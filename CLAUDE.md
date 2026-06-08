# CLAUDE.md
Never use powershell
Never use the Workflow tool (dynamic workflows). Too token-expensive. Use Agent tool or direct research instead.

## What this is

Multi-agent workforce — Pi agents in Docker containers orchestrated via pi-subagents-http. Each agent is a standalone HTTP server with its own model, tools, and dependencies. An orchestrating Pi session on the host delegates tasks via the `subagent()` tool.

Evolved from evaluation work in `paperclip-eval` repo (see its EVALUATION.md for architecture comparison).

## Architecture

```
E2E test / user
  └─ POST http://localhost:8081/invoke  ← planner container (deepseek-reasoner)
       ├─ subagent("researcher", task) → http://researcher:8080 (qwen3-32b)
       ├─ subagent("data", task)       → http://data:8080      (qwen3-32b)
       └─ subagent("writer", task)     → http://writer:8080     (qwen3-32b)
```

The planner is the orchestrating agent. It has pi-subagents-http for remote delegation to worker agents over Docker networking. Worker agents have pi-subagents (local, non-HTTP) for internal model routing on subtasks.

Delegation is blocking by default — tool call waits until the remote agent completes. Parallel delegation via `tasks: [...]`. Server supports concurrent sessions (MAX_CONCURRENT_SESSIONS per container).

Session IDs (from Pi SDK's SessionManager) are used for artifact scoping and cross-agent correlation. No process.env mutation for per-request state.

## Repo layout

```
docker-compose.yml          Agent containers + infrastructure
.env.example                Template for API keys
scripts/init-artifact-db.sql  Postgres init (artifact_store)
src/artifact-service/       Bun artifact storage (HTTP, MinIO, Postgres)
src/agents/
  server.mjs               Agent HTTP server (Node, Pi SDK)
  logger.mjs               Pino logger with OTel shipping
  Dockerfile               Multi-stage build (node:22-slim + Pi CLI)
  rbac.json                 Artifact access control per agent
  extensions/               Pi extensions (discovered from ~/.pi/agent/extensions/)
    artifacts/              write_artifact, read_artifact, list_artifacts
    subagent-http/          Vendored pi-subagents-http (planner only)
    deep-research/          Multi-iteration research engine
    duckdb/                 DuckDB analytics
    web-search.ts           Exa semantic search
    web-fetch.ts            URL fetch + Jina Reader fallback
    web-scrape/             4-tier scraping (static, stealth, browser, Apify)
    workproduct-lib/        Structured findings with ADMIRALTY grading
    writing-style/          Vale linter + style profiling
  planner/                  Planner agent — task decomposition, delegation, quality assessment
  researcher/               Research agent — web search, scraping, structured findings
  data/                     Data agent — scraping, ETL, database ops
  writer/                   Writer agent — document pipeline, style engine
  coder/                    Coder agent — code execution, analysis
  qa/                       QA agent — review, verdicts, gating
  publisher/                Publisher agent — content distribution
tasks/
  lessons.md                Patterns learned from corrections and successes
  plans/                    Named implementation plans
tests/
  e2e/                      End-to-end test suite
    jsonl-helpers.sh         jq-based JSONL parsing + artifact + planner helpers
    e2e-30-instagram-growth-research.sh   Full planner pipeline test
    e2e-31-researcher-tool-trials.sh      Model/prompt comparison trials
    e2e-32-model-and-output-validation.sh Model + concurrency + output validation
    run-e2e.sh
```

## Quick start

```bash
# 1. Copy .env.example to .env, fill in API keys
cp .env.example .env

# 2. Create per-agent .env files
echo "WORKSPACE=default\nARTIFACT_SERVICE_URL=http://artifact-service:8090" > src/agents/researcher/.env
# repeat for data/, writer/

# 3. Start infrastructure + agents
docker compose up -d

# 4. Install pi-subagents-http on host
pi install ~/repos/pi-subagents-http

# 5. Create extension config
mkdir -p ~/.pi/agent/extensions/subagent-http
cat > ~/.pi/agent/extensions/subagent-http/config.json << 'EOF'
{
  "agents": [
    { "name": "researcher", "url": "http://localhost:8082" },
    { "name": "data", "url": "http://localhost:8083" },
    { "name": "writer", "url": "http://localhost:8084" }
  ]
}
EOF

# 6. Test
pi -p "Use subagent({ action: \"list\" }) to see available agents"
```

## Server endpoints (per agent container)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/invoke` | POST | Accept task `{ task, context?, correlationId? }` → 202 |
| `/status/:runId` | GET | Run state, duration, turn count |
| `/result/:runId` | GET | Output, usage, model. 409 if running |
| `/cancel/:runId` | POST | Abort via AbortController |
| `/describe` | GET | Agent metadata (name, model, tools, status) |
| `/health` | GET | Readiness check |

## Artifact service

- URIs: `artifact://{workspace}/{run}/{agent}/{type}/{id}_{filename}`
- Env vars: `WORKSPACE` (tenant namespace), `RUN_ID` (set per-request by server.mjs)
- Storage: MinIO (S3-compat) + Postgres metadata
- RBAC: glob patterns in rbac.json per agent
- Types: `research`, `dataset`, `report`, `brief`, `finding`, `code`, `log`

## Workproduct / findings

Researcher and Data agents produce structured findings via `record_finding`:
- ADMIRALTY grading (6x6 NATO: source reliability A-F, information credibility 1-6)
- Each source has: URL, type, reliability, credibility, collection method, `source_data` (raw inline data)
- Published as JSONL via `write_artifact` type `dataset`
- Writer consumes findings via `read_artifact`, uses grades for hedging decisions

## Ports

| Service | Host Port | Container Port |
|---------|-----------|----------------|
| Planner | 8081 | 8080 |
| Researcher | 8082 | 8080 |
| Data | 8083 | 8080 |
| Writer | 8084 | 8080 |
| Artifact Service | 8090 | 8090 |
| Postgres | 5432 | 5432 |
| MinIO API | 9000 | 9000 |
| MinIO Console | 9001 | 9001 |
| OpenObserve | 5080 | 5080 |

## Models

| Role | Model | Provider | Notes |
|------|-------|----------|-------|
| Agentic (tool calling) | Qwen3 32B | Cerebras (free) | BFCL #2, primary for all worker agents |
| Planning | DeepSeek R1 | DeepSeek ($0.55/M) | Strong reasoning, used by planner |
| Fallback | Llama 3.3 70B | Cerebras (free) | Second fallback for agentic tasks |
| Smol | Llama 3.1 8B | Groq (free) | Lightweight tasks, commit messages |

MiniMax removed — fundamentally broken for tool calling (XML format, concatenated tool names). deepseek-chat removed from fallback chains — not suited for agentic tool-use, prefer loud failures during development.

## Concurrency

Server supports MAX_CONCURRENT_SESSIONS per container (default 3). Planner: 1, Researcher: 3, Data: 2, Writer: 2. Session IDs from Pi SDK used for artifact scoping — no global mutable state.

## Packages (Pi extensions installed via npm)

All agents: `@tintinweb/pi-tasks` (task tracking), `pi-otel` (observability), `pi-permission-system`
Worker agents: `pi-subagents` (local subprocess model routing for subtasks)
Planner only: vendored `pi-subagents-http` (remote HTTP delegation to worker containers)

## Running tests

```bash
bash tests/e2e/run-e2e.sh          # all active tests
bash tests/e2e/e2e-32-model-and-output-validation.sh  # model + concurrency + output validation
bash tests/e2e/e2e-30-instagram-growth-research.sh     # full planner pipeline
```

Tests produce markdown reports in `tests/results/` with metrics tables.

## Platform

- Windows 11, bash via Git Bash / WSL2
- Docker Desktop for containers
- Pi on host for orchestration
