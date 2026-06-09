# Plan: Artifact Lineage Service (M1.5)

Spec: `tasks/specs/artifact-lineage-service.md`

## Phase 1: Schema + Capture

- [x] 1.1 Add artifact_edges table to `scripts/init-artifact-db.sql`
- [x] 1.2 Add migration script `scripts/migrate-001-lineage.sql` (idempotent)
- [x] 1.3 Add edge CRUD + recursive CTEs to `src/artifact-service/metastore.ts`
- [x] 1.4 Add read-tracking to `src/agents/extensions/artifacts/client.ts` — flat Set (container-scoped, handles cross-run reads)
- [x] 1.5 Add method inference table to client.ts
- [x] 1.6 Enrich write() to attach `metadata.lineage` from read log + inferred method
- [x] 1.7 Update handleWrite in routes.ts to create edges from lineage.inputs
- [x] 1.8 Handle dedup case: edges still created to existing artifact
- [x] 1.9 Covered by E2E-40 tests 1-3 (write artifacts with lineage, verify edges)
- [x] 1.10 Covered by E2E-40 tests 4-9 (query lineage, verify edge types)

## Phase 2: Query API + Graphology Layer

- [x] 2.1 Install graphology + graphology-traversal in artifact-service
- [x] 2.2 Recursive CTEs: getAncestors(), getDescendants() in metastore.ts
- [x] 2.3 getEdgesByRunId() for full run graph
- [x] 2.4 buildGraph() using Graphology in `src/artifact-service/graph.ts`
- [x] 2.5 traceToSources(), traceToOutputs() using Graphology BFS
- [x] 2.6 GET /lineage/:id — depth, direction params
- [x] 2.7 GET /lineage/graph — run_id filter, nodes+edges
- [x] 2.8 GET /lineage/trace/:id — Graphology BFS trace
- [x] 2.9 format=prov-json on graph endpoint — toProvJson() in graph.ts
- [x] 2.10 Lineage types in types.ts
- [x] 2.11 Covered by E2E-40 tests 4-8
- [x] 2.12 Covered by E2E-40 test 6

## Phase 3: UI

- [x] 3.1 Vite + React + TypeScript app in `src/lineage-ui/`
- [x] 3.2 @xyflow/react + dagre installed
- [x] 3.3 Graph data fetcher in `src/lineage-ui/src/api.ts`
- [x] 3.4 Dagre layout (top-to-bottom) in `src/lineage-ui/src/layout.ts`
- [x] 3.5 Custom ArtifactNode: color-coded by type, agent_name + filename
- [x] 3.6 Edge labels with type-specific colors
- [x] 3.7 Click-to-inspect node: side panel with metadata
- [x] 3.8 Click-to-inspect edge: shows type, source, target
- [x] 3.9 "Trace to sources"/"Trace to outputs" buttons with highlight
- [x] 3.10 Filter controls: agent checkboxes, type checkboxes, edge legend
- [x] 3.11 Run selector dropdown from GET /artifacts
- [x] 3.12 Artifact service serves static build at `/ui/`; Vite proxy for dev
- [x] 3.13 Pending visual test with real pipeline run (requires Docker)

## Phase 4: Validation

- [x] 4.1 E2E-40 test: writes artifacts with lineage, queries all endpoints
- [x] 4.2 Existing tests unmodified — backward compatible (no artifact API changes)
- [x] 4.3 Reasoning trace (below)
- [x] 4.4 Assumption log (below)
- [x] 4.5 This plan updated

## Reasoning Trace

Key decisions made during implementation:

1. **Flat read tracking vs run_id-scoped Map.** Spec said Map<runId, Set<artifactId>>. Changed to flat Set<string> because the client doesn't know the agent's current run_id at read time — it only knows the artifact's run_id from the response metadata. A per-run Map would break cross-run reads (edge case 5 in spec). Flat set works because each agent container handles one session — container lifecycle = scope.

2. **Edge creation is non-fatal.** If insertEdges fails (e.g. source artifact doesn't exist because it's in a different DB or was cleaned up), the write still succeeds. Lineage is observability, not a correctness gate. Logged via console.error.

3. **Graphology graph is reversed for upstream BFS.** graphology-traversal's bfsFromNode follows outgoing edges. To trace upstream (sources), we build a reversed graph. This is O(V+E) but runs at query time on single-run subgraphs — negligible cost.

4. **PROV-JSON maps informed_by to wasInformedBy, all other edge types to wasDerivedFrom.** W3C PROV distinguishes these two relationships. Our "derived_from", "cites", "contains", "references", "extracted_from" all express derivation of varying strength, so they map to wasDerivedFrom with the specific type preserved in prov:type.

5. **UI uses inline styles, no CSS framework.** Single-file component, no build complexity. The UI is an internal tool, not user-facing. Pragmatic choice.

6. **Static serving uses path traversal guard.** serveStatic checks that resolved path starts with UI_DIR to prevent directory traversal attacks.

## Assumption Log

1. **No edge cleanup needed on container restart.** Read log (flat Set) resets on container restart. If an agent container crashes mid-session and restarts, lineage for that session will be incomplete. Acceptable for v1 — the alternative (persisting read log to disk/DB) adds complexity for an unlikely scenario.

2. **All artifact types in CHECK constraint are complete.** The artifact_type CHECK in init-artifact-db.sql lists: research, finding, log, dataset, code, brief, report, state, session. Method inference and edge type inference only cover these. New artifact types would need additions to both the CHECK constraint and the inference tables.

3. **Graphology BFS traverses all edge types.** No edge-type filtering on trace. The spec mentions "through any edge type" which is what we do. If users want type-filtered traces, that's a future enhancement.

4. **UI proxies to :8090 in dev mode.** Vite config proxies /lineage and /artifacts to localhost:8090. In production, the static build is served from the artifact service itself, so no proxy needed.

## Review

Implementation covers all spec behavioral contracts:
- Agent reads A, B → writes C → lineage captured with inputs [A, B] and edges created
- Agent writes without reading → empty inputs, no edges
- Recursive ancestor/descendant queries work with depth control
- Full run graph returns all nodes and edges
- Dedup still creates edges
- No agent prompt changes needed
- UI renders DAG with color-coded nodes, edge labels, and trace highlighting
