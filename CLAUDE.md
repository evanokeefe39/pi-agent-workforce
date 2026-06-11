# CLAUDE.md
Never use powershell
Never use the Workflow tool (dynamic workflows). Too token-expensive. Use Agent tool or direct research instead.

## What this is

Multi-agent workforce — Pi agents in Docker containers orchestrated via pi-subagents-http. Planner decomposes goals, delegates to specialist agents (researcher, data, writer), assesses quality, iterates. Evolved from `paperclip-eval` repo.

## Architecture

```
POST http://localhost:8081/invoke  ← planner (deepseek-v4-flash)
  ├─ subagent("researcher", task) → :8082 (deepseek-v4-flash)
  ├─ subagent("data", task)       → :8083 (deepseek-v4-flash)
  ├─ subagent("writer", task)     → :8084 (deepseek-v4-flash)
  ├─ subagent("publisher", task)  → :8085 (deepseek-v4-flash)
  └─ subagent("coder", task)      → :8086 (deepseek-v4-flash)

Agents ──gRPC:4317──▸ OTel Collector ──HTTP──▸ OpenObserve :5080
                      (artifact-service uses HTTP:4318)
```

Delegation blocks until agent completes. Parallel via `tasks: [...]`. Session IDs scope artifacts and correlate across agents.

## Stack

- **Runtime:** Bun (server.ts) + Node (Pi CLI). TypeScript, no build step.
- **SDK:** `@earendil-works/pi-coding-agent` as local dep in package.json
- **HTTP:** Fastify v5
- **Artifacts:** Bun service + Postgres + MinIO. RBAC via rbac.json. `artifact://` URIs.
- **Observability:** Pino + pi-otel → OTel Collector → OpenObserve (:5080). Agents send gRPC to collector :4317, artifact-service sends HTTP to :4318.
- **Platform:** Windows 11, Docker Desktop, Git Bash

## Key files

| File | What |
|------|------|
| `src/agents/server.ts` | Agent HTTP server (Bun, Fastify, Pi SDK, jidoka, replicator) |
| `src/agents/jidoka.ts` | Pure validation functions (zero-output, required tools, max turns) |
| `src/agents/replicator.ts` | fs.watch on /workspace/sessions/, uploads .meta.json sidecars to MinIO |
| `src/agents/artifact-store.ts` | ArtifactStore interface + HttpArtifactStore implementation |
| `src/agents/logger.mjs` | Pino + OTel log shipping |
| `src/agents/Dockerfile` | Multi-stage: node:22-slim + Bun, per-agent targets |
| `src/agents/{name}/.pi/agent/` | Agent config: AGENTS.md (sys prompt), config.yml (models), settings.json |
| `src/agents/{name}/agent.json` | Agent metadata + validation config (maxTurns, requiredTools) |
| `src/agents/extensions/` | Pi extensions: artifacts, web-search, web-scrape, deep-research, etc. |
| `otel-collector-config.yaml` | OTel Collector config — receives gRPC/HTTP from agents, exports HTTP to OpenObserve |
| `src/artifact-service/` | Bun artifact store (routes.ts, metastore.ts, graph.ts, rbac.ts) |
| `src/artifact-service/graph.ts` | Graphology-based lineage graph (BFS trace, PROV-JSON export) |
| `src/lineage-ui/` | React + @xyflow/react lineage visualization (served at /ui/) |
| `tests/e2e/helpers.ts` | Shared E2E test utilities (health, invoke/poll, artifact queries, report gen) |
| `docs/model-selection.md` | Model decisions, provider catalog, cost analysis |
| `tasks/lessons.md` | Patterns from corrections — read before starting work |
| `ISSUES.md` | Open issues, resolved issues collapsed at bottom |
| `MILESTONE.md` | M0-M4 milestone tracking |

## Models

All agents: DeepSeek V4 Flash ($0.10/M). V4 Pro demoted to plan/review fallback only (ignored structured output, caused timeouts). See `docs/model-selection.md` for full rationale.

## Session isolation

Each invocation gets `/workspace/sessions/{requestId}/` with `output/`, `workproduct/`, `scratch/` subdirs. server.ts calls `createAgentSession` (not `createAgentSessionFromServices`) with `cwd: sessionDir` and `sessionStartEvent`, then calls `await session.bindExtensions({})` to fire extension lifecycle hooks (required for pi-otel OTel initialization). Extensions write `.meta.json` sidecars alongside files. Replicator (`replicator.ts`) watches for sidecars via `fs.watch` and uploads to MinIO. Agent-complete gate waits for replication before marking run done.

## Jidoka (output validation)

`jidoka.ts` — pure validation functions, no I/O. server.ts calls after run completes:
- **Zero-output:** 0 tokens = failed, not completed
- **Turn breaker:** abort at maxTurns (researcher 60, writer 50)
- **Required tools:** post-run check that specified tools were called
- **Mid-run warning:** every 10 turns, log if required tools not yet called

## Ports

Planner :8081, Researcher :8082, Data :8083, Writer :8084, Publisher :8085, Coder :8086, QA :8087, Artifacts :8090, Postgres :5432, MinIO :9000/:9001, OpenObserve :5080, OTel Collector :4317 (gRPC) / :4318 (HTTP)

## Running tests

```bash
# Bun/TypeScript tests (new — run with bun test)
bun test tests/e2e/e2e-00-smoke.test.ts                # full pipeline smoke test (~3 min, 8 tests)
bun test tests/e2e/e2e-30-instagram-growth-research.test.ts  # full planner pipeline (~12 min, 8 tests)

# Bash tests (legacy — migrating to Bun/TS)
bash tests/e2e/e2e-32-model-and-output-validation.sh  # model + concurrency (11 tests)
bash tests/e2e/e2e-35-session-isolation.sh             # session dirs, replication (11 tests)
bash tests/e2e/e2e-34-data-agent-analysis.sh           # data agent workproduct tools
bash tests/e2e/e2e-30-instagram-growth-research.sh     # full planner pipeline (legacy bash version)
node tests/e2e/e2e-40-lineage-service.mjs --latest     # lineage API + graph (25 tests)
node tests/e2e/artifact-lineage.mjs --latest           # ASCII lineage report
node tests/e2e/artifact-lineage-html.mjs --latest      # HTML graph report
bash tests/e2e/e2e-50-content-production-infra.sh      # shared skills, workspace, publisher, coder, routing (32 tests)
bash tests/e2e/e2e-51-coder-rendering.sh               # coder toolchain, design system, live render, replication (15 tests)
bash tests/e2e/e2e-52-content-production-pipeline.sh   # full Writer → Coder → Publisher chain via planner (10 tests)
bash tests/e2e/e2e-53-writer-style-tools.sh            # writer style extension permissions + config (23 tests, static)
bun test tests/e2e/e2e-55-qa-agent-infra.sh            # QA agent config checks (17 tests, static)
bun test tests/e2e/e2e-56-qa-agent-pipeline.test.ts    # QA agent pipeline integration (6 tests)
```

## Workproduct standard

Researcher produces structured findings via `record_finding` with ADMIRALTY grades (A-F reliability, 1-6 credibility). Published as JSONL via `write_artifact` type `dataset`. Writer consumes findings, uses grades for hedging. Data agent uses DuckDB SQL for code-first analysis (`record_query_result`, `record_metric`, `record_chart`, `record_dataset_ref`). All workproduct tools write `.meta.json` sidecars for automatic replication.
