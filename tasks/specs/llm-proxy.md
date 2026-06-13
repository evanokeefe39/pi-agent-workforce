# LLM Resilience Layer

## Intent

Eliminate planner SDK hangs and malformed tool-call failures caused by DeepSeek V4 Flash responses. Based on industry research across LiteLLM, OpenAI SDK, Instructor, Guardrails AI, CrewAI, AutoGen, and the Pi SDK itself.

## Research Findings (2026-06-12)

### The problem
Pi SDK issues #2119 and #2381 document three failure modes:
1. Truncated streaming response: `stopReason: "toolUse"` with zero toolCall blocks → agent silently idles
2. `runLoop()` throws → EventStream never ends → consumer hangs forever  
3. Orphaned toolResults after crash → session unrecoverable

### Industry standard: three-level defense
Every production framework uses some combination of:

**Level 0 — Constrained decoding.** OpenAI/Anthropic `strict: true` guarantees schema-valid JSON at the token level (<0.1% failure). DeepSeek supports this via OpenAI-compatible API but reliability varies.

**Level 1 — Deterministic JSON repair.** Libraries like `json_repair` fix missing quotes, trailing commas, unclosed brackets. Zero API calls, sub-millisecond. Raises success rate from ~75% to ~99%. CrewAI uses this, AG2 has a simpler version.

**Level 2 — Validate-and-reask.** The universal pattern: validate output → on failure, append error message to conversation → re-prompt LLM → repeat 2-3 times. Every framework does this (Instructor, CrewAI, AutoGen, OpenAI Agents SDK, Pydantic AI). The error message becomes part of the next prompt, giving specific correction feedback.

**Level 3 — Transport retry.** HTTP-level: retry 429, 408, 500+ with exponential backoff. LiteLLM handles this well.

### Streaming is universally problematic for validation
- Instructor: validators disabled during streaming
- Guardrails AI: REASK not supported during streaming
- LiteLLM: streaming tool calls can silently drop tool_call deltas, no post-stream validation, JSON schema validation doesn't work with streaming
- Pi SDK: truncated streams cause silent hangs
- Consensus: no framework has solved validate-and-retry for streaming

### Pi SDK cannot disable streaming
Streaming is hardcoded in the agent loop for lifecycle events. Not configurable via config.yml.

### LiteLLM provides transport retry but NOT response validation
LiteLLM does NOT validate tool calls in responses — no argument JSON validation, no function name validation, no schema validation. Tool call argument `arguments` stored as plain string, never parsed. Known crashes on malformed JSON across multiple providers. This is an architectural gap being addressed incrementally via bug fixes.

What LiteLLM DOES provide: provider-agnostic error types, smart multi-deployment retry, configurable per-exception-type retry policies, exponential backoff, cooldown, fallback chains.

## Architecture

Two complementary components:

### Component 1: Tool Call Validation Extension (Pi extension)
**New file:** `src/agents/extensions/tool-validation/index.ts`

Hooks `tool_call` events. For each tool call:
1. Attempt `JSON.parse(event.input)` or check the parsed input for required fields
2. If malformed: attempt deterministic repair (json-repair pattern)
3. If still malformed: return `{ block: true, reason: "Invalid JSON in tool arguments: {error}. Please retry with valid JSON." }` — this feeds the error back to the model as a correction signal (validate-and-reask pattern)
4. If valid: return undefined (pass through)

This follows the CrewAI/Instructor/OpenAI Agents SDK pattern: error → conversation context → model self-corrects.

### Component 2: LiteLLM Sidecar (Docker container)
For transport-level resilience only:
- Retry 429, 502, 503 with exponential backoff
- Fallback chains across DeepSeek → OpenRouter free models (already configured in config.yml)
- Cooldown for failing deployments
- Consistent error normalization

Config: agents point `PI_PROVIDER_URL` at `http://litellm:4000` instead of directly at DeepSeek.

## Priority Assessment

**Component 1 (validation extension) is higher priority** — directly addresses the malformed tool-call failures.

**Component 2 (LiteLLM sidecar) is lower priority** — the Pi SDK already has retry.maxRetries: 5 with fallbackChains in config.yml. LiteLLM would add smarter retry (instant failover to healthy deployments, per-exception policies) but the existing config already covers the basic case.

**Recommendation:** Build Component 1 first. Defer Component 2 until transport errors are observed as a significant failure source.

## Open Questions

- [ ] Does Pi SDK's config.yml `retry` block handle 429/502/503 from providers? If yes, LiteLLM sidecar may not be needed at all.
- [ ] Do the fixes from Pi SDK issues #2119/#2381 ship in our SDK version (5.2.0)? If yes, the streaming hang may already be mitigated.
- [ ] Can `tool_call` hook's `{ block: true, reason }` actually inject the error into the LLM conversation, or does it just prevent execution silently? Need to verify in SDK source.

## Definition of Done

- [ ] Tool validation extension catches malformed JSON tool arguments
- [ ] Error message fed back to model via block reason
- [ ] E2E-00 passes 5/5 consecutive runs (currently ~3/5)
- [ ] No planner hangs (currently ~2/5 runs hang)
