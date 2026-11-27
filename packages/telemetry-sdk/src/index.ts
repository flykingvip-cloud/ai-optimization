import type { TelemetryEvent } from "../../shared-contracts/src/index.js";

const SECRET_PATTERNS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bsk-[A-Za-z0-9._-]{8,}\b/g, replacement: "sk-***" },
  { pattern: /\bBearer\s+[A-Za-z0-9._-]+\b/gi, replacement: "Bearer ***" },
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

export interface TelemetryTransport {
  send(batch: readonly TelemetryEvent[]): Promise<void>;
}

export interface TelemetryClientOptions {
  readonly maxQueueItems?: number;
  readonly transport: TelemetryTransport;
}

export interface TelemetryClientMetrics {
  readonly queuedCount: number;
  readonly droppedCount: number;
  readonly exportErrorCount: number;
  readonly exportedCount: number;
}

/**
 * Non-blocking, bounded-queue Telemetry client for OpenBot Runtime.
 * Never throws or blocks the caller's critical execution path.
 */
export class BoundedTelemetryClient {
  private readonly maxQueueItems: number;
  private readonly transport: TelemetryTransport;
  private readonly queue: TelemetryEvent[] = [];
  private droppedCount = 0;
  private exportErrorCount = 0;
  private exportedCount = 0;

  constructor(options: TelemetryClientOptions) {
    this.maxQueueItems = Math.max(1, options.maxQueueItems ?? 10_000);
    this.transport = options.transport;
  }

  enqueue(event: TelemetryEvent): void {
    try {
      const sanitized: TelemetryEvent = {
        ...event,
        redaction: { ...event.redaction, applied: true },
        payload: JSON.parse(redactText(JSON.stringify(event.payload))) as Record<string, unknown>,
      };
      if (this.queue.length >= this.maxQueueItems) {
        this.queue.shift();
        this.droppedCount += 1;
      }
      this.queue.push(sanitized);
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
    } catch {
      this.exportErrorCount += 1;
      for (const evt of batch) {
        if (this.queue.length >= this.maxQueueItems) {
          this.queue.shift();
          this.droppedCount += 1;
        }
        this.queue.push(evt);
      }
    }
  }

  getMetrics(): TelemetryClientMetrics {
    return {
      queuedCount: this.queue.length,
      droppedCount: this.droppedCount,
      exportErrorCount: this.exportErrorCount,
      exportedCount: this.exportedCount,
    };
  }
}
