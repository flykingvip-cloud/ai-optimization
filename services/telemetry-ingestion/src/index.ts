import type { OptimizationDatabase } from "../../../packages/shared-contracts/src/db.js";
import type { AuthContext, TelemetryEvent } from "../../../packages/shared-contracts/src/index.js";

export type IngestResult =
  | { status: "accepted"; duplicate: false }
  | { status: "accepted"; duplicate: true }
  | { status: "rejected"; code: "tenant_mismatch" | "unredacted_payload" | "invalid_schema" };

export class TelemetryIngestionService {
  private readonly seenKeys = new Set<string>();
  private readonly events: TelemetryEvent[] = [];
  private readonly db: OptimizationDatabase | undefined;

  constructor(db?: OptimizationDatabase) {
    this.db = db;
  }

  ingest(auth: AuthContext, event: TelemetryEvent): IngestResult {
    if (!event.eventId || !event.idempotencyKey || !event.traceContext?.runId) {
      return { status: "rejected", code: "invalid_schema" };
    }
    if (event.tenantId !== auth.tenantId) {
      return { status: "rejected", code: "tenant_mismatch" };
    }
    if (!event.redaction?.applied) {
      return { status: "rejected", code: "unredacted_payload" };
    }

    if (this.db) {
      const res = this.db.db
        .prepare(
          "INSERT OR IGNORE INTO telemetry_events (event_id, tenant_id, idempotency_key, event_type, occurred_at, payload_json) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          event.eventId,
          auth.tenantId,
          event.idempotencyKey,
          event.eventType,
          event.occurredAt,
          JSON.stringify(event),
        );
      return { status: "accepted", duplicate: Number(res.changes) === 0 };
    }

    const dedupeKey = `${auth.tenantId}::${event.idempotencyKey}`;
    if (this.seenKeys.has(dedupeKey)) {
      return { status: "accepted", duplicate: true };
    }
    this.seenKeys.add(dedupeKey);
    this.events.push(event);
    return { status: "accepted", duplicate: false };
  }

  listForTenant(auth: AuthContext): readonly TelemetryEvent[] {
    if (this.db) {
      const rows = this.db.db
        .prepare("SELECT payload_json FROM telemetry_events WHERE tenant_id = ?")
        .all(auth.tenantId) as Array<{ payload_json: string }>;
      return rows.map((r) => JSON.parse(r.payload_json) as TelemetryEvent);
    }
    return this.events.filter((evt) => evt.tenantId === auth.tenantId);
  }
}
