import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { TelemetryEvent } from "../../packages/shared-contracts/src/index.js";
import {
  BoundedTelemetryClient,
  TelemetryWalInitError,
  TelemetryWalLockError,
  type WalPersistStage,
} from "../../packages/telemetry-sdk/src/index.js";
import { ExclusiveWalLock } from "../../packages/telemetry-sdk/src/wal-lock.js";

const CHILD_PATH = fileURLToPath(new URL("./helpers/telemetry-wal-crash-child.ts", import.meta.url));
const CHILD_REGISTER_PATH = fileURLToPath(new URL("./helpers/ts-from-js-register.mjs", import.meta.url));

const openClients: BoundedTelemetryClient[] = [];

afterEach(() => {
  while (openClients.length > 0) {
    openClients.pop()?.close();
  }
});

function makeEvent(id: string): TelemetryEvent {
  return {
    schemaVersion: "1.0.0",
    eventId: id,
    idempotencyKey: `idem_${id}`,
    eventType: "runtime.run.completed",
    occurredAt: "2026-11-28T00:00:00Z",
    tenantId: "tenant_a",
    source: { system: "openbot", component: "wal-test" },
    traceContext: { traceId: "tr_p0_2", runId: id },
    redaction: { applied: true, policy: "v1" },
    payload: { status: "ok", latencyMs: 7 },
  };
}

function track(client: BoundedTelemetryClient): BoundedTelemetryClient {
  openClients.push(client);
  return client;
}

function newWalDir(): { dir: string; walPath: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-opt-p0-2-wal-"));
  return { dir, walPath: path.join(dir, "telemetry.wal.jsonl") };
}

function listTmps(walPath: string): string[] {
  const dir = path.dirname(walPath);
  const prefix = `${path.basename(walPath)}.tmp.`;
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(prefix))
    .map((name) => path.join(dir, name));
}

function eventIdsFromWal(walPath: string): string[] {
  if (!fs.existsSync(walPath)) return [];
  const ids: string[] = [];
  for (const line of fs.readFileSync(walPath, "utf8").split("\n").filter(Boolean)) {
    const evt = JSON.parse(line) as TelemetryEvent;
    ids.push(evt.eventId);
  }
  return ids;
}

async function killChildAtStage(options: {
  walPath: string;
  mode: string;
  pauseAt?: WalPersistStage | "hold-lock";
  skipHits?: number;
  eventA?: string;
  eventB?: string;
  holdLock?: boolean;
  transport?: "fail" | "ok";
}): Promise<{ stageFile: string }> {
  const dir = path.dirname(options.walPath);
  const stageFile = path.join(dir, "stage.signal");
  const readyFile = path.join(dir, "ready.signal");
  const child: ChildProcess = spawn(
    process.execPath,
    [
      "--experimental-strip-types",
      "--no-warnings=ExperimentalWarning",
      "--import",
      pathToFileURL(CHILD_REGISTER_PATH).href,
      CHILD_PATH,
    ],
    {
      env: {
        ...process.env,
        WAL_PATH: options.walPath,
        WAL_STAGE_FILE: stageFile,
        WAL_READY_FILE: readyFile,
        WAL_MODE: options.mode,
        WAL_PAUSE_AT: options.pauseAt && options.pauseAt !== "hold-lock" ? options.pauseAt : "",
        WAL_SKIP_STAGE_HITS: String(options.skipHits ?? 0),
        WAL_EVENT_A: options.eventA ?? "evt_a",
        WAL_EVENT_B: options.eventB ?? "evt_b",
        WAL_HOLD_LOCK: options.holdLock ? "1" : "0",
        WAL_TRANSPORT: options.transport ?? "ok",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const stderrChunks: Buffer[] = [];
  const stdoutChunks: Buffer[] = [];
  child.stderr?.on("data", (c: Buffer) => stderrChunks.push(c));
  child.stdout?.on("data", (c: Buffer) => stdoutChunks.push(c));
  try {
    await new Promise<void>((resolve, reject) => {
      const poll = setInterval(() => {
        if (fs.existsSync(stageFile)) {
          finish();
          resolve();
        }
      }, 20);
      const timer = setTimeout(() => {
        finish();
        reject(new Error(`Timed out waiting for ${stageFile}`));
      }, 8_000);
      const onExit = (code: number | null, signal: string | null) => {
        if (!fs.existsSync(stageFile)) {
          finish();
          reject(new Error(`child exited before reaching pause stage (code=${code} signal=${signal})`));
        }
      };
      const finish = () => {
        clearInterval(poll);
        clearTimeout(timer);
        child.off("exit", onExit);
      };
      child.once("exit", onExit);
    });
    if (child.pid === undefined) {
      throw new Error("child has no pid");
    }
    process.kill(child.pid, "SIGKILL");
    await new Promise<void>((resolve) => {
      child.on("exit", () => resolve());
      setTimeout(() => resolve(), 2000);
    });
    return { stageFile };
  } catch (error) {
    if (child.pid !== undefined) {
      try {
        process.kill(child.pid, "SIGKILL");
      } catch {
        // already gone
      }
    }
    const stderr = Buffer.concat(stderrChunks).toString("utf8");
    const stdout = Buffer.concat(stdoutChunks).toString("utf8");
    throw new Error(
      `crash child failed: ${(error as Error).message}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    );
  }
}

describe("P0-2 Telemetry WAL crash recovery, lock, leftover tmp, and flush cleanup", () => {
  // Child-process SIGKILL tests wait for a stage signal; keep a timeout above that wait.
  it("refuses a second live client on the same WAL path and does not overwrite the first writer's snapshot", () => {
    const { walPath } = newWalDir();
    const first = track(
      new BoundedTelemetryClient({
        walFilePath: walPath,
        transport: { async send() {} },
      }),
    );
    first.enqueue(makeEvent("evt_first"));
    expect(eventIdsFromWal(walPath)).toEqual(["evt_first"]);

    expect(
      () =>
        new BoundedTelemetryClient({
          walFilePath: walPath,
          transport: {
            async send() {
              throw new Error("must_not_flush");
            },
          },
        }),
    ).toThrow(TelemetryWalLockError);

    expect(eventIdsFromWal(walPath)).toEqual(["evt_first"]);
    first.enqueue(makeEvent("evt_first_2"));
    expect(eventIdsFromWal(walPath)).toEqual(["evt_first", "evt_first_2"]);
  });

  it("allows a successor client after close() and after SIGKILL of a lock-holding child", async () => {
    const { walPath } = newWalDir();
    const first = new BoundedTelemetryClient({
      walFilePath: walPath,
      transport: { async send() {} },
    });
    first.enqueue(makeEvent("evt_closed"));
    first.close();

    const afterClose = track(
      new BoundedTelemetryClient({
        walFilePath: walPath,
        transport: { async send() {} },
      }),
    );
    expect(afterClose.getMetrics().queuedCount).toBe(1);
    afterClose.close();

    await killChildAtStage({ walPath, mode: "enqueue", holdLock: true });
    const afterKill = track(
      new BoundedTelemetryClient({
        walFilePath: walPath,
        transport: { async send() {} },
      }),
    );
    expect(afterKill.getMetrics().queuedCount).toBe(1);
    expect(afterKill.getMetrics().queuedCount).toBeGreaterThanOrEqual(1);
  });

  it("discards a leftover partial tmp after SIGKILL mid-write and does not promote truncated data", async () => {
    const { walPath } = newWalDir();
    await killChildAtStage({ walPath, mode: "enqueue", pauseAt: "afterTmpPartialWrite", eventA: "evt_partial" });

    expect(fs.existsSync(walPath)).toBe(false);
    const leftovers = listTmps(walPath);
    expect(leftovers.some((p) => p.endsWith(".partial"))).toBe(true);
    for (const leftover of leftovers) {
      expect(leftover.endsWith(".complete")).toBe(false);
    }

    const recovered = track(
      new BoundedTelemetryClient({
        walFilePath: walPath,
        transport: { async send() {} },
      }),
    );
    expect(recovered.getMetrics().queuedCount).toBe(0);
    expect(fs.existsSync(walPath)).toBe(false);
    expect(listTmps(walPath).some((p) => p.endsWith(".partial"))).toBe(false);
  });

  it("promotes a leftover complete tmp when the final WAL is missing after SIGKILL", async () => {
    const { walPath } = newWalDir();
    await killChildAtStage({ walPath, mode: "enqueue", pauseAt: "afterTmpMarkedComplete", eventA: "evt_complete" });

    expect(fs.existsSync(walPath)).toBe(false);
    expect(listTmps(walPath).some((p) => p.endsWith(".complete"))).toBe(true);

    const recovered = track(
      new BoundedTelemetryClient({
        walFilePath: walPath,
        transport: { async send() {} },
      }),
    );
    expect(recovered.getMetrics().queuedCount).toBe(1);
    expect(eventIdsFromWal(walPath)).toEqual(["evt_complete"]);
    expect(listTmps(walPath)).toEqual([]);
  });

  it("discards a leftover complete tmp when the final WAL still exists and keeps the pre-rename snapshot", async () => {
    const { walPath } = newWalDir();
    await killChildAtStage({
      walPath,
      mode: "enqueue-then-update",
      pauseAt: "afterTmpMarkedComplete",
      skipHits: 1,
      eventA: "evt_committed",
      eventB: "evt_uncommitted",
    });

    expect(eventIdsFromWal(walPath)).toEqual(["evt_committed"]);
    expect(listTmps(walPath).some((p) => p.endsWith(".complete"))).toBe(true);

    const flushed: TelemetryEvent[] = [];
    const recovered = track(
      new BoundedTelemetryClient({
        walFilePath: walPath,
        transport: {
          async send(batch) {
            flushed.push(...batch);
          },
        },
      }),
    );
    expect(recovered.getMetrics().queuedCount).toBe(1);
    await recovered.flush();
    expect(flushed.map((e) => e.eventId)).toEqual(["evt_committed"]);
    expect(flushed.map((e) => e.eventId)).not.toContain("evt_uncommitted");
    expect(listTmps(walPath)).toEqual([]);
  });

  it("recovers events after SIGKILL following atomic rename onto the final WAL path", async () => {
    const { walPath } = newWalDir();
    await killChildAtStage({ walPath, mode: "enqueue", pauseAt: "afterRename", eventA: "evt_renamed" });

    expect(eventIdsFromWal(walPath)).toEqual(["evt_renamed"]);
    const recovered = track(
      new BoundedTelemetryClient({
        walFilePath: walPath,
        transport: { async send() {} },
      }),
    );
    expect(recovered.getMetrics().queuedCount).toBe(1);
  });

  it("records parent-directory fsync attempts after rename and does not treat that as a power-loss test", () => {
    const { walPath } = newWalDir();
    const client = track(
      new BoundedTelemetryClient({
        walFilePath: walPath,
        transport: { async send() {} },
      }),
    );
    client.enqueue(makeEvent("evt_fsync"));
    const metrics = client.getMetrics();
    expect(metrics.walDirFsyncCount).toBeGreaterThan(0);
    expect(metrics.walDirFsyncErrorCount).toBe(0);
    expect(eventIdsFromWal(walPath)).toEqual(["evt_fsync"]);
    // This assertion only shows that fsync(dir) was invoked successfully on this OS.
    // It is not a real power-cut test and must not be reported as 断电通过.
  });

  it("evicts oldest events under maxWalBytes and records drop metrics plus audit info", () => {
    const { walPath } = newWalDir();
    const probe = track(
      new BoundedTelemetryClient({
        walFilePath: walPath,
        transport: { async send() {} },
      }),
    );
    probe.enqueue(makeEvent("evt_evict_0"));
    const oneEventBytes = probe.getMetrics().walBytes;
    probe.close();
    fs.rmSync(walPath, { force: true });
    fs.rmSync(`${walPath}.lock`, { force: true });
    expect(oneEventBytes).toBeGreaterThan(0);

    const client = track(
      new BoundedTelemetryClient({
        walFilePath: walPath,
        // Fit one pending event but not two, so later enqueues evict the oldest pending.
        maxWalBytes: oneEventBytes + 32,
        transport: { async send() {} },
      }),
    );
    for (let i = 0; i < 8; i += 1) {
      client.enqueue(makeEvent(`evt_evict_${i}`));
    }
    const metrics = client.getMetrics();
    expect(metrics.droppedCount).toBeGreaterThanOrEqual(1);
    expect(metrics.droppedByMaxWalBytes).toBeGreaterThanOrEqual(1);
    expect(metrics.droppedByMaxWalBytes).toBe(metrics.droppedCount);
    expect(metrics.walBytes).toBeLessThanOrEqual(oneEventBytes + 32);
    expect(metrics.recentDrops.length).toBeGreaterThanOrEqual(1);
    expect(metrics.recentDrops.every((d) => d.reason === "max_wal_bytes")).toBe(true);
    expect(metrics.recentDrops.every((d) => d.eventId.startsWith("evt_evict_"))).toBe(true);
    expect(metrics.recentDrops.every((d) => d.idempotencyKey.startsWith("idem_evt_evict_"))).toBe(true);
    expect(metrics.recentDrops.every((d) => d.droppedAt.length > 0)).toBe(true);
  });

  it("replays events if the process crashes after a successful send but before durable WAL cleanup", async () => {
    const { walPath } = newWalDir();
    const sink = new Map<string, number>();
    await killChildAtStage({
      walPath,
      mode: "flush-success",
      pauseAt: "afterTransportSend",
      eventA: "evt_replay",
    });

    expect(eventIdsFromWal(walPath)).toEqual(["evt_replay"]);

    const recovered = track(
      new BoundedTelemetryClient({
        walFilePath: walPath,
        transport: {
          async send(batch) {
            for (const evt of batch) {
              sink.set(evt.idempotencyKey, (sink.get(evt.idempotencyKey) ?? 0) + 1);
            }
          },
        },
      }),
    );
    await recovered.flush();
    expect(recovered.getMetrics().exportedCount).toBe(1);
    expect(sink.get("idem_evt_replay")).toBe(1);
    // The child already "sent" once (process-local, lost) and this recovery send is a
    // second delivery attempt. At-least-once replay is expected; uniqueness is by
    // idempotencyKey at the consumer. After durable cleanup the WAL must be gone.
    expect(fs.existsSync(walPath)).toBe(false);
  });

  it("does not resurrect exported events after a durable post-flush WAL cleanup", async () => {
    const { walPath } = newWalDir();
    const sent: TelemetryEvent[] = [];
    const client = track(
      new BoundedTelemetryClient({
        walFilePath: walPath,
        transport: {
          async send(batch) {
            sent.push(...batch);
          },
        },
      }),
    );
    client.enqueue(makeEvent("evt_cleaned"));
    expect(fs.existsSync(walPath)).toBe(true);
    await client.flush();
    expect(sent.map((e) => e.eventId)).toEqual(["evt_cleaned"]);
    expect(fs.existsSync(walPath)).toBe(false);
    expect(listTmps(walPath)).toEqual([]);
    expect(client.getMetrics().walDirFsyncCount).toBeGreaterThan(0);
    client.close();

    const recovered = track(
      new BoundedTelemetryClient({
        walFilePath: walPath,
        transport: {
          async send() {
            throw new Error("must_not_resend");
          },
        },
      }),
    );
    expect(recovered.getMetrics().queuedCount).toBe(0);
    await recovered.flush();
    expect(recovered.getMetrics().exportedCount).toBe(0);
    expect(fs.existsSync(walPath)).toBe(false);
  });

  it("replays a full batch after transport failure even if a consumer already accepted part of it, and the consumer can dedupe by idempotencyKey", async () => {
    const { walPath } = newWalDir();
    const accepted = new Map<string, TelemetryEvent>();
    let attempts = 0;
    const client = track(
      new BoundedTelemetryClient({
        walFilePath: walPath,
        transport: {
          async send(batch) {
            attempts += 1;
            // Partial batch success: first event is retained by the consumer, then the
            // send fails. The client cannot know this and must retry the full batch.
            accepted.set(batch[0]!.idempotencyKey, batch[0]!);
            if (attempts === 1) {
              throw new Error("partial_then_fail");
            }
            for (const evt of batch) {
              accepted.set(evt.idempotencyKey, evt);
            }
          },
        },
      }),
    );
    client.enqueue(makeEvent("evt_partial_1"));
    client.enqueue(makeEvent("evt_partial_2"));
    await client.flush();
    expect(client.getMetrics().exportErrorCount).toBe(1);
    expect(client.getMetrics().exportedCount).toBe(0);
    expect(eventIdsFromWal(walPath)).toEqual(["evt_partial_1", "evt_partial_2"]);

    await client.flush();
    expect(attempts).toBe(2);
    expect(client.getMetrics().exportedCount).toBe(2);
    expect([...accepted.keys()].sort()).toEqual(["idem_evt_partial_1", "idem_evt_partial_2"]);
    expect(fs.existsSync(walPath)).toBe(false);
  });

  it("keeps in-flight flush events in the WAL if a concurrent enqueue persists before send returns", async () => {
    const { walPath } = newWalDir();
    let releaseSend: (() => void) | undefined;
    const sendGate = new Promise<void>((resolve) => {
      releaseSend = resolve;
    });
    let sendStarted = false;
    const sent: string[] = [];
    const client = track(
      new BoundedTelemetryClient({
        walFilePath: walPath,
        transport: {
          async send(batch) {
            sendStarted = true;
            await sendGate;
            sent.push(...batch.map((e) => e.eventId));
          },
        },
      }),
    );
    client.enqueue(makeEvent("evt_in_flight"));
    const flushDone = client.flush();
    const startedAt = Date.now();
    while (!sendStarted) {
      if (Date.now() - startedAt > 5_000) {
        throw new Error("transport.send did not start");
      }
      await new Promise((r) => setTimeout(r, 5));
    }
    client.enqueue(makeEvent("evt_during_send"));
    expect(eventIdsFromWal(walPath)).toEqual(["evt_in_flight", "evt_during_send"]);
    releaseSend?.();
    await flushDone;
    expect(sent).toEqual(["evt_in_flight"]);
    expect(client.getMetrics().exportedCount).toBe(1);
    expect(eventIdsFromWal(walPath)).toEqual(["evt_during_send"]);
    await client.flush();
    expect(sent).toEqual(["evt_in_flight", "evt_during_send"]);
    expect(fs.existsSync(walPath)).toBe(false);
  });

  it("overlapping flushes keep all unconfirmed events in the WAL snapshot and recoverable after close", async () => {
    const { walPath } = newWalDir();
    let releaseFirstSend: (() => void) | undefined;
    const firstSendGate = new Promise<void>((resolve) => {
      releaseFirstSend = resolve;
    });
    let sendStarts = 0;
    const sent: string[] = [];
    const client = track(
      new BoundedTelemetryClient({
        walFilePath: walPath,
        transport: {
          async send(batch) {
            sendStarts += 1;
            if (sendStarts === 1) {
              await firstSendGate;
            }
            sent.push(...batch.map((e) => e.eventId));
          },
        },
      }),
    );
    client.enqueue(makeEvent("evt_flush_a"));
    const flush1 = client.flush();
    const startedAt = Date.now();
    while (sendStarts < 1) {
      if (Date.now() - startedAt > 5_000) {
        throw new Error("first transport.send did not start");
      }
      await new Promise((r) => setTimeout(r, 5));
    }
    client.enqueue(makeEvent("evt_flush_b"));
    const flush2 = client.flush();
    client.enqueue(makeEvent("evt_flush_c"));
    expect(eventIdsFromWal(walPath)).toEqual(["evt_flush_a", "evt_flush_b", "evt_flush_c"]);
    expect(client.getMetrics().inFlightCount).toBe(1);
    expect(client.getMetrics().queuedCount).toBe(2);

    // Release the lock without completing send so a successor can recover the snapshot.
    client.close();
    const recovered = track(
      new BoundedTelemetryClient({
        walFilePath: walPath,
        transport: { async send() {} },
      }),
    );
    expect(recovered.getMetrics().queuedCount).toBe(3);
    recovered.close();

    releaseFirstSend?.();
    await flush1;
    await flush2;
    // The original client was closed before cleanup, so recovery still sees the unconfirmed set.
    expect(eventIdsFromWal(walPath)).toEqual(["evt_flush_a", "evt_flush_b", "evt_flush_c"]);
  });

  it("does not evict unconfirmed in-flight events under WAL capacity pressure and refuses events that cannot fit", async () => {
    const { walPath } = newWalDir();
    let releaseSend: (() => void) | undefined;
    const sendGate = new Promise<void>((resolve) => {
      releaseSend = resolve;
    });
    let sendStarted = false;
    const probe = track(
      new BoundedTelemetryClient({
        walFilePath: walPath,
        transport: { async send() {} },
      }),
    );
    probe.enqueue(makeEvent("evt_size_probe"));
    const inFlightBytes = probe.getMetrics().walBytes;
    probe.close();
    fs.rmSync(walPath, { force: true });
    fs.rmSync(`${walPath}.lock`, { force: true });
    expect(inFlightBytes).toBeGreaterThan(0);

    const client = track(
      new BoundedTelemetryClient({
        walFilePath: walPath,
        maxWalBytes: inFlightBytes + 32,
        transport: {
          async send() {
            sendStarted = true;
            await sendGate;
          },
        },
      }),
    );
    expect(client.getMetrics().walStatus).toBe("enabled");
    client.enqueue(makeEvent("evt_kept_in_flight"));
    const flushDone = client.flush();
    const startedAt = Date.now();
    while (!sendStarted) {
      if (Date.now() - startedAt > 5_000) {
        throw new Error("transport.send did not start");
      }
      await new Promise((r) => setTimeout(r, 5));
    }
    expect(eventIdsFromWal(walPath)).toEqual(["evt_kept_in_flight"]);

    client.enqueue(makeEvent("evt_cannot_fit"));
    const metrics = client.getMetrics();
    expect(metrics.droppedByWalCapacityRefused).toBe(1);
    expect(metrics.droppedCount).toBe(1);
    expect(metrics.recentDrops.some((d) => d.reason === "wal_capacity_refused" && d.eventId === "evt_cannot_fit")).toBe(
      true,
    );
    expect(eventIdsFromWal(walPath)).toEqual(["evt_kept_in_flight"]);
    expect(eventIdsFromWal(walPath)).not.toContain("evt_cannot_fit");

    client.close();
    const recoveredEvents: string[] = [];
    const recovered = track(
      new BoundedTelemetryClient({
        walFilePath: walPath,
        maxWalBytes: inFlightBytes + 32,
        transport: {
          async send(batch) {
            recoveredEvents.push(...batch.map((e) => e.eventId));
          },
        },
      }),
    );
    expect(recovered.getMetrics().queuedCount).toBe(1);
    await recovered.flush();
    expect(recoveredEvents).toEqual(["evt_kept_in_flight"]);
    expect(recoveredEvents).not.toContain("evt_cannot_fit");
    expect(fs.existsSync(walPath)).toBe(false);

    releaseSend?.();
    await flushDone;
  });

  it("treats an empty lock file as contention and does not unlink it", () => {
    const { walPath } = newWalDir();
    const lockPath = ExclusiveWalLock.lockPathFor(walPath);
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, "", "utf8");
    expect(
      () =>
        new BoundedTelemetryClient({
          walFilePath: walPath,
          transport: { async send() {} },
        }),
    ).toThrow(TelemetryWalLockError);
    expect(fs.existsSync(lockPath)).toBe(true);
    expect(fs.readFileSync(lockPath, "utf8")).toBe("");
  });

  it("does not unlink a lock file that no longer belongs to the releasing holder", () => {
    const { walPath } = newWalDir();
    const acquired = ExclusiveWalLock.acquire(walPath);
    if (!acquired.ok) {
      throw new Error("expected to acquire lock");
    }
    const lockPath = acquired.lock.path;
    const foreign = {
      pid: 1,
      starttime: "not-ours",
      createdAt: "2026-11-28T00:00:00.000Z",
    };
    fs.writeFileSync(lockPath, `${JSON.stringify(foreign)}\n`, "utf8");
    acquired.lock.close();
    expect(fs.existsSync(lockPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(lockPath, "utf8"))).toEqual(foreign);
  });

  it("fails closed with a distinct error when WAL initialization cannot be completed", () => {
    expect(
      () =>
        new BoundedTelemetryClient({
          walFilePath: "/dev/null/impossible/wal.jsonl",
          transport: { async send() {} },
        }),
    ).toThrow(TelemetryWalInitError);
    const memoryOnly = track(
      new BoundedTelemetryClient({
        transport: { async send() {} },
      }),
    );
    expect(memoryOnly.getMetrics().walStatus).toBe("disabled");
  });
}, 15_000);
