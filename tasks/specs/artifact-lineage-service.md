# Artifact Lineage Service

## Intent

Track the full dependency chain across agent-produced artifacts — which agent created what, what inputs fed into each output, and how documents derive from source data — as a lightweight knowledge graph. Lineage capture must be a natural side-effect of artifact read/write operations agents already perform, with no coupling to a provenance service.

The graph models richer relationships than simple derivation: findings cite sources, reports contain sections, sections reference findings, carousels reference report sections. Multi-hop traversal answers questions like "which scraped URLs ultimately contributed to this carousel slide?"

## Context Package

### Relevant existing code

- `src/artifact-service/routes.ts` — REST API for artifact CRUD. POST /artifacts, GET /artifacts/:id, GET /artifacts, PATCH /artifacts/:id.
- `src/artifact-service/metastore.ts` — Postgres queries. Insert, query, update metadata (JSONB merge via ||).
- `src/artifact-service/types.ts` — ArtifactRecord, WriteRequest, ListQuery. Metadata is `Record<string, unknown>`.
- `src/agents/extensions/artifacts/client.ts` — Per-container HTTP client. `write()`, `read()`, `list()`, `updateMetadata()`. Runs inside each agent container.
- `src/agents/extensions/artifacts/index.ts` — Pi extension registering `write_artifact`, `read_artifact`, `list_artifacts`, `get_template` tools.
- `scripts/init-artifact-db.sql` — Postgres schema. `artifacts` table with JSONB metadata, GIN index on metadata.
- `tests/e2e/artifact-lineage.mjs` — Post-hoc lineage reconstruction from Docker logs + artifact parsing.
- `tests/e2e/artifact-lineage-html.mjs` — HTML visualization using vis.Network.

### Architectural constraints

- Agents run in isolated Docker containers, communicate only via HTTP (artifact service, subagent protocol).
- Agent prompts must not change for lineage to work. No "call the provenance API" instructions.
- The artifact client (`client.ts`) is the only touch point — it runs per-container and handles all artifact I/O.
- Metadata JSONB field is the natural extension point (already has GIN index).
- All agents share the same run_id (session ID) within a planner-orchestrated run.
- Content dedup exists (by content_hash) — lineage must not break when dedup fires.

### Prior decisions

- W3C PROV vocabulary as conceptual model: Entity (artifact), Activity (agent run), Agent (researcher/writer/etc.), wasDerivedFrom, wasGeneratedBy, wasAttributedTo.
- No external graph database — Postgres edges table for storage, Graphology for complex traversals at query time (Tier 2 architecture). Apache AGE is the upgrade path if query patterns outgrow recursive CTEs.
- Graphology chosen for in-memory graph operations (traversal, serialization, community detection). ~900K weekly npm downloads, TypeScript-native, algorithm standard library.
- React Flow + dagre chosen for UI visualization.
- Implicit-only lineage capture for v1 — no explicit `inputs` parameter on write_artifact. Client read-tracking captures W3C PROV `wasInformedBy` semantics. Explicit inputs can be added later as optional override without breaking anything.
- UI served from artifact service at `/ui/` — static Vite build, no new container or port.
- RESTRICT foreign keys on edges — artifacts with lineage dependencies cannot be deleted until edges are explicitly removed. Matches immutability model (content-addressed, deduped).
- Method inference table only — no agent-provided overrides. New artifact types get a new row.

### Anti-patterns to avoid

- Explicit provenance API calls from agents — violates the zero-coupling constraint.
- Graph database dependency (Neo4j, etc.) — overengineered for this scale.
- Storing lineage only in metadata JSONB without a queryable edges table — makes graph queries expensive.
- Uniform deep processing of all artifacts for lineage — triage first.

## Design

### Core Insight: Implicit Lineage via Read-Tracking

The artifact client (`client.ts`) runs per-container and already handles every `read_artifact` and `write_artifact` call. It can maintain a session-local list of artifact IDs read, and automatically attach them as inputs when writing a new artifact. Zero agent prompt changes.

```
Agent reads artifact A (researcher findings)
Agent reads artifact B (data export)
Agent writes artifact C (report)
→ client automatically sets C.metadata.lineage.inputs = [A.id, B.id]
→ artifact service creates edges: A → C, B → C
```

### Data Model

#### Edges table (new)

```sql
CREATE TABLE IF NOT EXISTS artifact_edges (
    source_id   TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
    target_id   TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
    edge_type   TEXT NOT NULL CHECK (edge_type IN (
        'derived_from',     -- target was derived from source (PROV wasDerivedFrom)
        'informed_by',      -- weaker: target was informed by source (PROV wasInformedBy)
        'cites',            -- target cites source (finding → source data)
        'contains',         -- target contains source (dataset → individual findings)
        'references',       -- target references source (report section → finding)
        'extracted_from'    -- target was extracted from source (scraped data → raw page)
    )),
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (source_id, target_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_edges_target ON artifact_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON artifact_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_type ON artifact_edges(edge_type);
```

Edge metadata JSONB allows attaching context to relationships (section number, finding ID within a JSONL, etc.) without schema changes.

RESTRICT on both foreign keys: artifacts with lineage edges cannot be silently deleted. Explicit edge removal required first.

#### Metadata lineage envelope (on artifact records)

```json
{
  "lineage": {
    "inputs": ["01JHX...abc", "01JHX...def"],
    "method": "synthesis",
    "activity": "writer-report-generation"
  }
}
```

Edges table is the source of truth for graph queries. Metadata lineage is denormalized for fast single-artifact inspection.

### Knowledge Graph Query Layer (Tier 2)

Two-tier query architecture:

**Tier 1 — Postgres recursive CTEs.** Handle simple lineage queries: direct parents/children, single-relationship-type traversal, depth-bounded ancestor chains. These cover 80% of queries (UI graph rendering, single-artifact inspection).

**Tier 2 — Graphology in-memory graph.** For complex traversals that are awkward in SQL: multi-hop paths across mixed edge types, reachability queries ("which source URLs contributed to this carousel?"), connected components, community detection. Load edges from Postgres into a Graphology directed graph at query time.

```typescript
import Graph from "graphology";

async function buildGraph(runId: string): Promise<Graph> {
  const graph = new Graph({ type: "directed", multi: true });
  const artifacts = await listArtifacts({ run_id: runId });
  const edges = await getEdgesByRunId(runId);

  for (const a of artifacts) {
    graph.addNode(a.id, {
      agent: a.agent_name,
      type: a.artifact_type,
      filename: a.filename,
    });
  }
  for (const e of edges) {
    graph.addEdge(e.source_id, e.target_id, { type: e.edge_type });
  }
  return graph;
}
```

Graphology provides: BFS/DFS traversal, shortest path, all paths between two nodes, connected components, betweenness centrality. This makes queries like "trace all source data that fed into this report" a library call rather than a recursive CTE with multiple edge type joins.

**Upgrade path to Tier 3 (Apache AGE).** If Graphology-at-query-time becomes a bottleneck (hundreds of runs, thousands of artifacts), Apache AGE adds Cypher to Postgres. Same database, same container — just an extension. Query becomes `MATCH (report)-[:references|cites*]->(source) WHERE report.id = $1 RETURN source`. Not needed at current scale but zero-cost to migrate to later.

### Lineage Capture Flow

#### 1. Client-side read tracking (client.ts)

```typescript
// Module-level state — reset per container lifecycle, scoped by run_id
const readLog: Map<string, Set<string>> = new Map(); // run_id → Set<artifact_id>

// In read():
function trackRead(runId: string, artifactId: string) {
  if (!readLog.has(runId)) readLog.set(runId, new Set());
  readLog.get(runId)!.add(artifactId);
}

// In write():
function getInputs(runId: string): string[] {
  return Array.from(readLog.get(runId) ?? []);
}
```

#### 2. Write enrichment (client.ts → write())

Before sending POST /artifacts, the client attaches:

```typescript
metadata: {
  ...params.metadata,
  lineage: {
    inputs: getInputs(runId),
    method: inferMethod(params.type), // "research" → "collection", "report" → "synthesis", etc.
  }
}
```

#### 3. Server-side edge creation (routes.ts → handleWrite)

After inserting the artifact record, if `metadata.lineage.inputs` is present:

```typescript
const inputs = record.metadata?.lineage?.inputs as string[] | undefined;
if (inputs?.length) {
  const edgeType = inferEdgeType(record.artifact_type, inputs);
  await insertEdges(inputs.map(sourceId => ({
    source_id: sourceId,
    target_id: record.id,
    edge_type: edgeType,
  })));
}
```

Edge type inference from implicit read-tracking:

| writer artifact_type | source artifact_type | edge_type |
|---|---|---|
| report, brief | dataset, research | derived_from |
| dataset (JSONL findings) | any | contains |
| any | any (fallback) | informed_by |

The `informed_by` fallback is correct W3C PROV semantics for implicit tracking — "this agent saw that artifact before producing this one." Stronger edge types (`cites`, `references`, `extracted_from`) can be added later via explicit annotation or content-aware inference (parsing JSONL findings for source references).

#### 4. Dedup handling

When content dedup fires (existing artifact returned), the edges still get created for the new derivation relationship. Same content can have multiple derivation paths.

### Query API

#### GET /lineage/:id

Returns ancestors and descendants of an artifact.

```
GET /lineage/01JHX...abc?depth=3&direction=both
```

Response:
```json
{
  "root": "01JHX...abc",
  "ancestors": [
    { "id": "01JHX...def", "depth": 1, "edge_type": "derived_from", "artifact": { ... } }
  ],
  "descendants": [
    { "id": "01JHX...ghi", "depth": 1, "edge_type": "derived_from", "artifact": { ... } }
  ]
}
```

Implementation: recursive CTE in Postgres.

```sql
WITH RECURSIVE lineage AS (
    SELECT source_id, target_id, edge_type, 1 as depth
    FROM artifact_edges WHERE target_id = $1
    UNION ALL
    SELECT e.source_id, e.target_id, e.edge_type, l.depth + 1
    FROM artifact_edges e JOIN lineage l ON e.target_id = l.source_id
    WHERE l.depth < $2
)
SELECT DISTINCT * FROM lineage;
```

#### GET /lineage/graph?run_id=X

Returns full lineage graph for a run as nodes + edges (for visualization).

```json
{
  "nodes": [
    { "id": "01JHX...abc", "agent_name": "researcher", "artifact_type": "dataset", "filename": "findings.jsonl" }
  ],
  "edges": [
    { "source": "01JHX...abc", "target": "01JHX...def", "type": "derived_from" }
  ]
}
```

#### GET /lineage/graph?run_id=X&format=prov-json

Returns W3C PROV-JSON serialization for interoperability.

### UI

React Flow + dagre layout. Vite dev server during development, static build served from artifact service at `/ui/` in production. No new container or port.

Features:
- Auto-layout DAG with dagre (top-to-bottom: sources → findings → report → carousel)
- Node types: color-coded by artifact_type (dataset=blue, research=green, report=orange, etc.)
- Edge labels: edge_type (derived_from, informed_by, cites, etc.)
- Node labels: agent_name + filename
- Click node: side panel shows full artifact metadata, content preview, lineage inputs list
- Click edge: shows edge metadata and relationship type
- Filter by run_id, agent_name, artifact_type
- Run selector: dropdown of recent runs (grouped by run_id from artifact list)
- "Trace to sources" button on any node: uses Graphology BFS to highlight the full upstream chain
- Zoom/pan/fit-to-screen

### Method Inference

The client infers `lineage.method` from artifact type to avoid burdening agents:

| artifact_type | method |
|---|---|
| research, finding, dataset | collection |
| report, brief | synthesis |
| code | transformation |
| state, session, log | system |

## Behavioral Contracts

GIVEN an agent reads artifacts A and B via read_artifact, then writes artifact C via write_artifact
WHEN C is written to the artifact service
THEN C.metadata.lineage.inputs contains [A.id, B.id] AND artifact_edges contains rows (A→C, derived_from) and (B→C, derived_from)

GIVEN an agent writes artifact D without reading any artifacts first
WHEN D is written to the artifact service
THEN D.metadata.lineage.inputs is empty AND no edges are created for D as target

GIVEN artifact E has lineage inputs [F, G] and artifact G has lineage inputs [H]
WHEN GET /lineage/E?depth=3&direction=ancestors is called
THEN response contains F (depth 1), G (depth 1), H (depth 2)

GIVEN a run produces artifacts across researcher, writer, and publisher agents
WHEN GET /lineage/graph?run_id=X is called
THEN response contains all artifacts from that run as nodes and all derivation edges between them

GIVEN content dedup fires (identical content_hash already exists)
WHEN the client had read artifacts before the write
THEN edges are still created from the read artifacts to the existing (deduped) artifact

GIVEN the lineage UI loads with a run_id
WHEN the graph renders
THEN artifacts are laid out as a DAG (top-to-bottom), color-coded by type, with agent names on nodes

GIVEN no changes to any agent AGENTS.md files or agent prompts
WHEN a full planner → researcher → writer pipeline runs
THEN lineage is captured for all artifacts produced

## Edge Case Inventory

1. **Agent reads artifact but doesn't write** — reads accumulate but no edges created. No harm, no waste.
2. **Agent writes multiple artifacts in one session** — each write gets the full read log as inputs. Later artifacts may over-report inputs. Acceptable for v1; future refinement can add write-to-write scoping.
3. **Dedup collision** — same content written by two agents. Edges created to the original artifact ID. Both derivation paths preserved.
4. **Circular reference** — impossible by construction (artifacts are immutable, can only reference already-existing artifacts). The recursive CTE has a depth limit as safety.
5. **Cross-run references** — agent reads artifact from a different run. Client tracks by artifact ID regardless of run. Edges correctly span runs.
6. **Orphaned edges** — impossible. RESTRICT foreign keys prevent deletion of artifacts that have lineage edges. Must remove edges explicitly first.
7. **Large graphs** — run with hundreds of artifacts. Recursive CTE bounded by depth parameter. UI uses dagre layout which handles hundreds of nodes.
8. **Empty run** — no artifacts produced. Graph endpoint returns empty nodes/edges arrays.

## Definition of Done

- [ ] artifact_edges table created via migration script
- [ ] client.ts tracks reads per run_id and attaches lineage.inputs on write
- [ ] routes.ts creates edges on artifact write when lineage.inputs present
- [ ] GET /lineage/:id returns ancestors/descendants with depth control
- [ ] GET /lineage/graph?run_id=X returns full graph as nodes+edges
- [ ] PROV-JSON output supported via format parameter
- [ ] React Flow UI renders lineage DAG with color-coded nodes
- [ ] UI supports click-to-inspect, filter by run_id/agent/type, zoom/pan
- [ ] E2E test: planner → researcher → writer pipeline produces correct lineage graph
- [ ] Existing artifact-lineage.mjs/html tests still work (backward compat)
- [ ] No changes to any agent AGENTS.md files
- [ ] Reasoning trace written
- [ ] Assumption log written
- [ ] Plan in tasks/plans/ updated with all items marked complete

## Negative Space

What must not change:
- Agent prompts (AGENTS.md files) — lineage is invisible to agents
- write_artifact tool interface as seen by agents — no new required parameters
- Existing artifact API behavior — all current endpoints backward-compatible
- RBAC enforcement — lineage queries respect existing access control

What is out of scope:
- Real-time lineage streaming (webhook/SSE on edge creation)
- Lineage-based access control (restricting reads based on provenance)
- Automated quality scoring based on lineage depth
- Publisher agent implementation (mentioned in examples but not part of this milestone)

Resolved decisions (2026-06-08):
- Implicit-only lineage capture for v1. No explicit `inputs` parameter — client read-tracking is sufficient. Can add optional explicit override later.
- UI served from artifact service at `/ui/`. No new container.
- RESTRICT foreign keys. Artifacts with edges cannot be deleted silently.
- Method inference table only. No agent-provided overrides.
- Richer edge types beyond PROV basics: `cites`, `contains`, `references`, `extracted_from` alongside `derived_from` and `informed_by`.
- Graphology as query-time graph layer (Tier 2). Apache AGE as Tier 3 upgrade path if needed.

## Open Questions

None.
