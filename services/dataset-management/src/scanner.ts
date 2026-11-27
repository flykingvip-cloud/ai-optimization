export interface ScanReport {
  readonly scannerVersion: "1.0.0";
  readonly riskLevel: "none" | "high";
  readonly findings: readonly string[];
}

const RULES: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "openai_key", pattern: /\bsk-[A-Za-z0-9._-]{10,}\b/ },
  { name: "anthropic_key", pattern: /\bsk-ant-[A-Za-z0-9._-]{10,}\b/ },
  { name: "google_api_key", pattern: /\bAIza[A-Za-z0-9._-]{10,}\b/ },
  { name: "github_token", pattern: /\bgh[pousr]_[A-Za-z0-9]{16,}\b/ },
  { name: "bearer_token", pattern: /\bBearer\s+[A-Za-z0-9._-]{10,}\b/i },
  { name: "private_key_pem", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "ssn_pii", pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
  { name: "email_pii", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
];

function walkValue(value: unknown, path: string, findings: string[]): void {
  if (typeof value === "string") {
    for (const rule of RULES) {
      if (rule.pattern.test(value)) {
        findings.push(`${rule.name}@${path}`);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, idx) => walkValue(item, `${path}[${idx}]`, findings));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      walkValue(v, `${path}.${k}`, findings);
    }
  }
}

export function scanForSecretsAndPii(target: unknown): ScanReport {
  const findings: string[] = [];
  walkValue(target, "$", findings);
  return {
    scannerVersion: "1.0.0",
    riskLevel: findings.length > 0 ? "high" : "none",
    findings,
  };
}
