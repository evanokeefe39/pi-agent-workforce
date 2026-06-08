# Writer Fanout/Fan-in Pipeline

## Problem

Current writer AGENTS.md is 193 lines with a 4-stage pipeline (PLAN → EXPAND → STITCH → POLISH),
manifest tracking, style resolution ceremony, copy formulas, platform formats, and style cloning.
Overwhelms Qwen3 32B — prior runs: 74 turns, timeouts, partial output.

## Solution

Replace with a 3-phase fanout/fan-in pipeline using pi-subagents (nicobailon variant).
One custom agent definition handles parallel work. Writer agent orchestrates.

### Architecture

```
Phase 1: PLAN (writer agent, ~5 turns)
  ├─ read_artifact for each source URI
  ├─ get_style_instructions → style_block (one call, saved for reuse)
  ├─ Create skeleton: [{heading, objectives, finding_ids, word_target}]
  ├─ Extract per-section findings → write briefs/NN-slug.json
  ├─ Write manifest.json with expected_files array
  └─ TaskCreate per phase for progress tracking

Phase 2: WRITE+FIX (parallel fanout)
  └─ subagent({ tasks: [N section-writers], concurrency: 4 })
      Each section-writer:
        - context: "fresh" (no parent history)
        - reads briefs/NN-slug.json (its brief + findings subset)
        - writes first draft following style_block
        - self-reviews against style checklist
        - fixes violations before saving
        - writes final sections/NN-slug.md
        - tools: read, write, bash

Phase 3: ASSEMBLE (writer agent, ~2 turns)
  ├─ Completeness check: ls sections/ vs manifest.json expected_files
  ├─ cat sections/*.md > final.md (bash)
  ├─ Read final.md, add executive summary (2-3 sentences at top)
  └─ write_artifact → publish final document
```

### Context efficiency

Each section-writer gets ONLY:
- Its section brief (heading, objectives, word target) — ~100 words
- Its findings subset (pre-extracted by PLAN) — varies, only relevant items
- The style_block (~300 words from get_style_instructions)
- ADMIRALTY handling rules (3 lines)

NOT: full findings dump, other sections, skeleton, manifest, pipeline instructions.
Total per-subagent context: ~500-1000 words vs full agent context of 5000+.

### Dependency ordering

Enforced by the pipeline structure:
1. PLAN completes → briefs written to disk
2. `subagent({ tasks: [writers...] })` — blocks until ALL complete
3. ASSEMBLE reads finished sections

Each section-writer owns its section end-to-end: write + self-review + fix.
No coordination needed between sections during Phase 2.

### Completeness check

manifest.json written in Phase 1:
```json
{
  "expected_files": ["sections/01-introduction.md", "sections/02-analysis.md", ...],
  "doc_style": "report",
  "total_sections": 6
}
```

Phase 3 checks: ls sections/ vs expected_files. If missing,
writer reports which sections failed and retries those specific section-writers.

### Custom agent definition

One agent defined at `src/agents/writer/.pi/agents/`:

**section-writer.md** — writes + polishes one section from a brief file
  - model: cerebras/qwen-3-32b
  - tools: read, write, bash
  - thinking: medium
  - max_turns: 12
  - context: fresh
  - System prompt: read brief, write draft, self-review checklist, fix, save

### What gets cut from AGENTS.md

- Manifest resume tracking (retry whole invocation on failure)
- Style resolution ceremony (one get_style_instructions call)
- Copy formulas section (→ reference/formats.md)
- Platform formats section (→ reference/formats.md)
- Style cloning pipeline (→ reference/formats.md)
- Workproduct types section (tools are self-documenting)
- Separate VALIDATE and FIX phases (merged into section-writer)
- section-fixer agent (merged into section-writer)

### What stays

- ADMIRALTY grade handling (3 rules)
- AI tell avoidance (compact, baked into section-writer self-review)
- doc_style interpretation (section count + word targets)
- Constraints

### Files

- [x] tasks/plans/writer-fanout-pipeline.md (this file)
- [x] src/agents/writer/.pi/agents/section-writer.md (write + self-review + fix)
- [x] src/agents/writer/.pi/agent/AGENTS.md (rewrite — 3 phases)
- [x] src/agents/writer/.pi/agent/reference/formats.md (archive)
- [x] src/agents/writer/.pi/agents/section-fixer.md (deleted — merged into section-writer)
