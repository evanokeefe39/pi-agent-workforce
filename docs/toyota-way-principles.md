# The Toyota Way in Multi-Agent Systems

This project applies principles from the Toyota Production System (TPS) to multi-agent AI orchestration. LLM agents share many failure modes with manufacturing lines: silent defects, overproduction, context waste, and cascading failures. TPS provides battle-tested patterns for exactly these problems.

## Why TPS applies to AI agents

A factory produces physical goods through a sequence of stations. A multi-agent system produces knowledge artifacts through a sequence of LLM agents. Both face the same core challenges:

| Manufacturing problem | Agent equivalent |
|----------------------|-----------------|
| Defective parts passed downstream | Agent produces wrong output, next agent builds on it |
| Station produces more than ordered | Agent over-generates, bloating context and cost |
| Worker doesn't stop the line for defects | Agent runs 60 turns producing nothing useful |
| No one inspects until final QA | Planner discovers bad research only after writer finishes |
| Raw material quality varies | LLM response quality varies by model, load, and prompt |

TPS solves these with a small set of principles. Here's how each one maps to this system.

## Jidoka — automation with a human touch

**TPS meaning:** Every station can stop the production line when it detects a defect. Quality is built into the process, not inspected at the end.

**Why it matters for agents:** An LLM agent can silently produce garbage for 60 turns. Without jidoka, the planner won't know until the run times out and the next agent receives unusable input. By then, 10 minutes and thousands of tokens are wasted.

**Implementation:** `src/agents/jidoka.ts` — pure validation functions, no I/O.

| Check | What it catches | TPS analog |
|-------|----------------|------------|
| `validateZeroOutput` | Model returned 0 tokens — empty response | Machine produced nothing, stop the line |
| `validateRequiredTools` | Agent never called required tools (e.g., `record_finding`) | Worker skipped a mandatory step |
| `checkMaxTurns` | Agent exceeded turn limit (researcher: 60, writer: 50) | Machine running too long on one piece |
| `checkMidRunTools` | Every 10 turns, warns if required tools haven't been used | Periodic in-process inspection |

When jidoka fails a run, `server.ts` marks it as failed immediately. The planner gets a clear signal instead of empty output to debug. The line stops at the station that produced the defect.

**What's still missing:** Mid-run escalation. Currently jidoka warns but doesn't inject corrections or abort early. This is the equivalent of an andon light that nobody responds to — it needs to pull the cord. Tracked in ISSUES.md.

## Andon — signal and stop

**TPS meaning:** The andon cord lets any worker stop the line and signal for help. Stopping is correct behavior, not failure.

**Why it matters for agents:** LLM agents don't naturally ask for help. They hallucinate, improvise, or loop. The system needs explicit mechanisms to surface problems rather than hiding them in token streams.

**Implementation:** Andon signals appear throughout the system:

- **`andon_max_turns`** — server.ts aborts the run via AbortController when turn limit is hit
- **`andon_validation_failed`** — post-run validation failure logged with full context (tool calls, turns, usage)
- **`andon_zero_output`** — model produced nothing, run marked failed
- **Specification gate** (CLAUDE.md factory instructions) — development process stops if the specification is incomplete, rather than proceeding with assumptions

All andon events are structured log entries that flow through pi-otel to OpenObserve, making them searchable and alertable.

## Muda — eliminate waste

**TPS meaning:** Seven types of waste. Identify and remove each one systematically.

**Why it matters for agents:** LLM agents are expensive in time, tokens, and API cost. Every wasted turn is real money. Every unnecessary tool call is latency. Every oversized context window is a degraded response.

### Waste types in agent systems

**Overproduction** — agent generates more than requested.
- *Mitigation:* Tool policy extension (`src/agents/extensions/tool-policy/`) blocks tools the agent shouldn't use. Planner can't run web_search directly — it must delegate. Writer can't run bash — it uses workproduct tools. The Dockerfile enforces this by only copying relevant extensions into each agent's container.

**Over-processing** — spending expensive operations on low-value work.
- *Mitigation:* Context compaction extension (`src/agents/extensions/context-compaction/`) truncates large tool results. A 50KB web page becomes 800 chars with a pointer to the full content. Prevents context window bloat that causes agents to lose their system prompt instructions mid-run.

**Waiting** — agents idle while waiting for dependencies.
- *Mitigation:* Parallel delegation via `subagent({ tasks: [...] })`. Researcher can run 3 concurrent sessions. Planner fires parallel research tasks instead of sequencing them.

**Defect propagation** — bad output passes to the next agent.
- *Mitigation:* Jidoka post-run validation (above). Required tools check ensures structured output exists before marking a run complete. ADMIRALTY grading on research findings gives the writer explicit quality signals to hedge uncertain claims.

**Context waste** — starting work without sufficient information.
- *Mitigation:* The specification gate in the development process (CLAUDE.md). For agents at runtime: the planner's delegation briefs include context about what precedes and follows the task, so agents decompose with full awareness.

**Inventory** — storing more intermediate state than needed.
- *Mitigation:* Session isolation with scoped directories. Each run gets its own `/workspace/sessions/{id}/` directory. No shared mutable state between runs. Run history capped at 100 entries to prevent memory growth.

## Genchi Genbutsu — go and see

**TPS meaning:** Go to the actual place, observe the actual process, understand the actual problem. Don't make decisions from reports and abstractions.

**Why it matters for agents:** LLM failures are almost always surprising. You can't predict what a model will do from its documentation — you have to observe actual behavior under actual conditions.

**Implementation:**

- **Distributed tracing** — every agent exports OpenTelemetry spans (pi.interaction, pi.turn, pi.llm_request) via gRPC to OpenObserve. Cross-agent traces are linked via W3C traceparent headers. You can follow a single request from planner through researcher through writer, seeing every LLM call, tool invocation, and timing breakdown. This is genchi genbutsu applied to observability: don't guess what the agent did, go and see the actual trace.

- **Session directories** — every tool result, finding, and intermediate file is preserved in `/workspace/sessions/{id}/scratch/`. When an agent fails, you can inspect the exact files it produced and the exact tool results it received. Full tool outputs that were compacted for the LLM context are preserved at their original size.

- **Structured logging** — all significant events (`request_received`, `session_created`, `andon_*`, `request_complete`) are structured Pino logs with correlation IDs. Searchable in OpenObserve.

## Heijunka — level the workload

**TPS meaning:** Smooth production to avoid peaks and valleys. Don't batch; flow.

**Why it matters for agents:** Without leveling, the planner fires 5 parallel research tasks and overwhelms a single researcher container. Or 3 agents hit the same LLM provider simultaneously and trigger rate limiting.

**Implementation:**

- **Concurrency semaphore** — each agent has `MAX_CONCURRENT_SESSIONS` (researcher: 3, writer: 2, planner: 1). Excess requests queue up to `QUEUE_MAX_DEPTH`. Beyond that, 429 is returned. This prevents overload without unbounded queuing.

- **Fallback chains** — when the primary model (DeepSeek V4 Flash) is rate-limited, agents fall back to free models (Kimi K2.6, GPT-OSS 120B) via config.yml retry chains. Load shifts to available capacity rather than blocking.

- **Docker resource limits** — each agent container has a memory cap (512 MB default, 2 GB for data, 4 GB for coder). Prevents one agent from starving others.

## Poka-Yoke — mistake-proofing

**TPS meaning:** Design the process so errors are impossible or immediately obvious. Don't rely on worker attention.

**Why it matters for agents:** LLMs are unreliable by nature. They skip steps, call wrong tools, produce malformed output. The system must make common mistakes impossible rather than hoping the prompt prevents them.

**Implementation:**

- **Tool policy extension** — blocks disallowed tools at the extension level. The writer physically cannot call `bash` or `write` — the extension intercepts the tool call and returns an error message directing the agent to the correct tool. The error becomes part of the conversation, so the model self-corrects.

- **RBAC on artifact service** — `rbac.json` defines which agents can read/write which artifact types. Enforced at the HTTP layer, not by the prompt.

- **Dockerfile tool isolation** — the planner's Dockerfile stage doesn't include research extensions. Even if the model tries to call `web_search`, the tool doesn't exist. Delegation is the only path.

- **Artifact type constraints** — Postgres CHECK constraint on `artifact_type`. If an agent invents a type not in the allowed list, the INSERT fails. Caught at the database boundary, not in agent code.

- **Typed validation config** — `agent.json` declares maxTurns and requiredTools as structured data, not prose in a prompt. Server.ts enforces them mechanically.

## Kaizen — continuous improvement

**TPS meaning:** Small, incremental improvements driven by data from the production floor. Every defect is a learning opportunity.

**Why it matters for agents:** Agent systems fail in novel ways constantly. Each failure reveals a gap in the specification, the prompt, or the architecture. Without a systematic way to capture and apply these lessons, you fix the same class of bug repeatedly.

**Implementation:**

- **`tasks/lessons.md`** — correction log updated after every mistake. Each entry has a trigger (what went wrong), a rule (what to do differently), and application guidance (when and where the rule applies). This file is read before starting any new work.

- **Five Whys protocol** — applied to every non-trivial failure before implementing a fix. Prevents symptom-level patches. Example: "pollUntilDone hangs" → "only recognized 2 of 4 terminal states" → "state enum was hardcoded, not derived from the API spec." The fix goes to the root cause, not the symptom.

- **ISSUES.md with resolution tracking** — open issues include root cause analysis, attempted fixes, and remaining work. Resolved issues are collapsed but preserved, creating an institutional memory of failure patterns.

- **Specification factory** (CLAUDE.md) — the development process itself is continuously improved. Schema gaps discovered during review are logged in the continuous improvement section and update the specification template for next time.

## Respect for People

**TPS meaning:** The system supports the people doing the work. Don't ask people to compensate for system failures.

**Why it matters for agents:** In this context, "people" includes both the human operator and the LLM agents themselves. An agent running without proper context, tools, or guardrails is set up to fail — like a worker without proper tooling.

**Implementation:**

- **Context compaction** — doesn't just save tokens, it keeps the agent's "attention" on its instructions. A researcher that ingests 50KB of web page content loses track of its system prompt. Compaction preserves the signal-to-noise ratio the agent needs to do good work.

- **Planning cascades** — the planner doesn't micromanage. It tells the researcher "research this topic" and trusts the researcher to decompose the task using domain expertise. Each agent's AGENTS.md has a self-planning section describing how that agent type breaks down work.

- **Structured handoffs** — findings carry ADMIRALTY grades so the writer knows how much to trust each source. The writer doesn't need to re-evaluate source quality — that work was done upstream by the researcher and encoded in the data.

- **Clear error messages** — when tool-policy blocks a tool call, it tells the agent exactly what to use instead. When jidoka fails a run, the error names the specific validation that failed. Agents and operators get actionable information, not generic errors.

## Summary

| TPS Principle | Agent system application | Key implementation |
|--------------|------------------------|-------------------|
| Jidoka | Stop on defects, don't pass them downstream | `jidoka.ts` validation, andon log events |
| Andon | Signal problems immediately | Structured logging, abort on maxTurns |
| Muda | Eliminate wasted tokens, turns, and cost | Context compaction, tool policy, parallel delegation |
| Genchi Genbutsu | Observe actual agent behavior | OTel traces, session directories, structured logs |
| Heijunka | Level concurrent workload | Concurrency semaphore, fallback chains, memory limits |
| Poka-Yoke | Make common mistakes impossible | Tool policy, RBAC, Dockerfile isolation, DB constraints |
| Kaizen | Learn from every failure | lessons.md, Five Whys, ISSUES.md resolution tracking |
| Respect for People | Support agents and operators with good tooling | Context compaction, planning cascades, clear errors |

## Further reading

- *The Toyota Way* — Jeffrey Liker (2004). The definitive English-language treatment of TPS.
- *Toyota Production System* — Taiichi Ohno (1988). The original, from the creator.
- [CLAUDE.md](../CLAUDE.md) — development process built on these principles.
- [tasks/lessons.md](../tasks/lessons.md) — kaizen log of corrections and patterns.
- [ISSUES.md](../ISSUES.md) — current issues with root cause analysis.
