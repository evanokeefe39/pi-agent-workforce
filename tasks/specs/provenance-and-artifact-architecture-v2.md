# OUTDATED: Provenance layer removed (2026-06-13)
# Provenance and Artifact Architecture v2 — Design Specification

> **Note:** The provenance/OpenLineage layer described in this spec has been removed.
> OTel traces replaced Marquez for observability. The artifact/extension decoupling
> design (publish_artifact, artifact-store, RBAC) remains valid and is implemented.

Supersedes: `provenance-and-artifact-architecture.md` (v1)

## Why v2

v1 coupled provenance (lineage tracking) to artifact replication (data transfer).
The provenance extension was responsible for signaling the replicator to upload files,
making lineage a hard dependency of storage. Implementation exposed this as a design
flaw — disabling or misconfiguring provenance silently broke artifact uploads.

v2 separates every concern into independent layers with zero coupling between them.
The guiding principle: **no extension should depend on, trigger, or signal another
extension.** The agent sequences its own actions explicitly.

## Changes from v1

| v1 design | Problem | v2 design |
|-----------|---------|-----------|
| Provenance extension signals replicator on write | Couples lineage to storage; removing provenance breaks uploads | `publish_artifact` tool — agent explicitly publishes, decoupled from all extensions |
| Tool policy enforcement inside provenance extension | Couples access control to lineage; can't have policy without provenance | `pi-permission-system` (already installed) — update pi-permissions.jsonc per agent, remove custom toolPolicy |
| Replicator watches filesystem for .meta.json sidecars | Complex watcher + sidecar convention; fragile on timing, races, missed events | Replicator deleted. `publish_artifact` does a direct HTTP upload via artifact client |
| write_artifact combines file write + upload + metadata | One tool doing three jobs; can't write without publishing, can't publish without writing | Workproduct tools write local files. `publish_artifact` uploads. Two explicit steps |
| Pre-staging artifacts at delegation time | Overengineering; creates a special pattern per integration type | Agents discover via `read_artifact` / `list_artifacts` tools at runtime |
| artifact:// URI resolution in provenance hook | Couples discovery to lineage extension | `read_artifact` tool handles artifact:// URIs directly |

## Architecture

Six independent layers. Any can be added, removed, or disabled without affecting
the others.

### Layer 1: Workproduct Extensions (format enforcement)

Per-agent extension tools that validate and write structured local files. These are
poka-yoke — they enforce the shape of output at the tool level, not the prompt level.

| Agent | Workproduct tools | What they enforce |
|-------|-------------------|-------------------|
| Researcher | `record_finding` | ADMIRALTY grades (A-F reliability, 1-6 credibility), source_url, structured claim |
| Writer | `write_report`, `write_carousel_copy`, `write_caption` | Title, sections, citations with artifact refs, minimum length |
| Data | `record_query_result`, `record_metric`, `record_chart`, `record_dataset_ref` | SQL present, methodology, Vega-Lite spec |
| QA | `record_violation`, `record_commendation` | Evaluation criteria, verdict scale |
| Coder | (uses native write/edit — full filesystem access) | N/A |
| Publisher | (uses publish_artifact directly with pre-validated content) | N/A |
| Planner | (delegates, doesn't produce files) | N/A |

Each tool writes to the agent's session directory:
`/workspace/sessions/{id}/workproduct/{type}/{ulid}_{filename}`

Workproduct tools know nothing about artifact service, provenance, or tool policy.
They validate input, write a local file, return the path + metadata to the agent.

### Layer 2: Artifact Tools (publish, read, discover)

Three tools in a shared artifacts extension loaded by all agents. They wrap the
artifact service HTTP client. No coupling to any other extension.

**`publish_artifact`** — agent calls with a local file path, tool reads the file,
uploads to artifact service via HTTP POST. Returns artifact ID.

```typescript
pi.registerTool({
  name: "publish_artifact",
  parameters: {
    path: "Local file path (relative to session dir or absolute)",
    type: "Artifact type (finding, report, dataset, code, image, render)",
    tags: "Optional tags array",
  },
  execute(params, ctx) {
    const content = readFileSync(resolve(cwd, params.path));
    const result = await client.write({
      filename: basename(params.path),
      content: content.toString("base64"),
      type: params.type,
      mime: guessMime(params.path),
    });
    return `Published: artifact://${result.id}`;
  },
});
```

RBAC enforced at artifact service — `canWrite(agentName, s3Key)`.

**`read_artifact`** — fetches artifact content from artifact service by ID or
artifact:// URI. RBAC enforced at artifact service — `canRead(agentName, s3Key)`.

**`list_artifacts`** — queries artifact service with filters (agent, type, since,
run_id). Returns artifact IDs and metadata for discovery. RBAC enforced at service.

### Layer 3: Tool Policy — pi-permission-system (access control)

Already exists as `npm:pi-permission-system`, installed on all agents via
settings.json. Per-agent policy defined in `.pi/agent/pi-permissions.jsonc`.
No custom extension needed — this is a standard Pi SDK package.

Currently pi-permissions.jsonc allows `write`/`edit` for all agents. The
provenance refactor added a redundant `toolPolicy` in agent.json enforced
by custom code in the provenance extension. Remove the custom toolPolicy
and update pi-permissions.jsonc to be the single source of truth.

Agent profiles:

| Agent | write | edit | Workproduct tools | Rationale |
|-------|-------|------|-------------------|-----------|
| Researcher | BLOCK | BLOCK | record_finding, publish_artifact | Findings must have ADMIRALTY grades |
| Writer | BLOCK | BLOCK | write_report, publish_artifact | Reports must be structured |
| Data | BLOCK | BLOCK | record_query_result, record_metric, record_chart, publish_artifact | Outputs must be typed |
| Coder | allow | allow | publish_artifact | Needs full filesystem for code/rendering |
| Publisher | BLOCK | BLOCK | publish_artifact | Publishing is controlled |
| QA | BLOCK | BLOCK | record_violation, record_commendation, publish_artifact | Evaluations must be structured |
| Planner | N/A | N/A | N/A | Delegates, doesn't produce files |

### Layer 4: Provenance Extension (lineage tracking)

Hooks `tool_call` and `tool_result` on ALL tools. Classifies each as READ, WRITE,
or COMPUTE. Maintains per-session context window of inputs. Emits OpenLineage
RunEvents to Marquez. Does NOT move data, trigger uploads, enforce policy, or
signal any other component.

Identical to v1 spec with these corrections:
- RUNNING event interval: every 10 tool calls (not 30)
- Output facets: `piAgent_admiralty` and `piAgent_artifactType` on WRITE datasets
- No tool policy enforcement (moved to Layer 3)
- No replicator signaling (publish_artifact handles uploads)

### Layer 5: Jidoka (post-run validation)

Existing `jidoka.ts` — pure validation functions called by server.ts after run
completes. No coupling to any extension.

- `validateZeroOutput`: 0 tokens = failed
- `validateRequiredTools`: specified tools were called (catches "forgot to publish")
- `validateMaxTurns`: abort at turn limit
- Mid-run warning: log if required tools not called after N turns

Required tools per agent now include `publish_artifact`:
- Researcher: `["record_finding", "publish_artifact"]`
- Writer: `["write_report", "publish_artifact"]`
- Data: `["record_query_result", "publish_artifact"]`

### Layer 6: Artifact Service + RBAC (shared storage)

Unchanged from v1. Blob CRUD + discovery over Postgres + MinIO. RBAC via rbac.json
glob patterns on s3_key per agent.

## What Gets Removed (from current codebase)

| Component | Action | Replacement |
|-----------|--------|-------------|
| `write_artifact` tool | REMOVE | `publish_artifact` (upload only, no file creation) |
| Replicator module (`replicator.ts`) | DELETE | `publish_artifact` direct HTTP upload |
| `.meta.json` sidecar convention | DELETE | Not needed — no filesystem watching |
| `fs.watch` on session directories | DELETE | Not needed — agent explicitly publishes |
| `waitForSession` agent-complete gate | SIMPLIFY | No pending uploads to wait for — publish is synchronous |
| `provenance.jsonl` in data workproduct | DELETE | OpenLineage events to Marquez |
| `lineage` field in data workproduct sidecar | DELETE | No sidecars |
| Tool policy code in provenance extension | DELETE | Already handled by pi-permission-system |
| `toolPolicy` in agent.json runtimeConfig | DELETE | Redundant — pi-permissions.jsonc is source of truth |
| `TOOL_ALTERNATIVES` in provenance extension | MOVE | Tool-policy extension |
| Sidecar restoration from validation session | REVERT | Should never have been added |
| `guessMime()` in artifacts extension | MOVE | Into `publish_artifact` tool |

## What Gets Added

| Component | Size | Purpose |
|-----------|------|---------|
| `publish_artifact` tool | ~30 lines | Upload local file to artifact service |
| Tool-policy extension | ~30 lines | Block disallowed tools per agent.json |
| Writer workproduct tools | ~100 lines | `write_report`, `write_carousel_copy`, `write_caption` |
| Output facets in provenance | ~15 lines | piAgent_admiralty, piAgent_artifactType on datasets |

## Stress Test: Planner → Researcher → Writer

### Planner

1. Receives goal: "Research 3 facts about Eiffel Tower, produce summary report"
2. START OpenLineage event (provenance)
3. `subagent("researcher", "Research 3 key facts about the Eiffel Tower")`
4. Researcher returns: "3 findings published: artifact://01J5A, artifact://01J5B, artifact://01J5C"
5. `subagent("writer", "Write summary report. Source findings: artifact://01J5A, artifact://01J5B, artifact://01J5C")`
6. Writer returns: "Report published: artifact://01J7Y"
7. COMPLETE OpenLineage event

### Researcher

Extensions: workproduct, artifacts, tool-policy, provenance

1. START OpenLineage event
2. `web_search("Eiffel Tower facts")` → provenance: READ
3. `web_search("Eiffel Tower construction")` → provenance: READ
4. `record_finding({ topic: "height", claim: "330m", reliability: "A", credibility: "1", source_url: "..." })`
   → workproduct validates: ADMIRALTY present ✓, source_url present ✓
   → writes `workproduct/findings/01J5A_height.json`
   → provenance: WRITE
5. `record_finding(...)` → validates ✓ → writes `01J5B_construction.json`
6. `record_finding(...)` → validates ✓ → writes `01J5C_visitors.json`
7. `publish_artifact({ path: "workproduct/findings/01J5A_height.json", type: "finding" })`
   → reads file, HTTP POST to artifact service
   → RBAC: canWrite("researcher", key) ✓
   → returns "Published: artifact://01J5A"
8. `publish_artifact(...)` → 01J5B
9. `publish_artifact(...)` → 01J5C
10. COMPLETE OpenLineage event (inputs: 2 web searches, outputs: 3 findings)

Tool policy: `write` blocked ✓, `edit` blocked ✓, `record_finding` allowed ✓, `publish_artifact` allowed ✓
Jidoka: requiredTools `["record_finding", "publish_artifact"]` — both called ✓

### Writer

Extensions: workproduct, artifacts, tool-policy, provenance

1. START OpenLineage event
2. `read_artifact("01J5A")` → RBAC: canRead("writer", researcher key) ✓ → provenance: READ
3. `read_artifact("01J5B")` → ✓ → READ
4. `read_artifact("01J5C")` → ✓ → READ
5. Writer synthesizes, guided by skills (citation format, ADMIRALTY-based hedging)
6. `write_report({ title: "Eiffel Tower: Key Facts", sections: [...], citations: [...] })`
   → workproduct validates: title ✓, sections non-empty ✓, citations reference artifacts ✓
   → writes `workproduct/reports/01J7Y_eiffel-tower.md`
   → provenance: WRITE
7. `publish_artifact({ path: "workproduct/reports/01J7Y_eiffel-tower.md", type: "report" })`
   → reads file, HTTP POST → RBAC: canWrite("writer", key) ✓
   → returns "Published: artifact://01J7Y"
8. COMPLETE OpenLineage event (inputs: 3 artifacts, outputs: 1 report)

Tool policy: `write` blocked ✓, `write_report` allowed ✓, `publish_artifact` allowed ✓
Jidoka: requiredTools `["write_report", "publish_artifact"]` — both called ✓

### Failure modes

| Failure | Caught by | Layer |
|---------|-----------|-------|
| Finding missing ADMIRALTY grades | `record_finding` rejects | Workproduct |
| Report missing citations | `write_report` rejects | Workproduct |
| Agent writes raw file instead of workproduct tool | Tool policy blocks `write` | Tool policy |
| Agent forgets to publish | Jidoka `requiredTools` | Jidoka |
| Writer tries to read planner-only artifacts | RBAC at artifact service | Artifact service |
| Agent exceeds turn limit | Jidoka `maxTurns` | Jidoka |
| Marquez down | Provenance logs error, agent continues | Provenance (graceful) |
| Artifact service down | `publish_artifact` returns error, agent sees it | Artifact tools |

No failure in one layer cascades to another.

## Design Principles

### No extension coupling

Extensions must not depend on, trigger, or signal other extensions. If two actions
need to happen in sequence (write file, then publish), the agent handles sequencing
via its prompt instructions, not hidden extension wiring.

**Why:** v1 coupled provenance → replicator → artifact upload. This created a chain
where disabling provenance broke storage. Multiple implementation sessions went in
circles trying to wire the signal path correctly. The coupling was the root cause.

### Agent sequences its own actions

The agent is the orchestrator of its workflow. "Record my finding, then publish it"
is two explicit tool calls. The agent's AGENTS.md and skills teach the pattern.
This is visible, debuggable, and works regardless of which extensions are loaded.

### Hard enforcement at tool level, soft guidance at prompt level

Workproduct extensions enforce structure (poka-yoke). Skills and AGENTS.md guide
content quality and workflow decisions. Tool policy blocks wrong tools. Jidoka
catches missing required actions. Four layers of defense, each independent.

**Why:** V4 Pro ignored prompt-based constraints for 42 turns. Prompt enforcement
is model-dependent. Tool-level enforcement is model-independent.

### Extensions can self-mutate

Pi agents can create and modify their own extensions. The workproduct extension IS
the standardized work — it can be refined through kaizen cycles. This is more Toyota
than static skills that drift from actual practice. The extension captures what the
agent has learned about output format; the skill captures workflow knowledge.

## Migration Path

### Phase 3: Remove Old System (remaining work)

This phase completes the v1 → v2 transition on the existing branch.

1. Revert sidecar restoration in artifacts extension (today's erroneous fix)
2. Create `publish_artifact` tool in artifacts extension (replace write_artifact)
3. Remove `write_artifact` tool
4. Remove `read_artifact` tool (keep as-is or simplify — it already works correctly)
5. Extract tool policy enforcement from provenance extension into standalone extension
6. Remove replicator module (`replicator.ts`) and all references in server.ts
7. Remove `.meta.json` sidecar creation from data agent workproduct extension
8. Remove `provenance.jsonl` append from data agent workproduct extension
9. Simplify `waitForSession` in server.ts (no pending uploads to track)
10. Fix RUNNING_INTERVAL from 30 to 10 in provenance extension
11. Add output facets (piAgent_admiralty, piAgent_artifactType) to provenance
12. Debug OpenLineage emission — events not reaching Marquez
13. Update agent.json toolPolicy: remove write_artifact, add publish_artifact
14. Update agent.json requiredTools: add publish_artifact
15. Create writer workproduct extension (write_report, write_carousel_copy)
16. Update all agent AGENTS.md: document write → publish two-step pattern
17. Update tests

### Phase 4: Extend

1. More tool classifications as MCP integrations grow
2. Column-level lineage via Marquez (piAgent_admiralty fields on datasets)
3. Temporal queries (JSONB query on Marquez Postgres)
4. correlationId propagation through all delegation paths
5. Writer workproduct tool expansion (write_caption, write_script, etc.)

## Resolved Questions

1. **How do artifacts get from agent to shared storage?**
   Agent calls `publish_artifact` with a local file path. Tool uploads via artifact
   client HTTP POST. No filesystem watching, no sidecars, no replicator.

2. **How does an agent read another agent's output?**
   `read_artifact` with artifact ID (passed via planner delegation prompt) or
   `list_artifacts` for discovery. RBAC enforced at artifact service.

3. **What prevents an agent from bypassing workproduct tools?**
   Tool policy extension blocks native `write`/`edit`. Jidoka checks `requiredTools`
   post-run. Two independent enforcement layers.

4. **What if provenance extension is disabled?**
   Nothing breaks. Artifacts still publish and replicate. Tool policy still enforces.
   Jidoka still validates. Lineage tracking is the only thing lost.

5. **What if artifact service is down?**
   `publish_artifact` returns an error to the agent. Agent can retry or report
   failure. Other extensions continue operating. No silent failures.
