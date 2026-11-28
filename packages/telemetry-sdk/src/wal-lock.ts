import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Worker } from "node:worker_threads";

export class TelemetryWalLockError extends Error {
  readonly code = "WAL_LOCK_UNAVAILABLE" as const;

  constructor(message: string) {
    super(message);
    this.name = "TelemetryWalLockError";
  }
}

export type WalLockAcquireResult =
  | { readonly ok: true; readonly lock: ExclusiveWalLock }
  | { readonly ok: false; readonly reason: "contended"; readonly error: TelemetryWalLockError }
  | { readonly ok: false; readonly reason: "io_error"; readonly error: unknown };

export interface ExclusiveWalLockTestHooks {
  /**
   * Test-only hook invoked after the first ownership check and before unlink
   * during close(), so a test can replace the lock file and verify close()
   * re-checks identity instead of unlinking a new holder's file.
   */
  readonly beforeLockFileUnlink?: () => void;
}

interface LockPayload {
  readonly pid: number;
  readonly starttime: string;
  readonly createdAt: string;
}

/**
 * Exclusive single-writer lock for one walFilePath.
 *
 * Live exclusivity on Linux is a process-lifetime abstract Unix socket
 * (`\0aiopt-wal-<sha256(walPath)>`). bind(2) in the abstract namespace is
 * exclusive, and the kernel releases the name when the process dies (including
 * SIGKILL). That avoids the check-then-unlink-then-O_EXCL race of a path-based
 * lockfile: two recoverers cannot both steal a newly created lock by unlinking
 * it, and a live holder cannot have its name stolen by stale-recovery unlink.
 *
 * The `${walFilePath}.lock` cookie still records pid/starttime. It is written
 * only after the socket is held, so overwriting a stale or empty leftover is
 * safe. An empty lock file with no live socket is treated as a crash leftover
 * and may be overwritten by the new holder; an empty file left by a live
 * mid-init holder is protected because that holder already owns the socket.
 * close() unlinks the cookie only while the socket is still held, and only if
 * a re-checked pid+starttime still matches this holder, then releases the
 * socket. That closes the close()-time TOCTOU window: a successor cannot
 * become the live holder until after unlink has finished.
 *
 * This is still a cooperating protocol (a process that ignores the socket can
 * still write the WAL). It is not a kernel flock on the WAL itself. Abstract
 * sockets are Linux-only; other platforms fail closed. This helper does not
 * claim power-loss durability for the lock cookie.
 */
export class ExclusiveWalLock {
  private readonly lockPath: string;
  private readonly payload: LockPayload;
  private readonly worker: Worker;
  private readonly releaseView: Int32Array;
  private readonly testHooks: ExclusiveWalLockTestHooks | undefined;
  private released = false;

  private constructor(
    lockPath: string,
    payload: LockPayload,
    worker: Worker,
    releaseView: Int32Array,
    testHooks: ExclusiveWalLockTestHooks | undefined,
  ) {
    this.lockPath = lockPath;
    this.payload = payload;
    this.worker = worker;
    this.releaseView = releaseView;
    this.testHooks = testHooks;
  }

  static lockPathFor(walFilePath: string): string {
    return `${walFilePath}.lock`;
  }

  static abstractSocketNameFor(walFilePath: string): string {
    const digest = createHash("sha256").update(path.resolve(walFilePath)).digest("hex");
    return `\0aiopt-wal-${digest}`;
  }

  static acquire(walFilePath: string, testHooks?: ExclusiveWalLockTestHooks): WalLockAcquireResult {
    if (process.platform !== "linux") {
      return {
        ok: false,
        reason: "io_error",
        error: new TelemetryWalLockError(
          `WAL exclusive live-lock requires Linux abstract Unix sockets; platform is ${process.platform}`,
        ),
      };
    }

    const lockPath = ExclusiveWalLock.lockPathFor(walFilePath);
    try {
      fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    } catch (error) {
      return { ok: false, reason: "io_error", error };
    }

    const bound = bindAbstractSocketSync(ExclusiveWalLock.abstractSocketNameFor(walFilePath));
    if (!bound.ok) {
      return bound;
    }

    const payload: LockPayload = {
      pid: process.pid,
      starttime: readProcessStarttime(process.pid) ?? "",
      createdAt: new Date().toISOString(),
    };
    try {
      const fd = fs.openSync(lockPath, "w", 0o600);
      try {
        fs.writeSync(fd, `${JSON.stringify(payload)}\n`, 0, "utf8");
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    } catch (error) {
      releaseAbstractSocketSync(bound.worker, bound.view);
      return { ok: false, reason: "io_error", error };
    }

    return {
      ok: true,
      lock: new ExclusiveWalLock(lockPath, payload, bound.worker, bound.view, testHooks),
    };
  }

  get path(): string {
    return this.lockPath;
  }

  close(): void {
    if (this.released) {
      return;
    }
    this.released = true;
    try {
      // Unlink the cookie only while this process still owns the abstract
      // socket, so a successor cannot become the live holder in between the
      // ownership check and unlink. Re-check after the test hook.
      let stillOurs = this.lockFileStillBelongsToHolder();
      this.testHooks?.beforeLockFileUnlink?.();
      stillOurs = this.lockFileStillBelongsToHolder();
      if (stillOurs) {
        try {
          fs.unlinkSync(this.lockPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            // Leave the file if unlink failed for a reason other than already gone.
          }
        }
      }
    } finally {
      releaseAbstractSocketSync(this.worker, this.releaseView);
    }
  }

  private lockFileStillBelongsToHolder(): boolean {
    try {
      const raw = fs.readFileSync(this.lockPath, "utf8").trim();
      if (raw.length === 0) {
        return false;
      }
      const parsed = JSON.parse(raw.split("\n")[0]!) as Partial<LockPayload>;
      return parsed.pid === this.payload.pid && (parsed.starttime ?? "") === this.payload.starttime;
    } catch {
      return false;
    }
  }
}

const SOCKET_WORKER_SOURCE = `
import net from "node:net";
import { parentPort, workerData } from "node:worker_threads";

const view = new Int32Array(workerData.sab);
const server = net.createServer();
server.on("error", (err) => {
  view[1] = err && err.code === "EADDRINUSE" ? 2 : 3;
  Atomics.store(view, 0, 1);
  Atomics.notify(view, 0);
});
server.listen({ path: workerData.path, exclusive: true }, () => {
  view[1] = 1;
  Atomics.store(view, 0, 1);
  Atomics.notify(view, 0);
});
parentPort.on("message", (msg) => {
  if (msg === "release") {
    server.close(() => {
      Atomics.store(view, 0, 2);
      Atomics.notify(view, 0);
    });
  }
});
`;

type BoundSocket =
  | { readonly ok: true; readonly worker: Worker; readonly view: Int32Array }
  | { readonly ok: false; readonly reason: "contended"; readonly error: TelemetryWalLockError }
  | { readonly ok: false; readonly reason: "io_error"; readonly error: unknown };

function bindAbstractSocketSync(abstractPath: string): BoundSocket {
  const sab = new SharedArrayBuffer(8);
  const view = new Int32Array(sab);
  const worker = new Worker(SOCKET_WORKER_SOURCE, {
    eval: true,
    type: "module",
    workerData: { path: abstractPath, sab },
  } as import("node:worker_threads").WorkerOptions);
  worker.on("error", () => {
    // The Atomics wait below is the acquire-time failure path. Later worker
    // failures release the socket automatically when the thread exits.
  });
  const wait = Atomics.wait(view, 0, 0, 3000);
  if (wait === "timed-out" || view[0] !== 1) {
    void worker.terminate();
    return {
      ok: false,
      reason: "io_error",
      error: new TelemetryWalLockError("Timed out binding WAL live-lock socket"),
    };
  }
  if (view[1] === 2) {
    void worker.terminate();
    return {
      ok: false,
      reason: "contended",
      error: new TelemetryWalLockError("WAL live-lock is already held by another process"),
    };
  }
  if (view[1] !== 1) {
    void worker.terminate();
    return {
      ok: false,
      reason: "io_error",
      error: new TelemetryWalLockError("Failed to bind WAL live-lock socket"),
    };
  }
  return { ok: true, worker, view };
}

function releaseAbstractSocketSync(worker: Worker, view: Int32Array): void {
  try {
    Atomics.store(view, 0, 0);
    worker.postMessage("release");
    Atomics.wait(view, 0, 0, 2000);
  } catch {
    // still terminate
  } finally {
    void worker.terminate();
  }
}

export function readProcessStarttime(pid: number): string | undefined {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const closeParen = stat.lastIndexOf(")");
    if (closeParen < 0) {
      return undefined;
    }
    const rest = stat.slice(closeParen + 2).trim().split(" ");
    return rest[19];
  } catch {
    return undefined;
  }
}
