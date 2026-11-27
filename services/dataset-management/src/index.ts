import { createHash } from "node:crypto";
import type { OptimizationDatabase } from "../../../packages/shared-contracts/src/db.js";
import type {
  AuthContext,
  DatasetCase,
  DatasetSplit,
} from "../../../packages/shared-contracts/src/index.js";
import { scanForSecretsAndPii, type ScanReport } from "./scanner.js";

export interface DatasetVersionRecord {
  readonly datasetId: string;
  readonly version: string;
  readonly tenantId: string;
  readonly split: DatasetSplit;
  readonly contentHash: string;
  readonly cases: readonly DatasetCase[];
  readonly scanReports: readonly ScanReport[];
  readonly createdAt: string;
}

export class DatasetGovernanceError extends Error {
  constructor(
    public readonly code:
      | "tenant_mismatch"
      | "version_immutable"
      | "unauthorized_source"
      | "unredacted_case"
      | "pii_or_secret_detected"
      | "contamination_detected"
      | "not_found",
    message: string,
  ) {
    super(message);
  }
}

export class DatasetManagementService {
  private readonly versions = new Map<string, DatasetVersionRecord>();
  private readonly goldenHashesByTenant = new Map<string, Set<string>>();
  private readonly db: OptimizationDatabase | undefined;

  constructor(db?: OptimizationDatabase) {
    this.db = db;
  }

  private versionKey(tenantId: string, datasetId: string, version: string): string {
    return `${tenantId}::${datasetId}::${version}`;
  }

  private getGoldenHashes(tenantId: string): Set<string> {
    if (!this.db) {
      return this.goldenHashesByTenant.get(tenantId) ?? new Set<string>();
    }
    const rows = this.db.db
      .prepare("SELECT cases_json FROM dataset_versions WHERE tenant_id = ? AND split IN ('golden', 'evaluation')")
      .all(tenantId) as Array<{ cases_json: string }>;
    const set = new Set<string>();
    for (const row of rows) {
      const cases = JSON.parse(row.cases_json) as DatasetCase[];
      for (const c of cases) set.add(c.contentHash);
    }
    return set;
  }

  publishVersion(
    auth: AuthContext,
    params: {
      datasetId: string;
      version: string;
      split: DatasetSplit;
      cases: readonly (DatasetCase & { readonly contentPayload?: unknown })[];
      nowIso?: string;
    },
  ): DatasetVersionRecord {
    const key = this.versionKey(auth.tenantId, params.datasetId, params.version);
    const existsInDb = this.db
      ? Boolean(
          this.db.db
            .prepare("SELECT 1 FROM dataset_versions WHERE tenant_id = ? AND dataset_id = ? AND version = ?")
            .get(auth.tenantId, params.datasetId, params.version),
        )
      : this.versions.has(key);

    if (existsInDb) {
      throw new DatasetGovernanceError(
        "version_immutable",
        `DatasetVersion ${params.datasetId}@${params.version} is immutable`,
      );
    }

    const goldenHashes = this.getGoldenHashes(auth.tenantId);
    const scanReports: ScanReport[] = [];

    for (const c of params.cases) {
      if (c.tenantId !== auth.tenantId) {
        throw new DatasetGovernanceError("tenant_mismatch", "Cross-tenant case rejected");
      }
      if (!c.sourceAuthorization.authorized) {
        throw new DatasetGovernanceError("unauthorized_source", `Case ${c.caseId} lacks authorization`);
      }
      if (c.redactionStatus === "pending_review") {
        throw new DatasetGovernanceError("unredacted_case", `Case ${c.caseId} is not redacted`);
      }
      const scan = scanForSecretsAndPii(c);
      scanReports.push(scan);
      if (scan.riskLevel === "high") {
        throw new DatasetGovernanceError(
          "pii_or_secret_detected",
          `Case ${c.caseId} blocked by active scanner: ${scan.findings.join(", ")}`,
        );
      }
      if (params.split === "train_candidate" && goldenHashes.has(c.contentHash)) {
        throw new DatasetGovernanceError(
          "contamination_detected",
          `Case ${c.caseId} overlaps with golden/evaluation split`,
        );
      }
    }

    if (!this.db && (params.split === "golden" || params.split === "evaluation")) {
      for (const c of params.cases) {
        goldenHashes.add(c.contentHash);
      }
      this.goldenHashesByTenant.set(auth.tenantId, goldenHashes);
    }

    const contentHash = createHash("sha256")
      .update(JSON.stringify(params.cases.map((c) => c.contentHash).toSorted()))
      .digest("hex");

    const sanitizedCases = params.cases.map(({ contentPayload: _ignored, ...rest }) => rest);
    const createdAt = params.nowIso ?? new Date().toISOString();

    const record: DatasetVersionRecord = {
      datasetId: params.datasetId,
      version: params.version,
      tenantId: auth.tenantId,
      split: params.split,
      contentHash,
      cases: sanitizedCases,
      scanReports,
      createdAt,
    };

    if (this.db) {
      this.db.db
        .prepare(
          "INSERT INTO dataset_versions (tenant_id, dataset_id, version, split, content_hash, cases_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          auth.tenantId,
          params.datasetId,
          params.version,
          params.split,
          contentHash,
          JSON.stringify(sanitizedCases),
          createdAt,
        );
    } else {
      this.versions.set(key, record);
    }
    return record;
  }

  getVersion(auth: AuthContext, datasetId: string, version: string): DatasetVersionRecord {
    if (this.db) {
      const row = this.db.db
        .prepare(
          "SELECT split, content_hash, cases_json, created_at FROM dataset_versions WHERE tenant_id = ? AND dataset_id = ? AND version = ?",
        )
        .get(auth.tenantId, datasetId, version) as
        | { split: DatasetSplit; content_hash: string; cases_json: string; created_at: string }
        | undefined;
      if (!row) {
        throw new DatasetGovernanceError("not_found", "DatasetVersion not found for tenant");
      }
      return {
        datasetId,
        version,
        tenantId: auth.tenantId,
        split: row.split,
        contentHash: row.content_hash,
        cases: JSON.parse(row.cases_json) as DatasetCase[],
        scanReports: [],
        createdAt: row.created_at,
      };
    }
    const found = this.versions.get(this.versionKey(auth.tenantId, datasetId, version));
    if (!found) {
      throw new DatasetGovernanceError("not_found", "DatasetVersion not found for tenant");
    }
    return found;
  }

  deleteVersion(auth: AuthContext, datasetId: string, version: string): boolean {
    if (this.db) {
      const res = this.db.db
        .prepare("DELETE FROM dataset_versions WHERE tenant_id = ? AND dataset_id = ? AND version = ?")
        .run(auth.tenantId, datasetId, version);
      return Number(res.changes) > 0;
    }
    return this.versions.delete(this.versionKey(auth.tenantId, datasetId, version));
  }
}
