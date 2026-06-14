# API Reference

Every agent exposes the same HTTP API on its container port (mapped to host ports 8081-8087).

## Endpoints

### POST /invoke

Start an agent run. Returns immediately with a run ID; the agent processes asynchronously.

**Request:**
```json
{
  "prompt": "Research the top AI agent frameworks",
  "task": "Alternative to prompt — used by subagent-http",
  "context": "Optional additional context appended to task"
}
```

Either `prompt` or `task` is required. If both are present, `task` takes precedence.

**Response (202 Accepted):**
```json
{
  "runId": "a1b2c3d4e5f6",
  "status": "accepted"
}
```

**Headers:**
- `x-request-id` — same as `runId`
- `traceparent` (optional, inbound) — W3C trace context for cross-agent trace linking

**Error responses:**
- `429` — queue full (all concurrent slots and queue depth exhausted)
- `503` — services still initializing

---

### GET /status/:runId

Check run progress without fetching output.

**Response (200):**
```json
{
  "runId": "a1b2c3d4e5f6",
  "state": "running",
  "startedAt": "2026-06-14T10:00:00.000Z",
  "durationMs": 45000,
  "progress": {
    "turnCount": 12
  }
}
```

**States:** `queued` → `running` → `completed` | `failed` | `cancelled` | `timeout`

---

### GET /result/:runId

Fetch completed run output and usage.

**Response (200):**
```json
{
  "runId": "a1b2c3d4e5f6",
  "state": "completed",
  "output": "The agent's text output...",
  "error": null,
  "usage": {
    "input": 15420,
    "output": 3200,
    "cacheRead": 12000,
    "cost": 0,
    "turns": 8
  },
  "durationMs": 120000,
  "model": "deepseek/deepseek-v4-flash"
}
```

**Error responses:**
- `404` — run not found (expired from history or never existed)
- `409` — run still in progress (`{ "error": "still_running", "state": "running" }`)

---

### POST /cancel/:runId

Cancel a queued or running invocation.

**Response (200):**
```json
{
  "runId": "a1b2c3d4e5f6",
  "state": "cancelled"
}
```

**Error responses:**
- `404` — run not found
- `409` — run already finished

---

### GET /health

Health check endpoint used by Docker healthchecks and load balancers.

**Response (200):**
```json
{
  "status": "ok",
  "uptime_s": 3600,
  "version": "5.2.0",
  "config": {
    "provider": "deepseek",
    "model": "deepseek-v4-flash",
    "port": 8080
  },
  "busy": false,
  "queue_depth": 0,
  "queue_max": 8,
  "runs_active": 0
}
```

`status` is `"starting"` until services finish initializing (~60s).

---

### GET /metrics

Operational metrics for monitoring.

**Response (200):**
```json
{
  "requests_total": 42,
  "requests_active": 1,
  "requests_failed": 3,
  "avg_duration_ms": 95000,
  "last_request_at": "2026-06-14T10:05:00.000Z",
  "cold_start_ms": 120000,
  "queue_depth": 0,
  "runs_completed": 38,
  "runs_active": 1
}
```

---

### GET /describe

Agent metadata and capabilities. Used by `subagent({ action: "list" })` for discovery.

**Response (200):**
```json
{
  "name": "researcher",
  "description": "Web research agent",
  "role": "researcher",
  "capabilities": "web search, scraping, structured findings",
  "model": "deepseek/deepseek-v4-flash",
  "tools": ["web_search", "web_fetch", "record_finding", "publish_artifact"],
  "extensions": ["artifacts", "deep-research", "web-scrape", "context-compaction"],
  "status": "ready"
}
```

**Status values:** `starting` | `ready` | `busy`

---

### GET /runs/:runId

Full run record (superset of /status and /result). Useful for debugging.

---

## Concurrency

Each agent supports concurrent sessions controlled by `MAX_CONCURRENT_SESSIONS` (env var, per-agent in docker-compose.yml). Defaults:

| Agent | Concurrent sessions |
|-------|-------------------|
| Planner | 1 |
| Researcher | 3 |
| Data | 2 |
| Writer | 2 |
| Publisher | 2 |
| Coder | 2 |
| QA | 2 |

When all slots are busy, requests queue up to `QUEUE_MAX_DEPTH` (default 8). Beyond that, `/invoke` returns `429`.

## Timeouts

Configurable via `BRIDGE_TIMEOUT_MS` per agent:

| Agent | Timeout |
|-------|---------|
| Planner | 1800s (30 min) |
| Workers | 600s (10 min) |

The planner timeout is long because it waits for multiple agent delegations to complete sequentially.
