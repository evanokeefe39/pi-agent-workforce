# CLAUDE.md

## Constraints

- Never use powershell
- Never use the Workflow tool (dynamic workflows) — too token-expensive, use Agent tool instead
- master protected — squash merge only, branches auto-delete
- Land changes via `gh pr create` + `gh pr merge --squash`, never `git merge`
- Branch naming: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/` prefixes

## Architecture

```
POST :8081/invoke  ← planner
  ├─ subagent("researcher") → :8082
  ├─ subagent("data")       → :8083
  ├─ subagent("writer")     → :8084
  ├─ subagent("publisher")  → :8085
  ├─ subagent("coder")      → :8086
  └─ subagent("qa")         → :8087

Agents ──gRPC:4317──▸ OTel Collector ──HTTP──▸ OpenObserve :5080
Artifacts :8090, Postgres :5432, MinIO :9000/:9001
```

All agents run DeepSeek V4 Flash. Delegation blocks until complete; parallel via `tasks: [...]`. Cross-agent traces linked via W3C traceparent propagation.

**Stack:** Bun (server.ts) + Node (Pi CLI), TypeScript, Fastify v5, `@earendil-works/pi-coding-agent` SDK. Artifacts: Bun + Postgres + MinIO. Observability: Pino + pi-otel → OTel Collector → OpenObserve.

## Key files

| Path | Purpose |
|------|---------|
| `src/agents/server.ts` | Shared HTTP server — all agents run this |
| `src/agents/jidoka.ts` | Output validation (zero-output, required tools, max turns) |
| `src/agents/Dockerfile` | Multi-stage build, per-agent targets |
| `src/agents/{name}/.pi/agent/` | Per-agent config: AGENTS.md, config.yml, settings.json |
| `src/agents/{name}/agent.json` | Validation config (maxTurns, requiredTools) |
| `src/agents/extensions/` | Shared Pi extensions |
| `src/artifact-service/` | Artifact store service |

## Deep-dive references

Read these before modifying related areas:

| Doc | When to read |
|-----|-------------|
| `docs/model-selection.md` | Changing models, providers, fallback chains, or cost analysis |
| `ISSUES.md` | Before starting work — current bugs, known limitations, partial fixes |
| `tasks/lessons.md` | Before starting work — correction patterns from past sessions |
| `MILESTONE.md` | Understanding project history and milestone scope |
| `tasks/specs/` | Before implementing features — check for existing specs |

## Session isolation

Each invocation gets `/workspace/sessions/{requestId}/` with `output/`, `workproduct/`, `scratch/`. Key requirement: use `createAgentSession` (not `createAgentSessionFromServices`) with `cwd: sessionDir`, then call `session.bindExtensions({})` for pi-otel init.

## Gotchas

- `@opentelemetry/api` exists in two locations (/app/ and /root/.pi/agent/npm/) — safe, uses `Symbol.for()` for global state. Don't deduplicate.
- Pi SDK breaks AsyncLocalStorage in tool execute() — `context.active()` returns ROOT_CONTEXT. Subagent-http uses pi-otel event channel instead.
- Workproduct tools write local files; agents must explicitly call `publish_artifact` to upload.

## Tests

```bash
bun test tests/e2e/e2e-00-smoke.test.ts        # pipeline smoke (~3 min)
bun test tests/e2e/e2e-32-*.test.ts             # model + concurrency (11 tests)
bun test tests/e2e/e2e-35-*.test.ts             # session isolation (11 tests)
bun test tests/e2e/e2e-56-*.test.ts             # QA pipeline (6 tests)

# Bash (legacy — migrating to Bun/TS)
bash tests/e2e/e2e-50-content-production-infra.sh  # skills, routing (32 tests)
bash tests/e2e/e2e-51-coder-rendering.sh           # coder toolchain (15 tests)
bash tests/e2e/e2e-52-content-production-pipeline.sh  # full pipeline (10 tests)
bash tests/e2e/e2e-53-writer-style-tools.sh        # style config (23 tests)
bash tests/e2e/e2e-55-qa-agent-infra.sh            # QA config (17 tests)
```
