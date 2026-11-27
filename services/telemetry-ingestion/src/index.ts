import type { AuthContext, TelemetryEvent } from "../../../packages/shared-contracts/src/index.js";

export type IngestResult =
  | { status: "accepted"; duplicate: false }
  | { status: "accepted"; duplicate: true }
  | { status: "rejected"; code: "tenant_mismatch" | "unredacted_payload" | "invalid_schema" };

export class TelemetryIngestionService {
  private readonly seenKeys = new Set<string>();
  private readonly events: TelemetryEvent[] = [];

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

    const dedupeKey = `${auth.tenantId}::${event.idempotencyKey}`;
    if (this.seenKeys.has(dedupeKey)) {
      return { status: "accepted", duplicate: true };
    }
    this.seenKeys.add(dedupeKey);
    this.events.push(event);
    return { status: "accepted", duplicate: false };
  }

  listForTenant(auth: AuthContext): readonly TelemetryEvent[] {
    return this.events.filter((evt) => evt.tenantId === auth.tenantId);
  }
}
