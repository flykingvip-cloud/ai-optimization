import fs from "node:fs";
import type { TelemetryEvent } from "../../../packages/shared-contracts/src/index.js";
import {
  BoundedTelemetryClient,
  TelemetryWalLockError,
  type WalPersistStage,
} from "../../../packages/telemetry-sdk/src/index.js";
import { ExclusiveWalLock } from "../../../packages/telemetry-sdk/src/wal-lock.js";

function makeEvent(id: string): TelemetryEvent {
  return {
    schemaVersion: "1.0.0",
    eventId: id,
    idempotencyKey: `idem_${id}`,
    eventType: "runtime.run.completed",
    occurredAt: "2026-11-28T00:00:00Z",
    tenantId: "tenant_a",
    source: { system: "openbot", component: "wal-crash-child" },
    traceContext: { traceId: "tr_wal_crash", runId: id },
    redaction: { applied: true, policy: "v1" },
    payload: { status: "ok", latencyMs: 1 },
  };
}

function hangForever(): never {
  for (;;) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
}

function waitForFile(filePath: string): void {
  for (;;) {
    if (fs.existsSync(filePath)) {
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
  }
}

const walPath = process.env.WAL_PATH;
const stageFile = process.env.WAL_STAGE_FILE;
const readyFile = process.env.WAL_READY_FILE;
const resultFile = process.env.WAL_RESULT_FILE;
const goFile = process.env.WAL_GO_FILE;
const pauseAt = process.env.WAL_PAUSE_AT as WalPersistStage | undefined;
const skipHits = Number(process.env.WAL_SKIP_STAGE_HITS ?? "0");
const mode = process.env.WAL_MODE ?? "enqueue";
const eventA = process.env.WAL_EVENT_A ?? "evt_a";
const eventB = process.env.WAL_EVENT_B ?? "evt_b";

if (!walPath) {
  throw new Error("WAL_PATH is required");
}

if (mode === "race-acquire") {
  if (readyFile) {
    fs.writeFileSync(readyFile, `pid=${process.pid}\n`, "utf8");
  }
  if (goFile) {
    waitForFile(goFile);
  }
  try {
    const client = new BoundedTelemetryClient({
      walFilePath: walPath,
      transport: { async send() {} },
    });
    if (resultFile) {
      fs.writeFileSync(resultFile, JSON.stringify({ ok: true, pid: process.pid }), "utf8");
    }
    if (process.env.WAL_HOLD_LOCK === "1") {
      hangForever();
    }
    client.close();
  } catch (error) {
    const err = error as { name?: string; code?: string; message?: string };
    if (resultFile) {
      fs.writeFileSync(
        resultFile,
        JSON.stringify({
          ok: false,
          pid: process.pid,
          name: err.name ?? "Error",
          code: err.code ?? "",
          message: err.message ?? "",
        }),
        "utf8",
      );
    }
    if (!(error instanceof TelemetryWalLockError) && err.name !== "TelemetryWalLockError") {
      throw error;
    }
  }
  process.exit(0);
}

if (mode === "close-toctou") {
  const acquired = ExclusiveWalLock.acquire(walPath, {
    beforeLockFileUnlink: () => {
      if (stageFile) {
        fs.writeFileSync(stageFile, "before-unlink", "utf8");
      }
      if (goFile) {
        waitForFile(goFile);
      }
    },
  });
  if (!acquired.ok) {
    throw new Error("close-toctou child failed to acquire lock");
  }
  if (readyFile) {
    fs.writeFileSync(readyFile, `pid=${process.pid}\nlock=${acquired.lock.path}\n`, "utf8");
  }
  if (stageFile && !process.env.WAL_PAUSE_AT) {
    // Wait until the test is ready to enter close(); signal via WAL_GO_CLOSE.
    const closeGo = process.env.WAL_GO_CLOSE;
    if (closeGo) {
      waitForFile(closeGo);
    }
  }
  acquired.lock.close();
  if (resultFile) {
    fs.writeFileSync(resultFile, JSON.stringify({ closed: true, pid: process.pid }), "utf8");
  }
  process.exit(0);
}

let hits = 0;
const client = new BoundedTelemetryClient({
  walFilePath: walPath,
  transport: {
    async send() {
      if (process.env.WAL_TRANSPORT === "fail") {
        throw new Error("transport_unavailable");
      }
    },
  },
  testHooks: {
    onStage(stage) {
      if (stage === "afterTransportSend" && process.env.WAL_PLANT_STALE_COMPLETE === "1") {
        fs.copyFileSync(walPath, `${walPath}.tmp.${process.pid}.exported.complete`);
      }
      if (stage === "afterCleanupSentinel" && process.env.WAL_UNLINK_FINAL_IN_HOOK === "1") {
        try {
          fs.unlinkSync(walPath);
        } catch {
          // already gone
        }
      }
      if (!pauseAt || stage !== pauseAt) {
        return;
      }
      hits += 1;
      if (hits <= skipHits) {
        return;
      }
      if (stageFile) {
        fs.writeFileSync(stageFile, stage, "utf8");
      }
      hangForever();
    },
  },
});

if (readyFile) {
  fs.writeFileSync(readyFile, `pid=${process.pid}\n`, "utf8");
}

if (process.env.WAL_HOLD_LOCK === "1") {
  if (stageFile) {
    fs.writeFileSync(stageFile, "hold-lock", "utf8");
  }
  hangForever();
}

if (mode === "enqueue") {
  client.enqueue(makeEvent(eventA));
} else if (mode === "enqueue-then-update") {
  client.enqueue(makeEvent(eventA));
  client.enqueue(makeEvent(eventB));
} else if (mode === "flush-success") {
  client.enqueue(makeEvent(eventA));
  await client.flush();
} else {
  throw new Error(`Unknown WAL_MODE=${mode}`);
}

client.close();
