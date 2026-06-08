# Urgent 4: Jidoka Hooks → ISSUES/MILESTONE Cleanup → Data Agent → M0.5

## Dependency order

```
1. Jidoka hooks (safety net — everything else is unreliable without this)
   └── 2. Data agent implementation (needs hooks to validate its output)
       └── 3. M0.5: Ad hoc IG scraping (tests both Apify + data agent in small scope)
4. ISSUES/MILESTONE cleanup — DONE
```

## 1. Jidoka hooks — programmatic output validation

**Goal:** Agents fail loudly and early when producing wrong output, regardless of model.

**Scope:**

### 1a. Server-level: zero-output detection
- After Pi session completes, if outputTokens == 0, mark run as "failed" not "completed"
- Log clear error with model identity
- server.mjs change, affects all agents

### 1b. Researcher mid-run validation
- After turn 8: check if any `record_finding` tool calls have occurred in the event stream
- If not: log warning, continue (model may be planning)
- After turn 15: if still 0 findings, inject system message "You have not recorded any findings. Use record_finding now." or abort
- Mechanism: event subscriber in server.mjs counts tool calls by name per run, agent-specific thresholds in agent.json

### 1c. Writer post-run validation
- After Pi session completes, check artifact service for report-type artifacts with this run_id
- If none: mark as failed, not completed
- server.mjs change, uses artifact-query patterns from tests/e2e/artifact-query.mjs

### 1d. All agents: turn count circuit breaker
- If turn count exceeds 2x agent.json runtimeConfig max (e.g. researcher 60 turns, writer 40), abort via AbortController
- Prevents infinite loops burning tokens

### 1e. Planner: delegation result validation
- After researcher delegation returns, planner should check artifact service for dataset artifacts
- If none exist for that run: re-delegate with feedback, or fail
- This is prompt-level (AGENTS.md update), not hooks — planner already has quality assessment instructions

**Files to change:**
- `src/agents/server.mjs` — event counting, post-run validation, turn circuit breaker
- `src/agents/researcher/agent.json` — add maxTurns threshold
- `src/agents/writer/agent.json` — add maxTurns threshold
- `src/agents/planner/.pi/agent/AGENTS.md` — strengthen artifact validation step

**Tests:**
- E2E-32 already covers model validation — extend with output validation
- New test: send researcher a task that produces no web results — should fail, not complete with 0 findings

---

## 2. Data agent implementation

**Goal:** Data agent can receive scraped data (from Apify or researcher), perform numerical analysis, content/metadata analysis, and produce structured output.

**Scope:**

### 2a. Define data agent's role clearly
- Receives: raw scraped data (JSON/CSV from Apify), artifact URIs from researcher
- Produces: statistical summaries, trend analysis, comparative tables, structured datasets
- Tools: Python (code execution), DuckDB (SQL), read_artifact, write_artifact
- NOT a scraper — researcher/Apify scrapes, data agent analyzes
- NOT an LLM-judgment agent — researcher uses LLM to interpret and grade sources, data agent uses code to compute

### 2b. Analysis workflow (code-first, not LLM-first)
- LLM role: orchestrate — decide what to analyze, write Python/SQL, interpret results, record findings
- Python role: ingest data from artifact service, reshape, clean, transform
- DuckDB role: SQL queries over ingested data — aggregations, joins, statistical summaries
- Output: result sets (CSV/JSONL artifacts) + findings that link source data → result set → claim
- Lineage: every finding must reference the source artifact ID + the query/code that produced it

### 2c. Container setup
- Python already installed in data container (inherited from researcher-deps)
- DuckDB node API already installed (`npm install -g @duckdb/node-api`)
- Need: Python DuckDB package (`pip install duckdb`), artifact service client for Python (simple HTTP)
- Data agent needs code execution permission (bash/python) — already has it via Pi SDK

### 2d. Test with sample data
- Load E2E-30's findings JSONL into data agent via artifact URI
- Ask: "Analyze source reliability distribution, identify which claims have strongest/weakest backing, produce a summary table"
- Verify: produces analysis artifact with SQL/Python code trail, not LLM prose

**Files to change:**
- `src/agents/data/.pi/agent/AGENTS.md` — rewrite with code-first analysis focus
- `src/agents/data/agent.json` — update capabilities description
- `src/agents/Dockerfile` — add `pip install duckdb` to data-deps stage

---

## 3. M0.5: Ad hoc IG scraping

**Goal:** Extract structured taxonomy of design aesthetics from @vinny_creative.

**Scope:** Defined in MILESTONE.md. Tests Apify integration + data agent analysis in a small, self-contained task.

**Prerequisites:** Jidoka hooks (1) and data agent (2) working.

**Execution:** Single planner invocation. Planner delegates scraping to researcher (Apify IG scraper), analysis to data agent, synthesis to writer.

---

## Status

- [x] 4. ISSUES/MILESTONE cleanup
- [x] 1. Jidoka hooks
  - [x] 1a. Zero-output detection — server.mjs fails run on 0 output tokens
  - [x] 1b. Researcher mid-run validation — warns every 10 turns if required tools not called
  - [x] 1c. Writer post-run validation — checks artifact service for report artifact
  - [x] 1d. Turn count circuit breaker — aborts via AbortController at maxTurns
  - [ ] 1e. Planner delegation validation — prompt-level, deferred
- [ ] 2. Data agent implementation
  - [ ] 2a. Role definition
  - [ ] 2b. AGENTS.md
  - [ ] 2c. Test with sample data
- [ ] 3. M0.5 execution
