import { createHash } from "node:crypto";
import type {
  AuthContext,
  DatasetCase,
  DatasetSplit,
} from "../../../packages/shared-contracts/src/index.js";

export interface DatasetVersionRecord {
  readonly datasetId: string;
  readonly version: string;
  readonly tenantId: string;
  readonly split: DatasetSplit;
  readonly contentHash: string;
  readonly cases: readonly DatasetCase[];
  readonly createdAt: string;
}

export class DatasetGovernanceError extends Error {
  constructor(
    public readonly code:
      | "tenant_mismatch"
      | "version_immutable"
      | "unauthorized_source"
      | "unredacted_case"
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

  private versionKey(tenantId: string, datasetId: string, version: string): string {
    return `${tenantId}::${datasetId}::${version}`;
  }

  publishVersion(
    auth: AuthContext,
    params: {
      datasetId: string;
      version: string;
      split: DatasetSplit;
      cases: readonly DatasetCase[];
      nowIso?: string;
    },
  ): DatasetVersionRecord {
    const key = this.versionKey(auth.tenantId, params.datasetId, params.version);
    if (this.versions.has(key)) {
      throw new DatasetGovernanceError(
        "version_immutable",
        `DatasetVersion ${params.datasetId}@${params.version} is immutable`,
      );
    }

    const goldenHashes = this.goldenHashesByTenant.get(auth.tenantId) ?? new Set<string>();

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
      if (params.split === "train_candidate" && goldenHashes.has(c.contentHash)) {
        throw new DatasetGovernanceError(
          "contamination_detected",
          `Case ${c.caseId} overlaps with golden/evaluation split`,
        );
      }
    }

    if (params.split === "golden" || params.split === "evaluation") {
      for (const c of params.cases) {
        goldenHashes.add(c.contentHash);
      }
      this.goldenHashesByTenant.set(auth.tenantId, goldenHashes);
    }

    const contentHash = createHash("sha256")
      .update(JSON.stringify(params.cases.map((c) => c.contentHash).toSorted()))
      .digest("hex");

    const record: DatasetVersionRecord = {
      datasetId: params.datasetId,
      version: params.version,
      tenantId: auth.tenantId,
      split: params.split,
      contentHash,
      cases: [...params.cases],
      createdAt: params.nowIso ?? new Date().toISOString(),
    };
    this.versions.set(key, record);
    return record;
  }

  getVersion(auth: AuthContext, datasetId: string, version: string): DatasetVersionRecord {
    const found = this.versions.get(this.versionKey(auth.tenantId, datasetId, version));
    if (!found) {
      throw new DatasetGovernanceError("not_found", "DatasetVersion not found for tenant");
    }
    return found;
  }

  deleteVersion(auth: AuthContext, datasetId: string, version: string): boolean {
    return this.versions.delete(this.versionKey(auth.tenantId, datasetId, version));
  }
}
