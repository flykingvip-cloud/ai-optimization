import fs from "node:fs";
import type { TelemetryEvent } from "../../../packages/shared-contracts/src/index.js";
import {
  BoundedTelemetryClient,
  type WalPersistStage,
} from "../../../packages/telemetry-sdk/src/index.js";

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

const walPath = process.env.WAL_PATH;
const stageFile = process.env.WAL_STAGE_FILE;
const readyFile = process.env.WAL_READY_FILE;
const pauseAt = process.env.WAL_PAUSE_AT as WalPersistStage | undefined;
const skipHits = Number(process.env.WAL_SKIP_STAGE_HITS ?? "0");
const mode = process.env.WAL_MODE ?? "enqueue";
const eventA = process.env.WAL_EVENT_A ?? "evt_a";
const eventB = process.env.WAL_EVENT_B ?? "evt_b";

if (!walPath) {
  throw new Error("WAL_PATH is required");
}

let hits = 0;
const client = new BoundedTelemetryClient({
  walFilePath: walPath,
  transport: {
    async send() {
      // Success unless WAL_TRANSPORT=fail
      if (process.env.WAL_TRANSPORT === "fail") {
        throw new Error("transport_unavailable");
      }
    },
  },
  testHooks: {
    onStage(stage) {
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
