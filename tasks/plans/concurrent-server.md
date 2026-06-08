# Plan: Concurrent Server — Session ID as Correlation

## Context

server.mjs uses a FIFO queue — one request at a time. Planner's parallel research tasks queue sequentially, causing timeouts. The root blocker is `process.env.RUN_ID` as shared mutable state.

## Key insight: session ID replaces RUN_ID

Each `createAgentSessionFromServices({ sessionManager: SessionManager.inMemory() })` creates a fresh session with a unique `session.sessionId`. Extensions can access it via `ctx.sessionManager.getSessionId()` in their execute function (5th param). No process.env needed.

For parent-child correlation across agents, subagent-http forwards the parent's session ID as `correlationId` in the invoke request. The child agent stores this as `parentSessionId` for tracing.

## Changes

### 1. server.mjs — remove FIFO queue, remove process.env.RUN_ID

- Delete the FIFO queue and sequential processing
- Add semaphore for max concurrent sessions
- Stop setting `process.env.RUN_ID` — session.sessionId replaces it
- After session creation, capture `session.sessionId` for logging and run tracking
- Keep accepting `body.correlationId` from callers — store it as metadata for parent-child tracing

### 2. extensions/artifacts/index.ts — use ctx.sessionManager

```typescript
// Before:
run_id: params.run_id || process.env.RUN_ID

// After:
run_id: params.run_id || ctx.sessionManager.getSessionId()
```

### 3. extensions/session-plan.ts — use ctx.sessionManager

```typescript
// Before:
const runId = process.env.RUN_ID || "unknown";

// After (in execute):
const runId = (params.run_id as string) || ctx.sessionManager.getSessionId();
```

### 4. researcher/.pi/agent/extensions/workproduct.ts — use ctx.sessionManager

Same pattern — replace `process.env.RUN_ID` with `ctx.sessionManager.getSessionId()`.

### 5. pi-subagents-http — forward parent session ID as correlationId

In `src/extension/index.ts`, the subagent tool has access to `ctx: ExtensionContext`. When invoking a remote agent, forward the parent session ID:

```typescript
// Before:
const correlationId = randomUUID();
resp = await invoke(endpoint.url, { task, context, correlationId });

// After:
const parentSessionId = ctx.sessionManager.getSessionId();
resp = await invoke(endpoint.url, { task, context, correlationId: parentSessionId });
```

This means child agent requests carry the parent's session ID, enabling trace correlation across the planner → researcher → writer chain.

### 6. docker-compose — add MAX_CONCURRENT_SESSIONS

| Agent | MAX_CONCURRENT_SESSIONS |
|-------|------------------------|
| Planner | 1 |
| Researcher | 3 |
| Data | 2 |
| Writer | 2 |

## What does NOT change

- `process.env.AGENT_NAME` — static per-container
- `process.env.ARTIFACT_SERVICE_URL` — static per-container
- `process.env.WORKSPACE` — static default
- All API key env vars — static
- Extension registration — boot-time only, read-only shared services

## Verification

1. Send 3 concurrent requests to researcher — all process in parallel
2. Each produces artifacts with correct, distinct session IDs as run_id
3. Artifacts from child sessions carry parent's correlationId
4. Run E2E-30 — planner's parallel delegation completes in ~300s
