# Context Compaction Extension

## Intent

Prevent context window saturation that causes agents to skip `publish_artifact`. When DeepSeek V4 Flash performs 10-14 turns of research, each web_fetch/web_search injects thousands of chars into conversation history. By turn 12, system prompt instructions drift out of effective attention. The agent concludes without the final publish step.

This extension intercepts tool results before they enter LLM context, replaces large results with a compact summary plus a disk reference, keeping the working context small enough that system prompt instructions remain salient throughout the session.

## Context Package

### Relevant existing code
- `src/agents/extensions/provenance/index.ts` — reference pattern for tool_result handler
- `src/agents/server.ts` lines 222-227 — creates `${sessionDir}/scratch/` per session, sets `PI_SESSION_DIR` env var at line 267
- Pi SDK `types.d.ts` line 749 — `ToolResultEventResult { content?, details?, isError? }` returned by handlers to replace results

### Architectural constraints
- Pi SDK fires tool_result events after execution, before LLM context insertion
- Handlers return `ToolResultEventResult` to replace content — designed extension point
- Extension load order is alphabetical by directory name under `~/.pi/agent/extensions/`
- `context-compaction` sorts after `provenance` — provenance sees original content first

### Prior decisions
- Provenance extension uses lazy-init pattern (this session) — context-compaction can use simpler pattern since it doesn't need session context file
- publish_artifact replaced replicator (v2 spec) — made publishing model-dependent, this extension compensates

## Behavioral Contracts

### B1 — Config-driven matching
GIVEN a config.json with rules array
WHEN a tool_result event fires
THEN rules are evaluated in order, first regex match on toolName wins

### B2 — Threshold gate
GIVEN a matching rule with thresholdChars
WHEN total TextContent chars in event.content exceeds thresholdChars
THEN result is compacted (full saved to disk, summary returned)
WHEN total chars is at or below threshold
THEN result passes through unmodified

### B3 — Skip list bypass
GIVEN event.toolName matches the hardcoded skip list (record_*, publish_artifact, read_artifact, list_artifacts, get_template, add_source, query_findings, get_finding, subagent)
OR event.isError is true
THEN result passes through unmodified regardless of size or config match

### B4 — Full content preservation
GIVEN a result eligible for compaction
WHEN compaction runs
THEN full original content is written to `${PI_SESSION_DIR}/scratch/tool-results/${toolCallId}.md` with toolName, input, and content sections

### B5 — Summary format
GIVEN a compacted result
THEN the replacement content is a single TextContent with:
- Header: `[Compacted — {origChars} chars → {summaryChars} chars | Full: scratch/tool-results/{id}.md]`
- Body: first N chars of original (line-boundary aligned, up to rule's summaryChars)
- Footer: `[...truncated — read scratch/tool-results/{id}.md for full content]`

### B6 — Details passthrough
GIVEN a compacted result
THEN original event.details is preserved with `_compaction` metadata added

### B7 — Image passthrough
GIVEN event.content contains ImageContent items
THEN images are preserved alongside the compacted text summary

## Config Format

`src/agents/extensions/context-compaction/config.json`:

```json
{
  "rules": [
    {
      "match": ".*",
      "thresholdChars": 2000,
      "summaryChars": 800
    }
  ]
}
```

Rules are ordered, first regex match wins. Future refinement:
```json
{
  "rules": [
    { "match": "web_fetch|scrape_.*", "thresholdChars": 1500, "summaryChars": 600 },
    { "match": "bash|read", "thresholdChars": 4000, "summaryChars": 1200 },
    { "match": ".*", "thresholdChars": 8000, "summaryChars": 1500 }
  ]
}
```

Initial deployment uses single wildcard rule. Tuning from observing real sessions.

## Edge Case Inventory

- Empty content / image-only content: skip, no crash, no file write
- PI_SESSION_DIR not set: fall back to process.cwd() + /scratch/tool-results/
- File write failure: log error, return undefined (original preserved). Compaction failure never loses data.
- Content just above threshold: still compact (establishes pattern for model)
- Multiple TextContent items: concatenate for summary, single item in replacement
- Unicode / binary content: writeFileSync utf-8, no transformation

## Definition of Done

- [ ] `src/agents/extensions/context-compaction/index.ts` exists (~80 lines)
- [ ] `src/agents/extensions/context-compaction/config.json` exists with wildcard rule
- [ ] Dockerfile `base` and `planner` targets include COPY line
- [ ] Results from matched tools above threshold are compacted
- [ ] Results from skip-listed tools, below threshold, and errors pass through unmodified
- [ ] Manual test: invoke researcher, observe compaction in logs, publish_artifact called
- [ ] No changes to server.ts, no changes to existing extensions, no SDK modifications

## Negative Space

- NOT semantic summarization — head-truncation only. No LLM call inside the handler.
- NOT modifying system prompt — existing promptSnippet on publish_artifact is sufficient when context stays manageable
- NOT compacting subagent results — already formatted summaries from subagent extension
- NOT implementing progressive summarization — full content always available via scratch file
- NOT interacting with session-level compaction — orthogonal mechanisms
