import fs from "node:fs";
import path from "node:path";
import type { TelemetryEvent } from "../../shared-contracts/src/index.js";

export const REDACTION_POLICY_VERSION = "1.1.0";

const ALLOWED_PAYLOAD_FIELDS = new Set([
  "judgement",
  "status",
  "durationMs",
  "latencyMs",
  "tokensInput",
  "tokensOutput",
  "costUsd",
  "provider",
  "model",
  "modelVersion",
  "toolName",
  "toolOk",
  "errorCode",
  "feedbackPolarity",
  "artifactId",
  "deploymentStatus",
]);

const SECRET_PATTERNS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bsk-[A-Za-z0-9._-]{8,}\b/g, replacement: "sk-***" },
  { pattern: /\bBearer\s+[A-Za-z0-9._-]+\b/gi, replacement: "Bearer ***" },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: "***@***" },
  {
    pattern: /(\b(?:api[_-]?key|token|secret|password)\b\s*[:=]\s*)("?)([^"\s]+)("?)/gi,
    replacement: "$1$2***$4",
  },
];

export function redactText(input: string): string {
  let out = input;
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function sanitizeTelemetryPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!ALLOWED_PAYLOAD_FIELDS.has(key)) {
      continue;
    }
    if (typeof value === "string") {
      out[key] = redactText(value);
    } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
      out[key] = value;
    }
  }
  return out;
}

export interface TelemetryTransport {
  send(batch: readonly TelemetryEvent[]): Promise<void>;
}

export interface TelemetryClientOptions {
  readonly maxQueueItems?: number;
  readonly walFilePath?: string;
  readonly maxWalBytes?: number;
  readonly transport: TelemetryTransport;
}

export interface TelemetryClientMetrics {
  readonly queuedCount: number;
  readonly droppedCount: number;
  readonly exportErrorCount: number;
  readonly exportedCount: number;
  readonly walWriteErrorCount: number;
  readonly walBytes: number;
}

/**
 * Non-blocking, bounded-queue + crash-consistent atomic disk WAL Telemetry client.
 * Uses temp file + fsync + atomic rename so partial writes cannot corrupt the WAL.
 */
export class BoundedTelemetryClient {
  private readonly maxQueueItems: number;
  private readonly maxWalBytes: number;
  private readonly walFilePath: string | undefined;
  private readonly transport: TelemetryTransport;
  private readonly queue: TelemetryEvent[] = [];
  private droppedCount = 0;
  private exportErrorCount = 0;
  private exportedCount = 0;
  private walWriteErrorCount = 0;

  constructor(options: TelemetryClientOptions) {
    this.maxQueueItems = Math.max(1, options.maxQueueItems ?? 10_000);
    this.maxWalBytes = Math.max(256, options.maxWalBytes ?? 64 * 1024 * 1024);
    this.walFilePath = options.walFilePath;
    this.transport = options.transport;
    this.recoverFromWal();
  }

  private recoverFromWal(): void {
    if (!this.walFilePath) return;
    try {
      if (!fs.existsSync(this.walFilePath)) return;
      const lines = fs.readFileSync(this.walFilePath, "utf8").split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const evt = JSON.parse(line) as TelemetryEvent;
          if (this.queue.length >= this.maxQueueItems) {
            this.queue.shift();
            this.droppedCount += 1;
          }
          this.queue.push(evt);
        } catch {
          // Ignore corrupt trailing line while preserving valid prior records
          this.walWriteErrorCount += 1;
        }
      }
    } catch {
      this.walWriteErrorCount += 1;
    }
  }

  private persistWalAtomic(): void {
    if (!this.walFilePath) return;
    try {
      fs.mkdirSync(path.dirname(this.walFilePath), { recursive: true });
      // Evict oldest items until serialized WAL fits within maxWalBytes so new events persist
      let content = this.queue.map((e) => JSON.stringify(e)).join("\n") + (this.queue.length ? "\n" : "");
      while (this.queue.length > 0 && Buffer.byteLength(content, "utf8") > this.maxWalBytes) {
        this.queue.shift();
        this.droppedCount += 1;
        content = this.queue.map((e) => JSON.stringify(e)).join("\n") + (this.queue.length ? "\n" : "");
      }
      const tmpPath = `${this.walFilePath}.tmp.${process.pid}`;
      const fd = fs.openSync(tmpPath, "w", 0o600);
      try {
        fs.writeSync(fd, content, 0, "utf8");
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      fs.renameSync(tmpPath, this.walFilePath);
    } catch {
      this.walWriteErrorCount += 1;
    }
  }

  enqueue(event: TelemetryEvent): void {
    try {
      const sanitized: TelemetryEvent = {
        ...event,
        redaction: {
          applied: true,
          policy: `allowlist-${REDACTION_POLICY_VERSION}`,
          piiStripped: true,
        },
        payload: sanitizeTelemetryPayload(event.payload),
      };
      if (this.queue.length >= this.maxQueueItems) {
        this.queue.shift();
        this.droppedCount += 1;
      }
      this.queue.push(sanitized);
      this.persistWalAtomic();
    } catch {
      this.droppedCount += 1;
    }
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }
    const batch = this.queue.splice(0, this.queue.length);
    try {
      await this.transport.send(batch);
      this.exportedCount += batch.length;
      this.persistWalAtomic();
    } catch {
      this.exportErrorCount += 1;
      for (const evt of batch) {
        if (this.queue.length >= this.maxQueueItems) {
          this.queue.shift();
          this.droppedCount += 1;
        }
        this.queue.push(evt);
      }
      this.persistWalAtomic();
    }
  }

  getMetrics(): TelemetryClientMetrics {
    let walBytes = 0;
    if (this.walFilePath && fs.existsSync(this.walFilePath)) {
      try {
        walBytes = fs.statSync(this.walFilePath).size;
      } catch {
        walBytes = 0;
      }
    }
    return {
      queuedCount: this.queue.length,
      droppedCount: this.droppedCount,
      exportErrorCount: this.exportErrorCount,
      exportedCount: this.exportedCount,
      walWriteErrorCount: this.walWriteErrorCount,
      walBytes,
    };
  }
}
