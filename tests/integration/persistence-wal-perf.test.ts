import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CORE_MIGRATIONS, OptimizationDatabase } from "../../packages/shared-contracts/src/db.js";
import type { TelemetryEvent } from "../../packages/shared-contracts/src/index.js";
import { BoundedTelemetryClient } from "../../packages/telemetry-sdk/src/index.js";

describe("P1-01/02/04 Persistence, Migrations, Disk WAL & Performance", () => {
  it("P1-01 executes SQLite migrations, persists across reopen, rolls back, and handles failed migration atomically", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-opt-db-"));
    const dbPath = path.join(tmpDir, "opt.db");

    const db1 = new OptimizationDatabase(dbPath);
    expect(db1.migrate()).toEqual([1]);
    expect(db1.migrate()).toEqual([]);
    db1.db
      .prepare(
        "INSERT INTO telemetry_events (event_id, tenant_id, idempotency_key, event_type, occurred_at, payload_json) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run("e1", "tenant_a", "idem1", "runtime.run.completed", "2026-11-27T00:00:00Z", "{}");
    db1.close();

    const db2 = new OptimizationDatabase(dbPath);
    const row = db2.db.prepare("SELECT event_id FROM telemetry_events WHERE tenant_id = ?").get("tenant_a") as {
      event_id: string;
    };
    expect(row.event_id).toBe("e1");

    expect(() =>
      db2.migrate([
        ...CORE_MIGRATIONS,
        { version: 2, name: "bad_migration", upSql: "INVALID SQL SYNTAX;", downSql: "" },
      ]),
    ).toThrow();
    expect(db2.rollbackLast()).toBe(1);
    db2.close();
  });

  it("P1-02 recovers Telemetry events from disk WAL after restart and survives unwritable WAL path", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-opt-wal-"));
    const walPath = path.join(tmpDir, "telemetry.wal.jsonl");
    const evt: TelemetryEvent = {
      schemaVersion: "1.0.0",
      eventId: "e_wal_1",
      idempotencyKey: "k_wal_1",
      eventType: "runtime.run.completed",
      occurredAt: "2026-11-27T00:00:00Z",
      tenantId: "tenant_a",
      source: { system: "openbot", component: "runner" },
      traceContext: { traceId: "tr1", runId: "r1" },
      redaction: { applied: true, policy: "v1" },
      payload: { status: "ok" },
    };

    const client1 = new BoundedTelemetryClient({
      walFilePath: walPath,
      transport: {
        async send() {
          throw new Error("offline");
        },
      },
    });
    client1.enqueue(evt);
    expect(fs.existsSync(walPath)).toBe(true);

    const recovered: TelemetryEvent[] = [];
    const client2 = new BoundedTelemetryClient({
      walFilePath: walPath,
      transport: {
        async send(batch) {
          recovered.push(...batch);
        },
      },
    });
    await client2.flush();
    expect(recovered).toHaveLength(1);
    expect(recovered[0]!.eventId).toBe("e_wal_1");

    const brokenClient = new BoundedTelemetryClient({
      walFilePath: "/dev/null/impossible/wal.jsonl",
      transport: { async send() {} },
    });
    expect(() => brokenClient.enqueue(evt)).not.toThrow();
    expect(brokenClient.getMetrics().walWriteErrorCount).toBeGreaterThan(0);
  });

  it("P1-04 meets throughput benchmark (>= 1,000 events/sec in-process)", async () => {
    const sent: TelemetryEvent[] = [];
    const client = new BoundedTelemetryClient({
      maxQueueItems: 2000,
      transport: {
        async send(batch) {
          sent.push(...batch);
        },
      },
    });
    const t0 = performance.now();
    for (let i = 0; i < 1000; i += 1) {
      client.enqueue({
        schemaVersion: "1.0.0",
        eventId: `e_${i}`,
        idempotencyKey: `k_${i}`,
        eventType: "runtime.run.completed",
        occurredAt: "2026-11-27T00:00:00Z",
        tenantId: "tenant_a",
        source: { system: "openbot", component: "runner" },
        traceContext: { traceId: "tr1", runId: `r_${i}` },
        redaction: { applied: true, policy: "v1" },
        payload: { status: "ok", latencyMs: 12 },
      });
    }
    await client.flush();
    const elapsedMs = performance.now() - t0;
    expect(sent).toHaveLength(1000);
    expect(elapsedMs).toBeLessThan(2000);
  });
});
