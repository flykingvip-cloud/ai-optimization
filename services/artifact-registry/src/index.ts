import { createHash, sign, verify } from "node:crypto";
import type { OptimizationDatabase } from "../../../packages/shared-contracts/src/db.js";
import type { AuthContext, OptimizationArtifact } from "../../../packages/shared-contracts/src/index.js";

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).toSorted()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Canonical JSON serialization covering the COMPLETE OptimizationArtifact,
 * excluding only `signature` and mutable post-issuance `revocationStatus`.
 * All security-critical metadata (`approvalPolicy`, `sourceExperimentId`,
 * `evaluationReportRef`, `datasetVersion`, `issuer`, `rollbackTargetArtifactId`,
 * `targetScope`, `tenantId`, `monotonicEpoch`, etc.) is signed.
 */
export function canonicalSigningBytes(
  artifact: Omit<OptimizationArtifact, "signature" | "revocationStatus"> & {
    readonly signature?: unknown;
    readonly revocationStatus?: unknown;
  },
): Buffer {
  const { signature: _sig, revocationStatus: _rev, ...signable } = artifact;
  return Buffer.from(JSON.stringify(sortKeysDeep(signable)), "utf8");
}

export function computePayloadSha256(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(sortKeysDeep(payload))).digest("hex");
}

function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export type ArtifactVerifyResult =
  | { valid: true }
  | {
      valid: false;
      reason:
        | "unknown_key"
        | "invalid_signature"
        | "content_hash_mismatch"
        | "revoked"
        | "expired"
        | "replay_detected"
        | "tenant_mismatch"
        | "agent_scope_mismatch"
        | "incompatible_openbot_version"
        | "approval_required";
    };

export class ArtifactRegistryService {
  private readonly artifacts = new Map<string, OptimizationArtifact>();
  private readonly publicKeys = new Map<string, string>();
  private readonly revokedIds = new Set<string>();
  private readonly db: OptimizationDatabase | undefined;

  constructor(db?: OptimizationDatabase) {
    this.db = db;
  }

  registerTrustedKey(keyId: string, publicKeyPem: string): void {
    this.publicKeys.set(keyId, publicKeyPem);
  }

  createSignedArtifact(
    auth: AuthContext,
    input: Omit<
      OptimizationArtifact,
      "tenantId" | "contentHash" | "signature" | "signatureAlgorithm" | "revocationStatus"
    >,
    privateKeyPem: string,
  ): OptimizationArtifact {
    const contentHash = computePayloadSha256(input.payload);
    const unsigned: Omit<OptimizationArtifact, "signature"> = {
      ...input,
      tenantId: auth.tenantId,
      contentHash,
      signatureAlgorithm: "Ed25519",
      revocationStatus: "active",
    };
    const signature = sign(null, canonicalSigningBytes(unsigned), privateKeyPem).toString("base64");
    const artifact: OptimizationArtifact = { ...unsigned, signature };
    if (this.db) {
      this.db.db
        .prepare(
          "INSERT INTO optimization_artifacts (artifact_id, tenant_id, revocation_status, artifact_json) VALUES (?, ?, ?, ?)",
        )
        .run(artifact.artifactId, artifact.tenantId, artifact.revocationStatus, JSON.stringify(artifact));
    } else {
      this.artifacts.set(artifact.artifactId, artifact);
    }
    return artifact;
  }

  getArtifact(auth: AuthContext, artifactId: string): OptimizationArtifact | null {
    if (this.db) {
      const row = this.db.db
        .prepare("SELECT artifact_json FROM optimization_artifacts WHERE artifact_id = ? AND tenant_id = ?")
        .get(artifactId, auth.tenantId) as { artifact_json: string } | undefined;
      return row ? (JSON.parse(row.artifact_json) as OptimizationArtifact) : null;
    }
    const found = this.artifacts.get(artifactId);
    return found && found.tenantId === auth.tenantId ? found : null;
  }

  revokeArtifact(auth: AuthContext, artifactId: string): OptimizationArtifact | null {
    const existing = this.getArtifact(auth, artifactId);
    if (!existing) {
      return null;
    }
    this.revokedIds.add(artifactId);
    const updated: OptimizationArtifact = { ...existing, revocationStatus: "revoked" };
    if (this.db) {
      this.db.db
        .prepare(
          "UPDATE optimization_artifacts SET revocation_status = ?, artifact_json = ? WHERE artifact_id = ? AND tenant_id = ?",
        )
        .run("revoked", JSON.stringify(updated), artifactId, auth.tenantId);
    } else {
      this.artifacts.set(artifactId, updated);
    }
    return updated;
  }

  verifyForOpenBot(
    artifact: OptimizationArtifact,
    context: {
      readonly expectedTenantId: string;
      readonly targetAgentId: string;
      readonly openBotVersion: string;
      readonly lastAppliedEpoch: number;
      readonly hasHumanApproval: boolean;
      readonly hasPolicyGatePass?: boolean;
      readonly nowIso?: string;
    },
  ): ArtifactVerifyResult {
    if (artifact.tenantId !== context.expectedTenantId) {
      return { valid: false, reason: "tenant_mismatch" };
    }
    if (!artifact.targetScope.agentIds.includes(context.targetAgentId)) {
      return { valid: false, reason: "agent_scope_mismatch" };
    }
    const isRevokedInDb = this.db
      ? ((this.db.db
          .prepare("SELECT revocation_status FROM optimization_artifacts WHERE artifact_id = ?")
          .get(artifact.artifactId) as { revocation_status: string } | undefined)?.revocation_status === "revoked")
      : false;
    if (artifact.revocationStatus === "revoked" || this.revokedIds.has(artifact.artifactId) || isRevokedInDb) {
      return { valid: false, reason: "revoked" };
    }
    const nowMs = Date.parse(context.nowIso ?? new Date().toISOString());
    if (nowMs >= Date.parse(artifact.expiresAt)) {
      return { valid: false, reason: "expired" };
    }
    if (artifact.monotonicEpoch <= context.lastAppliedEpoch) {
      return { valid: false, reason: "replay_detected" };
    }
    if (compareSemver(context.openBotVersion, artifact.targetScope.minOpenBotVersion) < 0) {
      return { valid: false, reason: "incompatible_openbot_version" };
    }
    if (
      artifact.targetScope.maxOpenBotVersion &&
      compareSemver(context.openBotVersion, artifact.targetScope.maxOpenBotVersion) > 0
    ) {
      return { valid: false, reason: "incompatible_openbot_version" };
    }
    if (artifact.approvalPolicy === "human_required" && !context.hasHumanApproval) {
      return { valid: false, reason: "approval_required" };
    }
    if (artifact.approvalPolicy === "policy_gate" && !context.hasPolicyGatePass && !context.hasHumanApproval) {
      return { valid: false, reason: "approval_required" };
    }
    if (computePayloadSha256(artifact.payload) !== artifact.contentHash) {
      return { valid: false, reason: "content_hash_mismatch" };
    }
    const pubKey = this.publicKeys.get(artifact.keyId);
    if (!pubKey) {
      return { valid: false, reason: "unknown_key" };
    }
    const ok = verify(null, canonicalSigningBytes(artifact), pubKey, Buffer.from(artifact.signature, "base64"));
    return ok ? { valid: true } : { valid: false, reason: "invalid_signature" };
  }
}
