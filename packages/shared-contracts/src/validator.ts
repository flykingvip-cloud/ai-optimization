import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { ValidateFunction } from "ajv";

export type SchemaName =
  | "telemetry-event"
  | "task-outcome-event"
  | "dataset-case"
  | "evaluation-result"
  | "experiment-run"
  | "optimization-artifact";

const SCHEMA_FILES: Record<SchemaName, string> = {
  "telemetry-event": "telemetry-event.schema.json",
  "task-outcome-event": "task-outcome-event.schema.json",
  "dataset-case": "dataset-case.schema.json",
  "evaluation-result": "evaluation-result.schema.json",
  "experiment-run": "experiment-run.schema.json",
  "optimization-artifact": "optimization-artifact.schema.json",
};

export class ContractValidator {
  private readonly ajv: Ajv2020.default;
  private readonly validators = new Map<SchemaName, ValidateFunction>();

  constructor(schemaDir: string) {
    this.ajv = new Ajv2020.default({ allErrors: true, strict: false });
    addFormats.default(this.ajv);
    for (const [name, file] of Object.entries(SCHEMA_FILES) as Array<[SchemaName, string]>) {
      const raw = JSON.parse(fs.readFileSync(path.join(schemaDir, file), "utf8")) as Record<string, unknown>;
      this.validators.set(name, this.ajv.compile(raw));
    }
  }

  validate(name: SchemaName, data: unknown): { valid: true } | { valid: false; errors: string[] } {
    const fn = this.validators.get(name);
    if (!fn) {
      return { valid: false, errors: [`unknown schema: ${name}`] };
    }
    const ok = fn(data);
    if (ok) {
      return { valid: true };
    }
    const errors = (fn.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`);
    return { valid: false, errors };
  }
}
