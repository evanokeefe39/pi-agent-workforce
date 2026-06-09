# Plan: Session Isolation & Artifact Replication

Spec: `tasks/specs/session-isolation-artifact-replication.md`

## Phase 1: Server-Layer Modules

- [x] 1.1 Extract jidoka validation to `src/agents/jidoka.ts` (pure functions)
- [x] 1.2 Create `src/agents/artifact-store.ts` (ArtifactStore interface + HttpArtifactStore)
- [x] 1.3 Create `src/agents/replicator.ts` (fs.watch + waitForSession + upload)
- [x] 1.4 Update `src/agents/server.ts` — import jidoka/replicator/artifact-store
- [x] 1.5 Per-session directory creation: `/workspace/sessions/{traceId}/`
- [x] 1.6 Fix: use `createAgentSession` instead of `createAgentSessionFromServices` for per-session cwd
- [x] 1.7 Agent-complete gate: waitForSession before marking run done
- [x] 1.8 Update Dockerfile: COPY jidoka.ts, replicator.ts, artifact-store.ts

## Phase 2: Extension Updates

- [x] 2.1 `extensions/artifacts/index.ts` — write_artifact writes to local output/ with .meta.json sidecar
- [x] 2.2 `data/.pi/agent/extensions/workproduct.ts` — write to session-scoped dirs via ctx.sessionManager.getCwd()
- [x] 2.3 Both extensions write provenance.jsonl entries
- [x] 2.4 Atomic writes (tmp + rename) for both file and sidecar

## Phase 3: Artifact Service (Lineage)

- [x] 3.1 artifact_edges table in init-artifact-db.sql
- [x] 3.2 migrate-001-lineage.sql (idempotent)
- [x] 3.3 Edge CRUD + recursive CTEs in metastore.ts
- [x] 3.4 Graphology graph (graph.ts) with BFS trace + PROV-JSON
- [x] 3.5 Lineage routes in routes.ts
- [x] 3.6 Lineage types in types.ts

## Phase 4: Testing

- [x] 4.1 E2E-35 Test A: session-scoped working directory
- [x] 4.2 E2E-35 Test B: concurrent session isolation (ALPHA/BRAVO)
- [x] 4.3 E2E-35 Test C: artifact replication to service
- [x] 4.4 E2E-35 Test D: workproduct tools write to session dir, not shared
- [x] 4.5 E2E-35 Test E: session directory structure
- [x] 4.6 E2E-32 regression: 11/11 passing
- [x] 4.7 E2E-40 regression: 25/25 passing

## Phase 5: Remaining (not started)

- [ ] 5.1 Session directory cleanup (TTL-based cron)
- [ ] 5.2 Docker-compose sysctls for inotify limits
- [ ] 5.3 Researcher workproduct.ts — update to use ctx.sessionManager.getCwd()
- [ ] 5.4 Verify replication under high file volume (10+ files per session)
- [ ] 5.5 Cross-agent artifact read E2E test

## Reasoning Trace

1. **`createAgentSession` vs `createAgentSessionFromServices`.** Spec claimed SessionManager.inMemory(sessionDir) would propagate cwd to all tools. Wrong — `createAgentSessionFromServices` hardcodes `services.cwd`. Fix: call `createAgentSession` directly with `cwd: sessionDir` + reused services. Verified with E2E test showing agent bash pwd = session dir.

2. **Extensions self-contained.** Extensions depend on `ctx.sessionManager.getCwd()` and plain fs — no imports from server layer. Replicator and extensions connected only through .meta.json filesystem convention. This means extensions are npm-installable and testable without the server.

3. **Replicator uses ArtifactStore interface.** Not HTTP directly. Enables mock injection for tests, different storage backends later.

## Assumption Log

1. **fs.watch on Docker named volumes works.** Confirmed via testing — named volumes use host filesystem (ext4/xfs), not overlayfs. inotify events fire correctly.

2. **200ms debounce sufficient.** Replicator waits 200ms after detecting .meta.json before uploading. Handles the tiny gap between file write and sidecar write. No issues observed in testing.

3. **services.resourceLoader is safe to share across sessions with different cwds.** The resource loader was created with the boot-time cwd but only controls extension discovery, not per-session behavior. Extensions get cwd from ctx.sessionManager at call time.
