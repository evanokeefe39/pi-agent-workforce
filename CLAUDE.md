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
  └─ subagent("writer", task)     → :8084 (deepseek-v4-flash)
```

Delegation blocks until agent completes. Parallel via `tasks: [...]`. Session IDs scope artifacts and correlate across agents.

## Stack

- **Runtime:** Bun (server.ts) + Node (Pi CLI). TypeScript, no build step.
- **SDK:** `@earendil-works/pi-coding-agent` as local dep in package.json
- **HTTP:** Fastify v5
- **Artifacts:** Bun service + Postgres + MinIO. RBAC via rbac.json. `artifact://` URIs.
- **Observability:** Pino + OTel → OpenObserve (:5080)
- **Platform:** Windows 11, Docker Desktop, Git Bash

## Key files

| File | What |
|------|------|
| `src/agents/server.ts` | Agent HTTP server (Bun, Fastify, Pi SDK, jidoka hooks) |
| `src/agents/logger.mjs` | Pino + OTel log shipping |
| `src/agents/Dockerfile` | Multi-stage: node:22-slim + Bun, per-agent targets |
| `src/agents/{name}/.pi/agent/` | Agent config: AGENTS.md (sys prompt), config.yml (models), settings.json |
| `src/agents/{name}/agent.json` | Agent metadata + validation config (maxTurns, requiredTools) |
| `src/agents/extensions/` | Pi extensions: artifacts, web-search, web-scrape, deep-research, etc. |
| `src/artifact-service/` | Bun artifact store (routes.ts, storage.ts, rbac.ts) |
| `docs/model-selection.md` | Model decisions, provider catalog, cost analysis |
| `tasks/lessons.md` | Patterns from corrections — read before starting work |
| `ISSUES.md` | Open issues, resolved issues collapsed at bottom |
| `MILESTONE.md` | M0-M4 milestone tracking |

## Models

All agents: DeepSeek V4 Flash ($0.10/M). V4 Pro demoted to plan/review fallback only (ignored structured output, caused timeouts). See `docs/model-selection.md` for full rationale.

## Jidoka (output validation)

server.ts enforces output quality via `agent.json runtimeConfig.validation`:
- **Zero-output:** 0 tokens = failed, not completed
- **Turn breaker:** abort at maxTurns (researcher 60, writer 50)
- **Required tools:** post-run check that specified tools were called
- **Required artifact:** post-run check that artifact type exists in service

## Ports

Planner :8081, Researcher :8082, Data :8083, Writer :8084, Artifacts :8090, Postgres :5432, MinIO :9000/:9001, OpenObserve :5080

## Running tests

```bash
bash tests/e2e/e2e-32-model-and-output-validation.sh  # model + concurrency
bash tests/e2e/e2e-30-instagram-growth-research.sh     # full planner pipeline
node tests/e2e/artifact-lineage.mjs --latest           # ASCII lineage report
node tests/e2e/artifact-lineage-html.mjs --latest      # HTML graph report
```

## Workproduct standard

Researcher produces structured findings via `record_finding` with ADMIRALTY grades (A-F reliability, 1-6 credibility). Published as JSONL via `write_artifact` type `dataset`. Writer consumes findings, uses grades for hedging. Data agent (WIP) will use Python + DuckDB for code-first analysis of scraped data.
