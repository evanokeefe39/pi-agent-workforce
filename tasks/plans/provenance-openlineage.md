# Provenance & OpenLineage Phase 1 — Subagent Execution Plan

Spec: `tasks/specs/provenance-and-artifact-architecture.md`

## Key findings from exploration

1. **Extension API pattern**: Extensions export `default function(pi: ExtensionAPI)`, import types from `@mariozechner/pi-coding-agent`. Register tools via `pi.registerTool()`, hooks via `pi.on()`. See `extensions/web-search.ts` for minimal example.

2. **Session events available**: server.ts subscribes to `tool_execution_end` (has `toolName`), `turn_end` (has `usage`), `message_update`. Extensions use `pi.on("session_shutdown", ...)` confirmed in subagent-http.

3. **correlationId flow**: Request body → `body.correlationId || requestId` in server.ts line 597. Subagent-http passes `correlationId: parentSessionId` (lines 215, 295). Already propagates across delegation boundaries.

4. **Session directory layout**: `/workspace/sessions/{requestId}/` with `output/`, `workproduct/`, `scratch/` subdirs. Created at server.ts lines 218-220, before `createAgentSession()` at line 225.

5. **Dockerfile copies extensions to `/root/.pi/agent/extensions/`**. Base stage (line 13-18) copies shared extensions. Planner stage (line 46-47) copies artifacts + subagent-http only. Each agent stage then copies its `.pi/agent/` config.

6. **No OpenLineage code exists yet**. Term only appears in spec/planning docs.

7. **Marquez manages own schema via Flyway**. We just need database + user created in init SQL. Env vars: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`.

8. **MARQUEZ_URL delivery**: Follow existing pattern — add env var to each agent's environment block in docker-compose, same as `ARTIFACT_SERVICE_URL`.

9. **Context file approach**: server.ts writes `.provenance-context.json` to sessionDir between dir creation (line 221) and session creation (line 225). Extension reads it during init.

## Wave 1 — 3 parallel subagents

### W1-A: Docker + DB Infrastructure
- **Files:** `docker-compose.yml`, `scripts/init-artifact-db.sql`
- **Depends on:** none
- **Changes:**
  - docker-compose.yml: Add `marquez-api` service (marquezproject/marquez:latest, ports 5000+5001, depends_on postgres, env vars for DB connection) and `marquez-web` service (marquezproject/marquez-web:latest, port 3001→3000, points at marquez-api)
  - docker-compose.yml: Add `MARQUEZ_URL: "http://marquez-api:5000"` to environment of all 7 agent services (planner, researcher, data, writer, publisher, coder, qa)
  - docker-compose.yml: Add `marquez-api` to artifact-service depends_on (not strictly needed but ensures Marquez is up for lineage queries)
  - scripts/init-artifact-db.sql: After existing artifact_store setup, reconnect to postgres DB, create `marquez` database + `marquez` user with password, grant privileges

### W1-B: Provenance Extension (new files)
- **Files:** `src/agents/extensions/provenance/index.ts`, `src/agents/extensions/provenance/classifications.ts`, `src/agents/extensions/provenance/openlineage.ts`
- **Depends on:** none
- **Changes:**
  - `classifications.ts`: Tool classification registry mapping tool names → READ/WRITE/COMPUTE + URI builder functions. Covers filesystem (read/write/edit), research (web_search, deep_research, scrape_apify), MCP (Notion/Linear/Github glob patterns), workproduct (record_finding, record_metric, etc). Unknown tools default to COMPUTE.
  - `openlineage.ts`: OpenLineage event builder + HTTP emitter. Functions: `buildRunEvent()`, `emitEvent()` (POST to MARQUEZ_URL/api/v1/lineage), `buildInputDataset()`, `buildOutputDataset()`. Fire-and-forget with error logging, never blocks agent execution.
  - `index.ts`: Main extension (~200 lines). On init: reads `.provenance-context.json` from cwd for correlationId/causationId/agentName/runId. Maintains contextWindow (Set of input URIs) and outputs array. Hooks: `tool_call` → classify + track reads in contextWindow. `tool_result` → for WRITE tools, record output with URI. Emits START event on init. Counts tool calls, emits RUNNING every 30 tool calls. Emits COMPLETE on `session_shutdown`. All events include piAgent_correlation custom facet.

### W1-C: Server + Dockerfile Integration
- **Files:** `src/agents/server.ts`, `src/agents/Dockerfile`
- **Depends on:** none
- **Changes:**
  - server.ts: In `processInvocation()`, after session dir creation (line 221) and before `createAgentSession()` (line 225), write `.provenance-context.json` with `{ correlationId, causationId, agentName, runId, marquezUrl }`. correlationId = `body.correlationId || requestId`. causationId = `body.correlationId || null` (null for top-level invocations). agentName = `AGENT_NAME` env. runId = `requestId`. marquezUrl = `process.env.MARQUEZ_URL`.
  - Dockerfile base stage: Add `COPY extensions/provenance/ /root/.pi/agent/extensions/provenance/` after line 18 (after web-search.ts copy)
  - Dockerfile planner stage: Add `COPY extensions/provenance/ /root/.pi/agent/extensions/provenance/` after line 47 (after subagent-http copy)

## Verification

After all subagents merge:

```bash
# Structure check
ls src/agents/extensions/provenance/
# Should show: index.ts, classifications.ts, openlineage.ts

# Marquez in docker-compose
grep -c "marquez" docker-compose.yml
# Should be >= 10 (service names, env vars, depends)

# MARQUEZ_URL in all agents
grep "MARQUEZ_URL" docker-compose.yml | wc -l
# Should be >= 7

# Provenance context in server.ts
grep "provenance-context" src/agents/server.ts
# Should find the writeFileSync call

# Dockerfile copies
grep "provenance" src/agents/Dockerfile
# Should find 2 COPY lines (base + planner)

# Init SQL has marquez
grep -i "marquez" scripts/init-artifact-db.sql
# Should find database + role creation

# No syntax errors in new TS files
cd src/agents && bun build --no-bundle extensions/provenance/index.ts 2>&1 | head -5
```

## Subagent count: 3 (3 in Wave 1)
