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
 * Non-blocking, bounded-queue + bounded-disk-WAL Telemetry client for OpenBot Runtime.
 * Never throws or blocks the caller's critical execution path.
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
    this.maxWalBytes = Math.max(1024, options.maxWalBytes ?? 64 * 1024 * 1024);
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
        const evt = JSON.parse(line) as TelemetryEvent;
        if (this.queue.length >= this.maxQueueItems) {
          this.queue.shift();
          this.droppedCount += 1;
        }
        this.queue.push(evt);
      }
    } catch {
      this.walWriteErrorCount += 1;
    }
  }

  private persistWalSnapshot(): void {
    if (!this.walFilePath) return;
    try {
      fs.mkdirSync(path.dirname(this.walFilePath), { recursive: true });
      const content = this.queue.map((e) => JSON.stringify(e)).join("\n") + (this.queue.length ? "\n" : "");
      if (Buffer.byteLength(content, "utf8") > this.maxWalBytes) {
        this.walWriteErrorCount += 1;
        return;
      }
      fs.writeFileSync(this.walFilePath, content, "utf8");
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
      this.persistWalSnapshot();
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
      this.persistWalSnapshot();
    } catch {
      this.exportErrorCount += 1;
      for (const evt of batch) {
        if (this.queue.length >= this.maxQueueItems) {
          this.queue.shift();
          this.droppedCount += 1;
        }
        this.queue.push(evt);
      }
      this.persistWalSnapshot();
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
