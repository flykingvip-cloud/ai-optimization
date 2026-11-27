import http from "node:http";
import { AuthError, verifyJwtAuth, type JwtVerifierConfig } from "../../../packages/shared-contracts/src/auth.js";
import type { AuthContext, TelemetryEvent } from "../../../packages/shared-contracts/src/index.js";
import type { OidcJwksClient } from "../../../packages/shared-contracts/src/oidc-jwks.js";
import type { ArtifactRegistryService } from "../../artifact-registry/src/index.js";
import { DatasetGovernanceError, type DatasetManagementService } from "../../dataset-management/src/index.js";
import type { EvaluationEngineService, EvalTargetInput } from "../../evaluation-engine/src/index.js";
import type { TelemetryIngestionService } from "../../telemetry-ingestion/src/index.js";

export interface HttpApiDeps {
  readonly jwtConfig?: JwtVerifierConfig;
  readonly oidcClient?: OidcJwksClient;
  readonly telemetry: TelemetryIngestionService;
  readonly datasets: DatasetManagementService;
  readonly evaluations?: EvaluationEngineService;
  readonly artifacts?: ArtifactRegistryService;
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function authenticate(
  req: http.IncomingMessage,
  deps: HttpApiDeps,
): Promise<AuthContext & { readonly principalType: "user" | "service" }> {
  if (deps.oidcClient) {
    return deps.oidcClient.verifyAuthorization(req.headers.authorization, {
      disallowServiceImpersonation: true,
    });
  }
  if (deps.jwtConfig) {
    return verifyJwtAuth(req.headers.authorization, deps.jwtConfig, {
      disallowServiceImpersonation: true,
    });
  }
  throw new AuthError("missing_token", "No auth verifier configured");
}

export function createOptimizationHttpServer(deps: HttpApiDeps): http.Server {
  return http.createServer(async (req, res) => {
    try {
      const auth = await authenticate(req, deps);
      const url = req.url ?? "/";

      if (req.method === "POST" && url === "/v1/telemetry/events") {
        const body = (await readJsonBody(req)) as TelemetryEvent;
        const result = deps.telemetry.ingest(auth, body);
        if (result.status === "rejected") {
          sendJson(res, result.code === "tenant_mismatch" ? 403 : 400, result);
          return;
        }
        sendJson(res, 202, result);
        return;
      }

      if (req.method === "GET" && url === "/v1/telemetry/events") {
        sendJson(res, 200, { events: deps.telemetry.listForTenant(auth) });
        return;
      }

      if (req.method === "POST" && url.startsWith("/v1/datasets/")) {
        const body = (await readJsonBody(req)) as Parameters<DatasetManagementService["publishVersion"]>[1];
        const published = deps.datasets.publishVersion(auth, body);
        sendJson(res, 201, published);
        return;
      }

      if (req.method === "POST" && url === "/v1/evaluations/rules" && deps.evaluations) {
        const body = (await readJsonBody(req)) as EvalTargetInput;
        const result = deps.evaluations.evaluateByRules(auth, body);
        sendJson(res, 201, result);
        return;
      }

      if (req.method === "GET" && url.startsWith("/v1/artifacts/") && url.endsWith("/bundle") && deps.artifacts) {
        const artifactId = url.slice("/v1/artifacts/".length, -"/bundle".length);
        const artifact = deps.artifacts.getArtifact(auth, artifactId);
        if (!artifact) {
          sendJson(res, 404, { error: "not_found" });
          return;
        }
        if (artifact.revocationStatus === "revoked") {
          sendJson(res, 410, { error: "revoked", artifact });
          return;
        }
        sendJson(res, 200, artifact);
        return;
      }

      if (req.method === "POST" && url.startsWith("/v1/artifacts/") && url.endsWith("/revocations") && deps.artifacts) {
        const artifactId = url.slice("/v1/artifacts/".length, -"/revocations".length);
        const revoked = deps.artifacts.revokeArtifact(auth, artifactId);
        if (!revoked) {
          sendJson(res, 404, { error: "not_found" });
          return;
        }
        sendJson(res, 200, revoked);
        return;
      }

      sendJson(res, 404, { error: "not_found" });
    } catch (err) {
      if (err instanceof AuthError) {
        const status =
          err.code === "missing_token" ||
          err.code === "token_expired" ||
          err.code === "invalid_signature" ||
          err.code === "token_not_active" ||
          err.code === "malformed_token"
            ? 401
            : 403;
        sendJson(res, status, { error: err.code, message: err.message });
        return;
      }
      if (err instanceof DatasetGovernanceError) {
        const status = err.code === "tenant_mismatch" ? 403 : err.code === "version_immutable" ? 409 : 400;
        sendJson(res, status, { error: err.code, message: err.message });
        return;
      }
      sendJson(res, 500, { error: "internal_error" });
    }
  });
}
