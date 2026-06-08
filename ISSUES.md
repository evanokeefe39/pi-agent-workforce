# Known Issues

## RESOLVED: MiniMax-M2.7 silently fails as primary agentic model

**Status:** Fixed 2026-06-08
**Fix:** Removed MiniMax from all fallback chains. Replaced with Qwen3 32B (Cerebras, free, BFCL #2) as primary agentic model. Llama 3.3 70B as fallback. deepseek-chat removed entirely — fail loudly during development.
**Needs test:** Verify Qwen3 32B actually runs (no silent fallback) and follows tool-calling instructions.

---

## RESOLVED: Server uses process.env for per-request state

**Status:** Fixed 2026-06-08
**Fix:** Replaced process.env.RUN_ID with ctx.sessionManager.getSessionId(). Removed FIFO queue, added semaphore (MAX_CONCURRENT_SESSIONS). All extensions updated.
**Needs test:** Verify concurrent requests produce artifacts with distinct session IDs.

---

## RESOLVED: Planner timeout on multi-agent research tasks

**Status:** Fixed 2026-06-08
**Fix:** Concurrent session support (MAX_CONCURRENT_SESSIONS=3 on researcher). Planner timeout bumped to 1800s. Parallel research tasks now execute simultaneously.
**Needs test:** Verify planner completes within timeout with parallel delegation.

---

## TESTING: Agents ignore standard output format under abstract briefs

**Severity:** Critical (blocks milestone)
**Analysis:** `tasks/plans/five-whys-standard-output.md`

Changes applied:
1. Model switched from MiniMax/deepseek-chat to Qwen3 32B (BFCL #2 for tool calling)
2. AGENTS.md restructured — mandatory output workflow in first 20 lines with few-shot example
3. pi-tasks replaces custom session-plan for task tracking
4. pi-subagents (local) available for internal model routing

**Needs test:** Does Qwen3 32B follow the record_finding → JSONL workflow under abstract briefs from the planner?

---

## RESOLVED: Writer pipeline too complex for current models

**Status:** Fixed 2026-06-08
**Fix:** Replaced 193-line 4-stage pipeline (PLAN→EXPAND→STITCH→POLISH) with 3-phase fanout/fan-in: PLAN → WRITE+FIX (parallel subagents) → ASSEMBLE. Each section-writer subagent owns its section end-to-end. Dropped from 74 turns to 21 turns, 118s to completion.
**Artifacts:** `tasks/plans/writer-fanout-pipeline.md`, custom agent at `src/agents/writer/.pi/agents/section-writer.md`

---

## PARTIALLY RESOLVED: Researcher does not use Apify for social media profiles

**Status:** Improved 2026-06-08
**Current behavior:** Researcher independently chooses to scrape structured aggregators (viralist.ai) for profile metrics rather than relying on articles. Uses web_scrape for first-party-ish data, web_search for context. This is acceptable — correct data quality instinct.
**Remaining gap:** Apify gives actual Instagram API data (A1 reliability). Aggregators like viralist.ai are B2 — good but not primary. For production-quality research, Apify should be preferred when available and budget allows.
**Future work:** Add data source tiering guidance to researcher AGENTS.md — Apify (A1, costs API credits) > aggregator scrape (B2, free) > web search articles (C3, free). Let the researcher make the cost/quality tradeoff based on the brief's requirements.

---

## FIXED: settings.json defaultModel misaligned with config.yml across all workers

**Status:** Fixed 2026-06-08
**Severity:** Critical — agents ran on deepseek-chat instead of cerebras/qwen-3-32b

**Root cause:** When models were switched to Qwen3 32B, only config.yml modelRoles were updated. settings.json still had `defaultProvider: "deepseek"` and `defaultModel: "deepseek-chat"`. Pi CLI uses settings.json defaultModel as the runtime default, not config.yml modelRoles.default.

**Scope:** All 6 worker agents (writer, researcher, data, coder, qa, publisher). Planner was correct (both files said deepseek-reasoner). Additionally, coder/qa/publisher config.yml still referenced MiniMax (removed) and nvidia/maverick in fallback chains.

**Fix:** Updated settings.json in all 6 workers to `cerebras` / `qwen-3-32b`. Aligned config.yml fallback chains in coder/qa/publisher to match writer/researcher pattern (cerebras/qwen-3-32b primary, cerebras/llama-3.3-70b fallback, no minimax, no deepseek-chat).

**Needs test:** Rebuild all containers and verify /describe returns correct model. E2E-32 model validation test should catch this.

---

## OPEN: Writing-style extension tools not usable by writer agent

**Status:** Investigating
**Severity:** Medium — writer adapts by crafting its own style block, but misses mechanical validation

**Symptoms:** Writer agent said "I don't have a get_style_instructions tool" and crafted its own style block manually. Agent never attempted calling the tool — it inspected its tool list and determined the tool wasn't available.

**Investigation so far:**
- Extension files are present in container at `/root/.pi/agent/extensions/writing-style/` (index.ts, lint.ts, profile.ts, metrics.ts)
- Data files present at `/app/data/style/` (default-profile.json, platforms.json, formulas.json, excess-words.json)
- Startup logs show 12 extensions loaded, no errors
- /describe endpoint shows 12 extensions but tools array is empty (endpoint doesn't enumerate tools)
- The agent DID use `write_artifact` (from artifacts extension) successfully, proving some extension tools work
- The `|| true` in Dockerfile `pi extensions install` swallows any compilation errors

**Possible causes (in priority order):**
1. Extension registers tools but the model can't discover them in its tool catalog (model issue — deepseek-chat may not surface extension tools reliably)
2. TypeScript compilation failure during `pi extensions install` silenced by `|| true`
3. writing-style extension has no package.json (though other working extensions like artifacts also lack one)
4. Extension dependency issue — profile.ts imports from metrics.ts which may fail to compile

**Next steps:**
- Rebuild with correct model (cerebras/qwen-3-32b) and retest — Qwen3 32B is BFCL #2 for tool calling
- Remove `|| true` from Dockerfile temporarily to surface any compilation errors
- Create a targeted test that sends a task specifically requesting `validate_style` and checks the result
- If tool registration is confirmed working, the issue is model-specific tool discovery

---

## RESOLVED: OpenObserve OTLP auth mismatch

**Status:** Fixed 2026-06-08
**Fix:** Updated `.env` ZO_OTLP_AUTH to match docker-compose OpenObserve password.
