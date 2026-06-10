# Plan: Cross-Agent OTel Trace Propagation — IMPLEMENTED

## Context

Agents emit OTel spans via pi-otel (pi.interaction, pi.turn, pi.llm_request, pi.tool.*), but each agent gets an independent trace. Planner delegates to subagents via HTTP POST /invoke — no trace context propagated. Result: no parent-child span nesting across agents in OpenObserve trace waterfall.

Pi-otel uses `NodeSDK` from `@opentelemetry/sdk-node`. Calls `sdk.start()` which registers the global TracerProvider. Uses `ParentBasedSampler` which honors remote parent context. OTel API's `ProxyTracer` pattern means tracers obtained before `sdk.start()` auto-upgrade to real tracers after init. `AsyncLocalStorageContextManager` propagates context through async chains including third-party code.

## Approach

Manual trace context propagation using `@opentelemetry/api` only (no auto-instrumentation, no SDK coupling). This is the OTel-prescribed pattern when you don't control the SDK.

## Changes

### 1. server.ts — Fastify hooks for trace context extraction + span lifecycle

Add `@opentelemetry/api` as a dynamic import (try/catch, null if not available).

**onRequest hook:**
- Extract `traceparent` header via `propagation.extract(context.active(), request.headers)`
- Create server span via `tracer.startActiveSpan(name, { kind: SpanKind.SERVER }, extractedCtx, ...)`
- Store span + context on request object for downstream use
- Use `context.with(ctxWithSpan, ...)` to set active context for request lifecycle

**onResponse hook:**
- End the server span (retrieve from request object)
- Set standard HTTP attributes (method, status_code, url)

**Tracer init:**
- `trace.getTracer('agent-server')` at module load — safe before `sdk.start()` via ProxyTracer pattern
- Returns no-op tracer until pi-otel initializes, real tracer after

**Graceful degradation:**
- Dynamic import of `@opentelemetry/api` with try/catch
- If import fails (no OTel installed), all hook logic is skipped
- If SDK not yet started, ProxyTracer produces no-ops — zero errors

**File:** `src/agents/server.ts`

### 2. subagent-http — Inject traceparent into outbound invoke calls

In `http-client.ts`, before calling `fetch()`:
- `propagation.inject(context.active(), headers)` adds `traceparent` + `tracestate` headers
- Same dynamic import guard as server.ts

This is the standard OTel pattern for outbound HTTP calls without auto-instrumentation.

**File:** `src/agents/extensions/subagent-http/src/transport/http-client.ts`

### 3. Rename misleading trace_id field

Current `traceId` in server.ts is a Fastify request ID (randomUUID), not an OTel trace ID. Rename to `requestId` in code and `request_id` in log fields to eliminate semantic confusion. The OTel trace ID is managed by the SDK, not by server.ts.

**File:** `src/agents/server.ts` (rename throughout)

## What NOT to change

- No changes to pi-otel, its config, or its initialization
- No changes to artifact sidecars or artifact service — trace-to-artifact linkage is derivable from OTel spans (pi.tool.write_artifact spans carry artifact context, and they'll now be nested under the correct trace)
- No new dependencies in package.json — `@opentelemetry/api` is already transitively present via pi-otel; dynamic import means zero hard coupling
- No changes to .meta.json sidecar format or replicator
- No schema migrations

## Verification

1. `docker compose up --build` all services
2. POST planner task that delegates to researcher
3. OpenObserve trace waterfall: planner server span → pi.interaction (planner) → pi.tool.subagent → researcher server span → pi.interaction (researcher) → pi.turn → pi.tool.* — all under one trace ID
4. Invoke subagent directly (no traceparent header) — still works, gets its own root trace
5. Remove pi-otel from an agent's settings.json — server still starts, hooks produce no-ops
6. Existing E2E tests pass unchanged

## Risks

- **Fastify hook + context.with() shape:** startActiveSpan uses a callback, but Fastify hooks are discrete stages. Need to store span on request and manage context manually across hooks. Well-documented pattern, just needs care.
- **First request before SDK init:** ProxyTracer handles this — no-op spans, no errors. First request might lack tracing if it arrives before bindExtensions(). Acceptable.
- **pi-otel internal span parenting:** pi-otel creates pi.interaction as a root span. After this change, if there's an active context from our server span, pi.interaction should become a child. Needs empirical verification — if pi-otel explicitly creates a root context, it would break the chain. Fixable by checking pi-otel's spans.ts.

## Dependencies verified

- `@opentelemetry/api` ProxyTracer: tracers obtained before sdk.start() auto-upgrade (source: ProxyTracer.ts)
- `@opentelemetry/sdk-node` AsyncLocalStorageContextManager: context propagates through async chains (default in NodeSDK)
- `propagation.extract/inject`: uses globally registered W3CTraceContextPropagator (default)
- `ParentBasedSampler`: honors remote parent with sampled flag (source: ParentBasedSampler.ts)
- Fastify v5: no known AsyncLocalStorage bugs (fixed in v3.25.1)
