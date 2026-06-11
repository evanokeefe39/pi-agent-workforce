# Provenance and Artifact Architecture — Design Specification

## Intent

Replace the current tangled artifact/provenance system with a clean, industry-standard
architecture that separates event capture, blob storage, metadata, lineage, and discovery
into independent layers. Adopt OpenLineage as the lineage standard and Marquez as the
lineage backend, eliminating custom lineage code. Introduce per-agent tool access policies
that enforce workproduct standards without constraining agents that need full filesystem
access.

## Problem Statement

The current system mixes five concerns across multiple components:

| Concern | Current owner(s) | Problem |
|---------|------------------|---------|
| Blob storage | Replicator → artifact-service → MinIO | Clean, but coupled to sidecar parsing |
| Metadata | write_artifact + workproduct extensions + .meta.json sidecars | Duplicated across every extension |
| Provenance/lineage | readLog in client.ts + lineage fields in sidecars + provenance.jsonl + graph.ts | Fragmented, incomplete (misses tool calls to external systems) |
| Discovery | read_artifact + list_artifacts tools | Artifact-service-specific, no cross-system discovery |
| Tool enforcement | Prompt-only ("you must use record_finding") | Model-dependent, fails on model upgrade |

Additionally, data flows through external systems (Notion, GitHub, Linear, web APIs) are
invisible to the provenance system because it only tracks filesystem reads/writes.

## Architecture

### Layer 1: Event Capture — Provenance Extension

A shared Pi extension loaded by all agents. Hooks `tool_call` and `tool_result` events
on ALL tools (built-in and custom). Classifies each tool call as READ, WRITE, or COMPUTE.
Maintains a per-session context window of inputs. Emits OpenLineage RunEvents.

```
pi.on("tool_call", ...)   → classify, track reads in contextWindow
pi.on("tool_result", ...) → for writes: record output dataset
session end                → emit COMPLETE RunEvent with all inputs → all outputs
```

The provenance extension is ~150-200 lines. It does NOT own storage, metadata, or lineage
graph construction.

#### Tool Classification Registry

Maps tool names to data flow semantics:

```typescript
interface ToolClassification {
  type: "READ" | "WRITE" | "COMPUTE";
  uri: (input: any, result?: any) => string;
}

const TOOL_CLASSIFICATIONS: Record<string, ToolClassification> = {
  // Filesystem
  read:              { type: "READ",  uri: (i) => `file://${i.path}` },
  write:             { type: "WRITE", uri: (i) => `file://${i.path}` },
  edit:              { type: "WRITE", uri: (i) => `file://${i.file_path}` },

  // Research tools
  web_search:        { type: "READ",  uri: (i) => `web://search?q=${i.query}` },
  deep_research:     { type: "READ",  uri: (i) => `web://research?q=${i.query}` },
  scrape_apify:      { type: "READ",  uri: (i, r) => `apify://dataset/${r?.id}` },

  // MCP integrations
  "mcp__Notion__*":  { type: "WRITE", uri: (i, r) => `notion://page/${r?.id}` },
  "mcp__Linear__*":  { type: "READ",  uri: (i) => `linear://issue/${i.id}` },
  "mcp__Github__*":  { type: "WRITE", uri: (i, r) => `github://...` },

  // Workproduct tools
  record_finding:    { type: "WRITE", uri: (i) => `file://workproduct/findings/...` },
  record_metric:     { type: "WRITE", uri: (i) => `file://workproduct/metrics/...` },
  record_query_result: { type: "WRITE", uri: (i) => `file://workproduct/queries/...` },
  record_chart:      { type: "WRITE", uri: (i) => `file://workproduct/charts/...` },
};

// Unknown tools default to COMPUTE (no provenance impact)
```

New integrations register their classification. Glob patterns supported for MCP tool
families.

#### OpenLineage Event Shape

```json
{
  "eventType": "COMPLETE",
  "eventTime": "2026-06-11T12:00:00Z",
  "producer": "https://github.com/user/pi-agent-workforce",
  "schemaURL": "https://openlineage.io/spec/1-0-0/OpenLineage.json#/definitions/RunEvent",
  "run": {
    "runId": "researcher-session-456",
    "facets": {
      "piAgent_correlation": {
        "_producer": "...", "_schemaURL": "...",
        "correlationId": "planner-run-xyz",
        "causationId": "planner-run-xyz",
        "agentName": "researcher"
      }
    }
  },
  "job": {
    "namespace": "pi-workforce",
    "name": "researcher"
  },
  "inputs": [
    { "namespace": "web", "name": "search?q=instagram+growth" },
    { "namespace": "apify", "name": "instagram/creator_x" }
  ],
  "outputs": [
    { "namespace": "artifact", "name": "01J5A_finding.json",
      "facets": {
        "piAgent_admiralty": { "_producer": "...", "_schemaURL": "...",
          "reliability": "A", "credibility": "1"
        },
        "piAgent_artifactType": { "_producer": "...", "_schemaURL": "...",
          "type": "dataset"
        }
      }
    }
  ]
}
```

#### Context Window Semantics

Reads accumulate for the entire agent session, not cleared on individual writes. One
COMPLETE event emitted at session end with all inputs and all outputs. This matches
OpenLineage's model: one Job Run = one Activity that consumed inputs and produced outputs.

Rationale: an LLM processes all reads in its context window. Finding #7 is informed by
the same web searches as finding #1 — clearing the context window per-write loses this.

#### Correlation and Causation IDs

- **correlationId**: shared across all agents in a pipeline run. Set by planner, propagated
  to all subagents via delegation brief or environment variable. Answers "show me everything
  from this project/pipeline run."
- **causationId**: the immediate parent that spawned this agent run. Answers "which
  delegation created this."

These are OpenLineage custom facets on every RunEvent, queryable via Marquez API.

#### Event Emission Timing

OpenLineage defines three event types for job lifecycle. Agent runs are long-running
(researcher: 60 turns / several minutes), so we use all three:

- **START** — emitted when agent session starts. Contains job identity, correlationId,
  causationId. No inputs/outputs yet.
- **RUNNING** — emitted every 10 turns (aligns with existing jidoka mid-run checks).
  Contains inputs seen so far, outputs written so far. Gives Marquez live visibility
  into running agents. Also serves as a jidoka signal — if RUNNING at turn 20 shows
  0 outputs, that's a trigger for mid-run escalation.
- **COMPLETE/FAIL/ABORT** — emitted at session end with all inputs and all outputs.

Marquez merges inputs/outputs across all events for a given runId to construct the
final lineage. Partial RUNNING events are additive, not replacing.

This is the standard OpenLineage pattern used by Flink and Spark integrations for
long-running jobs. No custom protocol needed.

### Layer 2: Blob Storage — Replicator + MinIO

Replicator becomes event-driven, triggered by the provenance extension. No sidecar
parsing, no filesystem watching, no metadata extraction.

```
Current: replicator watches for .meta.json sidecars via fs.watch, parses metadata, uploads
After:   provenance extension detects write tool_result → signals replicator → upload blob
```

The provenance extension is the authoritative source of "a file is ready." It intercepts
the write tool_result (which fires after the file is fully written and closed), then
notifies the replicator to upload. This is more reliable than filesystem watching because
it's tied to tool execution completion, not inotify events that might fire mid-write.

The .meta.json sidecar convention is retired. Metadata flows through OpenLineage events,
not file sidecars.

MinIO key scheme: `{correlationId}/{agent}/{filename}` or content-addressed
`{sha256}/{filename}`.

### Layer 3: Event Store + Projections — Marquez

Marquez (OpenLineage reference implementation) receives RunEvents via HTTP, stores them,
and materializes lineage graph + metadata projections.

#### Docker Compose Addition

```yaml
marquez-api:
  image: marquezproject/marquez:latest
  ports:
    - "5000:5000"
    - "5001:5001"
  depends_on:
    - postgres
  environment:
    - MARQUEZ_DB_HOST=postgres
    - MARQUEZ_DB_NAME=marquez
    - MARQUEZ_DB_USER=${POSTGRES_USER}
    - MARQUEZ_DB_PASSWORD=${POSTGRES_PASSWORD}

marquez-web:
  image: marquezproject/marquez-web:latest
  ports:
    - "3001:3000"
  environment:
    - MARQUEZ_HOST=marquez-api
    - MARQUEZ_PORT=5000
```

Reuses existing Postgres instance with a separate `marquez` database.

#### Lineage API

```
POST /api/v1/lineage                    → receive OpenLineage RunEvent
GET  /api/v1/lineage?nodeId=...&depth=N → traverse lineage graph
GET  /api/v1/namespaces/.../datasets    → discover datasets
GET  /api/v1/namespaces/.../jobs        → discover job runs
```

Graph traversal with configurable depth, upstream/downstream direction. Column-level
lineage supported.

### Layer 4: Artifact Service (Simplified)

Artifact service becomes blob CRUD + discovery only. Lineage code removed.

**Drop:**
- graph.ts (Graphology-based lineage graph)
- artifact_edges table
- lineage endpoints (/lineage/*)
- Edge creation in routes.ts handleWrite
- PROV-JSON serialization

**Keep:**
- POST /artifacts (blob upload, metadata upsert)
- GET /artifacts/:id (blob retrieval)
- GET /artifacts (filtered listing, discovery)
- PATCH /artifacts/:id (metadata update)
- GET /health
- Postgres artifacts table (metadata)
- MinIO integration (blob storage)
- RBAC enforcement

**Simplify:**
- handleWrite no longer creates lineage edges
- No deduplication logic needed (content-addressed MinIO handles this)

### Layer 5: Discovery — Artifact Resolution

Agents need to find and read each other's outputs. Three mechanisms:

**Primary: Pre-staging at delegation time (data locality pattern)**

The planner knows which artifacts the next agent needs — it has the previous agent's
output IDs. When delegating, server.ts pre-stages artifacts into the target agent's
session directory before the agent starts:

```
Planner delegates to writer with artifact IDs [01J5A, 01J5C]:
  → server.ts fetches blobs from artifact service
  → writes to /workspace/sessions/{writer-session}/input/01J5A_finding.json
  → writes to /workspace/sessions/{writer-session}/input/01J5C_findings.jsonl
  → writer agent starts, reads local files (fast, no network latency)
```

This is the standard pattern from CI/CD (download artifacts before job runs), scientific
workflows (Pegasus stages data to compute node), and distributed computing (Spark data
locality scheduling). Pre-fetching reduces workflow latency by 50%+ in published studies.

Pre-staging eliminates runtime artifact resolution for the common case (known artifacts
passed through delegation). The provenance extension sees the local read and tracks it
as an input.

**Fallback: artifact:// URI resolution**

For artifacts not pre-staged (ad-hoc reads, dynamic discovery), the provenance extension
resolves artifact:// URIs on the fly:

```typescript
pi.on("tool_call", async (event) => {
  if (event.toolName === "read" && event.input.path.startsWith("artifact://")) {
    const id = parseArtifactId(event.input.path);
    const blob = await artifactService.read(id);
    const localPath = `${sessionDir}/input/${id}_${blob.filename}`;
    writeFileSync(localPath, blob.content);
    event.input.path = localPath;  // mutate path to local file
  }
});
```

This is the fallback, not the primary path. Used when an agent discovers artifacts
dynamically (e.g., via list_artifacts) rather than receiving them in the delegation brief.

**External entities (Notion, GitHub, Linear):**

Referenced by URI in the lineage graph but not stored in MinIO. Agents access them via
their native MCP tools. Lineage tracks the connection; blob storage is not involved.

### Querying by Project / Pipeline Run

Marquez does not support filtering by custom facet values through its API. The
`/runs/{id}/facets` endpoint only retrieves facets for a known run ID.

**Resolution: direct JSONB query on Marquez's Postgres.**

Marquez stores raw OpenLineage events in a `lineage_events` table. Since Marquez shares
our existing Postgres instance (separate database), we query it directly:

```sql
SELECT * FROM lineage_events
WHERE event->'run'->'facets'->'piAgent_correlation'->>'correlationId' = 'planner-xyz';
```

Add a GIN index on the JSONB path for performance:

```sql
CREATE INDEX idx_lineage_correlation
ON lineage_events ((event->'run'->'facets'->'piAgent_correlation'->>'correlationId'));
```

This replaces both the `since` timestamp hack and the need for a custom search service.
The artifact service can expose a thin endpoint that wraps this query if needed.

This is the same pattern DataHub uses — consume OpenLineage events into one system
(lineage graph), layer search/filter on top via a separate projection. Marquez owns the
graph; Postgres JSONB owns the search.

## Tool Access Policies

### The Problem

Agents with standardized workproducts (researcher, writer, data) must use their workproduct
tools (record_finding, write_artifact with report type, record_query_result). If they bypass
these tools and write raw files, the output lacks required structure (ADMIRALTY grades,
schema-validated fields, typed artifacts).

Prompt-only enforcement ("you must use record_finding") is model-dependent. V4 Flash
follows it; V4 Pro ignored it for 42 turns. This is a known failure mode documented in
tasks/lessons.md.

### Industry Patterns

Three established approaches, composable:

1. **Tool allowlist/denylist at session creation** (architectural containment)
   Pi SDK supports `excludeTools` and `tools` (allowlist) in `createAgentSession()`.
   Also supports `noTools: "builtin"` to disable all built-in tools.

2. **Tool call interception via hooks** (execution rails)
   `pi.on("tool_call", handler)` can return `{ block: true, reason: "..." }` to prevent
   any tool from executing. Pattern from NeMo Guardrails "execution rails."

3. **Post-run validation** (output validation)
   Already implemented in jidoka.ts — `validateRequiredTools` checks that specified tools
   were called. Catches violations after the fact.

### Proposed Policy: Per-Agent Tool Profiles

Define tool access profiles in agent.json, enforced programmatically:

```jsonc
// researcher/agent.json
{
  "runtimeConfig": {
    "toolPolicy": {
      "write": "block",           // block native write
      "edit": "block",            // block native edit
      "record_finding": "allow",  // workproduct tool
      "write_artifact": "allow",  // for JSONL assembly
      "read": "allow",            // reading is always fine
      "bash": "allow",            // needed for various tasks
      "web_search": "allow",
      "deep_research": "allow",
      "scrape_apify": "allow"
    }
  }
}

// coder/agent.json
{
  "runtimeConfig": {
    "toolPolicy": {
      "write": "allow",           // coder needs full filesystem
      "edit": "allow",
      "bash": "allow",
      "read": "allow"
    }
  }
}
```

Enforcement via the provenance extension (or a separate policy extension):

```typescript
pi.on("tool_call", async (event) => {
  const policy = agentConfig.runtimeConfig.toolPolicy;
  const rule = policy[event.toolName] ?? policy["*"] ?? "allow";

  if (rule === "block") {
    return {
      block: true,
      reason: `${event.toolName} is not available. Use ${suggestAlternative(event.toolName)} instead.`
    };
  }
});
```

The block message tells the agent WHAT to use instead — critical for guiding the LLM
toward the correct tool rather than just failing.

### Agent Profiles

| Agent | write | edit | bash | Workproduct tools | Rationale |
|-------|-------|------|------|-------------------|-----------|
| Researcher | BLOCK | BLOCK | allow | record_finding, write_artifact | Findings must have ADMIRALTY grades, source_url |
| Writer | BLOCK | BLOCK | allow | write_artifact (type: report/brief) | Reports must go through artifact system |
| Data | BLOCK | BLOCK | allow | record_query_result, record_metric, record_chart, record_dataset_ref, write_artifact | All outputs must be typed and structured |
| Coder | allow | allow | allow | write_artifact (for publishing) | Needs full filesystem for code/rendering |
| Publisher | BLOCK | BLOCK | allow | write_artifact (for manifests) | Publishing is a controlled pipeline |
| QA | BLOCK | BLOCK | allow | record_violation, record_commendation | QA outputs must be structured evaluations |
| Planner | N/A | N/A | allow | N/A | Planner delegates, doesn't produce files |

### Interaction with Provenance Extension

When `write` is blocked for researcher, the agent must use `record_finding`. The
record_finding tool writes a structured JSON file to workproduct/findings/. The provenance
extension sees this write (via tool_result on record_finding) and classifies it as a WRITE
output for the OpenLineage event. The file lands in the right directory, replicator uploads
it, and the lineage graph captures it.

No behavior change needed in the provenance extension — it observes whatever tools are
actually called.

### Jidoka Integration

Existing jidoka.ts `validateRequiredTools` becomes the safety net:
- Primary enforcement: tool policy blocks (prevents wrong tool usage)
- Secondary enforcement: required tools check (catches cases where agent does nothing)
- Mid-run escalation: if required tools not called after N turns, inject correction

The tool policy prevents the wrong action. Jidoka ensures the right action happened.

## What Gets Removed

| Component | Status | Replacement |
|-----------|--------|-------------|
| write_artifact extension tool | REMOVE | Native write (coder) or workproduct tools (researcher, writer, data) + provenance extension auto-capture |
| read_artifact extension tool | SIMPLIFY | artifact:// URI resolution in provenance extension |
| list_artifacts extension tool | KEEP (simplified) | Thin wrapper over artifact service GET /artifacts |
| .meta.json sidecar convention | REMOVE | OpenLineage events carry all metadata |
| provenance.jsonl | REMOVE | OpenLineage event log in Marquez |
| readLog in artifacts/client.ts | REMOVE | Provenance extension contextWindow |
| graph.ts | REMOVE | Marquez lineage graph |
| artifact_edges Postgres table | REMOVE | Marquez lineage storage |
| lineage endpoints on artifact-service | REMOVE | Marquez lineage API |
| lineage-ui (React Flow) | REMOVE | Marquez Web UI |
| Sidecar parsing in replicator.ts | SIMPLIFY | Replicator uploads blobs only |

## What Gets Added

| Component | Size | Purpose |
|-----------|------|---------|
| Provenance extension | ~200 lines | tool_call/tool_result hooks, contextWindow, OpenLineage event emission |
| Tool classification registry | ~50 lines | Maps tool names → READ/WRITE/COMPUTE + URI builders |
| Tool policy enforcement | ~30 lines | Per-agent write blocking (in provenance extension or separate) |
| Marquez services | Docker images | Lineage backend + UI (zero custom code) |
| open-lineage-client dependency | npm package | TypeScript client for emitting RunEvents |
| correlationId propagation | ~20 lines in server.ts | Pass planner runId to subagents |

## Domain-Specific Workproduct Standards (Unchanged)

These stay exactly as they are. They are content-level concerns, not infrastructure:

- **Researcher**: record_finding with source_url, ADMIRALTY grades (reliability A-F,
  credibility 1-6), structured claim text. This is intelligence tradecraft — the provenance
  extension cannot infer source reliability from a web_search result.

- **Data agent**: record_query_result with SQL, record_metric with methodology,
  record_chart with Vega-Lite spec. These encode analytical rigor.

- **Writer**: Citation format using ADMIRALTY grades from findings. Confidence hedging
  based on source reliability.

- **QA**: record_violation / record_commendation with structured evaluation criteria.

The provenance extension captures THAT these tools were called and WHAT data flowed
through them. The workproduct extensions enforce HOW the content is structured.

## Stress Test: Full Pipeline Trace

### Scenario: Planner → Researcher → Writer

**Planner (correlationId: planner-xyz):**
- Emits START event
- Delegates to researcher with correlationId=planner-xyz
- Delegates to writer with correlationId=planner-xyz
- Emits COMPLETE event

**Researcher (correlationId: planner-xyz, causationId: planner-xyz):**
- web_search → READ from web://search?q=...
- scrape_apify → READ from apify://instagram/creator_x
- scrape_apify → READ from apify://instagram/creator_y
- record_finding (A1) → WRITE to artifact://01J5A_finding.json
- record_finding (B2) → WRITE to artifact://01J5B_finding.json
- write_artifact (JSONL) → WRITE to artifact://01J5C_findings.jsonl
- Session ends → COMPLETE event:
  inputs: [web://search, apify://creator_x, apify://creator_y]
  outputs: [01J5A, 01J5B, 01J5C]

**Writer (correlationId: planner-xyz, causationId: planner-xyz):**
- read(artifact://01J5C_findings.jsonl) → READ
- read(artifact://01J5A_finding.json) → READ
- write("output/report.md") → BLOCKED (writer tool policy)
- Agent retries with write_artifact → WRITE to artifact://01J7Y_report.md
- Session ends → COMPLETE event:
  inputs: [artifact://01J5C, artifact://01J5A]
  outputs: [artifact://01J7Y_report.md]

### Lineage query: "What informed the final report?"

```
GET /api/v1/lineage?nodeId=dataset:artifact:01J7Y_report.md&depth=20

Graph:
  web://search?q=instagram+growth ─┐
  apify://instagram/creator_x ─────┼─→ [researcher] ─→ findings ─┐
  apify://instagram/creator_y ─────┘                              ├─→ [writer] ─→ report.md
                                                                  │
```

Two hops from report to original Instagram profile data. Full cross-agent lineage.

### Lineage query: "Everything in this project"

```
GET /api/v1/namespaces/pi-workforce/jobs?facets=piAgent_correlation.correlationId:planner-xyz

Returns: all jobs (planner, researcher, writer) and all datasets they touched.
```

The correlationId facet replaces the `since` timestamp hack for pipeline-scoped queries.

## Migration Path

### Phase 1: Marquez + Provenance Extension (new, parallel)
- Add Marquez to docker-compose
- Build provenance extension with tool_call/tool_result hooks
- Emit OpenLineage events to Marquez alongside existing system
- Both systems run in parallel, compare lineage graphs
- No breaking changes

### Phase 2: Tool Policy Enforcement
- Add tool policies to agent.json for researcher, writer, data, QA
- Enforce via provenance extension tool_call hooks
- Verify agents adapt to blocked tools (use workproduct tools instead)
- E2E tests confirm structured output still produced

### Phase 3: Remove Old System
- Drop write_artifact tool (agents use workproduct tools + native write)
- Drop .meta.json sidecar convention
- Simplify replicator (blob-only, no sidecar parsing)
- Drop graph.ts, lineage endpoints, artifact_edges table
- Drop lineage-ui (Marquez UI replaces it)
- Drop provenance.jsonl, readLog

### Phase 4: Extend
- Add more tool classifications as MCP integrations grow
- Column-level lineage via Marquez
- Temporal queries (lineage at a point in time)
- correlationId propagation through all delegation paths

## Resolved Questions

1. **Replicator trigger without sidecars.**
   Resolution: provenance extension signals replicator after intercepting write tool_result.
   No filesystem watching heuristics. The tool_result event fires after the file is fully
   written and closed — more reliable than inotify. See Layer 2.

2. **Marquez custom facet querying.**
   Resolution: direct JSONB query on Marquez's Postgres lineage_events table. Marquez
   cannot filter by facet values through its API, but shares our Postgres instance. One
   indexed JSONB query replaces the `since` timestamp hack. No extra service needed.
   See "Querying by Project / Pipeline Run" section.

3. **Binary artifact resolution latency.**
   Resolution: pre-stage artifacts into session input/ directory at delegation time.
   Standard data locality pattern from CI/CD, Pegasus, Spark. Eliminates runtime fetching
   for the common case. artifact:// URI resolution remains as fallback for dynamic
   discovery. See Layer 5.

4. **Event emission timing.**
   Resolution: START on session create, RUNNING every 10 turns (aligns with jidoka
   mid-run checks), COMPLETE/FAIL/ABORT on session end. Standard OpenLineage pattern
   for long-running jobs. Marquez merges inputs/outputs across all events per runId.
   RUNNING events double as jidoka health signals. See "Event Emission Timing" section.

## References

- [OpenLineage Spec](https://github.com/OpenLineage/OpenLineage/blob/main/spec/OpenLineage.md)
- [OpenLineage Custom Facets](https://openlineage.io/docs/spec/facets/custom-facets/)
- [open-lineage-client npm](https://www.npmjs.com/package/open-lineage-client)
- [Marquez Project](https://github.com/MarquezProject/marquez)
- [Marquez Lineage API](https://marquezproject.ai/docs/api/get-lineage/)
- [W3C PROV Data Model](https://www.w3.org/TR/prov-dm/)
- [OpenLineage as Spine of Data Observability](https://datalakehousehub.com/blog/2026-05-openlineage-observability/)
- [AI Agent Guardrails 2026](https://toolhalla.ai/blog/ai-agent-guardrails-io-validation-2026)
- [OpenLineage Streaming Philosophy](https://openlineage.io/blog/streaming-philosophy/)
- [Marquez Facets API](https://marquezproject.ai/docs/api/get-facets/)
- [GeoFF: Federated Workflows with Data Pre-Fetching](https://arxiv.org/pdf/2405.13594)
