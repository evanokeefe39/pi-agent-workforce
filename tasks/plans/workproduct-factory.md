# Workproduct Factory Refactor

Dissolve workproduct-lib. Extract infrastructure into factory.ts. Shrink per-agent
configs to ~30 lines of domain declaration, zero infrastructure.

## Problem

Four per-agent workproduct extensions (2,651 lines) share identical infrastructure
copy-pasted with minor variations. Each file does three things at different rates of
change:

1. **Domain config** — what kinds exist, their schemas, their validation profiles.
   Changes when product evolves.
2. **Validation** — style-based field checking (validateByStyle). Changes with
   quality standards.
3. **Storage I/O** — writeLocal, readLocal, listLocal, ULID, session helpers.
   Infrastructure. Rarely changes.

Storage I/O is ~40% of each file and functionally identical across all four. The
domain config is what's unique — and it's buried inside 500+ lines of boilerplate.

### Duplicated code

| Symbol | Copies | Lines each |
|--------|--------|------------|
| `LocalRecord` interface | 4 | 7 |
| `writeLocal()` | 4 | 12-20 |
| `readLocal()` | 4 | 8-15 |
| `listLocal()` | 4 | 15-25 |
| `getSessionId()` | 4 | 3 |
| AGENT_NAME gate | 4 | 5 |
| try/catch error wrapper | ~20 tools | 3 each |

### Coupling points (from prior analysis)

1. **FS path convention** — workproduct → artifacts. publish_artifact reads files
   workproduct wrote. Implicit contract on directory layout. (Keep — make explicit.)
2. **get_template reads workproduct-lib/templates/** — artifacts extension hardcodes
   path `/root/.pi/agent/extensions/workproduct-lib/templates`. (Break — templates
   belong in skills.)
3. **ArtifactRef type** — schemas.ts exports a string type alias used by data agent.
   (Inline — it's just `Type.String()`.)
4. **Type normalization** — artifact-service routes.ts maps `dataset_ref→dataset`,
   `query_result→dataset`. Server knows domain vocabulary. (Move — agents should
   normalize at source.)
5. **tags as opaque JSONB** — artifact service stores metadata without understanding
   it. (Good boundary — keep.)

## Target State

```
src/agents/extensions/workproduct/
├── factory.ts          # createWorkproductExtension(pi, config)
│                       #   generates record_*, query_*, get_* tools
│                       #   owns: writeLocal, readLocal, listLocal, ulid,
│                       #         getSessionId, error wrapping, AGENT_NAME gate
├── types.ts            # WorkproductConfig, KindDef, LocalRecord, tool result types
├── validate.ts         # validateByStyle (moved from workproduct-lib, unchanged)
└── ulid.ts             # ulid() (moved from workproduct-lib, unchanged)

src/agents/researcher/.pi/agent/extensions/workproduct.ts   # ~30 lines: config only
src/agents/writer/.pi/agent/extensions/workproduct.ts       # ~30 lines: config only
src/agents/data/.pi/agent/extensions/workproduct.ts         # ~30 lines: config only
src/agents/qa/.pi/agent/extensions/workproduct.ts           # ~30 lines: config only

DELETE: src/agents/extensions/workproduct-lib/              # fully dissolved
```

## Factory Interface

```typescript
// types.ts
interface KindDef {
  // Schema for the record_* tool's parameters (TypeBox)
  schema: TObject;
  // Subdirectory under workproduct/ for local storage
  subdir: string;
  // Filename template: (params) => "report.md" or "metric_${name}.json"
  filename: (params: Record<string, any>) => string;
  // Extract content string from params (what gets stored as record.content)
  content: (params: Record<string, any>) => string;
  // Extract metadata from params (what gets stored as record.metadata)
  metadata: (params: Record<string, any>, sessionId: string) => Record<string, unknown>;
  // Format the success message returned to the LLM
  summary: (id: string, params: Record<string, any>) => string;
  // Optional: domain logic hooks run before storage (e.g. inferCorroboration)
  beforeWrite?: (params: Record<string, any>) => Record<string, any>;
}

interface WorkproductConfig {
  agentName: string;
  kinds: Record<string, KindDef>;
  profiles: StyleProfiles;
  promptSnippet?: string;
  // For query/get tools: how to format a result line
  formatLine?: (rec: LocalRecord) => string;
  // Extra query filters beyond the standard set
  extraFilters?: ExtraFilterDef[];
}

// factory.ts
export function createWorkproductExtension(
  pi: ExtensionAPI,
  config: WorkproductConfig,
): void;
```

## What the Factory Generates Per Kind

For each `kind` in `config.kinds`, factory registers:

- `record_{kind}` — validate → beforeWrite hook → writeLocal → return summary
- `query_{kinds}` (one tool, plural) — listLocal + post-filters → format lines
- `get_{kind}` — readLocal → JSON dump

Special cases handled by config, not by factory branching:
- Researcher's `add_source` — extra tool registered via an `extraTools` array in config
- QA's `record_violation` / `record_commendation` / `list_evaluations` / `export_evaluations_jsonl` — additional kinds with custom query behavior (extraTools or just more kinds)

## Per-Agent Config Shape (Target)

### Researcher (~35 lines)

```typescript
export default (pi: ExtensionAPI) => createWorkproductExtension(pi, {
  agentName: "researcher",
  kinds: {
    finding: {
      schema: Type.Object({ style: FindingStyle, claim: Type.String(), sources: Type.Array(SourceSchema, { minItems: 1 }), ... }),
      subdir: "findings",
      filename: () => "finding.json",
      content: (p) => JSON.stringify(p.claim),
      metadata: (p, sid) => ({ style: p.style, sources: p.sources, claim_preview: p.claim.slice(0, 120), session_id: sid, ... }),
      summary: (id, p) => `Finding recorded: ${id}\nADMIRALTY grade: ${grade}\nSources: ${p.sources.length}`,
      beforeWrite: (p) => ({ ...p, corroboration: inferCorroboration(p.sources, p.corroboration) }),
    },
  },
  profiles: FINDING_PROFILES,
  promptSnippet: INTELLIGENCE_SNIPPET,
  extraTools: [addSourceTool],  // add_source is researcher-specific
});
```

### Writer (~25 lines)

```typescript
export default (pi: ExtensionAPI) => createWorkproductExtension(pi, {
  agentName: "writer",
  kinds: {
    report: { schema: ..., subdir: "content", filename: () => "report.md", ... },
    guide: { schema: ..., subdir: "content", filename: () => "guide.md", ... },
    article: { schema: ..., subdir: "content", filename: () => "article.md", ... },
    marketing_copy: { schema: ..., subdir: "content", filename: () => "marketing_copy.md", ... },
    newsletter: { schema: ..., subdir: "content", filename: () => "newsletter.md", ... },
  },
  profiles: KIND_PROFILES,
});
```

### Data (~25 lines)

```typescript
export default (pi: ExtensionAPI) => createWorkproductExtension(pi, {
  agentName: "data",
  kinds: {
    dataset_ref: { schema: ..., subdir: "datasets", filename: () => "dataset_ref.json", ... },
    query_result: { schema: ..., subdir: "queries", filename: () => "query_result.json", ... },
    metric: { schema: ..., subdir: "metrics", filename: (p) => `metric_${p.name}.json`, ... },
    chart: { schema: ..., subdir: "charts", filename: (p) => p.title ? `chart_${p.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.json` : "chart.json", ... },
  },
  profiles: KIND_PROFILES,
});
```

### QA (~35 lines)

```typescript
export default (pi: ExtensionAPI) => createWorkproductExtension(pi, {
  agentName: "qa",
  kinds: {
    artifact_review: { schema: ..., subdir: "assessments", ... },
    plan_review: { schema: ..., subdir: "assessments", ... },
    stage_gate: { schema: ..., subdir: "assessments", ... },
    violation: { schema: ..., subdir: "evaluations", ... },
    commendation: { schema: ..., subdir: "evaluations", ... },
  },
  profiles: KIND_PROFILES,
  extraTools: [listEvaluationsTool, exportEvaluationsJsonlTool],
});
```

## Execution Plan

### Task 1: Create factory infrastructure

- [x] Create `src/agents/extensions/workproduct/types.ts` — WorkproductConfig, KindDef, LocalRecord, ExtraFilterDef interfaces
- [x] Move `workproduct-lib/ulid.ts` → `workproduct/ulid.ts` (unchanged)
- [x] Move `workproduct-lib/validate.ts` → `workproduct/validate.ts` (unchanged)
- [x] Create `src/agents/extensions/workproduct/factory.ts`:
  - writeRecord, readRecord, listRecords (unified — data agent's approach: ctx-aware cwd, atomic write, recursive walk)
  - AGENT_NAME gate
  - getSessionId, getSessionCwd, getBasedir
  - For each kind: generate record_{kind}, register with pi
  - Generate query tool (one per extension, configurable kinds/filters)
  - Generate get tool (single tool with kind discrimination)
  - Error wrapping around all tool execute methods
  - Handle promptSnippet per kind
  - Handle extraTools registration with WorkproductHandle

### Task 2: Migrate researcher workproduct.ts

- [x] Extract researcher domain config (FindingStyle, SourceSchema, FINDING_PROFILES, inferCorroboration, admiraltyGrade, prompt snippets)
- [x] Rewrite as factory call + domain config (435 lines, down from 540)
- [x] Preserve add_source as extraTool with WorkproductHandle for read/updateMetadata
- [x] ADMIRALTY schemas moved from workproduct-lib/schemas.ts into researcher file (domain, not infrastructure)
- [ ] Verify: record_finding, add_source, query_findings, get_finding all produce identical tool schemas and behavior
- [ ] Run E2E-50 to verify tool registration

### Task 3: Migrate writer workproduct.ts

- [x] Extract writer domain config (ContentKind, KIND_PROFILES, countWords, previewTitle)
- [x] Rewrite as factory call with 5 kinds (305 lines, down from 635)
- [x] Shared baseContentMeta helper for common metadata fields across all 5 kinds
- [ ] Verify: record_report, record_guide, record_article, record_marketing_copy, record_newsletter, query_content, get_content
- [ ] Run E2E-53 to verify

### Task 4: Migrate data workproduct.ts

- [x] Extract data domain config (KIND_PROFILES)
- [x] Inline ArtifactRef as `Type.String({ description: "..." })` — schemas.ts dependency eliminated
- [x] Rewrite as factory call with 4 kinds (268 lines, down from 589)
- [ ] Verify: record_dataset_ref, record_query_result, record_metric, record_chart, query_data_products, get_data_product

### Task 5: Migrate QA workproduct.ts

- [x] Extract QA domain config (KIND_PROFILES, formatAssessmentLine)
- [x] list_evaluations and export_evaluations_jsonl as extraTools with WorkproductHandle
- [x] Rewrite as factory call with 5 kinds + 2 extra tools (502 lines, down from 887)
- [x] query_assessments covers 3 assessment kinds; get_assessment restricted to same 3
- [ ] Verify: all 9 QA tools produce identical schemas and behavior
- [ ] Run E2E-55 to verify

### Task 6: Break coupling points

- [x] Move templates from `workproduct-lib/templates/` → `workproduct/templates/`
- [x] Update get_template in artifacts/index.ts to read from `/root/.pi/agent/extensions/workproduct/templates`
- [ ] Remove type normalization from artifact-service routes.ts — deferred (safety net, low risk)

### Task 7: Delete workproduct-lib

- [x] Delete `src/agents/extensions/workproduct-lib/` entirely
- [x] Verify no remaining imports reference old path (zero hits in *.ts/*.js/*.json/*.yml)
- [x] Update Dockerfile COPY path: `extensions/workproduct/` replaces `extensions/workproduct-lib/`
- [x] Update docs/agents.md, docs/architecture.md, templates/README.md

### Task 8: Verify

- [ ] All E2E tests pass (50, 51, 53, 55 at minimum)
- [ ] Docker build succeeds for all 7 agents
- [ ] Researcher record_finding produces same JSON shape as before
- [ ] Writer record_report produces same JSON shape as before
- [ ] Data record_dataset_ref produces same JSON shape as before
- [ ] QA record_artifact_review produces same JSON shape as before
- [ ] get_template still works from new path

## Design Decisions

**One query tool vs per-kind query tools.** Currently researcher has `query_findings`,
writer has `query_content`, data has `query_data_products`, QA has `query_assessments`
+ `list_evaluations`. Factory generates one `query_{agentKinds}` tool that accepts a
`kind` filter param. Keeps the tool count down.

**add_source stays researcher-specific.** It mutates an existing record (appends a
source, recalculates corroboration). This is domain logic, not infrastructure. Goes
in the researcher config as an extraTool, not in the factory.

**QA evaluations stay as extra tools.** `list_evaluations` and
`export_evaluations_jsonl` have custom formatting and cross-kind querying. They're
QA-specific query tools that go in extraTools.

**Schema objects stay in per-agent configs.** The TypeBox schema definitions are the
domain — they define what fields each workproduct kind has. Moving them into the
factory would make the factory domain-aware, which defeats the purpose. Each per-agent
file declares its schemas inline.

**beforeWrite hook for domain logic.** Researcher's `inferCorroboration` and
`admiraltyGrade` run before writeLocal. Factory calls `beforeWrite(params)` if
defined, uses return value as the final params. Domain logic stays in domain config.

## Line Count Estimate

| File | Before | After |
|------|--------|-------|
| factory.ts | — | ~150 |
| types.ts | — | ~40 |
| validate.ts | 48 | 48 (moved) |
| ulid.ts | 27 | 27 (moved) |
| researcher/workproduct.ts | 540 | ~80 (schemas + config) |
| writer/workproduct.ts | 635 | ~70 (schemas + config) |
| data/workproduct.ts | 589 | ~65 (schemas + config) |
| qa/workproduct.ts | 887 | ~90 (schemas + config) |
| **Total** | **2,796** | **~570** |

Net reduction: ~2,200 lines. Per-agent configs drop from 500-900 lines to 65-90 lines
(schemas are the bulk — the config wrapper is ~30 lines, but TypeBox schema
declarations take space).

## Risks

- **Tool schema regression.** If factory generates tool parameters differently from
  the hand-written versions, LLM tool calling behavior may change. Mitigate: snapshot
  current tool schemas (JSON) before refactor, diff against factory output.
- **Researcher add_source coupling.** add_source calls readLocal + updateLocalMetadata
  directly. Factory must expose these as helpers or add_source must use factory
  internals. Cleanest: factory returns a handle with `read(id)` and `update(id, meta)`
  methods for extraTools to use.
- **QA export_evaluations_jsonl.** Reads raw records and reformats. Needs access to
  listLocal. Same solution: factory handle exposes storage primitives.

## Not In Scope

- Changing what tools agents have (no adding/removing tools)
- Changing tool parameter schemas (exact same fields)
- Changing storage format (same JSON envelope)
- Changing validation behavior
- Refactoring artifacts extension (separate concern)
