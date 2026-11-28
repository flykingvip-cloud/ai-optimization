import fs from "node:fs";
import path from "node:path";

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

interface LockPayload {
  readonly pid: number;
  readonly starttime: string;
  readonly createdAt: string;
}

/**
 * Exclusive single-writer lock for one walFilePath.
 *
 * This is a cooperating lockfile protocol (O_EXCL create + pid/starttime liveness),
 * not a kernel flock/fcntl lock. A process that ignores the protocol can still
 * write the WAL. The lock file is released by close(), and a leftover lock after
 * SIGKILL is treated as stale once the holder pid is no longer alive with the
 * recorded starttime. On Linux, starttime is read from /proc to mitigate pid reuse.
 * This helper does not claim power-loss durability for the lock file itself.
 */
export class ExclusiveWalLock {
  private readonly lockPath: string;
  private fd: number | undefined;
  private released = false;

  private constructor(lockPath: string, fd: number) {
    this.lockPath = lockPath;
    this.fd = fd;
  }

  static lockPathFor(walFilePath: string): string {
    return `${walFilePath}.lock`;
  }

  static acquire(walFilePath: string): WalLockAcquireResult {
    const lockPath = ExclusiveWalLock.lockPathFor(walFilePath);
    try {
      fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    } catch (error) {
      return { ok: false, reason: "io_error", error };
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR, 0o600);
        try {
          const payload: LockPayload = {
            pid: process.pid,
            starttime: readProcessStarttime(process.pid) ?? "",
            createdAt: new Date().toISOString(),
          };
          fs.writeSync(fd, `${JSON.stringify(payload)}\n`, 0, "utf8");
          fs.fsyncSync(fd);
        } catch (error) {
          try {
            fs.closeSync(fd);
          } catch {
            // ignore close errors while rolling back a failed lock create
          }
          try {
            fs.unlinkSync(lockPath);
          } catch {
            // ignore
          }
          return { ok: false, reason: "io_error", error };
        }
        return { ok: true, lock: new ExclusiveWalLock(lockPath, fd) };
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "EEXIST") {
          return { ok: false, reason: "io_error", error };
        }

        const existing = readLockPayloadWithRetry(lockPath);
        if (existing === "unreadable") {
          return {
            ok: false,
            reason: "contended",
            error: new TelemetryWalLockError(
              `Refusing to open WAL "${walFilePath}": lock file ${lockPath} exists but is unreadable`,
            ),
          };
        }
        if (existing === "empty" || (existing && !isHolderAlive(existing))) {
          try {
            fs.unlinkSync(lockPath);
            continue;
          } catch (unlinkError) {
            const unlinkCode = (unlinkError as NodeJS.ErrnoException).code;
            if (unlinkCode === "ENOENT") {
              continue;
            }
            return { ok: false, reason: "io_error", error: unlinkError };
          }
        }
        const holder = existing ? `pid ${existing.pid}` : "another holder";
        return {
          ok: false,
          reason: "contended",
          error: new TelemetryWalLockError(
            `Refusing to open WAL "${walFilePath}": already locked by ${holder}`,
          ),
        };
      }
    }

    return {
      ok: false,
      reason: "contended",
      error: new TelemetryWalLockError(`Refusing to open WAL "${walFilePath}": lock acquisition retried out`),
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
    const fd = this.fd;
    this.fd = undefined;
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // still attempt unlink so a later process can acquire
      }
    }
    try {
      fs.unlinkSync(this.lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        // Leave a lock file only if unlink failed for a reason other than already gone.
        // The next acquirer will treat a dead pid as stale.
      }
    }
  }
}

function readLockPayloadWithRetry(lockPath: string): LockPayload | "empty" | "unreadable" {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const raw = fs.readFileSync(lockPath, "utf8").trim();
      if (raw.length === 0) {
        if (attempt < 2) {
          busyWait(10);
          continue;
        }
        return "empty";
      }
      const parsed = JSON.parse(raw.split("\n")[0]!) as Partial<LockPayload>;
      if (typeof parsed.pid !== "number" || !Number.isInteger(parsed.pid) || parsed.pid <= 0) {
        return "unreadable";
      }
      return {
        pid: parsed.pid,
        starttime: typeof parsed.starttime === "string" ? parsed.starttime : "",
        createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : "",
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return "empty";
      }
      if (attempt < 2) {
        busyWait(10);
        continue;
      }
      return "unreadable";
    }
  }
  return "unreadable";
}

function isHolderAlive(payload: LockPayload): boolean {
  if (!isPidAlive(payload.pid)) {
    return false;
  }
  const liveStart = readProcessStarttime(payload.pid);
  if (payload.starttime && liveStart && payload.starttime !== liveStart) {
    return false;
  }
  return true;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

export function readProcessStarttime(pid: number): string | undefined {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const closeParen = stat.lastIndexOf(")");
    if (closeParen < 0) {
      return undefined;
    }
    // Fields after comm: state is field 3, starttime is field 22.
    const rest = stat.slice(closeParen + 2).trim().split(" ");
    return rest[19];
  } catch {
    return undefined;
  }
}

function busyWait(ms: number): void {
  const sab = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(sab), 0, 0, ms);
}
