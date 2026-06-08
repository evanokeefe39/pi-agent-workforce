# Artifact Lineage Graph

## Intent

Debug tool to visualize how findings and report sections trace back to original data sources. Shows the full chain: goal → planner delegation → researcher findings (with source URLs) → writer sections (citing findings). Must derive all relations at read time from existing artifact data, not depend on write-time annotations.

## Design

Read-time graph derivation from existing fields:
- `run_id` + `correlation_id` → links researcher/writer runs to planner session
- `agent_name` + `artifact_type` → classifies nodes (dataset, research, report, brief)
- Finding `sources[]` → links claims to URLs
- Report sections → can be matched to findings by claim text or source URLs

### Graph structure

```
[Planner Run]
  ├── delegates → [Researcher Run A]
  │     ├── finding: "claim text..." ← source: url1 (B2), url2 (C3)
  │     ├── finding: "claim text..." ← source: url3 (A1)
  │     └── artifact: findings.jsonl
  ├── delegates → [Researcher Run B]
  │     └── ...
  └── delegates → [Writer Run]
        ├── section: "## Introduction" → cites findings [1, 3, 5]
        ├── section: "## Strategy" → cites findings [2, 4, 6, 7]
        └── artifact: final_report.md
```

### Implementation options

1. **CLI tool** — `node tests/e2e/artifact-lineage.mjs <planner-run-id>` → prints ASCII graph
2. **HTML report** — generate static HTML with collapsible tree + source links
3. **Artifact service endpoint** — `GET /lineage/:runId` returns graph JSON

Start with option 1. Upgrade to 2 or 3 if useful.

## Status

- [ ] Design approved
- [ ] CLI tool implemented
- [ ] Tested with E2E-30 output
