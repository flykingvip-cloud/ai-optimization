import { createHash, sign, verify } from "node:crypto";
import type { AuthContext, OptimizationArtifact } from "../../../packages/shared-contracts/src/index.js";

function canonicalSigningBytes(artifact: Omit<OptimizationArtifact, "signature">): Buffer {
  const canonical = {
    artifactId: artifact.artifactId,
    artifactType: artifact.artifactType,
    artifactVersion: artifact.artifactVersion,
    schemaVersion: artifact.schemaVersion,
    tenantId: artifact.tenantId,
    targetScope: artifact.targetScope,
    issuedAt: artifact.issuedAt,
    expiresAt: artifact.expiresAt,
    monotonicEpoch: artifact.monotonicEpoch,
    contentHash: artifact.contentHash,
  };
  return Buffer.from(JSON.stringify(canonical), "utf8");
}

export function computePayloadSha256(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
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
    this.artifacts.set(artifact.artifactId, artifact);
    return artifact;
  }

  revokeArtifact(auth: AuthContext, artifactId: string): OptimizationArtifact | null {
    const existing = this.artifacts.get(artifactId);
    if (!existing || existing.tenantId !== auth.tenantId) {
      return null;
    }
    this.revokedIds.add(artifactId);
    const updated: OptimizationArtifact = { ...existing, revocationStatus: "revoked" };
    this.artifacts.set(artifactId, updated);
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
    if (artifact.revocationStatus === "revoked" || this.revokedIds.has(artifact.artifactId)) {
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
    const { signature, ...unsigned } = artifact;
    const ok = verify(null, canonicalSigningBytes(unsigned), pubKey, Buffer.from(signature, "base64"));
    return ok ? { valid: true } : { valid: false, reason: "invalid_signature" };
  }
}
