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

## TESTING: Writer pipeline too complex for current models

**Severity:** High

Writer AGENTS.md has a 180-line 4-step pipeline. Previous model (deepseek-chat) used 74 turns and timed out.

**Needs test:** Does Qwen3 32B handle the writer pipeline, or does it also need simplification?

---

## PARTIALLY RESOLVED: Researcher does not use Apify for social media profiles

**Status:** Improved 2026-06-08
**Current behavior:** Researcher independently chooses to scrape structured aggregators (viralist.ai) for profile metrics rather than relying on articles. Uses web_scrape for first-party-ish data, web_search for context. This is acceptable — correct data quality instinct.
**Remaining gap:** Apify gives actual Instagram API data (A1 reliability). Aggregators like viralist.ai are B2 — good but not primary. For production-quality research, Apify should be preferred when available and budget allows.
**Future work:** Add data source tiering guidance to researcher AGENTS.md — Apify (A1, costs API credits) > aggregator scrape (B2, free) > web search articles (C3, free). Let the researcher make the cost/quality tradeoff based on the brief's requirements.

---

## RESOLVED: OpenObserve OTLP auth mismatch

**Status:** Fixed 2026-06-08
**Fix:** Updated `.env` ZO_OTLP_AUTH to match docker-compose OpenObserve password.
