# Lessons

## Passing tests with explicit instructions doesn't mean the system works

**Date:** 2026-06-08
**Trigger:** E2E-31 trials all passed — researcher produced JSONL when task said "record_finding" + "JSONL." But E2E-30 via planner always produced markdown. The smoke test proved the tools work; it didn't prove the agent uses them autonomously.
**Rule:** Test the actual deployment path, not the ideal path. If agents will receive abstract briefs from a planner, test with abstract briefs. A test that names specific tools in the prompt is testing instruction-following, not autonomous behavior. Both are valid tests but they answer different questions.
**How to apply:** E2E tests for agent output format should use goal-oriented prompts, not tool-specific prompts. Tool-specific tests (E2E-31) diagnose capability; goal-oriented tests (E2E-30) diagnose reliability.

---

## Model selection determines system behavior more than system prompts

**Date:** 2026-06-08
**Trigger:** 5 whys analysis showed deepseek-chat ignores system prompt constraints over long sessions. Same AGENTS.md, same tools, same permissions — different behavior depending on whether task is explicit or abstract. MiniMax (intended primary) silently fails every time.
**Rule:** The model IS the agent. A poorly-selected model cannot be fixed with better prompts — it will comply on short explicit tasks and drift on long abstract ones. When evaluating agent reliability, test model selection FIRST (which model follows system constraints under realistic conditions), then optimize prompts.
**How to apply:** Before investing in system prompt engineering, run the E2E-31 trial framework with abstract briefs (not explicit tool names) across candidate models. Pick the model that follows the output format without being told. THEN optimize the prompt for that model.

---

## System prompt tool-calling patterns from industry research

**Date:** 2026-06-08
**Trigger:** Agents not reliably using tools (record_finding, scrape_apify, plan) unless explicitly told in the task brief. Researched leaked system prompts and best practices.
**Key findings:**

1. **Manus pattern (strongest):** "Plain text responses are forbidden, must respond with tool use." For critical tools, mandate first-call behavior: "Your first tool call MUST be plan({ action: 'create' })."
2. **Tool description quality is highest leverage** (Anthropic engineering): "Small refinements yield dramatic improvements." Descriptions need: when to use, when NOT to use, cross-tool dependencies, output format, parameter constraints.
3. **Few-shot examples jump accuracy 11% → 75%** (LangChain): Add a concrete 3-line tool call example in the system prompt for critical workflows. Message format outperforms string format.
4. **MiniMax problematic for tool calling:** Parameter casing errors, batch signature crashes. Explains our MiniMax → deepseek-chat fallback. Consider deepseek-chat or deepseek-reasoner as primary for agentic tasks.
5. **"Recite objectives" pattern (Manus):** Writing todo/plan during execution counteracts lost-in-the-middle in long sessions. Our session-plan tool implements this.
6. **Ordering:** Tool definitions at context front, negative constraints at end. Critical workflow instructions in first 10 lines.
7. **Cursor pattern:** "NEVER output code, use edit tool instead." Frame mandatory tool use as what NOT to do without it.

**Sources:** github.com/jujumilk3/leaked-system-prompts, anthropic.com/engineering/writing-tools-for-agents, manus.im/blog/Context-Engineering-for-AI-Agents, langchain.com/blog/few-shot-prompting-to-improve-tool-calling-performance, arxiv.org/html/2602.20426v2

**How to apply:** Update agent AGENTS.md files with: (1) mandatory first-call pattern for plan tool, (2) few-shot examples for critical tool workflows, (3) improved tool descriptions with when-to/when-not-to, (4) evaluate dropping MiniMax as primary model.

---

## Planning cascades — every agent self-decomposes using domain expertise

**Date:** 2026-06-08
**Trigger:** Planner sent vague briefs to researcher, researcher didn't independently plan its approach. When given explicit step-by-step instructions (E2E-31) it performed well, but with abstract requirements it took the simplest path.
**Rule:** Planning is not just the planner's job. The planner decomposes into dependency waves (phases of parallel/sequential work). Each agent further decomposes using domain-specific knowledge — researcher plans research dimensions and source strategy, writer plans document structure and section dependencies, data agent plans extraction pipeline. The planner's delegation brief should tell agents to "decompose this using your domain expertise" rather than providing a flat task.
**How to apply:** Every agent AGENTS.md should have a "Self-planning" section near the top that describes how that agent type decomposes tasks. The planner's delegation briefs should include phase context (what precedes, what follows) and explicitly ask the agent to create its own plan before executing.

---

## Default behaviors must be in opening paragraph of agent system prompts

**Date:** 2026-06-08
**Trigger:** Researcher agent ignored record_finding and scrape_apify when given vague briefs from planner ("verified metrics with citations"), but used them correctly when the task explicitly named the tools. E2E-31 trials confirmed: 5/5 passed with explicit instructions, 0/3 E2E-30 runs passed with abstract requirements.
**Rule:** Any behavior that should happen on EVERY task — output format, tool preference, quality workflow — must appear in the first 10 lines of the agent's system prompt, before responsibilities or tool descriptions. Constraints buried at line 80+ get lost. Frame as "default behavior" not "rules to follow."
**How to apply:** When writing or reviewing an agent's AGENTS.md, check: is the most critical workflow instruction in the opening section? If it's in "Constraints" or "Tools" sections, the model may not internalize it when the incoming brief doesn't reinforce it.

---

## settings.json defaultModel overrides config.yml modelRoles — keep them aligned

**Date:** 2026-06-08
**Trigger:** Writer test ran on deepseek-chat instead of cerebras/qwen-3-32b. Root cause: settings.json had `defaultModel: "deepseek-chat"` (leftover from initial setup) while config.yml had `default: cerebras/qwen-3-32b`. Pi CLI uses settings.json defaultModel as the runtime default; config.yml modelRoles only apply when explicitly requesting a role.
**Rule:** When changing the primary model for an agent, update BOTH settings.json (defaultProvider + defaultModel) AND config.yml (modelRoles.default + modelRoles.agentic + fallbackChains). These files serve different purposes but must agree on which model is primary. The settings.json defaultModel is what actually runs; config.yml defines role-specific routing and fallback chains.
**How to apply:** After any model change, grep all agents for the old model identifier. Use E2E-32's model validation test to catch drift: it checks /describe for the expected model string.

---

## Raw http.createServer accumulates hidden bugs — use a framework

**Date:** 2026-06-08
**Trigger:** Audit of server.mjs found 5 bugs: cancel-while-queued broken (AbortController created too late, request runs anyway, double metrics decrement), unhandled promise rejection on acquireSlot chain (leaks concurrency slot permanently), setTimeout never cleared in Promise.race (timer leak), metrics.durations array grows unbounded (memory leak), events array per invocation grows unbounded and is never read.
**Rule:** Standard HTTP concerns (body parsing, size limits, request IDs, graceful shutdown, routing) are solved problems. Use Fastify (or equivalent). Reserve custom code for application logic (concurrency limiter, run tracking, SDK session management). The raw http.createServer approach saved a dependency but cost 5 bugs and ~200 lines of plumbing.
**How to apply:** For any new HTTP server in this project, start with Fastify. It shares Pino (already a dependency), handles body limits, request ID generation, graceful shutdown, and routing out of the box.

---

## Model config should have one source of truth — settings.json

**Date:** 2026-06-08
**Trigger:** PI_MODEL env var in docker-compose.yml, PI_MODEL default in server.mjs, defaultModel in settings.json, and modelRoles in config.yml all needed to agree. Three of those are redundant. When upgrading from V4 Flash to V4 Pro, had to edit 4 places per agent.
**Rule:** settings.json is the source of truth for model identity. server.mjs reads it at boot. PI_MODEL/PI_PROVIDER env vars are accepted as optional operational overrides but should not be set in docker-compose. config.yml modelRoles must agree with settings.json.
**How to apply:** After any model change, the workflow is: update settings.json + config.yml per agent, rebuild containers. No docker-compose or server.mjs edits needed.

---

## E2E tests must give goals, not imperative instructions

**Date:** 2026-06-07
**Trigger:** E2E-30 initial draft gave the researcher agent a numbered list of 8 research dimensions, told it which tools to use per dimension, and specified a minimum finding count. This defeats the purpose of testing agent coordination — we were testing whether the agent follows instructions, not whether it can plan and execute autonomously.
**Rule:** When testing subagent coordination, the orchestrating prompt must be a goal brief: what outcome is needed and why, not how to get there. The agent decides its own plan, tool selection, and research structure. The test harness captures the plan the agent made and judges plan quality separately from output quality.
**How to apply:** Before writing a pi_run prompt in an e2e test, check: does this prompt contain step numbers, tool names, or quantity targets? If yes, rewrite as a goal. Quantity expectations belong in test assertions, not in the prompt.
