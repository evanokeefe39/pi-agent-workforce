# CLAUDE.md
Never use powershell
Never use the Workflow tool (dynamic workflows). Too token-expensive. Use Agent tool or direct research instead.

## Git conventions

master is protected. No direct commits. All changes go through PRs with squash merge.

- Branch naming: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/` prefixes
- PR titles use conventional commits: `feat: add X`, `fix: Y broken`, `refactor: simplify Z`
- Squash merge only — GitHub enforces this, merge commits and rebase are disabled
- Branches auto-delete after merge
- Never use `git merge` to land on master. Always `gh pr create` + `gh pr merge --squash`
- Keep branches short-lived. One feature or fix per branch.

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

Cross-agent trace propagation: subagent-http injects traceparent header,
receiving server.ts extracts it and links pi-otel's trace to the caller.
```

Delegation blocks until agent completes. Parallel via `tasks: [...]`. Session IDs scope artifacts and correlate across agents.

## Stack

- **Runtime:** Bun (server.ts) + Node (Pi CLI). TypeScript, no build step.
- **SDK:** `@earendil-works/pi-coding-agent` as local dep in package.json
- **HTTP:** Fastify v5
- **Artifacts:** Bun service + Postgres + MinIO. RBAC via rbac.json. `artifact://` URIs.
- **Observability:** Pino + pi-otel → OTel Collector → OpenObserve (:5080). Agents send gRPC to collector :4317. Cross-agent traces linked via traceparent header propagation.
- **Platform:** Windows 11, Docker Desktop, Git Bash

## Key files

| File | What |
|------|------|
| `src/agents/server.ts` | Agent HTTP server (Bun, Fastify, Pi SDK, jidoka, trace context extraction) |
| `src/agents/jidoka.ts` | Pure validation functions (zero-output, required tools, max turns) |
| `src/agents/replicator.ts` | fs.watch on /workspace/sessions/, uploads .meta.json sidecars to MinIO |
| `src/agents/artifact-store.ts` | ArtifactStore interface + HttpArtifactStore implementation |
| `src/agents/logger.mjs` | Pino + OTel log shipping |
| `src/agents/Dockerfile` | Multi-stage: node:22-slim + Bun, per-agent targets |
| `src/agents/{name}/.pi/agent/` | Agent config: AGENTS.md (sys prompt), config.yml (models), settings.json |
| `src/agents/{name}/agent.json` | Agent metadata + validation config (maxTurns, requiredTools) |
| `src/agents/extensions/` | Pi extensions: artifacts, web-search, web-scrape, deep-research, subagent-http, context-compaction, etc. |
| `src/agents/extensions/subagent-http/` | HTTP delegation to remote agents. Injects traceparent header for cross-agent trace linking. |
| `src/agents/pi-npm/package.json` | Pi SDK npm extensions (pi-otel, pi-tasks, etc.) — deps for /root/.pi/agent/npm/ |
| `otel-collector-config.yaml` | OTel Collector config — receives gRPC from agents, exports HTTP to OpenObserve |
| `src/artifact-service/` | Bun artifact store (routes.ts, metastore.ts, rbac.ts) |
| `tests/e2e/helpers.ts` | Shared E2E test utilities (health, invoke/poll, artifact queries, report gen) |
| `docs/model-selection.md` | Model decisions, provider catalog, cost analysis |
| `tasks/lessons.md` | Patterns from corrections — read before starting work |
| `ISSUES.md` | Open issues, resolved issues collapsed at bottom |
| `MILESTONE.md` | M0-M4 milestone tracking |

## Models

All agents: DeepSeek V4 Flash ($0.10/M). V4 Pro demoted to plan/review fallback only (ignored structured output, caused timeouts). See `docs/model-selection.md` for full rationale.

## Session isolation

Each invocation gets `/workspace/sessions/{requestId}/` with `output/`, `workproduct/`, `scratch/` subdirs. server.ts calls `createAgentSession` (not `createAgentSessionFromServices`) with `cwd: sessionDir` and `sessionStartEvent`, then calls `await session.bindExtensions({})` to fire extension lifecycle hooks (required for pi-otel OTel initialization). After bindExtensions, server.ts extracts parent trace context from incoming traceparent header and wraps session.prompt() in otelApi.context.with() so pi-otel's pi.interaction inherits the caller's trace ID.

## Jidoka (output validation)

`jidoka.ts` — pure validation functions, no I/O. server.ts calls after run completes:
- **Zero-output:** 0 tokens = failed, not completed
- **Turn breaker:** abort at maxTurns (researcher 60, writer 50)
- **Required tools:** post-run check that specified tools were called
- **Mid-run warning:** every 10 turns, log if required tools not yet called

## Ports

Planner :8081, Researcher :8082, Data :8083, Writer :8084, Publisher :8085, Coder :8086, QA :8087, Artifacts :8090, Postgres :5432, MinIO :9000/:9001, OpenObserve :5080, OTel Collector :4317 (gRPC) / :4318 (HTTP)

## Cross-agent trace propagation

All agents share one trace tree in OpenObserve. Sending side: subagent-http listens for `pi-otel:trace-active` event, stores trace ID in a closure-scoped variable (per-session, concurrency-safe), constructs a W3C traceparent header, and passes it to invoke() on outgoing HTTP calls. Receiving side: server.ts extracts parent context from the traceparent header via `propagation.extract()`, wraps `session.prompt()` in `context.with(parentCtx)` so pi-otel's `pi.interaction` span inherits the caller's trace ID.

`@opentelemetry/api` is installed separately in `/app/node_modules/` (server.ts) and `/root/.pi/agent/npm/node_modules/` (pi-otel). Two copies are safe because the package uses `Symbol.for('opentelemetry.js.api.1')` to share global state (TracerProvider, ContextManager, Propagator) across all copies in the same process. Do not attempt to deduplicate via symlinks or NODE_PATH — it's unnecessary and fragile.

Pi SDK tool dispatch breaks AsyncLocalStorage context propagation. Do not rely on `context.active()` inside tool execute() — it will return ROOT_CONTEXT. The subagent-http traceparent injection uses the pi-otel event channel instead.

## Running tests

```bash
# Bun/TypeScript tests (run with bun test)
bun test tests/e2e/e2e-00-smoke.test.ts                       # full pipeline smoke test (~3 min, 8 tests)
bun test tests/e2e/e2e-30-instagram-growth-research.test.ts   # full planner pipeline (~12 min, 8 tests)
bun test tests/e2e/e2e-32-model-and-output-validation.test.ts # model + concurrency (11 tests)
bun test tests/e2e/e2e-35-session-isolation.test.ts           # session dirs, replication (11 tests)
bun test tests/e2e/e2e-56-qa-agent-pipeline.test.ts           # QA agent pipeline integration (6 tests)

# Bash tests (legacy — migrating to Bun/TS)
bash tests/e2e/e2e-34-data-agent-analysis.sh           # data agent workproduct tools
bash tests/e2e/e2e-50-content-production-infra.sh      # shared skills, workspace, publisher, coder, routing (32 tests)
bash tests/e2e/e2e-51-coder-rendering.sh               # coder toolchain, design system, live render, replication (15 tests)
bash tests/e2e/e2e-52-content-production-pipeline.sh   # full Writer → Coder → Publisher chain via planner (10 tests)
bash tests/e2e/e2e-53-writer-style-tools.sh            # writer style extension permissions + config (23 tests, static)
bash tests/e2e/e2e-55-qa-agent-infra.sh                # QA agent config checks (17 tests, static)
```

## Workproduct standard

Researcher produces structured findings via `record_finding` with ADMIRALTY grades (A-F reliability, 1-6 credibility). Published as JSONL via `publish_artifact` type `dataset`. Writer consumes findings, uses grades for hedging. Data agent uses DuckDB SQL for code-first analysis (`record_query_result`, `record_metric`, `record_chart`, `record_dataset_ref`). Workproduct tools write validated local files; agents call `publish_artifact` to upload to artifact service.
