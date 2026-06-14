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

## V4 Pro fails agentic tasks — benchmark rankings don't predict production behavior

**Date:** 2026-06-08
**Trigger:** Upgraded all agents from V4 Flash to V4 Pro (#1 on Artificial Analysis agentic index). Researcher on V4 Pro ignored structured output requirements — 42 turns of markdown reports, 0 findings, despite identical AGENTS.md that V4 Flash follows perfectly. Writer on V4 Pro timed out at 600s twice. Same researcher task completed in 4 minutes with 30 structured findings on V4 Flash. V4 Pro also exhibits possible shared rate limiting under high platform traffic (500 concurrency pool vs Flash's 2500).
**Rule:** Benchmark rankings (agentic index, BFCL) measure capability in controlled settings, not reliability in production. A model that scores higher on tool-calling benchmarks may still ignore system prompt constraints in long-running agentic sessions. The only valid test is running the actual pipeline with the actual prompts. When upgrading models, run E2E-30 (full planner pipeline) before committing — it tests autonomous behavior under abstract briefs, which is where regressions appear.
**How to apply:** Never upgrade the default model based on benchmark data alone. Run E2E-30 with the new model. If researcher produces 0 findings or agents timeout, the model is not production-ready regardless of its benchmark score. V4 Pro is retained in plan/review fallback chains where its reasoning helps, but not as default/agentic.

---

## Programmatic output validation needed — prompt-only enforcement fails across model changes

**Date:** 2026-06-08
**Trigger:** Researcher AGENTS.md says "If you complete a task with only a markdown report and no structured findings, you have not met the standard." V4 Flash follows this. V4 Pro ignores it. The instruction has no programmatic teeth — the server marks any completed session as "completed" regardless of output quality.
**Rule:** Any mandatory output requirement (researcher must produce JSONL findings, writer must produce report artifact) needs programmatic enforcement, not just prompt language. Prompt-only constraints are model-dependent and will break on model upgrades. Mid-run enforcement (checking findings count after N turns) is better than post-run validation (checking after 42 wasted turns).
**How to apply:** Implement output validation in the agent process. For researcher: after turn N (e.g. 5), if query_findings returns 0, inject a correction or abort. For writer: check write_artifact was called before marking complete. The server should not report "completed" for a run that produced no required artifacts.

---

## Researcher should use all research tools in parallel, not just web search

**Date:** 2026-06-08
**Trigger:** Lineage report showed only 1 Instagram profile (ohneis652) was directly examined. All other findings came from blog articles and web search. Researcher has access to deep_research, Apify scrapers, and web_search but defaulted to web_search for everything.
**Rule:** Research tools aren't a hierarchy — they're parallel coverage with different strengths. Deep research gives broad landscape understanding across hundreds of sources (best for initial sweep and knowing where to go deep). Apify gives primary data from platforms (actual follower counts, engagement rates, content metadata). Web search is fast for targeted lookups and may surface valuable or valueless results quickly. All three can run in parallel, taking best K results from each. The researcher doesn't have to choose one over the others.
**How to apply:** (1) Researcher should fan out all three tools in parallel for platform research tasks: deep_research for landscape, Apify for primary profile data, web_search for targeted context. (2) Data agent needs proper implementation for numerical/content analysis of scraped datasets from Apify. (3) Planner should delegate data-intensive analysis to data agent, not just researcher.

---

## Hooks for jidoka — fail loudly and early, not after 50 minutes

**Date:** 2026-06-08
**Trigger:** V4 Pro ran 42 turns producing zero findings over 7 minutes. Writer timed out at 600s twice. Planner waited 53 minutes total before the pipeline failed. No programmatic check caught the problem mid-run.
**Rule:** Toyota's jidoka principle: detect defects immediately and stop the line. Every agent should have hooks that check output quality at regular intervals during execution, not just at the end. The andon cord (escalation) should pull automatically when an agent is producing the wrong type of output. This is model-independent — hooks enforce the standard regardless of which model is running.
**How to apply:** Implement Pi hooks (post-turn or periodic) that check: (1) researcher: query_findings count after turn 5 — if 0, inject correction or abort; (2) writer: check write_artifact called before session ends; (3) all agents: abort if turn count exceeds 2x expected maximum. These are poka-yoke (error prevention) mechanisms, not quality checks — they prevent wasted compute, not bad content.

---

## Pi SDK `createAgentSessionFromServices` hardcodes services.cwd — per-session cwd requires `createAgentSession`

**Date:** 2026-06-09
**Trigger:** Session isolation spec claimed `SessionManager.inMemory(sessionDir)` would propagate cwd to all tools. Test showed agents still working in `/workspace/scratch`. Root cause: `createAgentSessionFromServices` passes `options.services.cwd` to `createAgentSession`, which overrides `sessionManager.getCwd()`. The services cwd was set once at boot to `/workspace/scratch`.
**Rule:** `createAgentSessionFromServices` is a convenience wrapper that hardcodes `cwd: options.services.cwd`. To get per-session cwd, call `createAgentSession` directly with `cwd: sessionDir` while reusing all other services (agentDir, authStorage, settingsManager, modelRegistry, resourceLoader). The SDK resolves cwd as: `options.cwd ?? sessionManager.getCwd() ?? process.cwd()`. Only the first wins.
**How to apply:** When sharing services across sessions but needing per-session directories (concurrency), never use `createAgentSessionFromServices`. Use `createAgentSession` with explicit cwd + reused services. Verify with a bash `pwd` test before trusting spec claims about SDK behavior.

---

## Spec claims about SDK internals must be verified by test, not code reading

**Date:** 2026-06-09
**Trigger:** Session isolation spec "Resolved Question 1" said cwd propagates from `SessionManager.inMemory(sessionDir)` to all tools, citing specific SDK source lines. The claim was wrong — `createAgentSessionFromServices` passes `services.cwd`, not `sessionManager.getCwd()`. The spec author read SDK source but missed the override in the wrapper function.
**Rule:** When a spec claims behavior from a third-party SDK (especially "the fix is one line"), verify with a running test before implementing the full feature. A 30-second smoke test (invoke agent, check pwd output) would have caught this immediately. Code reading finds what CAN happen; testing finds what DOES happen.
**How to apply:** For any spec that includes "Resolved Question" sections about SDK behavior, add a verification step to the implementation plan: "Run minimal smoke test confirming claimed behavior before building on it."

---

## E2E tests must give goals, not imperative instructions

**Date:** 2026-06-07
**Trigger:** E2E-30 initial draft gave the researcher agent a numbered list of 8 research dimensions, told it which tools to use per dimension, and specified a minimum finding count. This defeats the purpose of testing agent coordination — we were testing whether the agent follows instructions, not whether it can plan and execute autonomously.
**Rule:** When testing subagent coordination, the orchestrating prompt must be a goal brief: what outcome is needed and why, not how to get there. The agent decides its own plan, tool selection, and research structure. The test harness captures the plan the agent made and judges plan quality separately from output quality.
**How to apply:** Before writing a pi_run prompt in an e2e test, check: does this prompt contain step numbers, tool names, or quantity targets? If yes, rewrite as a goal. Quantity expectations belong in test assertions, not in the prompt.

---

## SDK bugs need server-level resilience, not just SDK patches

**Date:** 2026-06-09
**Trigger:** Pi SDK crashes with "Cannot continue from message role: assistant" after planner's third subagent returns. Root cause: `handleRunFailure` stacks a second assistant message; `_prepareRetry` only pops one. All subagent work completes but planner output is lost.
**Rule:** When depending on a third-party SDK's internal message/state management, the server must handle SDK-internal failures gracefully. The SDK's retry logic has a known double-assistant-message bug — our server can't fix the SDK, but it can: (1) detect the specific error pattern, (2) return captured output if subagents already completed (degraded success), (3) retry with a fresh session if no output was captured.
**How to apply:** Any new error pattern from the SDK should be caught in server.ts with specific detection (regex match), not generic error handling. Log the SDK error details (attempt, output length, turns completed) so the pattern is debuggable. The retry creates a fresh session — usage/output accumulators survive across retries since they're declared outside the retry loop.

---

## Tool parameters for binary content must support file paths, not just strings

**Date:** 2026-06-09
**Trigger:** Coder agent rendered a 38KB PNG carousel slide correctly, then called write_artifact with the file path as the content string (not the actual binary data). The extension wrote the 29-byte path string as the artifact. write_artifact only accepted a `content: string` parameter — impossible to pass binary data through an LLM tool call string parameter.
**Rule:** Any tool that agents use to publish files must support a `file_path` parameter alongside `content`. Agents render binary files to disk (via Playwright, ffmpeg, etc.) and cannot pass binary data through string parameters. The tool reads the file from disk when given a path.
**How to apply:** When adding new write/publish tools to extensions, always include a file_path alternative. Check existing tools for the same gap — any tool that writes files and only accepts string content will break on binary output.

---

## Pi SDK extensions require explicit `bindExtensions({})` — silent no-op without it

**Date:** 2026-06-10
**Trigger:** pi-otel configured on all agents (settings.json otel block, pi-otel npm-installed in container), but zero traces reached OpenObserve. Root cause: server.ts called `createAgentSession` but never called `session.bindExtensions({})`. The Pi SDK's extension lifecycle hooks (`session_start`, `before_agent_start`, etc.) only fire AFTER `bindExtensions` is called. Without it, pi-otel's `session_start` handler never runs, OTel SDK never initializes, no spans are created.
**Rule:** `createAgentSession` creates the session object but does NOT activate extensions. You must call `await session.bindExtensions({})` after session creation to fire extension lifecycle events. This is not documented prominently — the only evidence is in agent-session.js where `bindExtensions` calls `this._extensionRunner.emit(this._sessionStartEvent)`. Also pass `sessionStartEvent: { type: "session_start", reason: "new" }` in the `createAgentSession` config to ensure the event payload is correct.
**How to apply:** Any server.ts change that touches session creation must preserve the `bindExtensions({})` call. If adding a new agent type or changing session initialization flow, verify OTel traces still appear in OpenObserve after the change.

---

## pi-otel HTTP path bug — use gRPC protocol to avoid it

**Date:** 2026-06-10
**Trigger:** Even after wiring pi-otel to an OTel Collector, traces failed with HTTP protocol. Root cause: pi-otel's `pickByProtocol` passes `url: cfg.endpoint` directly to OTel HTTP exporters without appending signal-specific paths (`/v1/traces`, `/v1/metrics`, `/v1/logs`). The OTel HTTP exporters expect the base URL and handle path appending themselves, but pi-otel's usage bypasses that. gRPC protocol doesn't use URL paths (uses service definitions), so it's unaffected.
**Rule:** When configuring pi-otel, always use `"protocol": "grpc"` in settings.json. The HTTP protocol path has a known bug in `pickByProtocol` (sdk.js) that sends requests to the base endpoint without signal paths. gRPC avoids this entirely. An OTel Collector sits between agents and OpenObserve — agents send gRPC to collector:4317, collector exports HTTP (with correct paths) to OpenObserve.
**How to apply:** All agent settings.json files must have `"protocol": "grpc"` and `"endpoint": "http://otel-collector:4317"`. The artifact-service (which uses a custom logger.mjs with `fetch()` and manually appends `/v1/logs`) connects to collector:4318 (HTTP). Never point pi-otel directly at OpenObserve — always go through the collector.

---

## Artifact type normalization belongs at source and destination, not in the pipe

**Date:** 2026-06-09
**Trigger:** Replicator upload failed with Postgres CHECK constraint violation — planner wrote a manifest file with an artifact_type not in the allowed list. Initial fix put type normalization in replicator.ts, which was wrong — replicator is a dumb pipe. Adding type knowledge to the replicator couples it to every agent's domain vocabulary.
**Rule:** Type normalization happens at two boundaries: (1) the source — workproduct extensions in each agent that standardize types before calling publish_artifact, (2) the destination — artifact service routes.ts that normalizes on ingest as a safety net. If a new agent invents a new type, update the workproduct extension for that agent and the artifact service constraint. (Note: replicator was removed — publish_artifact replaced the sidecar → replicator → upload chain.)

## Dynamic imports in server.ts must resolve from /app/ — pi extension packages are invisible

**Date:** 2026-06-10
**Trigger:** `await import("@opentelemetry/api")` in server.ts silently failed. Package existed in `/root/.pi/agent/npm/node_modules/` (pi-otel's tree) but not in `/app/node_modules/` where Bun resolves for server.ts. Try/catch swallowed the error, `otelApi` stayed null, all tracing code was no-op with zero visible symptoms.
**Rule:** Any package server.ts imports must be in `src/agents/package.json`. Pi extensions install to `/root/.pi/agent/npm/node_modules/` which is not on the resolution path for `/app/`. The `@opentelemetry/api` package uses `Symbol.for()` for process-global singleton state, so duplicate copies safely share TracerProvider/ContextManager.
**How to apply:** Before adding `import("pkg")` to server.ts, add `pkg` to `src/agents/package.json`, run `bun install`, rebuild.

## OTel API must be a direct dependency of server.ts, not just transitive via pi-otel

**Date:** 2026-06-10
**Trigger:** Added `await import("@opentelemetry/api")` to server.ts for manual trace propagation. Import silently failed because @opentelemetry/api only existed in `/root/.pi/agent/npm/node_modules/` (pi-otel's dependency tree), not in `/app/node_modules/` where server.ts resolves modules. The try/catch swallowed the error, `otelApi` stayed null, all tracing code was silently no-op. No error in logs.
**Rule:** When server.ts (or any `/app/` code) needs to import a package, it must be in `src/agents/package.json` — even if the same package exists elsewhere in the container (pi extensions, npm packages). Bun resolves from the importing file's location. Pi extensions live in `/root/.pi/agent/npm/node_modules/` which is NOT on the resolution path for `/app/server.ts`. The @opentelemetry/api package uses `Symbol.for()` for process-global singleton state, so having two copies (one in /app/, one in pi-otel's tree) is safe — they share the same TracerProvider.
**How to apply:** Before using `import("some-package")` in server.ts, verify it's in `src/agents/package.json`. Run `bun install` to update the lockfile. Test with `docker exec <container> sh -c "bun -e \"require('some-package')\""` from /app/ context to verify resolution.

## Extensions must not couple to other extensions

**Date:** 2026-06-12
**Trigger:** Provenance spec v1 had provenance extension signal the replicator on write tool_result to trigger artifact upload. Implementation went through multiple sessions trying to wire hook → signal → upload. When provenance was misconfigured, artifact uploads silently broke. The coupling was the root cause — lineage tracking (observability) should never be a dependency of data storage (infrastructure).
**Rule:** No extension should depend on, trigger, or signal another extension. Each extension does one thing. If two actions need to happen in sequence (write a file, then publish it), the AGENT handles that sequencing via explicit tool calls, not hidden extension wiring. Extensions are leaves, not links in a chain.
**How to apply:** When designing a new extension, check: does this extension need another extension to be loaded for its core function to work? If yes, the design is wrong — split the shared concern into something the agent or server owns. When reviewing extension code, grep for imports from other extension directories — those are coupling violations.

---

## publish_artifact replaces write_artifact + replicator + sidecars

**Date:** 2026-06-12
**Trigger:** write_artifact combined three concerns: file creation, metadata sidecar creation, and artifact upload triggering (via sidecar → replicator → artifact service). Removing any part broke the chain. The replicator was a filesystem watcher that parsed .meta.json sidecars — fragile on timing, races, and missed events. The entire chain existed because v1 tried to make artifact publishing automatic and invisible.
**Rule:** Explicit is better than automatic for agent actions. `publish_artifact` is a single tool that reads a local file and uploads via HTTP. The agent decides what to publish and when. No sidecars, no filesystem watching, no replicator module. Workproduct tools write validated local files. `publish_artifact` uploads them. Two steps, zero coupling.
**How to apply:** Any "automatic" behavior that chains extensions together should be replaced with an explicit agent tool call. If the agent needs to do X then Y, give it tools for X and Y and let the prompt teach the sequence. Don't wire X's extension to trigger Y's extension internally.

---

## Tool policy enforcement must be independent of provenance tracking

**Date:** 2026-06-12
**Trigger:** v1 spec put tool policy enforcement (blocking write/edit for non-coder agents) inside the provenance extension. This meant an agent couldn't have tool access controls without also having lineage tracking enabled. These are orthogonal concerns — access control is a security/quality decision, lineage is an observability decision.
**Rule:** Tool policy is its own extension (or server-level hook). It reads `runtimeConfig.toolPolicy` from agent.json and blocks disallowed tools. It doesn't import, reference, or depend on the provenance extension. An agent can have tool policy without provenance, provenance without tool policy, both, or neither.
**How to apply:** When adding enforcement logic, check: is this enforcement orthogonal to the extension's primary purpose? If a provenance extension is enforcing access control, or a workproduct extension is triggering uploads, the concern is in the wrong place.

---

## Cross-agent OTel trace propagation — bypass AsyncLocalStorage, use pi-otel events

**Date:** 2026-06-13
**Trigger:** Each agent created independent traces in OpenObserve — no unified view of planner → researcher → writer → QA orchestration. Attempted 4 approaches before finding the working solution.
**Root cause chain:**
1. Pi SDK tool dispatch breaks AsyncLocalStorage — context.active() returns ROOT_CONTEXT inside tool execute(), even when context.with() wraps the session. This is by design (extension isolation).
2. @opentelemetry/api installed in two locations (/app/node_modules and /root/.pi/agent/npm/node_modules) initially appeared to create separate global states, but `Symbol.for('opentelemetry.js.api.1')` shares state across copies. The duplicate wasn't the real problem.
3. Pi SDK has no metadata/context passthrough — createAgentSession, sessionStartEvent, bindExtensions, ExtensionContext are all closed interfaces with no room for custom data like traceparent.
4. pi-otel always parents pi.interaction off otelContext.active() — no TRACEPARENT env var, no header extraction.

**Working solution:**
- Sending side: subagent-http listens for `pi-otel:trace-active` event (inter-extension channel), stores traceId, constructs traceparent header manually with `randomBytes(8)` for spanId. No @opentelemetry/api import needed.
- Receiving side: server.ts extracts parent context from traceparent header via `propagation.extract()` after `bindExtensions()`. Wraps `session.prompt()` in `context.with(parentCtx)`. Works because `before_agent_start` fires synchronously during prompt() — pi-otel picks up the parent. Symbol.for() ensures server.ts's @opentelemetry/api copy sees the propagator pi-otel registered.
- Result: 365 spans across 4 agents in one trace.

**Failed approaches (don't repeat):**
1. Symlinks in Dockerfile to unify @opentelemetry/api copies — unnecessary (Symbol.for handles it)
2. NODE_PATH to share node_modules — unnecessary (Symbol.for handles it)
3. AsyncHooksContextManager registration at startup — doesn't help because Pi SDK tool dispatch still breaks the async chain
4. context.with() wrapping the entire session — works for synchronous events but NOT for tool execution

**How to apply:** When integrating OTel across Pi SDK extensions, never rely on context.active() during tool execution. Use pi-otel's event channels (pi-otel:trace-active, pi-otel:status) for inter-extension data sharing. Multiple copies of @opentelemetry/api are safe at the same major version thanks to Symbol.for().

---

## pollUntilDone must recognize all terminal states — not just completed/failed

**Date:** 2026-06-13
**Trigger:** Smoke test planner stuck at turn 4 for 10+ minutes. Root cause: researcher hit maxTurns (60), server.ts set state to "cancelled". pollUntilDone in poll.ts only checked for "completed" or "failed" as terminal states, so it kept polling the "cancelled" run until its own 10-minute timeout.
**Rule:** Any state machine consumer must handle ALL terminal states, not just the happy-path ones. server.ts can produce four terminal states: completed, failed, cancelled, timeout. Poll code that only checks two will silently hang on the other two.
**How to apply:** When adding new terminal states to server.ts (or any state machine), grep all consumers of that state for exhaustive matching. poll.ts, formatResult, and any test assertions that check state must all handle every possible terminal value.

---

## Subagent artifacts have their own run_id — use `since` for pipeline-scoped queries

**Date:** 2026-06-10
**Trigger:** E2E-30 TypeScript migration. `artifactsByRun(plannerRunId)` returned 0 results despite 9 artifacts created by researcher + writer. Each agent generates its own sessionId via `createAgentSession`; artifact run_id = subagent's sessionId, not planner's requestId. Planner passes `correlationId` (its sessionId) but subagents don't use it as artifact run_id.
**Rule:** To query all artifacts from a pipeline run (planner + subagents), use `GET /artifacts?since=<invokeTimestamp>` with a timestamp captured before the invoke call. `run_id` only matches a single agent's artifacts. The `since` parameter is supported by the artifact service (metastore.ts line 95, routes.ts line 224).
**How to apply:** In E2E tests, capture `new Date().toISOString()` before `plannerRun()`, pass to `artifactsSince_time()`. Never use `artifactsByRun(plannerRunId)` expecting cross-agent results.
