# E2E Test Migration: Bash → Bun/TypeScript

## Intent

Replace fragile bash E2E tests with Bun/TypeScript using `bun:test`. E2E-30 is the template migration — all future migrations follow same pattern.

## Why (from ISSUES.md)

Bash tests fail silently due to shell limitations (heredoc expansion, variable truncation, `|| true` error swallowing, count-diff artifact scoping). These are test harness bugs, not pipeline bugs. TypeScript eliminates all 7 root causes.

## Approach

### Phase 1: helpers.ts (shared utilities)

Replaces `jsonl-helpers.sh`. Covers:

- [x] Agent URL config (same defaults as bash)
- [x] `waitForHealth(url, timeoutMs)` — retry loop with backoff
- [x] `requireAgents()` — health gate for all workers
- [x] `plannerRun(goal, timeoutMs)` — POST /invoke + poll /status, returns `{ runId, result }`
- [x] `artifactList(query)` — GET /artifacts with query params
- [x] `artifactContent(id)` — GET /artifacts/:id with qa RBAC header
- [x] `artifactFindingsCount(runId)` — run-scoped JSONL line count (replaces artifact-query.mjs)
- [x] `artifactSnapshot()` / `artifactsSince(before)` — count-based (kept for backward compat)
- [x] `dockerLogs(container)` — Bun.spawn `docker logs`, returns string
- [x] `countInLogs(logs, pattern)` — regex match count (replaces grep -c)
- [x] `agentMetrics(port)` — GET /metrics
- [x] `writeReport(path, content)` — Bun.write, no heredoc
- [x] Result/response types

### Phase 2: e2e-30-instagram-growth-research.test.ts

Replaces `e2e-30-instagram-growth-research.sh`. Structure:

- [x] `beforeAll` — require all agents healthy
- [x] Test: invoke planner with goal, poll until done
- [x] Test: planner completed successfully
- [x] Test: artifacts produced (run-scoped by runId)
- [x] Test: structured findings >= 10
- [x] Test: report exists with >= 500 words, >= 3 sections
- [x] Test: researcher completed >= 1 run
- [x] Test: timing < 20 minutes
- [x] `afterAll` — write detailed markdown report

### Key improvements over bash

1. **Run-scoped artifacts** — filter by run_id from invoke response, not count-diff
2. **Native JSON** — template literals for report, no heredoc expansion on large content
3. **No silent failures** — fetch rejects on network errors, expect() throws on assertion failure
4. **Typed** — interfaces for API responses, IDE autocomplete
5. **Docker logs** — Bun.spawn + regex in JS, no bash pipe fragility

### What stays the same

- Same agent URLs and ports
- Same planner invoke/poll protocol
- Same artifact service API
- Same assertions (>= 10 findings, >= 500 words, etc.)
- Same markdown report format

## Running

```bash
bun test tests/e2e/e2e-30-instagram-growth-research.test.ts
```

## Migration order (future)

After E2E-30 template is proven:
1. E2E-32 (model + output validation) — simple assertions, good second candidate
2. E2E-35 (session isolation) — uses artifact helpers heavily
3. E2E-50/51/52 (content production) — complex, last
4. Remove jsonl-helpers.sh when all migrated
