import http from "node:http";
import { AuthError, verifyJwtAuth, type JwtVerifierConfig } from "../../../packages/shared-contracts/src/auth.js";
import type { TelemetryEvent } from "../../../packages/shared-contracts/src/index.js";
import { DatasetGovernanceError, type DatasetManagementService } from "../../dataset-management/src/index.js";
import type { TelemetryIngestionService } from "../../telemetry-ingestion/src/index.js";

export interface HttpApiDeps {
  readonly jwtConfig: JwtVerifierConfig;
  readonly telemetry: TelemetryIngestionService;
  readonly datasets: DatasetManagementService;
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

export function createOptimizationHttpServer(deps: HttpApiDeps): http.Server {
  return http.createServer(async (req, res) => {
    try {
      const auth = verifyJwtAuth(req.headers.authorization, deps.jwtConfig, {
        disallowServiceImpersonation: true,
      });
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

      sendJson(res, 404, { error: "not_found" });
    } catch (err) {
      if (err instanceof AuthError) {
        const status =
          err.code === "missing_token" || err.code === "token_expired" || err.code === "invalid_signature"
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
