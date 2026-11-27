import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");

describe("Frozen Contracts", () => {
  const schemaFiles = [
    "telemetry-event.schema.json",
    "dataset-case.schema.json",
    "evaluation-result.schema.json",
    "experiment-run.schema.json",
    "optimization-artifact.schema.json",
  ];

  it.each(schemaFiles)("validates JSON Schema %s is valid JSON with $schema", (file) => {
    const raw = fs.readFileSync(path.join(ROOT, "contracts/json-schema", file), "utf8");
    const parsed = JSON.parse(raw) as { $schema?: string; required?: string[] };
    expect(parsed.$schema).toContain("json-schema.org");
    expect(Array.isArray(parsed.required)).toBe(true);
    expect(parsed.required!.length).toBeGreaterThan(3);
  });

  it("verifies OpenAPI spec excludes direct production rollback execution", () => {
    const openapi = fs.readFileSync(path.join(ROOT, "contracts/openapi/ai-optimization-v1.yaml"), "utf8");
    expect(openapi).toContain("/v1/artifacts/{artifactId}/release-requests");
    expect(openapi).toContain("/v1/artifacts/{artifactId}/revocations");
    expect(openapi).not.toContain("/v1/artifacts/{artifactId}/rollback:");
  });
});
