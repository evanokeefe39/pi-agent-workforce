# OTel Cross-Agent Trace Propagation

## Goal

One unified trace tree in OpenObserve when planner delegates to researcher/writer/qa.
Currently each agent creates an independent trace — no way to see the full orchestration.

## Problem Statement

Planner calls researcher via HTTP (subagent-http extension). Each agent runs pi-otel
which creates `pi.interaction` as root span with a fresh trace ID. No traceparent
header is sent on the HTTP call, so the researcher can't link to the planner's trace.

## Root Cause Chain (Five Whys)

1. No `traceparent` header arrives at subagent HTTP endpoints
2. subagent-http's `propagation.inject(context.active(), headers)` found no span (old approach)
3. Pi SDK tool dispatch breaks AsyncLocalStorage — context.active() returns ROOT_CONTEXT during tool execution even when context.with() wraps the session
4. Pi SDK separates event-driven span creation (pi-otel) from tool execution (separate async path) — AsyncLocalStorage doesn't survive the boundary
5. This is by design in Pi SDK — extension isolation is intentional

**Conclusion:** OTel automatic context propagation (AsyncLocalStorage) cannot work through Pi SDK tool dispatch. Manual trace ID passing is required.

## Key Findings

### Pi SDK API Surface
- `createAgentSession`, `sessionStartEvent`, `bindExtensions`, `ExtensionContext` are all closed typed interfaces — no metadata bag or context passthrough
- pi-otel always parents `pi.interaction` off `otelContext.active()` — no TRACEPARENT env var reading, no header extraction
- pi-otel emits `pi-otel:trace-active` event with `{ traceId }` after creating the interaction span — usable for inter-extension communication

### @opentelemetry/api Singleton via Symbol.for()
- `@opentelemetry/api` stores global state on `globalThis[Symbol.for('opentelemetry.js.api.1')]`
- Multiple copies at same major version share TracerProvider, ContextManager, Propagator
- This means separate copies in `/app/node_modules/` and `/root/.pi/agent/npm/node_modules/` SHOULD share state
- Unverified in Bun — theoretically sound (Symbol.for is spec-level JS)

### What We Verified
- `context.with()` works immediately inside callback: `hasSpanInside=true`
- `context.with()` does NOT survive to tool execution: `hasSpan=false` in subagent-http inject
- `before_agent_start` fires synchronously during `session.prompt()` — so context.with around prompt() SHOULD make pi-otel inherit the parent trace
- Two copies of @opentelemetry/api exist in container: `/app/node_modules/` (bun install) and `/root/.pi/agent/npm/node_modules/` (pi-otel dep)
- subagent-http at `/root/.pi/agent/extensions/subagent-http/` cannot resolve @opentelemetry/api from its path at all

## Design

### Sending Side (planner → subagent HTTP call)

subagent-http extension listens for `pi-otel:trace-active` event, stores traceId.
On outgoing HTTP invoke, constructs `traceparent: 00-{traceId}-{randomSpanId}-01`
header manually. No @opentelemetry/api dependency needed.

**Status: Implemented.** Changes in:
- `src/agents/extensions/subagent-http/src/transport/http-client.ts` — setActiveTraceId(), makeTraceparent()
- `src/agents/extensions/subagent-http/src/extension/index.ts` — pi-otel:trace-active listener

**Coupling:** Loose. If pi-otel not loaded, traceId stays null, no header sent. Downstream agent ignores missing header. Nothing breaks.

### Receiving Side (subagent processes incoming traceparent)

server.ts extracts traceparent from incoming HTTP headers after `bindExtensions()`.
Uses `propagation.extract()` to parse W3C trace context, then wraps `session.prompt()`
in `context.with(parentCtx, ...)`. pi-otel's `startInteraction` fires synchronously
during prompt(), reads `otelContext.active()`, and parents `pi.interaction` under the
incoming trace — inheriting the planner's trace ID.

**Status: Implemented.** Changes in:
- `src/agents/server.ts` — parentCtx extraction + context.with around prompt

**Dependencies:**
- Requires `@opentelemetry/api` in server.ts to call propagation.extract + context.with
- Requires pi-otel's NodeSDK to have registered W3C propagator (it does by default)
- Requires shared global state between server.ts and pi-otel copies of @opentelemetry/api (Symbol.for should handle this)
- Requires pi-otel's context manager for context.with to work (registered during bindExtensions)

### Module Resolution

**Current state:** @opentelemetry/api removed from src/agents/package.json. Dockerfile has `rm -rf /app/node_modules/@opentelemetry` + `NODE_PATH=/root/.pi/agent/npm/node_modules`.

**Proposed:** Put @opentelemetry/api BACK in package.json. Remove Dockerfile hacks. Trust Symbol.for() global singleton. Two copies coexist, share state.

**Verified 2026-06-13:** Symbol.for() works in Bun. Two separate copies of @opentelemetry/api
share TracerProvider, ContextManager, and Propagator via globalThis. No Dockerfile hacks needed.

**Verified 2026-06-13:** After pi-otel initializes (first request), propagation.extract()
from server.ts's copy successfully parses traceparent headers using the W3C propagator
registered by pi-otel's NodeSDK via Symbol.for(). Debug endpoint /debug/otel confirms.

**Verified 2026-06-13:** Dockerfile reverted to clean state — no symlinks, no NODE_PATH,
no rm -rf. @opentelemetry/api back in package.json. Both copies coexist safely.

**Remaining risk:** context.with(parentCtx, promptFn) on receiving side — does pi-otel's
startInteraction pick up parentCtx? Verified that context.with works synchronously and
before_agent_start fires synchronously. Needs full integration test to confirm end-to-end.

## Known Issues

### 1. Concurrency bug in activeTraceId
`activeTraceId` in http-client.ts is module-scoped. Concurrent sessions in same process would race. Not a problem today (sessions serialize in practice) but latent defect.

**Fix when needed:** Key traceId by session (e.g., Map keyed by correlationId passed to invoke).

### 2. Graceful degradation
If pi-otel fails to initialize (endpoint unreachable), no propagator or context manager is registered. propagation.extract returns empty context, context.with is no-op, pi-otel creates independent trace. Acceptable — traces just aren't linked.

### 3. First request cold start
pi-otel initializes during first request's bindExtensions(). server.ts gets tracer at startup (before pi-otel). The ProxyTracer pattern handles this for spans, but the context manager isn't available until bindExtensions. context.with() before that is a no-op. First request's receiving side may not link. Second+ requests work.

## Test Plan

- [x] Verify Symbol.for() works in Bun — PASSED (2026-06-13)
- [x] Revert Dockerfile hacks, put @opentelemetry/api back in package.json — DONE
- [x] Verify propagation.extract works cross-copy after pi-otel init — PASSED (debug/otel endpoint)
- [x] Build planner + researcher with final changes — DONE
- [x] Invoke e2e-00 task (forces planner → researcher delegation) — DONE
- [x] Query OpenObserve: planner + researcher share trace_id — PASSED (trace 08246d5c...)
- [x] Full run: planner + researcher + writer + QA all in one trace — PASSED (205 spans, 4 services)
- [x] Remove /debug/otel endpoint — DONE
- [ ] Remove @opentelemetry/context-async-hooks from pi-npm/package.json (not needed)

## Changes Made (Not Yet Tested Together)

| File | Change |
|------|--------|
| `src/agents/extensions/subagent-http/src/transport/http-client.ts` | Removed @opentelemetry/api import. Added setActiveTraceId + makeTraceparent. Injects traceparent header on invoke. |
| `src/agents/extensions/subagent-http/src/extension/index.ts` | Listens for pi-otel:trace-active, calls setActiveTraceId |
| `src/agents/server.ts` | After bindExtensions, extracts parentCtx from incoming traceparent header. Wraps session.prompt() in context.with(parentCtx). Removed debug logging. Removed context-async-hooks registration. |
| `src/agents/package.json` | @opentelemetry/api and context-async-hooks removed (needs @opentelemetry/api added back) |
| `src/agents/pi-npm/package.json` | Added @opentelemetry/context-async-hooks (can remove — no longer needed) |
| `src/agents/Dockerfile` | Has NODE_PATH + rm -rf hacks (revert pending Symbol.for test) |

## Next Steps

1. Verify Symbol.for() in Bun (quick spike in container)
2. Clean up Dockerfile and package.json based on result
3. Build and run full integration test
4. Remove @opentelemetry/context-async-hooks from pi-npm/package.json (not needed)
5. Consider: remove provenance extension entirely (user indicated it's going away)
