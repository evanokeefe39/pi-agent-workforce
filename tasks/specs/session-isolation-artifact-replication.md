# Session Isolation & Artifact Replication

## Intent

Give every agent invocation its own filesystem sandbox so concurrent sessions cannot collide, and automatically replicate session outputs to object storage so agents never need to explicitly "publish." The filesystem is the interface — agents write files locally, infrastructure handles durability, cross-agent discovery, and lineage.

This replaces the current pattern where agents call `write_artifact` (an HTTP POST to the artifact service) as a deliberate publish step. That step is probabilistic — models forget, skip it, or call it inconsistently. Instead, any file an agent writes to its session directory (outside of scratch) becomes a durable artifact automatically.

## Context Package

### Relevant existing code

- `src/agents/server.ts` — Agent HTTP server. Creates `workDir = /workspace/{issueScope}` per invocation (line 217) but never passes it to the session. All sessions share `CWD = "/workspace/scratch"`. `SessionManager.inMemory()` called with no args, defaults to `process.cwd()`.
- `src/agents/extensions/artifacts/index.ts` — Pi extension registering `write_artifact`, `read_artifact`, `list_artifacts`. `write_artifact` currently does HTTP POST to artifact service with base64 content. `read_artifact` does HTTP GET.
- `src/agents/extensions/artifacts/client.ts` — HTTP client for artifact service. `write()`, `read()`, `list()`.
- `src/agents/data/.pi/agent/extensions/workproduct.ts` — Data agent workproduct tools. `getWorkDir()` returns `path.join(process.cwd(), "workproduct", "data")`. No session scoping.
- `src/agents/researcher/.pi/agent/extensions/workproduct.ts` — Researcher workproduct tools. Same pattern: `path.join(process.cwd(), "workproduct", "findings")`.
- `src/artifact-service/routes.ts` — REST API. POST /artifacts accepts base64 content + metadata, stores to S3 + Postgres. Lineage edges created from `metadata.lineage.inputs`.
- `src/artifact-service/metastore.ts` — Postgres queries including artifact_edges recursive CTEs.
- `docker-compose.yml` — Per-agent named volumes: `researcher-workspace:/workspace`, `data-workspace:/workspace`, `writer-workspace:/workspace`.

### Architectural constraints

- Agents run in isolated Docker containers. Each agent type (researcher, data, writer) has its own container with its own `/workspace` volume.
- Concurrent sessions on the same container share the same process and the same volume. `MAX_CONCURRENT_SESSIONS` is 2-3 per agent.
- Pi SDK `createAgentSessionServices` accepts `cwd` but services are created once at boot and shared across all invocations.
- Extensions access the filesystem via `process.cwd()` — there is no per-session cwd override mechanism in the Pi SDK.
- MinIO (S3-compatible) is already running for artifact blob storage. Postgres stores artifact metadata.
- pi-otel is already capturing traces per session.

### Prior decisions

- Artifact service is the durable store (S3 + Postgres). Local filesystem is ephemeral.
- Lineage edges captured in Postgres via `artifact_edges` table with recursive CTE queries.
- Agent names come from `x-agent-name` header (set by the container's AGENT_NAME env var).
- Session IDs come from Pi SDK's `SessionManager.getSessionId()`.
- Content dedup by SHA-256 hash exists in artifact service.

### Anti-patterns to avoid

- Relying on agents to explicitly publish via HTTP POST — probabilistic, model-dependent.
- Polling-based replication (every N seconds) — adds latency, wastes resources when idle.
- Shared flat directory across concurrent sessions — collision, data leakage (current bug).
- Per-session containers or microVMs — correct but overengineered for our scale and Docker Compose deployment.

## Component Architecture

Six modules with clear boundaries. Dependencies flow downward. No module reaches into another's concern.

```
server.ts — orchestration
  │  Session lifecycle, HTTP routes, wires everything together.
  │  Does NOT contain validation logic, file I/O, or replication logic.
  │
  ├─► jidoka.ts — output validation
  │     validateRun(config, toolCalls, usage) → { pass, errors[] }
  │     Pure function. No I/O. No side effects.
  │
  ├─► replicator.ts — file sync
  │     watch(root) — starts fs.watch on sessions/
  │     waitForSession(dir, timeout) → { ok, outstanding }
  │     Depends on ArtifactStore interface (not HTTP directly).
  │
  └─► artifact-store.ts — storage abstraction (interface)
        upload(meta, content) → { id, ref, deduplicated }
        query(filters) → ArtifactRecord[]
        read(id) → { content, metadata }
        HTTP implementation calls artifact service. Tests inject mock.
```

Extensions are self-contained — they use plain fs and follow a file convention:

```
workproduct extensions (record_query_result, record_metric, etc.)
  │  Validate params (TypeBox schema).
  │  Write file to {cwd}/workproduct/{type}/ using plain fs (atomic: tmp + rename).
  │  Write .meta.json sidecar alongside it (convention — replicator picks it up).
  │  Append to {cwd}/provenance.jsonl.
  │  No imports from server layer. npm-installable. Self-contained.
  │
artifact extension (write_artifact, read_artifact, list_artifacts)
  │  write_artifact: write to {cwd}/output/ with .meta.json sidecar. Plain fs.
  │  read_artifact: HTTP to artifact service. Unchanged.
  │  list_artifacts: HTTP to artifact service. Unchanged.
```

The .meta.json sidecar is a convention, not a dependency. Any extension can write one.
The replicator watches for .meta.json files. Extensions and replicator never import each other.

### SOLID compliance

| Principle | How enforced |
|-----------|-------------|
| **Single Responsibility** | server.ts orchestrates. jidoka.ts validates. replicator.ts syncs. Extensions own their domain logic + file writes. |
| **Open/Closed** | New jidoka checks = new function in jidoka.ts. New extensions = follow .meta.json convention, auto-replicated. New storage backend = new ArtifactStore implementation. |
| **Dependency Inversion** | Extensions depend on fs (stdlib) and ctx.sessionManager (Pi SDK injection), not on any server module. Replicator depends on ArtifactStore (interface), not fetch (concrete). |
| **Interface Segregation** | ArtifactStore has upload/query/read. Replicator only uses upload. read_artifact only uses read. Extensions don't use ArtifactStore at all. |
| **DRY** | Sidecar format is a documented JSON schema — each extension writes it inline (3 lines of code). Not worth a shared module for a JSON convention. Atomic write pattern is 2 lines (writeFileSync tmp, renameSync) — repeated is simpler than abstracted. |

### Coupling/Cohesion

**Loose coupling between modules:**
- Extensions ↔ replicator: zero coupling. Connected only through filesystem convention (.meta.json files). Neither imports the other.
- Extensions ↔ server: zero coupling. Extensions are npm packages. Server creates the session dir and passes cwd via Pi SDK ctx.
- server.ts ↔ jidoka: function call with plain data in, plain data out. No shared state.
- replicator ↔ artifact service: via ArtifactStore interface, not HTTP directly.

**High cohesion within modules:**
- jidoka: everything about validating agent output quality.
- replicator: everything about syncing local files to remote storage.
- extensions: domain validation + file writing. Self-contained.

## Design

### Session Directory Convention

Every invocation gets its own directory under `/workspace/sessions/`:

```
/workspace/
  sessions/
    {session-id}/
      workproduct/
        findings/       ← researcher record_finding outputs
        queries/        ← data agent record_query_result outputs
        metrics/        ← data agent record_metric outputs
        charts/         ← data agent record_chart outputs
        datasets/       ← record_dataset_ref outputs
      output/           ← final deliverables (JSONL, reports, etc.)
      provenance.jsonl  ← lineage manifest, appended by tools
      scratch/          ← temp files, WIP — excluded from replication
```

`session-id` is the Pi SDK session ID from `SessionManager.getSessionId()`, same value that currently goes into `run_id` on artifacts.

### Metadata Sidecars

Every file written to `workproduct/` or `output/` gets a `.meta.json` sidecar alongside it:

```
workproduct/queries/01KTMK3HS_engagement_analysis.json
workproduct/queries/01KTMK3HS_engagement_analysis.json.meta.json
```

Sidecar content:

```json
{
  "id": "01KTMK3HS62F2A4QAQPAFZBPRS",
  "filename": "engagement_analysis.json",
  "artifact_type": "dataset",
  "agent_name": "data",
  "session_id": "abc123",
  "created_at": "2026-06-09T12:00:00Z",
  "content_hash": "sha256:...",
  "size_bytes": 4096,
  "mime_type": "application/json",
  "lineage": {
    "inputs": ["01KTMK...", "01KTMK..."],
    "method": "transformation"
  },
  "tags": ["engagement", "instagram"]
}
```

Written atomically at the same time as the file itself. The workproduct tools already have all this metadata — they just need to write it to the sidecar instead of (or in addition to) embedding it in the JSON body.

### Provenance Manifest

`provenance.jsonl` at session root. Each workproduct tool appends one line when it creates a file:

```jsonl
{"ts":"2026-06-09T12:00:00Z","tool":"record_dataset_ref","id":"01KT...","path":"workproduct/datasets/01KT_accounts.json","inputs":[],"method":"collection"}
{"ts":"2026-06-09T12:00:01Z","tool":"record_query_result","id":"01KT...","path":"workproduct/queries/01KT_engagement.json","inputs":["01KT...(dataset_ref)"],"method":"transformation"}
{"ts":"2026-06-09T12:00:02Z","tool":"record_metric","id":"01KT...","path":"workproduct/metrics/01KT_save_rate.json","inputs":["01KT...(query_result)"],"method":"derivation"}
```

This is the lineage graph in append-only form. The artifact service indexes it on replication.

### Triggered Replication

A file watcher inside the agent container (or a sidecar process) monitors `/workspace/sessions/*/` for new files. On file close:

1. Skip if path contains `/scratch/`
2. Read the `.meta.json` sidecar
3. Upload file content to MinIO at `sessions/{session_id}/{relative_path}`
4. POST metadata to artifact service (or artifact service indexes from MinIO events)
5. Create lineage edges from `lineage.inputs` in the sidecar

Implementation options, in order of preference:

**Option A: In-process watcher in server.ts.** Use `fs.watch` (or chokidar/watchman) on `/workspace/sessions/`. When a `.meta.json` file appears, trigger replication of the paired file. Runs in the same process as the agent server. Simplest, no extra containers.

**Option B: MinIO bucket notifications.** MinIO supports S3 event notifications (SQS, Kafka, webhook). If we mount session dirs as a MinIO alias, MinIO handles the watch + upload. But this requires MinIO to have filesystem access to the agent volumes, which breaks container isolation.

**Option C: Sidecar container.** A lightweight container sharing the agent's volume, running a file sync daemon. More Kubernetes-native but heavier for Docker Compose.

Recommendation: Option A for now. The server.ts process already manages sessions and knows when they start/end. A file watcher in the same process is the simplest path.

### Agent-Complete Gate

When a Pi session completes (in `processInvocation`, after `session.prompt()` resolves):

1. Check `/workspace/sessions/{session_id}/` for any `.meta.json` files without a corresponding replication receipt (a `.replicated` marker or an in-memory set)
2. If outstanding files exist, wait up to `REPLICATION_TIMEOUT_MS` (default 10s) for replication to complete
3. If timeout expires:
   - Log error: `andon_replication_incomplete`
   - Mark run as failed with error: `"replication incomplete: N files not synced to storage"`
   - Or: mark as completed with warning, let planner decide whether to retry

This gate ensures no run reports "completed" while its artifacts are still only on local disk.

### Artifact Service Role Change

The artifact service shifts from write endpoint to index/query layer:

**Keeps:**
- GET /artifacts — query/list artifacts with filters
- GET /artifacts/:id — read artifact content (from S3)
- GET /lineage/* — lineage graph queries
- GET /ui — lineage visualization
- POST /artifacts — retained for user uploads (files attached to prompts, external data ingestion). Not used by agents in normal flow.

**New:**
- POST /index — called by replicator with metadata from `.meta.json`. Creates Postgres record + lineage edges. Content already in S3.
- Or: artifact service watches MinIO bucket notifications and indexes on new object events.

**Drops (from agent flow):**
- Agents no longer POST to artifact service. They write locally. Replicator handles upload + indexing.

### Cross-Agent Reads

Agent A (data) needs to read researcher's output. Two options:

**Option 1: Read from S3 via artifact service.** Same as today. `read_artifact` calls GET /artifacts/:id, artifact service fetches from S3. Works across containers. Depends on replication having completed.

**Option 2: Direct S3 read.** Agent's artifact client reads directly from MinIO. Skip the artifact service middleman for content fetches. Artifact service still needed for discovery queries (list, filter, search).

Recommendation: Keep Option 1 for now. The artifact service handles RBAC, content-type detection, and metadata enrichment. Optimize to direct S3 reads later if latency matters.

### User Uploads

Users attach files to prompts (CSV, images, reference docs). These don't come from an agent session. The artifact service POST /artifacts endpoint stays for this use case. The upload flow:

1. User sends file via planner prompt or direct API
2. Planner (or API gateway) POSTs to artifact service with `x-agent-name: user`, file content, metadata
3. Artifact service stores to S3 + Postgres as before
4. Planner delegates task to agent with artifact URI
5. Agent reads via `read_artifact` — same interface regardless of whether artifact came from replication or user upload

## Behavioral Contracts

GIVEN two concurrent sessions on the same agent container
WHEN both sessions write files
THEN session A's files are in `/workspace/sessions/{A}/` and session B's are in `/workspace/sessions/{B}/` with no overlap

GIVEN a workproduct tool writes a file to `/workspace/sessions/{id}/workproduct/`
WHEN the file is written
THEN a `.meta.json` sidecar is written atomically alongside it containing artifact_type, agent_name, session_id, content_hash, lineage.inputs

GIVEN a workproduct tool writes a file
WHEN it completes
THEN one line is appended to `/workspace/sessions/{id}/provenance.jsonl` with tool name, file path, inputs, and method

GIVEN a file is written to a session directory (not under scratch/)
WHEN the file watcher detects it
THEN the file and its .meta.json are replicated to MinIO within 5 seconds

GIVEN a session completes
WHEN the agent-complete gate runs
THEN all files with .meta.json sidecars have been replicated to MinIO, or the run is marked failed

GIVEN a file is written under `/workspace/sessions/{id}/scratch/`
WHEN the replicator scans
THEN the file is NOT replicated

GIVEN a user uploads a file via the artifact service POST endpoint
WHEN an agent later calls read_artifact with that artifact's ID
THEN the agent receives the file content, same as any replicated artifact

GIVEN a replicated artifact has lineage.inputs in its .meta.json
WHEN the artifact service indexes it
THEN artifact_edges rows are created for each input

## Edge Case Inventory

1. **Session directory already exists** — session IDs are ULIDs, collision probability is negligible. If it exists, append a counter suffix.
2. **File written without .meta.json** — replicator skips files without sidecars. Only files from workproduct tools get replicated. Ad-hoc bash file writes stay local.
3. **Replication fails (MinIO down)** — replicator retries with backoff. Agent-complete gate catches if still outstanding. Run fails rather than silently losing artifacts.
4. **Agent crashes mid-session** — session directory persists on volume. On container restart, orphaned sessions can be cleaned up by TTL or manual scan.
5. **Large file (>100MB)** — replicator streams to MinIO rather than buffering. MinIO handles multipart upload.
6. **provenance.jsonl concurrent appends** — within a single session, tool calls are sequential (one LLM turn at a time). No concurrent append risk within a session. Across sessions, each has its own file.
7. **Clock skew between file write and replication** — `.meta.json` contains `created_at` from the tool. Replication timestamp is separate. Artifact service uses the sidecar timestamp.
8. **Content dedup across sessions** — two sessions produce identical files. Both get replicated. Artifact service dedup logic applies at indexing time — returns existing artifact ID but creates new lineage edges.
9. **Session directory cleanup** — after successful replication + agent-complete gate, session dir can be removed. Implement via post-completion hook with configurable retention (keep for N hours for debugging, then delete).

## Definition of Done

- [ ] server.ts creates per-session directory at `/workspace/sessions/{session_id}/` and sets it as the working context for that invocation
- [ ] Workproduct extensions write to `{session_dir}/workproduct/{type}/` instead of `process.cwd()/workproduct/`
- [ ] Every workproduct file gets a `.meta.json` sidecar with full metadata
- [ ] Every workproduct write appends to `{session_dir}/provenance.jsonl`
- [ ] File watcher in server.ts monitors session directories and replicates to MinIO on file events
- [ ] Replication excludes `scratch/` subdirectory
- [ ] Agent-complete gate in processInvocation waits for outstanding replications before marking run complete
- [ ] Artifact service indexes replicated files (metadata + lineage edges) from .meta.json sidecars
- [ ] Artifact service POST /artifacts retained for user uploads
- [ ] read_artifact works for both replicated and user-uploaded artifacts
- [ ] write_artifact tool rewritten to write to local session directory instead of HTTP POST
- [ ] E2E test: concurrent sessions produce files in separate directories
- [ ] E2E test: files replicated to MinIO within timeout
- [ ] E2E test: agent-complete gate fails when replication is blocked
- [ ] E2E test: lineage edges created from .meta.json sidecar data
- [ ] E2E test: cross-agent read works (data agent reads researcher's replicated artifact)
- [ ] No changes to agent AGENTS.md files (agents still call same tool names)
- [ ] Reasoning trace written
- [ ] Assumption log written

## Negative Space

What must not change:
- Agent tool interfaces — agents call `write_artifact`, `read_artifact`, `record_finding`, `record_query_result` etc. with same parameters. The tools change internally but the agent-facing API is identical.
- Agent AGENTS.md prompts — no prompt changes needed.
- Artifact service query API — GET endpoints remain the same. Downstream consumers (lineage UI, E2E tests) are unaffected.
- RBAC enforcement — read/write access still controlled per-agent.

What is out of scope:
- Per-session containers or microVMs — overkill for Docker Compose deployment.
- Real-time streaming of artifact events to external systems.
- Garbage collection of old sessions (implement as a separate cron, not part of this spec).
- Migration of existing artifacts — new system applies to new sessions only.

What decisions are reserved for human review:
- Replication timeout value (proposed 10s — may need tuning based on file sizes).
- Session directory retention period (proposed: keep for 24 hours after completion, then eligible for cleanup).
- Whether to implement MinIO bucket notifications (Option B) as a follow-up optimization.
- Whether agent-complete gate should hard-fail or soft-warn when replication times out.

## Resolved Questions

### 1. Pi SDK cwd handling — CORRECTED: createAgentSessionFromServices hardcodes services.cwd

**Original claim (WRONG):** "The fix is one line — change `SessionManager.inMemory()` to `SessionManager.inMemory(sessionDir)`."

**What actually happens:** `createAgentSessionFromServices` always passes `options.services.cwd` to `createAgentSession`:

```js
// agent-session-services.js — services.cwd overrides sessionManager.getCwd()
return createAgentSession({
    cwd: options.services.cwd,  // ← hardcoded from boot-time services
    ...
});
```

And `createAgentSession` resolves cwd as: `options.cwd ?? sessionManager.getCwd() ?? process.cwd()`. Since `services.cwd` is always present, the sessionManager fallback never triggers.

**Actual fix:** Call `createAgentSession` directly with per-session cwd + reused services:

```ts
const result = await createAgentSession({
  cwd: sessionDir,
  agentDir: services.agentDir,
  authStorage: services.authStorage,
  settingsManager: services.settingsManager,
  modelRegistry: services.modelRegistry,
  resourceLoader: services.resourceLoader,
  sessionManager: SessionManager.inMemory(sessionDir),
});
```

**Verified by E2E-35:** agent bash `pwd` returns `/workspace/sessions/{traceId}`, concurrent sessions fully isolated.

Custom extensions use `ctx.sessionManager.getCwd()` for session-scoped paths — this works correctly because AgentSession passes `this._cwd` to extensions via ctx.

### 2. fs.watch reliability — CONFIRMED: works on named volumes, use atomic writes

Key findings from production research:

**The overlayfs problem does not apply.** Docker's overlayfs silently drops inotify events (moby/moby#11705, unfixed since 2015). But our agent volumes are Docker named volumes backed by ext4/xfs on the host. inotify works correctly on native filesystems. Only the container root filesystem (overlayfs layers) is affected.

**Scale is trivially within limits.** Our load: 2-3 sessions, 10-50 files each = 30-150 watches. Default kernel limit is 8,192-1,048,576 watches. inotify instances limit (128 default) is the tighter constraint — set via docker-compose sysctl.

**Atomic write pattern prevents partial reads.** The production race condition: watcher sees file creation, reads partial content. Fix: write to `.tmp` file, then `fs.rename()` (atomic on same filesystem). `fs.watch` fires a single `'rename'` event on the complete file. lsyncd uses this pattern (reacts to `IN_CLOSE_WRITE`, not `IN_CREATE`).

**No chokidar needed at this scale.** chokidar adds value at thousands of files or for cross-platform. At 50 files, built-in `fs.watch` is sufficient. Chokidar uses inotify under the hood anyway.

**Implementation pattern:**
- Watch session directory (not individual files): `fs.watch(sessionDir, { recursive: true })`
- Filter: ignore `.tmp` files and `scratch/` paths
- On `'rename'` event for non-temp file: read `.meta.json` sidecar, replicate to MinIO
- Debounce 100-200ms as defense-in-depth
- Add to docker-compose: `sysctls: [fs.inotify.max_user_watches=524288, fs.inotify.max_user_instances=512]`

## Open Questions

None.
