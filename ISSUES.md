# Known Issues

## OPEN: Planner SDK crash on multi-hop chains — "Cannot continue from message role: assistant"

**Status:** Mitigated — server-side retry + degraded success in server.ts v5.2.0. SDK bug remains.
**Severity:** Critical — blocks full pipeline completion (E2E-52 P3-P6)

**Problem:** Planner crashes after third subagent returns in Writer → Coder → Publisher pipeline. All three subagents complete successfully (artifacts created), but planner returns empty output. Error: "Cannot continue from message role: assistant".

**Root Cause Analysis (Five Whys):**

```
Problem: Planner returns empty output after all 3 subagents complete successfully
Why 1: Pi SDK throws "Cannot continue from message role: assistant" in agent.continue()
Why 2: agent.continue() requires last message NOT be role: "assistant", but it is
Why 3: _prepareRetry() removed only the synthetic error message, leaving the original
        assistant message that was being built when the failure occurred
Why 4: handleRunFailure() in pi-agent-core/agent.js stacks a SECOND assistant message
        on top of the existing one — _prepareRetry only pops one
Why 5: The retry logic assumes the error message is the ONLY assistant message at the
        end, but under tool execution failures or transient API errors (429/500/502),
        there can be two consecutive assistant messages
```

**Fix:** `_prepareRetry` (pi-coding-agent agent-session.js ~line 1996) needs to pop ALL trailing assistant messages, not just one. Or `handleRunFailure` should replace the last assistant message rather than appending.

**SDK locations:**
- `pi-agent-core/dist/agent.js` — `Agent.continue()` line 225, `handleRunFailure` line 329
- `pi-agent-core/dist/agent-loop.js` — `agentLoopContinue` line 27
- `pi-coding-agent/dist/core/agent-session.js` — `_prepareRetry` line 1977, `_handlePostAgentRun` line 667

**Evidence:**
- E2E-52: planner state "failed", empty output, 526s duration (consistent with all 3 subagents completing then failing on final turn)
- All subagent artifacts created: writer 9, coder 8 images, publisher 1
- DeepSeek V4 Flash returns transient errors under load, triggering the retry path

**Additional context:** Some models support parallel tool calling, others don't. DeepSeek V4 Flash behavior under multi-hop chains with sequential tool calls may contribute to triggering the failure path. Need to verify if model-level parallel tool calling support affects message ordering.

**Mitigation applied (server.ts v5.2.0):**
- Detect SDK message role error via regex match
- If output captured (subagents completed) → degraded success, return captured output
- If no output → retry with fresh session (MAX_PROMPT_RETRIES=2, configurable via env)
- Named event handler (`handleSessionEvent`) re-attached on retry; usage/output accumulators survive across attempts

**Verified:** E2E-52 rerun 2026-06-09 — 10/10 passed, planner completed in 527s. Retry/degraded success mitigation confirmed working after container rebuild to v5.2.0.

**Remaining:**
1. Report upstream to @earendil-works/pi-coding-agent — `_prepareRetry` should pop ALL trailing assistant messages
2. Investigate whether model-level parallel tool calling support affects message ordering

---

## OPEN: Coder rendering quality — inline HTML instead of design system components

**Status:** Open
**Severity:** Medium — functional but suboptimal output quality

**Problem:** Coder agent writes its own inline HTML for rendering instead of using design system components (Card, CarouselSlide, Typography, etc.) in project/design-system/. Results have excess whitespace, inconsistent styling, and don't match brand guidelines.

**Root cause:** No JSX transform in container — coder can't import and render React components directly. Agent writes raw HTML + inline styles, ignoring the design system entirely.

**Current behavior:** Coder receives render brief, writes standalone HTML with Playwright screenshot. Output is functional but visually inconsistent — each render is a one-off.

**Desired behavior:** Coder uses design system tokens (colors, spacing, typography) at minimum. Ideally renders design system components via a build step or pre-compiled bundle.

**Options:**
1. Pre-bundle design system components into a single JS file coder can `<script>` include
2. Inject tokens.css and component templates into coder's prompt context
3. Add esbuild/swc JSX transform to coder container
4. Accept inline HTML but enforce token usage via jidoka validation

---

## OPEN: Mid-run jidoka should escalate, not just warn

**Status:** Open
**Severity:** High — agents waste turns without correction

**Problem:** Mid-run tool check (every 10 turns) only logs warnings when required tools haven't been called. Agent continues uncorrected, potentially consuming all maxTurns producing nothing useful.

**Current behavior:** `checkMidRunTools` returns warnings, server.ts logs them. Agent keeps running.

**Desired behavior:** Escalation options at configurable thresholds:
1. Inject correction prompt into conversation ("You must use record_finding before continuing")
2. Abort run early if threshold exceeded (e.g., 50% of maxTurns with no required tool calls)
3. Both — inject correction first, abort if still no compliance after N more turns

**Blocked by:** Pi SDK may not support injecting messages mid-run. Need to investigate whether session.prompt() can be called during an active run, or if AbortController + re-prompt is the only path.

---

## OPEN: No resilience layer for malformed or non-200 LLM responses

**Status:** Open — monitor frequency before investing
**Severity:** Medium

**Problem:** When LLM providers return non-200 responses (429, 502, 503) or malformed output (truncated JSON, text instead of tool calls), the only handling is inside the Pi SDK's retry logic — which itself has bugs (see planner SDK crash issue above). No intermediate layer normalizes responses before they reach the agent loop.

**Impact:** Transient provider errors propagate into SDK state corruption. Each new failure mode requires a new server.ts workaround.

**Potential fix:** LLM API proxy between agents and providers — retries transient errors, normalizes responses, handles rate-limit backoff. All agents benefit from one layer. Also where you'd catch malformed JSON, truncated responses, parallel tool calling mismatches across models.

**Decision:** Monitor. If SDK crash or similar failures recur across multiple E2E runs, build the proxy. Current server-level retry is sufficient mitigation for now.

---

## OPEN: V4 Pro unsuitable as default agentic model

**Status:** Open
**Severity:** Critical

**Problem:** DeepSeek V4 Pro ignores structured output requirements when used as the default agentic model. Researcher ran 42 turns producing markdown prose with 0 findings recorded via `record_finding`. Writer timed out at 600s twice. Possible DeepSeek shared rate limiting contributing to writer timeouts.

**Evidence:**
- Researcher: 42 turns, 0 `record_finding` calls, output was unstructured markdown
- Writer: 600s timeout hit twice in succession
- V4 Flash (cheaper model) follows structured output requirements correctly

**Current status:** V4 Pro demoted to plan/review fallback only. V4 Flash is the default agentic model for all workers.

**Remaining work:** Evaluate whether V4 Pro can be used reliably for non-agentic tasks (planning, review) or if it should be removed from fallback chains entirely.

---

## OPEN: Writer invents confidence scales instead of passing through ADMIRALTY grades

**Status:** Open
**Severity:** Medium

**Problem:** Writer fabricates H/M/L confidence ratings instead of passing through the ADMIRALTY grades (A-F reliability, 1-6 credibility) attached to findings. The planner reinforced this by telling the writer to use H/M/L in its delegation brief.

**Fix applied:** Citation format added to `src/agents/writer/.pi/agents/section-writer.md` specifying ADMIRALTY grade passthrough.

**Remaining work:** Test that the section-writer actually uses ADMIRALTY grades in output. Verify planner delegation briefs no longer instruct writer to use H/M/L.

---

## OPEN: E2E-30 report generation fails silently

**Status:** Open
**Severity:** Medium

**Problem:** E2E-30 full pipeline test produces no report file. `write_report` fails silently when the LLM-as-judge section errors. Test output is truncated, masking the failure.

**Next steps:**
- Investigate LLM-as-judge section error in E2E-30
- Make `write_report` fail loudly when a section errors instead of silently dropping
- Ensure test output is not truncated so failures are visible

---

## PARTIALLY RESOLVED: Agents ignore standard output format under abstract briefs

**Status:** Partially resolved
**Severity:** High

**What changed:** V4 Flash follows structured output requirements (record_finding workflow, JSONL artifacts). V4 Pro does not (42 turns, 0 findings). Prompt-only enforcement is model-dependent.

**Remaining work:** Programmatic enforcement via hooks is still needed. Mid-run validation should detect when an agent has consumed N turns without producing expected artifacts and intervene. Prompt-only enforcement is insufficient across model changes.

---

## PARTIALLY RESOLVED: Model identity has no single source of truth

**Status:** Partially resolved
**Severity:** High

**What changed:** server.mjs now reads from settings.json at boot. PI_MODEL/PI_PROVIDER removed from docker-compose.yml. Down from 4 sources of truth to 2.

**Remaining sources:**
| Source | What it controls |
|--------|-----------------|
| `settings.json` defaultProvider/defaultModel | Pi CLI runtime model selection + server.mjs reporting |
| `config.yml` modelRoles | Role-based model routing, fallback chains |

**Remaining work:** config.yml and settings.json still require manual alignment. When the default model changes, both files in every agent must be updated. A single source of truth (one file generates or validates the other) has not been implemented.

---

## PARTIALLY RESOLVED: Agents need hardening with jidoka/hooks for mid-run validation

**Status:** Partially resolved
**Severity:** High

**What changed (2026-06-09):**
- `jidoka.ts` extracted as pure validation module: `validateZeroOutput`, `validateRequiredTools`, `checkMidRunTools`, `checkMaxTurns`, `validateRun`
- Zero-output detection: 0 output tokens = failed, not completed
- Turn breaker: abort at maxTurns via AbortController
- Mid-run tool warnings: every 10 turns, logs if required tools not yet called
- Post-run required tools check: run fails if specified tools never called
- All validation config driven by `agent.json runtimeConfig.validation`
- E2E-32 validates this behavior (11/11 passing)

**Remaining work:**
- Mid-run tool check should escalate (inject correction prompt or abort), not just warn
- Model identity reporting from API response (currently logs configured model, not actual)
- OpenObserve alerting on 0-output completions
- Fallback chain testing when provider goes down

---

## OPEN: Researcher should fan out deep_research + Apify + web_search in parallel

**Status:** Open
**Severity:** Medium

**Previous framing:** "Researcher does not use Apify." The issue is broader: researcher should fan out deep_research, Apify, and web_search in parallel rather than treating them as a hierarchy.

**Current behavior:** Researcher independently chooses to scrape structured aggregators for profile metrics. Uses web_scrape for first-party-ish data, web_search for context. Acceptable but suboptimal.

**Desired behavior:** For any research task, researcher fires deep_research + Apify + web_search concurrently, then merges and deduplicates findings. Apify gives actual API data (A1 reliability). Aggregators are B2. Web search articles are C3.

**Additional gap:** Data agent needs implementation for numerical analysis of scraped data. Currently data agent can scrape but does not perform statistical or trend analysis on the results.

---

## OPEN: Writing-style extension tools not usable by writer agent

**Status:** Investigating
**Severity:** Medium — writer adapts by crafting its own style block, but misses mechanical validation

**Symptoms:** Writer agent said "I don't have a get_style_instructions tool" and crafted its own style block manually. Agent never attempted calling the tool — it inspected its tool list and determined the tool wasn't available.

**Investigation so far:**
- Extension files present in container at `/root/.pi/agent/extensions/writing-style/` (index.ts, lint.ts, profile.ts, metrics.ts)
- Data files present at `/app/data/style/`
- Startup logs show 12 extensions loaded, no errors
- /describe endpoint shows 12 extensions but tools array is empty (endpoint doesn't enumerate tools)
- Agent DID use `write_artifact` (from artifacts extension) successfully, proving some extension tools work
- The `|| true` in Dockerfile `pi extensions install` swallows any compilation errors

**Unknown:** Whether the model change to V4 Flash resolves this. V4 Flash has better tool-calling compliance than previous models but this has not been retested.

**Next steps:**
- Rebuild with V4 Flash and retest
- Remove `|| true` from Dockerfile temporarily to surface compilation errors
- Create targeted test that sends a task requesting `validate_style` and checks the result

---

## OPEN: Server invoke span not exported to collector

**Status:** Investigating
**Severity:** Low — trace propagation works without it, this is cosmetic

**Problem:** server.ts creates a span via `tracer.startSpan("${AGENT_NAME} invoke", ...)` in the /invoke route handler. Pi-otel's spans (pi.interaction, pi.turn, pi.llm_request) correctly inherit the trace context from our `context.with()` wrapper. But the server span itself never appears in OpenObserve.

**What works:** traceparent header extraction, context propagation to pi-otel, pi.interaction correctly parents under the injected span ID. The full cross-agent trace chain connects.

**What doesn't:** the server invoke span is invisible — it doesn't land in the collector/OpenObserve.

**Likely cause:** ProxyTracer timing. `trace.getTracer("agent-server")` is called in `start()` before pi-otel's `sdk.start()` (which happens during first request's `bindExtensions()`). The ProxyTracer returns NoOpSpan for the first request. By the second request the ProxyTracer is upgraded, but the span may still not export because it goes through a different code path than pi-otel's BatchSpanProcessor, or the BatchSpanProcessor hasn't flushed before the process exits/restarts.

**Next steps:**
- Move tracer initialization to after first `bindExtensions()` call
- Or create the tracer lazily on first use (after pi-otel has initialized)
- Verify with a third request and explicit flush delay

---

## OPEN: Pi SDK runtime npm install causes 3-4 minute startup delay

**Status:** Known, not a regression
**Severity:** Medium — slows container startup, causes Docker healthcheck failures

**Problem:** `createAgentSessionServices()` (Pi SDK) runs npm install at startup to resolve extension dependencies. Takes ~225s, dominated by a single `npm install` that removes 129 packages and adds 2 (3 minutes). This happens despite `pi extensions install` running at Docker build time.

**Evidence:**
```
added 2 packages, removed 129 packages, and audited 89 packages in 3m
added 6 packages, and audited 95 packages in 7s
added 2 packages, and audited 97 packages in 3s
```

**Impact:** Docker healthcheck (start_period: 15s) marks containers unhealthy before SDK init completes. Dependent containers (planner depends on researcher/writer/publisher) fail to start on first attempt, requiring manual `docker compose up -d planner` after workers are healthy.

**Not a regression:** This behavior predates the OTel trace propagation changes. The Pi SDK resolves at runtime, not just build time.

**Possible mitigations:**
- Increase healthcheck start_period to 300s
- Pre-warm the npm cache at build time
- Investigate why `pi extensions install` at build time doesn't prevent runtime re-resolution

---

## OPEN: Container cold start still 55s after pre-install optimization

**Status:** Open — monitor, low priority
**Severity:** Low

**Problem:** Container startup reduced from 225s to 55s via pre-install + PI_OFFLINE=1 (commit 1845faf), but 55s is still slow. Healthcheck start_period must accommodate this delay, and first request after startup has added latency.

**What was done:**
- All npm packages pre-installed at Docker build time
- PI_OFFLINE=1 set to skip runtime npm resolution
- Startup went from 225s → 55s (4x improvement)

**Remaining 55s breakdown (estimated):**
- Pi SDK initialization (createAgentSessionServices, extension loading)
- Bun + Fastify server setup
- Extension compilation/registration (12 extensions)

**Possible further optimizations:**
1. Profile SDK init to find the dominant cost
2. Lazy extension loading — only compile extensions on first use, not at startup
3. Pre-compile extensions at build time if Pi SDK supports it
4. Snapshot/cache the initialized SDK state
5. Warm pool — keep one pre-initialized session ready

**Not urgent:** Current 55s is workable with appropriate healthcheck start_period. Optimize when it becomes a bottleneck for iteration speed or scaling.

---

## OPEN: Migrate E2E tests from bash to Bun/TypeScript

**Status:** E2E-30 migrated, remaining tests not started
**Severity:** Medium — test brittleness blocks reliable CI and pipeline validation

**Problem:** E2E tests written in bash (jsonl-helpers.sh + per-test .sh scripts) are fragile. E2E-30 fails silently due to shell limitations, not actual pipeline failures.

**Root causes of brittleness:**
1. Shell heredoc expansion on megabytes of JSONL content (write_report uses `cat <<EOF` with `$@`)
2. No run scoping — artifact queries return all-time results, source analysis loop processes all 67 datasets instead of just this run's
3. `2>/dev/null || true` everywhere swallows errors silently
4. Bash variables holding large JSON content corrupt or truncate
5. `docker logs | grep` for tool counting is fuzzy — matches log messages, accumulates across runs
6. `set -euo pipefail` + bash arithmetic (`((_PASS++))`) has exit-code edge cases
7. `artifacts_since` uses count diff, not filtered query — breaks under concurrent runs

**Decision:** Migrate to Bun + TypeScript (`bun:test`).

**Why Bun/TS over Python:**
- Bun already in every container, TypeScript is the project language — no new runtime
- `bun:test` has expect/assertions, beforeAll hooks, describe/it blocks
- Native fetch, async/await for polling, proper JSON handling
- Typed responses, shares types with server.ts
- Avoids maintaining tests in a third language

**Migration plan:**
1. Create `tests/e2e/helpers.ts` — shared utilities (health check, planner invoke/poll, artifact queries, run-scoped filtering)
2. Rewrite E2E-30 as `tests/e2e/e2e-30-instagram-growth-research.test.ts` — template for all migrations
3. Migrate other tests incrementally, bash scripts remain until replaced
4. Remove jsonl-helpers.sh when all tests migrated

---

## OPEN: Agent-to-user escalation over HTTP — AskUserQuestion equivalent

**Status:** Not started
**Severity:** Medium — blocks interactive use cases where agents need human input mid-run

**Problem:** Agents running as HTTP services have no mechanism to ask the user a question or request permission during execution. In interactive pi CLI, tools like `AskUserQuestion` pause and prompt the user. Over HTTP (POST /invoke → 202 → poll), the agent runs asynchronously with no back-channel to the caller.

**Use cases:**
- Agent encounters ambiguity and wants clarification before proceeding
- Agent wants permission before an expensive or destructive operation
- Quality gate where human approval is needed mid-pipeline (e.g., publisher HITL)

**Considerations:**
- The /invoke HTTP protocol is fire-and-forget with polling — no bidirectional channel
- Options: WebSocket upgrade, long-poll on a /questions endpoint, queue-and-wait pattern where agent blocks until answer arrives via a separate POST
- Must work for both interactive (host pi agent as caller) and deployed (planner as caller) scenarios
- When host pi agent is the caller, could bridge back to pi CLI's native AskUserQuestion

**Next steps:**
- Design the escalation protocol (HTTP endpoint shape, timeout behavior, what happens if no one answers)
- Determine how pi-otel spans should represent blocked-on-human time
- Prototype with a simple /questions/:runId endpoint

---

## PARTIALLY RESOLVED: Session isolation and artifact replication architecture

**Status:** Core implementation done, tested. Remaining: session cleanup, docker-compose sysctls.
**Severity:** High

**What changed (2026-06-09):**
- server.ts creates `/workspace/sessions/{traceId}/` per invocation with `output/`, `workproduct/`, `scratch/` subdirs
- server.ts calls `createAgentSession` (not `createAgentSessionFromServices`) with `cwd: sessionDir` — all Pi SDK tools (bash, read, write) operate in session dir
- `jidoka.ts` — pure validation functions extracted from server.ts
- `replicator.ts` — fs.watch on `/workspace/sessions/` for `.meta.json` files, uploads paired artifact via ArtifactStore interface
- `artifact-store.ts` — ArtifactStore interface + HttpArtifactStore calling artifact service REST API
- Extensions (`write_artifact`, `record_query_result`, etc.) write `.meta.json` sidecars + append to `provenance.jsonl`
- Agent-complete gate: waits for all sidecars to replicate before marking run done
- E2E-35: 11 tests covering session dirs, concurrent isolation, replication, sidecar writes, dir structure

**Key finding:** Spec's "Resolved Question 1" was wrong — `createAgentSessionFromServices` hardcodes `services.cwd`, so `SessionManager.inMemory(sessionDir)` alone doesn't propagate cwd to tools. Fix: call `createAgentSession` directly with `cwd: sessionDir`.

**What changed (2026-06-09 afternoon):**
- write_artifact extension: added `file_path` parameter for binary files (images, PDFs). Agents render to disk then publish by path, solving the binary truncation bug.
- Postgres artifact_type constraint: added `image`, `render`, `document`, `package` types.
- E2E-51: 13/13 passing — coder renders 1080×1350 PNG, binary artifact replicates at full size.

**What changed (2026-06-09 night):**
- Postgres artifact_type constraint: added `manifest` type.
- Data workproduct extension: `dataset_ref` type normalized to `dataset` at source (was sending raw "dataset_ref" which violated constraint).
- Artifact service routes.ts: type normalization safety net on ingest — aliases (`dataset_ref` → `dataset`, `query_result` → `dataset`) and fallback to `document` for unknown types.
- Replicator stays a dumb pipe — no type knowledge, passes artifact_type through untouched.

**Remaining work:**
- Session directory cleanup (TTL-based, post-replication)
- Docker-compose sysctls for inotify limits (`fs.inotify.max_user_watches`, `fs.inotify.max_user_instances`)
- Verify replication under high file volume (current testing: 2-5 files per session)

---

## FEATURE: Publisher agent — full specification and deployment

**Status:** Implemented, tested (E2E-50 C1–C8)
**Priority:** High
**Spec:** `tasks/specs/publisher-agent.md`

**What shipped:** AGENTS.md rewritten to 136 lines with 6-phase pipeline (RECEIVE → ASSEMBLE → CHECKLIST → STAGE → PUBLISH → TRACK), 3 operating modes, rendering delegation protocol with render brief schema, HITL gating. docker-compose :8085, RBAC, planner subagent config. agent.json capabilities updated.

---

## FEATURE: Shared skills infrastructure

**Status:** Implemented, tested (E2E-50 A1–A6)
**Priority:** High
**Spec:** `tasks/specs/shared-skills-infrastructure.md`

**What shipped:** `src/agents/skills/` with brand-guidelines (color palette, typography, voice/tone, visual identity, anti-patterns) and platform-formats (dimensions, safe zones, render brief schema). Dockerfile COPY into publisher, coder, qa targets.

---

## FEATURE: Project workspace — persistent versioned asset storage

**Status:** Implemented, tested (E2E-50 B1–B5)
**Priority:** Medium
**Spec:** `tasks/specs/project-workspace.md`

**What shipped:** `project/` directory with design-system, brand, templates, reference, archive subdirs. README.md. docker-compose read-only bind mount on publisher, coder, data services.

---

## FEATURE: Planner routing hints — rendering delegation and publisher integration

**Status:** Implemented, tested (E2E-50 E1–E5)
**Priority:** High
**Spec:** `tasks/specs/planner-routing-hints.md`

**What shipped:** Content Production Routing section in planner AGENTS.md with 6-entry chain table, rendering delegation pattern, multi-phase example. Publisher + coder added to subagent-http config.json.

---

## FEATURE: Coder agent — rendering capability

**Status:** Implemented, tested (E2E-50 D1–D8)
**Priority:** High
**Spec:** `tasks/specs/coder-rendering-capability.md`

**What shipped:** Coder AGENTS.md expanded to 88 lines with rendering workflow, render types table, design system reference. Dockerfile coder-deps stage (Chromium + React + Playwright). docker-compose :8086 with 4G memory. RBAC expanded. Shared skills COPY.

---

<details>
<summary>Resolved Issues</summary>

## RESOLVED: Cerebras removed Qwen3 32B and Llama 3.3 70B from API

**Status:** Resolved 2026-06-08
**Fix:** All agents migrated to DeepSeek V4 Flash as default agentic model. Cerebras removed from provider catalog entirely. Fallback chains updated across all agent config.yml and settings.json files.

---

## RESOLVED: MiniMax-M2.7 silently fails as primary agentic model

**Status:** Resolved 2026-06-08
**Fix:** Removed MiniMax from all fallback chains. Replaced with Qwen3 32B (Cerebras, free, BFCL #2) as primary agentic model. Llama 3.3 70B as fallback. deepseek-chat removed entirely. Subsequently migrated again to DeepSeek V4 when Cerebras removed models.

---

## RESOLVED: Server uses process.env for per-request state

**Status:** Resolved 2026-06-08
**Fix:** Replaced process.env.RUN_ID with ctx.sessionManager.getSessionId(). Removed FIFO queue, added semaphore (MAX_CONCURRENT_SESSIONS). All extensions updated.

---

## RESOLVED: Planner timeout on multi-agent research tasks

**Status:** Resolved 2026-06-08
**Fix:** Concurrent session support (MAX_CONCURRENT_SESSIONS=3 on researcher). Planner timeout bumped to 1800s. Parallel research tasks now execute simultaneously.

---

## RESOLVED: Writer pipeline too complex for current models

**Status:** Resolved 2026-06-08
**Fix:** Replaced 193-line 4-stage pipeline (PLAN->EXPAND->STITCH->POLISH) with 3-phase fanout/fan-in: PLAN -> WRITE+FIX (parallel subagents) -> ASSEMBLE. Each section-writer subagent owns its section end-to-end. Dropped from 74 turns to 21 turns, 118s to completion.

---

## RESOLVED: settings.json defaultModel misaligned with config.yml across all workers

**Status:** Resolved 2026-06-08
**Fix:** Updated settings.json in all workers to match config.yml. Subsequently migrated to DeepSeek V4 with both files aligned.

---

## RESOLVED: OpenObserve OTLP auth mismatch

**Status:** Resolved 2026-06-08
**Fix:** Updated `.env` ZO_OTLP_AUTH to match docker-compose OpenObserve password.

---

## RESOLVED: OTel traces not reaching OpenObserve — pi-otel silent init failure

**Status:** Resolved 2026-06-10
**Severity:** High — zero observability despite pi-otel configured on all agents

**Problem:** pi-otel was configured in every agent's settings.json and npm-installed in Docker containers, but zero traces appeared in OpenObserve. Two independent root causes:

1. **`bindExtensions` never called.** server.ts called `createAgentSession` but not `session.bindExtensions({})`. Pi SDK extension lifecycle hooks (`session_start`) only fire after `bindExtensions`. Without it, pi-otel's OTel SDK never initialized — no spans created, no exports attempted. Completely silent failure.

2. **pi-otel `pickByProtocol` HTTP path bug.** When using HTTP protocol, pi-otel passes `url: cfg.endpoint` to OTel HTTP exporters without appending signal-specific paths (`/v1/traces`, `/v1/metrics`, `/v1/logs`). Requests hit the base URL and get 404/dropped. gRPC protocol is unaffected (uses service definitions, no URL paths).

**Fix:**
- Added `sessionStartEvent: { type: "session_start", reason: "new" }` to `createAgentSession` config
- Added `await session.bindExtensions({})` after session creation in server.ts
- Switched all agents from HTTP to gRPC protocol (`"protocol": "grpc"`) in settings.json
- Added OTel Collector between agents and OpenObserve (otel-collector-config.yaml, docker-compose service)
- Agents send gRPC to collector:4317, collector exports HTTP to OpenObserve (with correct paths)
- Artifact-service (custom logger.mjs) uses HTTP to collector:4318

**Verified:** `pi.interaction`, `pi.turn`, `pi.llm_request` spans confirmed in OpenObserve from researcher agent test invocations.

</details>
