# Plan: Artifact Lineage Service (M1.5)

Spec: `tasks/specs/artifact-lineage-service.md`

## Phase 1: Schema + Capture

- [ ] 1.1 Add artifact_edges table to `scripts/init-artifact-db.sql` — source_id, target_id, edge_type (derived_from, informed_by, cites, contains, references, extracted_from), metadata JSONB, composite PK, indexes on source/target/type. RESTRICT foreign keys.
- [ ] 1.2 Add migration script `scripts/migrate-001-lineage.sql` for existing deployments (CREATE TABLE IF NOT EXISTS, idempotent)
- [ ] 1.3 Add `insertEdges()`, `getEdgesByArtifact()`, `getEdgesByRunId()`, `deleteEdges()` to `src/artifact-service/metastore.ts`
- [ ] 1.4 Add read-tracking to `src/agents/extensions/artifacts/client.ts` — module-level Map<runId, Set<artifactId>>, populated on read(), consumed on write()
- [ ] 1.5 Add method inference table and edge type inference logic to client.ts
- [ ] 1.6 Enrich write() in client.ts to attach `metadata.lineage.inputs` from read log + inferred method
- [ ] 1.7 Update `handleWrite` in routes.ts to create edges when `metadata.lineage.inputs` present, using edge type inference (artifact_type of writer + source → edge_type)
- [ ] 1.8 Handle dedup case: when content_hash matches existing artifact, still create edges to existing artifact ID
- [ ] 1.9 Unit test: client read-tracking accumulates correctly, resets per write
- [ ] 1.10 Integration test: write artifact with lineage.inputs → edges appear in DB with correct types

## Phase 2: Query API + Graphology Layer

- [ ] 2.1 Install graphology + graphology-traversal as dependencies in artifact-service
- [ ] 2.2 Add recursive CTE queries to metastore.ts: `getAncestors(id, depth)`, `getDescendants(id, depth)` — handle mixed edge types
- [ ] 2.3 Add `getGraphByRunId(runId)` query — all artifacts + edges for a run
- [ ] 2.4 Implement `buildGraph(runId)` using Graphology — load artifacts as nodes, edges from DB, return typed Graph instance
- [ ] 2.5 Implement Graphology-powered traversal functions: `traceToSources(graph, nodeId)` (BFS upstream through any edge type), `traceToOutputs(graph, nodeId)` (BFS downstream)
- [ ] 2.6 Add GET /lineage/:id route — depth, direction, edge_type filter params. Uses recursive CTE for simple queries.
- [ ] 2.7 Add GET /lineage/graph route — run_id filter, returns nodes+edges for React Flow. Uses Graphology for graph assembly.
- [ ] 2.8 Add GET /lineage/trace/:id route — full upstream/downstream trace through mixed edge types. Uses Graphology BFS.
- [ ] 2.9 Add format=prov-json option on graph endpoint. Implement PROV-JSON serialization (Entity/Activity/Agent/wasDerivedFrom mapping).
- [ ] 2.10 Add lineage types to types.ts (LineageResponse, GraphResponse, TraceResponse, ProvJsonResponse)
- [ ] 2.11 Integration test: multi-artifact chain with mixed edge types → correct traversal
- [ ] 2.12 Integration test: full run graph returns complete DAG with edge type labels

## Phase 3: UI

- [ ] 3.1 Set up React app (Vite + React + TypeScript) in `src/lineage-ui/`
- [ ] 3.2 Install @xyflow/react + dagre for auto-layout
- [ ] 3.3 Build graph data fetcher (GET /lineage/graph?run_id=X)
- [ ] 3.4 Implement DAG layout with dagre (top-to-bottom: sources → findings → reports → outputs)
- [ ] 3.5 Custom node component: color-coded by artifact_type, shows agent_name + filename
- [ ] 3.6 Custom edge component: labeled with edge_type, color intensity by relationship strength
- [ ] 3.7 Click-to-inspect node: side panel with full metadata, content preview, lineage inputs list
- [ ] 3.8 Click-to-inspect edge: shows edge metadata and relationship type
- [ ] 3.9 "Trace to sources" button: calls GET /lineage/trace/:id, highlights upstream chain in graph
- [ ] 3.10 Filter controls: run_id selector, agent_name checkboxes, artifact_type checkboxes, edge_type checkboxes
- [ ] 3.11 Run selector: dropdown of recent runs from GET /artifacts (grouped by run_id)
- [ ] 3.12 Configure artifact service to serve static build at `/ui/` (Vite dev server for development)
- [ ] 3.13 Visual test: run real pipeline, verify graph renders correctly with edge labels and trace highlighting

## Phase 4: Validation

- [ ] 4.1 E2E test: planner → researcher → writer pipeline, verify edges captured without agent prompt changes
- [ ] 4.2 Verify existing artifact-lineage.mjs and artifact-lineage-html.mjs tests still pass
- [ ] 4.3 Write reasoning trace
- [ ] 4.4 Write assumption log
- [ ] 4.5 Update this plan — mark all items complete

## Review

(to be filled after completion)
