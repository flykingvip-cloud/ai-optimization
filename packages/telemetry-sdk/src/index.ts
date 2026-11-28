import fs from "node:fs";
import path from "node:path";
import type { TelemetryEvent } from "../../shared-contracts/src/index.js";
import { ExclusiveWalLock, TelemetryWalLockError } from "./wal-lock.js";

export { TelemetryWalLockError } from "./wal-lock.js";

export class TelemetryWalInitError extends Error {
  readonly code = "WAL_INIT_FAILED" as const;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TelemetryWalInitError";
  }
}

export class TelemetryWalIoError extends Error {
  readonly code = "WAL_IO_FAILED" as const;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TelemetryWalIoError";
  }
}

export type TelemetryWalStatus = "disabled" | "enabled" | "io_failed";

export function walCleanupSentinelPath(walFilePath: string): string {
  return `${walFilePath}.cleanup`;
}

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

export type TelemetryDropReason = "max_queue_items" | "max_wal_bytes" | "wal_capacity_refused" | "enqueue_error";

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
  | "afterCleanupSentinel"
  | "afterCleanupTmpsRemoved"
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
  readonly droppedByWalCapacityRefused: number;
  readonly walDirFsyncCount: number;
  readonly walDirFsyncErrorCount: number;
  readonly walBytes: number;
  readonly walStatus: TelemetryWalStatus;
  readonly inFlightCount: number;
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
 * - flush() is serialized. Concurrent flush() calls wait in line; a waiting
 *   flush only sends what remains in the pending queue after the prior flush
 *   finishes. Unconfirmed in-flight events stay in the durable snapshot until
 *   send succeeds (or they are re-queued after failure). After success, the
 *   remaining queue is durably persisted, or the WAL is unlinked if empty.
 *   A crash after send and before that cleanup may replay events
 *   (at-least-once). Consumers must treat idempotencyKey as the idempotency
 *   key. This client does not provide exactly-once delivery.
 * - Capacity eviction never deletes unconfirmed in-flight events. Pending
 *   (not-yet-sent) queue events may be evicted under maxWalBytes. A new event
 *   that cannot fit alongside the unconfirmed in-flight set is refused and
 *   audited; the in-flight set is left intact.
 * - Post-send empty cleanup writes a durable `${wal}.cleanup` sentinel first,
 *   then removes leftover tmp files (including `.complete`), then unlinks the
 *   final WAL. Recovery never promotes a `.complete` when that sentinel is
 *   present, so a leftover complete from an already-exported batch cannot be
 *   resurrected if a crash hits the cleanup window.
 * - After WAL initialization succeeds, later WAL read/write failures throw
 *   TelemetryWalIoError and mark walStatus=io_failed. The client does not
 *   silently continue as if persistence were still healthy.
 *
 * Concurrency: one writer per walFilePath. Live exclusivity is a Linux
 * abstract Unix socket plus a lock cookie; a second live client is refused
 * with TelemetryWalLockError. If walFilePath is set but initialization fails,
 * construction throws TelemetryWalInitError (fail-closed). close() unlinks the
 * lock cookie only while the socket is still held and only if it still belongs
 * to this holder, then releases the socket.
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
  private droppedByWalCapacityRefused = 0;
  private droppedByEnqueueError = 0;
  private exportErrorCount = 0;
  private exportedCount = 0;
  private walWriteErrorCount = 0;
  private walDirFsyncCount = 0;
  private walDirFsyncErrorCount = 0;
  private walLock: ExclusiveWalLock | undefined;
  private walEnabled = false;
  private walStatus: TelemetryWalStatus = "disabled";
  private closed = false;
  /** Unconfirmed batches handed to transport.send. Included in WAL snapshots until success or re-queue. */
  private readonly inFlightBatches: TelemetryEvent[][] = [];
  private flushChain: Promise<void> = Promise.resolve();

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
      throw new TelemetryWalInitError(
        `WAL initialization failed for "${this.walFilePath}": persistence is not enabled`,
        { cause: acquired.error },
      );
    }
    this.walLock = acquired.lock;
    try {
      this.reconcileLeftoverTmps();
      this.recoverFromWal();
      this.clearCleanupSentinelAfterRecover();
      this.walEnabled = true;
      this.walStatus = "enabled";
    } catch (error) {
      this.walWriteErrorCount += 1;
      this.walEnabled = false;
      this.walLock = undefined;
      acquired.lock.close();
      throw new TelemetryWalInitError(
        `WAL initialization failed for "${this.walFilePath}": persistence is not enabled`,
        { cause: error },
      );
    }
  }

  private tmpPrefix(): string {
    return `${this.walFilePath}.tmp.`;
  }

  private listTmpFiles(): ReadonlyArray<{ readonly path: string; readonly kind: "partial" | "complete" | "other" }> {
    if (!this.walFilePath) return [];
    const dir = path.dirname(this.walFilePath);
    const prefix = path.basename(this.tmpPrefix());
    let names: string[];
    try {
      names = fs.readdirSync(dir);
    } catch (error) {
      // ENOENT means the directory is gone; treat that as no leftovers.
      // Any other directory-read fault must fail closed so callers cannot
      // mistake an I/O error for "no temp files".
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
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

  /**
   * Leftover tmp policy:
   * - `.partial` is never a promotion candidate (may be mid-write / truncated).
   * - A `${wal}.cleanup` sentinel means post-send durable cleanup had started.
   *   In that case leftover `.complete` files are never promoted, even if the
   *   final WAL is missing, because they may contain already-exported events.
   * - Otherwise `.complete` may be promoted only if the final WAL is missing
   *   AND exactly one complete tmp is present. Multiple complete tmps are
   *   fail-closed (none are promoted).
   * - If the final WAL exists, every leftover tmp is discarded. The pre-rename
   *   (or already committed) WAL is the durable state.
   */
  private reconcileLeftoverTmps(): void {
    if (!this.walFilePath) return;
    const tmps = this.listTmpFiles();
    const sentinelExists = fs.existsSync(walCleanupSentinelPath(this.walFilePath));
    const finalExists = fs.existsSync(this.walFilePath);
    const complete = tmps.filter((t) => t.kind === "complete");
    if (sentinelExists) {
      // Cleanup intent is to retire exported events. Never promote a complete.
      for (const tmp of tmps) {
        this.unlinkRequired(tmp.path);
      }
      this.fsyncParentDirectoryOrThrow();
      return;
    }
    if (tmps.length === 0) return;
    if (!finalExists && complete.length === 1 && complete[0]) {
      fs.renameSync(complete[0].path, this.walFilePath);
      this.fsyncParentDirectoryOrThrow();
    } else if (!finalExists && complete.length > 1) {
      this.walWriteErrorCount += 1;
      throw new Error(
        `Refusing to promote leftover WAL complete files for "${this.walFilePath}": multiple complete temps are present`,
      );
    }
    for (const tmp of this.listTmpFiles()) {
      this.unlinkRequired(tmp.path);
    }
    this.fsyncParentDirectoryOrThrow();
  }

  private clearCleanupSentinelAfterRecover(): void {
    if (!this.walFilePath) return;
    const sentinel = walCleanupSentinelPath(this.walFilePath);
    if (!fs.existsSync(sentinel)) return;
    this.unlinkRequired(sentinel);
    this.fsyncParentDirectoryOrThrow();
  }

  private recoverFromWal(): void {
    if (!this.walFilePath) return;
    let raw: string;
    try {
      if (!fs.existsSync(this.walFilePath)) return;
      raw = fs.readFileSync(this.walFilePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      this.walWriteErrorCount += 1;
      throw error;
    }
    const lines = raw.split("\n").filter(Boolean);
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
  }

  private fsyncParentDirectory(): void {
    try {
      this.fsyncParentDirectoryOrThrow();
    } catch {
      this.walDirFsyncErrorCount += 1;
    }
  }

  private fsyncParentDirectoryOrThrow(): void {
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
    } catch (error) {
      this.walDirFsyncErrorCount += 1;
      throw error;
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

  private unlinkRequired(filePath: string): void {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.walWriteErrorCount += 1;
        throw error;
      }
    }
  }

  private inFlightEvents(): TelemetryEvent[] {
    const events: TelemetryEvent[] = [];
    for (const batch of this.inFlightBatches) {
      events.push(...batch);
    }
    return events;
  }

  private persistableEvents(): TelemetryEvent[] {
    return this.inFlightEvents().concat(this.queue);
  }

  private evictUntilWithinWalBudget(): string {
    // Never evict unconfirmed in-flight events to make room. Only pending
    // (not-yet-sent) queue events are droppable under maxWalBytes. If the
    // snapshot is still over budget, the remainder is in-flight and is kept.
    let content = this.serializeEvents(this.persistableEvents());
    while (this.queue.length > 0 && Buffer.byteLength(content, "utf8") > this.maxWalBytes) {
      const evicted = this.queue.shift();
      this.recordDrop("max_wal_bytes", evicted);
      content = this.serializeEvents(this.persistableEvents());
    }
    return content;
  }

  private serializeEvents(events: readonly TelemetryEvent[]): string {
    return events.map((e) => JSON.stringify(e)).join("\n") + (events.length ? "\n" : "");
  }

  private persistWalAtomic(): void {
    if (!this.walFilePath || this.closed) return;
    if (this.walStatus === "io_failed") {
      throw new TelemetryWalIoError(`WAL I/O has already failed for "${this.walFilePath}"`);
    }
    if (!this.walEnabled) return;
    try {
      fs.mkdirSync(path.dirname(this.walFilePath), { recursive: true });
      const content = this.evictUntilWithinWalBudget();
      if (this.persistableEvents().length === 0) {
        this.commitEmptyWal();
        return;
      }
      const tmpPartial = `${this.walFilePath}.tmp.${process.pid}.partial`;
      const tmpComplete = `${this.walFilePath}.tmp.${process.pid}.complete`;
      this.unlinkRequired(tmpPartial);
      this.unlinkRequired(tmpComplete);
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
      this.fsyncParentDirectoryOrThrow();
      this.invokeHook("afterTmpMarkedComplete");
      fs.renameSync(tmpComplete, this.walFilePath);
      this.invokeHook("afterRename");
      this.fsyncParentDirectoryOrThrow();
      this.invokeHook("afterParentDirFsync");
    } catch (error) {
      this.markWalIoFailed(error);
      throw new TelemetryWalIoError(`WAL write failed for "${this.walFilePath}"`, { cause: error });
    }
  }

  private markWalIoFailed(error: unknown): void {
    this.walWriteErrorCount += 1;
    this.walStatus = "io_failed";
    this.walEnabled = false;
    void error;
  }

  /**
   * Durable cleanup of an empty queue. Order is fail-closed against
   * `.complete` resurrection:
   * 1. Write and fsync a cleanup sentinel so recovery will not promote leftover completes.
   * 2. Remove leftover tmp files, including `.complete`.
   * 3. Unlink the final WAL.
   * 4. Remove the sentinel.
   * Writing an empty file is intentionally avoided so absence of the WAL is
   * the cleanup contract. send success alone is not this commit; the WAL
   * lifecycle completes only after this durable cleanup.
   */
  private commitEmptyWal(): void {
    if (!this.walFilePath) return;
    const sentinel = walCleanupSentinelPath(this.walFilePath);
    const fd = fs.openSync(sentinel, "w", 0o600);
    try {
      fs.writeSync(fd, '{"reason":"post-send-empty-cleanup"}\n', 0, "utf8");
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    this.fsyncParentDirectoryOrThrow();
    this.invokeHook("afterCleanupSentinel");
    for (const tmp of this.listTmpFiles()) {
      this.unlinkRequired(tmp.path);
    }
    this.fsyncParentDirectoryOrThrow();
    this.invokeHook("afterCleanupTmpsRemoved");
    if (fs.existsSync(this.walFilePath)) {
      fs.unlinkSync(this.walFilePath);
    }
    this.unlinkRequired(sentinel);
    this.fsyncParentDirectoryOrThrow();
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
    } else if (reason === "wal_capacity_refused") {
      this.droppedByWalCapacityRefused += 1;
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
    if (this.walStatus === "io_failed") {
      this.recordDrop("enqueue_error", event);
      throw new TelemetryWalIoError(
        this.walFilePath
          ? `WAL I/O has already failed for "${this.walFilePath}"`
          : "WAL I/O has already failed",
      );
    }
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
      const inFlightPlusNew = this.serializeEvents([...this.inFlightEvents(), sanitized]);
      if (Buffer.byteLength(inFlightPlusNew, "utf8") > this.maxWalBytes) {
        // Cannot fit this event without deleting unconfirmed in-flight data.
        this.recordDrop("wal_capacity_refused", sanitized);
        return;
      }
      this.queue.push(sanitized);
      this.persistWalAtomic();
    } catch (error) {
      if (error instanceof TelemetryWalIoError) {
        throw error;
      }
      this.recordDrop("enqueue_error", event);
    }
  }

  async flush(): Promise<void> {
    const run = this.flushChain.then(() => this.flushSerialized());
    this.flushChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async flushSerialized(): Promise<void> {
    if (this.closed) {
      return;
    }
    if (this.walStatus === "io_failed") {
      throw new TelemetryWalIoError(
        this.walFilePath
          ? `WAL I/O has already failed for "${this.walFilePath}"`
          : "WAL I/O has already failed",
      );
    }
    if (this.queue.length === 0) {
      return;
    }
    const batch = this.queue.splice(0, this.queue.length);
    this.inFlightBatches.push(batch);
    try {
      await this.transport.send(batch);
      this.invokeHook("afterTransportSend");
      this.removeInFlightBatch(batch);
      // Persist only after send succeeds. Remaining queue may contain events
      // enqueued during send; persist (or unlink) that snapshot. Unconfirmed
      // in-flight events stay in WAL snapshots until this point.
      // exportedCount is increased only after durable cleanup/persist, because
      // send success alone does not complete the WAL lifecycle.
      this.persistWalAtomic();
      this.exportedCount += batch.length;
    } catch (error) {
      this.removeInFlightBatch(batch);
      for (const evt of batch) {
        if (this.queue.length >= this.maxQueueItems) {
          const evicted = this.queue.shift();
          this.recordDrop("max_queue_items", evicted);
        }
        this.queue.push(evt);
      }
      if (error instanceof TelemetryWalIoError) {
        throw error;
      }
      this.exportErrorCount += 1;
      this.persistWalAtomic();
    }
  }

  private removeInFlightBatch(batch: TelemetryEvent[]): void {
    const idx = this.inFlightBatches.indexOf(batch);
    if (idx >= 0) {
      this.inFlightBatches.splice(idx, 1);
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
      droppedByWalCapacityRefused: this.droppedByWalCapacityRefused,
      droppedByEnqueueError: this.droppedByEnqueueError,
      exportErrorCount: this.exportErrorCount,
      exportedCount: this.exportedCount,
      walWriteErrorCount: this.walWriteErrorCount,
      walDirFsyncCount: this.walDirFsyncCount,
      walDirFsyncErrorCount: this.walDirFsyncErrorCount,
      walBytes,
      walStatus: this.walStatus,
      inFlightCount: this.inFlightEvents().length,
      recentDrops: this.dropAudit.slice(),
    };
  }
}
