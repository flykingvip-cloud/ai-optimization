# AI Optimization

Independent **Evaluation, Experimentation & Optimization Platform** for Agent Runtimes (starting with OpenBot).

## Architecture Split

- **OpenBot (`Runtime & Governance Plane`)**: Agent Runtime, Gateway, Tool/Workflow, Model Fallback, Diagnostics, `TaskOutcome` (Sole Authority), OTel, and `evolution-control` (Canary/Rollback execution).
- **AI Optimization (`Evaluation & Learning Plane`)**: Telemetry Ingestion, Golden Dataset & Expert Feedback, Evaluation Engine (Rules + LLM-as-a-Judge), Benchmark, Experiment Engine, Prompt/Routing/Policy Optimizer, Artifact Registry (and Phase 3+ SFT/DPO/RLVR).

## Getting Started

See [AI Optimization Product & Architecture Charter](docs/architecture/AI_OPTIMIZATION_PRODUCT_AND_ARCHITECTURE_CHARTER.md).

## Repository Layout

- `docs/architecture/` — Product definition, architecture charter, and ADRs
- `contracts/` — Telemetry, Evaluation, and Optimization Artifact schemas (OpenAPI / JSON Schema)
- `services/` — Evaluation, Dataset, Experiment, and Artifact Registry services (Phase 1+)
- `packages/` — Shared core packages (reserved for `aor-*` migration with preserved git history)
