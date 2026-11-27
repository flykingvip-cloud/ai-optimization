import { DatabaseSync } from "node:sqlite";

export interface MigrationStep {
  readonly version: number;
  readonly name: string;
  readonly upSql: string;
  readonly downSql: string;
}

export const CORE_MIGRATIONS: readonly MigrationStep[] = [
  {
    version: 1,
    name: "init_core_tables",
    upSql: `
      CREATE TABLE IF NOT EXISTS telemetry_events (
        event_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        event_type TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        UNIQUE (tenant_id, idempotency_key)
      );
      CREATE TABLE IF NOT EXISTS dataset_versions (
        tenant_id TEXT NOT NULL,
        dataset_id TEXT NOT NULL,
        version TEXT NOT NULL,
        split TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        cases_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (tenant_id, dataset_id, version)
      );
      CREATE TABLE IF NOT EXISTS evaluation_results (
        evaluation_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        run_id TEXT,
        dataset_case_id TEXT,
        source_category TEXT NOT NULL,
        result_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS experiment_runs (
        experiment_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        status TEXT NOT NULL,
        conclusion TEXT NOT NULL,
        run_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS optimization_artifacts (
        artifact_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        revocation_status TEXT NOT NULL,
        artifact_json TEXT NOT NULL
      );
    `,
    downSql: `
      DROP TABLE IF EXISTS optimization_artifacts;
      DROP TABLE IF EXISTS experiment_runs;
      DROP TABLE IF EXISTS evaluation_results;
      DROP TABLE IF EXISTS dataset_versions;
      DROP TABLE IF EXISTS telemetry_events;
    `,
  },
];

export class OptimizationDatabase {
  readonly db: DatabaseSync;

  constructor(dbPath = ":memory:") {
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
  }

  migrate(migrations: readonly MigrationStep[] = CORE_MIGRATIONS): number[] {
    const appliedRows = this.db.prepare("SELECT version FROM schema_migrations").all() as Array<{ version: number }>;
    const applied = new Set(appliedRows.map((r) => r.version));
    const newlyApplied: number[] = [];

    for (const step of migrations) {
      if (applied.has(step.version)) continue;
      this.db.exec("BEGIN;");
      try {
        this.db.exec(step.upSql);
        this.db
          .prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)")
          .run(step.version, step.name, new Date().toISOString());
        this.db.exec("COMMIT;");
        newlyApplied.push(step.version);
      } catch (err) {
        this.db.exec("ROLLBACK;");
        throw err;
      }
    }
    return newlyApplied;
  }

  rollbackLast(migrations: readonly MigrationStep[] = CORE_MIGRATIONS): number | null {
    const last = this.db
      .prepare("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1")
      .get() as { version: number } | undefined;
    if (!last) return null;
    const step = migrations.find((m) => m.version === last.version);
    if (!step) {
      throw new Error(`Missing migration definition for version ${last.version}`);
    }
    this.db.exec("BEGIN;");
    try {
      this.db.exec(step.downSql);
      this.db.prepare("DELETE FROM schema_migrations WHERE version = ?").run(step.version);
      this.db.exec("COMMIT;");
      return step.version;
    } catch (err) {
      this.db.exec("ROLLBACK;");
      throw err;
    }
  }

  close(): void {
    this.db.close();
  }
}
