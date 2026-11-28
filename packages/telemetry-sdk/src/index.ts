import fs from "node:fs";
import path from "node:path";
import type { TelemetryEvent } from "../../shared-contracts/src/index.js";
import { ExclusiveWalLock, TelemetryWalLockError } from "./wal-lock.js";

export { TelemetryWalLockError } from "./wal-lock.js";

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

const MAX_DROP_AUDIT = 32;

export type TelemetryDropReason = "max_queue_items" | "max_wal_bytes" | "enqueue_error";

export interface TelemetryDropAudit {
  readonly reason: TelemetryDropReason;
  readonly eventId: string;
  readonly idempotencyKey: string;
  readonly droppedAt: string;
}

export type WalPersistStage =
  | "afterTmpPartialWrite"
  | "afterTmpMarkedComplete"
  | "afterRename"
  | "afterParentDirFsync"
  | "afterTransportSend"
  | "afterDurableCleanup";

/**
 * Test-only hooks for crash-injection. Not part of the production contract.
 * A hook may block (e.g. sleep forever) so a test harness can SIGKILL the process
 * at a known persist/flush stage.
 */
export interface TelemetryClientTestHooks {
  readonly onStage?: (stage: WalPersistStage) => void;
}

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
  readonly testHooks?: TelemetryClientTestHooks;
}

export interface TelemetryClientMetrics {
  readonly queuedCount: number;
  readonly droppedCount: number;
  readonly droppedByMaxQueueItems: number;
  readonly droppedByMaxWalBytes: number;
  readonly droppedByEnqueueError: number;
  readonly exportErrorCount: number;
  readonly exportedCount: number;
  readonly walWriteErrorCount: number;
  readonly walDirFsyncCount: number;
  readonly walDirFsyncErrorCount: number;
  readonly walBytes: number;
  readonly recentDrops: readonly TelemetryDropAudit[];
}

/**
 * Non-blocking, bounded-queue telemetry client with a single-writer disk WAL.
 *
 * Crash-consistency contract (process crash, same host):
 * - The commit point of a new WAL snapshot is the atomic rename of a *complete*
 *   tmp file over the final WAL path (or unlink of the final path when empty).
 * - A leftover `.tmp.<pid>.partial` file is never promoted. It is discarded
 *   even if it happens to contain parsable JSON, because it may be truncated.
 * - A leftover `.tmp.<pid>.complete` file is promoted only when the final WAL
 *   is missing (first persist, or previous unlink). If the final WAL still
 *   exists, the leftover complete tmp is discarded: the pre-rename WAL remains
 *   the durable state.
 * - After rename or unlink, the parent directory is fsynced when the OS
 *   supports it. This is a durability *intent* for power loss of the directory
 *   entry; it is not evidence that a real power cut was tested.
 * - flush() does not clear the WAL before transport.send succeeds. After
 *   success, the remaining queue is durably persisted, or the WAL is unlinked
 *   if empty. A crash after send and before that cleanup may replay events
 *   (at-least-once). Consumers must treat idempotencyKey as the idempotency
 *   key. This client does not provide exactly-once delivery.
 *
 * Concurrency: one writer per walFilePath. A second live client is refused
 * with TelemetryWalLockError. close() releases the lock; a leftover lock after
 * SIGKILL is treated as stale once the holder is no longer alive.
 */
export class BoundedTelemetryClient {
  private readonly maxQueueItems: number;
  private readonly maxWalBytes: number;
  private readonly walFilePath: string | undefined;
  private readonly transport: TelemetryTransport;
  private readonly testHooks: TelemetryClientTestHooks | undefined;
  private readonly queue: TelemetryEvent[] = [];
  private readonly dropAudit: TelemetryDropAudit[] = [];
  private droppedCount = 0;
  private droppedByMaxQueueItems = 0;
  private droppedByMaxWalBytes = 0;
  private droppedByEnqueueError = 0;
  private exportErrorCount = 0;
  private exportedCount = 0;
  private walWriteErrorCount = 0;
  private walDirFsyncCount = 0;
  private walDirFsyncErrorCount = 0;
  private walLock: ExclusiveWalLock | undefined;
  private walEnabled = false;
  private closed = false;
  /** Events handed to transport.send but not yet acknowledged. Included in WAL snapshots until success or re-queue. */
  private inFlightBatch: TelemetryEvent[] | undefined;

  constructor(options: TelemetryClientOptions) {
    this.maxQueueItems = Math.max(1, options.maxQueueItems ?? 10_000);
    this.maxWalBytes = Math.max(256, options.maxWalBytes ?? 64 * 1024 * 1024);
    this.transport = options.transport;
    this.testHooks = options.testHooks;
    if (options.walFilePath) {
      this.walFilePath = path.resolve(options.walFilePath);
      this.acquireWalLockAndRecover();
    } else {
      this.walFilePath = undefined;
    }
  }

  private acquireWalLockAndRecover(): void {
    if (!this.walFilePath) return;
    const acquired = ExclusiveWalLock.acquire(this.walFilePath);
    if (!acquired.ok) {
      this.walWriteErrorCount += 1;
      if (acquired.reason === "contended") {
        throw acquired.error;
      }
      return;
    }
    this.walLock = acquired.lock;
    this.walEnabled = true;
    try {
      this.reconcileLeftoverTmps();
      this.recoverFromWal();
    } catch {
      this.walWriteErrorCount += 1;
    }
  }

  private tmpPrefix(): string {
    return `${this.walFilePath}.tmp.`;
  }

  private listTmpFiles(): ReadonlyArray<{ readonly path: string; readonly kind: "partial" | "complete" | "other" }> {
    if (!this.walFilePath) return [];
    const dir = path.dirname(this.walFilePath);
    const prefix = path.basename(this.tmpPrefix());
    let names: string[] = [];
    try {
      names = fs.readdirSync(dir);
    } catch {
      return [];
    }
    const out: Array<{ path: string; kind: "partial" | "complete" | "other" }> = [];
    for (const name of names) {
      if (!name.startsWith(prefix)) continue;
      const full = path.join(dir, name);
      if (name.endsWith(".partial")) {
        out.push({ path: full, kind: "partial" });
      } else if (name.endsWith(".complete")) {
        out.push({ path: full, kind: "complete" });
      } else {
        out.push({ path: full, kind: "other" });
      }
    }
    return out;
  }

  private unlinkQuietly(filePath: string): void {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.walWriteErrorCount += 1;
      }
    }
  }

  /**
   * Leftover tmp policy:
   * - `.partial` is never a promotion candidate (may be mid-write / truncated).
   * - `.complete` may be promoted only if the final WAL is missing AND exactly
   *   one complete tmp is present. Multiple complete tmps are fail-closed
   *   (none are promoted) because a unique uncommitted snapshot cannot be chosen
   *   safely. The files are left in place for inspection and counted as errors.
   * - If the final WAL exists, every leftover tmp is discarded. The pre-rename
   *   (or already committed) WAL is the durable state.
   */
  private reconcileLeftoverTmps(): void {
    if (!this.walFilePath) return;
    const tmps = this.listTmpFiles();
    if (tmps.length === 0) return;
    const finalExists = fs.existsSync(this.walFilePath);
    const complete = tmps.filter((t) => t.kind === "complete");
    if (!finalExists && complete.length === 1 && complete[0]) {
      try {
        fs.renameSync(complete[0].path, this.walFilePath);
        this.fsyncParentDirectory();
      } catch {
        this.walWriteErrorCount += 1;
      }
    } else if (!finalExists && complete.length > 1) {
      this.walWriteErrorCount += 1;
      // Do not promote or delete complete tmps when the choice would be ambiguous.
      for (const tmp of tmps) {
        if (tmp.kind !== "complete") {
          this.unlinkQuietly(tmp.path);
        }
      }
      return;
    }
    for (const tmp of this.listTmpFiles()) {
      this.unlinkQuietly(tmp.path);
    }
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
            const evicted = this.queue.shift();
            this.recordDrop("max_queue_items", evicted);
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

  private fsyncParentDirectory(): void {
    if (!this.walFilePath) return;
    const dir = path.dirname(this.walFilePath);
    let fd: number | undefined;
    try {
      const flags =
        typeof fs.constants.O_DIRECTORY === "number"
          ? fs.constants.O_RDONLY | fs.constants.O_DIRECTORY
          : fs.constants.O_RDONLY;
      fd = fs.openSync(dir, flags);
      fs.fsyncSync(fd);
      this.walDirFsyncCount += 1;
    } catch {
      this.walDirFsyncErrorCount += 1;
    } finally {
      if (fd !== undefined) {
        try {
          fs.closeSync(fd);
        } catch {
          // ignore
        }
      }
    }
  }

  private persistableEvents(): TelemetryEvent[] {
    return this.inFlightBatch && this.inFlightBatch.length > 0
      ? this.inFlightBatch.concat(this.queue)
      : this.queue;
  }

  private evictUntilWithinWalBudget(): string {
    let events = this.persistableEvents();
    let content = this.serializeEvents(events);
    while (events.length > 0 && Buffer.byteLength(content, "utf8") > this.maxWalBytes) {
      const evicted =
        this.inFlightBatch && this.inFlightBatch.length > 0 ? this.inFlightBatch.shift() : this.queue.shift();
      this.recordDrop("max_wal_bytes", evicted);
      events = this.persistableEvents();
      content = this.serializeEvents(events);
    }
    return content;
  }

  private serializeEvents(events: readonly TelemetryEvent[]): string {
    return events.map((e) => JSON.stringify(e)).join("\n") + (events.length ? "\n" : "");
  }

  private persistWalAtomic(): void {
    if (!this.walFilePath || !this.walEnabled || this.closed) return;
    try {
      fs.mkdirSync(path.dirname(this.walFilePath), { recursive: true });
      const content = this.evictUntilWithinWalBudget();
      if (this.persistableEvents().length === 0) {
        this.commitEmptyWal();
        return;
      }
      const tmpPartial = `${this.walFilePath}.tmp.${process.pid}.partial`;
      const tmpComplete = `${this.walFilePath}.tmp.${process.pid}.complete`;
      this.unlinkQuietly(tmpPartial);
      this.unlinkQuietly(tmpComplete);
      const payload = Buffer.from(content, "utf8");
      const splitAt = Math.max(1, Math.min(payload.length, Math.floor(payload.length / 2)));
      const fd = fs.openSync(tmpPartial, "w", 0o600);
      try {
        fs.writeSync(fd, payload.subarray(0, splitAt));
        this.invokeHook("afterTmpPartialWrite");
        fs.writeSync(fd, payload.subarray(splitAt));
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      fs.renameSync(tmpPartial, tmpComplete);
      this.fsyncParentDirectory();
      this.invokeHook("afterTmpMarkedComplete");
      fs.renameSync(tmpComplete, this.walFilePath);
      this.invokeHook("afterRename");
      this.fsyncParentDirectory();
      this.invokeHook("afterParentDirFsync");
    } catch {
      this.walWriteErrorCount += 1;
    }
  }

  /**
   * Durable cleanup of an empty queue: unlink the final WAL if it exists,
   * discard leftover tmp files, then fsync the parent directory. Recovery after
   * this commit must not resurrect exported events. Writing an empty file is
   * intentionally avoided so absence of the WAL is the cleanup contract.
   */
  private commitEmptyWal(): void {
    if (!this.walFilePath) return;
    if (fs.existsSync(this.walFilePath)) {
      fs.unlinkSync(this.walFilePath);
    }
    for (const tmp of this.listTmpFiles()) {
      this.unlinkQuietly(tmp.path);
    }
    this.fsyncParentDirectory();
    this.invokeHook("afterParentDirFsync");
    this.invokeHook("afterDurableCleanup");
  }

  private invokeHook(stage: WalPersistStage): void {
    this.testHooks?.onStage?.(stage);
  }

  private recordDrop(reason: TelemetryDropReason, evicted: TelemetryEvent | undefined): void {
    this.droppedCount += 1;
    if (reason === "max_queue_items") {
      this.droppedByMaxQueueItems += 1;
    } else if (reason === "max_wal_bytes") {
      this.droppedByMaxWalBytes += 1;
    } else {
      this.droppedByEnqueueError += 1;
    }
    this.dropAudit.push({
      reason,
      eventId: evicted?.eventId ?? "",
      idempotencyKey: evicted?.idempotencyKey ?? "",
      droppedAt: new Date().toISOString(),
    });
    if (this.dropAudit.length > MAX_DROP_AUDIT) {
      this.dropAudit.shift();
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
        const evicted = this.queue.shift();
        this.recordDrop("max_queue_items", evicted);
      }
      this.queue.push(sanitized);
      this.persistWalAtomic();
    } catch {
      this.recordDrop("enqueue_error", event);
    }
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }
    const batch = this.queue.splice(0, this.queue.length);
    this.inFlightBatch = batch;
    try {
      await this.transport.send(batch);
      this.invokeHook("afterTransportSend");
      this.exportedCount += batch.length;
      this.inFlightBatch = undefined;
      // Persist only after send succeeds. Remaining queue may contain events
      // enqueued during send; persist (or unlink) that snapshot. The in-flight
      // batch stays in WAL snapshots until this point so a concurrent enqueue
      // cannot drop unacknowledged events from disk.
      this.persistWalAtomic();
    } catch {
      this.exportErrorCount += 1;
      this.inFlightBatch = undefined;
      for (const evt of batch) {
        if (this.queue.length >= this.maxQueueItems) {
          const evicted = this.queue.shift();
          this.recordDrop("max_queue_items", evicted);
        }
        this.queue.push(evt);
      }
      this.persistWalAtomic();
    }
  }

  /**
   * Release the exclusive WAL lock and disable further WAL writes.
   * Idempotent. Does not flush outstanding events.
   */
  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.walEnabled = false;
    const lock = this.walLock;
    this.walLock = undefined;
    lock?.close();
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
      droppedByMaxQueueItems: this.droppedByMaxQueueItems,
      droppedByMaxWalBytes: this.droppedByMaxWalBytes,
      droppedByEnqueueError: this.droppedByEnqueueError,
      exportErrorCount: this.exportErrorCount,
      exportedCount: this.exportedCount,
      walWriteErrorCount: this.walWriteErrorCount,
      walDirFsyncCount: this.walDirFsyncCount,
      walDirFsyncErrorCount: this.walDirFsyncErrorCount,
      walBytes,
      recentDrops: this.dropAudit.slice(),
    };
  }
}
