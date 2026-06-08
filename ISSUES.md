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

## OPEN: Model identity has no single source of truth

**Status:** Open
**Severity:** High — causes silent wrong-model execution and misleading diagnostics

**Problem:** The model an agent runs on is configured in 4 independent places, none authoritative:

| Source | What it controls | Example value |
|--------|-----------------|---------------|
| `settings.json` defaultProvider/defaultModel | Pi CLI runtime model selection | `cerebras` / `qwen-3-32b` |
| `config.yml` modelRoles.default | Role-based model routing (only when a role is requested) | `cerebras/qwen-3-32b` |
| `server.mjs` PI_PROVIDER/PI_MODEL env vars | /describe, /health, /result model field (reporting only) | defaults to `minimax/MiniMax-M2.7` |
| `docker-compose.yml` environment | Can override PI_PROVIDER/PI_MODEL per service | not set for workers |

**Consequences observed:**
1. Writer ran on deepseek-chat (settings.json) while config.yml said qwen-3-32b and /describe reported minimax
2. E2E-32 model validation test checks /describe, which reports server.mjs defaults, not the actual model Pi CLI uses
3. After fixing settings.json, /describe still showed minimax because server.mjs has its own hardcoded defaults
4. Planner needs different model than workers but server.mjs has one global default

**Root cause:** Model identity evolved incrementally — server.mjs predates config.yml, settings.json was added separately, docker-compose env vars are a third layer. No single file was designated as source of truth.

**Desired state:** One place defines the model per agent. Everything else reads from it.

**Options to evaluate:**
1. **docker-compose.yml as source of truth** — PI_PROVIDER/PI_MODEL env vars per service. server.mjs reads from env (already does). settings.json and config.yml read from env at container startup (needs init script)
2. **settings.json as source of truth** — server.mjs reads settings.json at startup instead of env vars. config.yml modelRoles.default stays aligned manually
3. **config.yml as source of truth** — server.mjs parses config.yml for the default model. settings.json generated from config.yml

**Interim fix applied:** Updated server.mjs defaults from minimax to cerebras/qwen-3-32b, added PI_PROVIDER/PI_MODEL to planner in docker-compose.yml. All settings.json files aligned. This is duct tape — the 4-source problem remains.

---

## OPEN: Cerebras removed Qwen3 32B and Llama 3.3 70B from API

**Status:** Open — blocks all agent execution
**Severity:** Critical

**Discovery:** After aligning all agents to `cerebras/qwen-3-32b`, every request returns 0 tokens in ~400ms. Direct API test confirms: `{"message":"Model qwen-3-32b does not exist or you do not have access to it.","type":"not_found_error"}`.

**Current Cerebras models:** Only `gpt-oss-120b` and `zai-glm-4.7` available. Qwen3 32B, Llama 3.3 70B, and Llama 3.1 8B all removed.

**Impact:** Primary model (qwen-3-32b) and first fallback (llama-3.3-70b) both gone. All worker agents produce empty responses. The smol chain (groq/llama-3.1-8b) and plan chain (deepseek/deepseek-reasoner) are unaffected since they use different providers.

**Pi SDK behavior:** Pi SDK silently returns empty response when model not found instead of throwing an error. The `|| true` fallback-chain behavior in config.yml should catch this, but the server shows 0 tokens and completes — suggesting Pi SDK treats the API error as a successful empty completion rather than triggering fallback.

**Additional finding:** Groq free tier has 6K TPM limit for Qwen3 32B, 12K for Llama 3.3 70B. Fully-loaded agent system prompts are ~15K tokens (AGENTS.md + all extensions). Pi SDK silently returns 0 tokens on 413 errors instead of falling back. The model works fine via Pi CLI without extensions (~2K tokens) or from a clean dir.

**Next steps:**
1. Fix models.json apiKey format: use `$GROQ_API_KEY` not `GROQ_API_KEY` (Pi auto-migrates but warns)
2. Evaluate providers with no/high TPM limits for free tier: DeepSeek (deepseek-chat works, proven in E2E-33 first run), OpenRouter free models
3. Fix Pi SDK silent failure — 413 errors should trigger fallback chain, not return empty
4. Consider reducing extension token footprint (lazy-load tool descriptions, trim promptSnippets)
5. Update all config.yml fallback chains once new primary model chosen

---

## OPEN: Agents need hardening against model/provider failures

**Status:** Open
**Severity:** High

**Problem:** When a model provider removes models or goes down, agents silently return empty responses. No error, no fallback, no alert. The Pi SDK treats a 0-token completion as success. The test suite also doesn't catch this — E2E-32 checks the /describe model string but never verifies the agent actually generated content.

**Failure modes observed:**
1. Provider removes model (Cerebras dropped Qwen3 32B) → Pi SDK returns empty completion → server reports "completed" with 0 output → tests that check for completion pass
2. API key expires → same silent empty response
3. Rate limiting → unknown behavior, may also silently degrade

**Hardening needed in server.mjs:**
- Detect 0-token completions and treat as failure, not success
- Log a clear error when output tokens = 0 after a non-trivial prompt
- Trigger fallback chain on empty completions (if Pi SDK supports it)
- Report actual model used in result (from API response), not configured model

**Hardening needed in tests:**
- E2E-32 model validation: send a task and verify output > 0 tokens, not just completion state
- All E2E tests: check output length as a baseline assertion (e.g. output > 100 chars)
- Add a "model smoke test" that sends "say hello" and verifies non-empty response before running full test suite
- Test fallback chain behavior: mock primary model failure, verify agent falls back

**Hardening needed in monitoring:**
- Alert on agents completing with 0 output tokens (OpenObserve/OTLP)
- Track model identity per request in metrics (provider + model from API response, not config)

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
