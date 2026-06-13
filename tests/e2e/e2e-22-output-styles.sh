#!/usr/bin/env bash
# E2E-22: Output style control
# Validates: IG carousel vs exec brief vs research report produce different output shapes
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/jsonl-helpers.sh"
TEST_ID="e2e-22"
REPORT="$RESULTS_DIR/e2e-22-$(date +%Y%m%d-%H%M%S).md"

echo "=== E2E-22: Output Style Control ==="
require_agents

SNAP_BEFORE=$(artifact_snapshot)

# --- Style 1: IG Carousel ---
echo ""; echo "--- Style 1: Instagram Carousel Copy ---"
IG_EVENTS=$(pi_run 'Use subagent to delegate to the writer agent:

Write Instagram carousel copy (10 slides) about the top 5 productivity hacks for remote workers.

Format: Slide 1 = hook (bold claim, max 15 words). Slides 2-9 = one hack per slide, headline (max 8 words) + body (max 30 words). Slide 10 = CTA (follow + save). Separate caption block with 2-3 sentences + 15-20 hashtags.

Publish via publish_artifact with type brief and filename ig-carousel-productivity.md.

This is social media copy, NOT a report. Short. Punchy. Visual-first.' 300 ig)

IG_TURNS=$(jsonl_turns "$IG_EVENTS")

# --- Style 2: Executive Brief ---
echo ""; echo "--- Style 2: Executive Brief ---"
BRIEF_EVENTS=$(pi_run 'First delegate to the researcher agent:
Quick research: find 3 key trends in remote work for 2026. Use web_search. Record each via record_finding with style intelligence. Publish summary via publish_artifact type research.

Then delegate to the writer agent:
Write an executive brief (500-800 words) on remote work trends for 2026. Read the researcher output. Structure: 1-sentence executive summary, 3 trend sections (150-200 words each), 3-bullet action items. Publish via publish_artifact type report filename remote-work-brief.md. doc_style: briefing' 300 brief)

BRIEF_TURNS=$(jsonl_turns "$BRIEF_EVENTS")

# --- Style 3: Research Report ---
echo ""; echo "--- Style 3: Research Report ---"
REPORT_EVENTS=$(pi_run 'First delegate to the researcher agent:
Deep research on AI agent orchestration frameworks in 2026. Compare at least 4 frameworks. For each, use record_finding (style: intelligence) for: name, architecture type, transport mechanism, language support, maturity. At least 15 findings. Publish JSONL via publish_artifact type dataset. Publish summary via publish_artifact type research.

Then delegate to the writer agent:
Write comprehensive research report (3000-5000 words) comparing AI agent orchestration frameworks. Read researcher output. Include: abstract, methodology, per-framework analysis, comparison table, recommendations. Publish via publish_artifact type report filename ai-orchestration-report.md. doc_style: report' 600 report)

REPORT_TURNS=$(jsonl_turns "$REPORT_EVENTS")
REPORT_FINDINGS=$(artifact_findings_count "artifact_type=dataset")

# --- Analyze artifacts ---
echo ""; echo "--- Artifact Analysis ---"
NEW_COUNT=$(artifacts_since "$SNAP_BEFORE")
ALL=$(artifact_list "limit=$((NEW_COUNT + 10))")

IG_SIZE=$(echo "$ALL" | jq '[.[] | select(.filename | test("ig-carousel"))] | .[0].size_bytes // 0')
BRIEF_SIZE=$(echo "$ALL" | jq '[.[] | select(.filename | test("remote-work-brief"))] | .[0].size_bytes // 0')
REPORT_SIZE=$(echo "$ALL" | jq '[.[] | select(.filename | test("ai-orchestration-report"))] | .[0].size_bytes // 0')

IG_EXISTS=$(echo "$ALL" | jq '[.[] | select(.filename | test("ig-carousel"))] | length')
BRIEF_EXISTS=$(echo "$ALL" | jq '[.[] | select(.filename | test("remote-work-brief"))] | length')
REPORT_EXISTS=$(echo "$ALL" | jq '[.[] | select(.filename | test("ai-orchestration-report"))] | length')

echo "  IG carousel: ${IG_SIZE}B (exists=$IG_EXISTS)"
echo "  Exec brief: ${BRIEF_SIZE}B (exists=$BRIEF_EXISTS)"
echo "  Research report: ${REPORT_SIZE}B (exists=$REPORT_EXISTS)"
echo "  Findings datasets: $REPORT_FINDINGS"
echo "  Total new artifacts: $NEW_COUNT"

# --- Assertions ---
echo ""; echo "--- Assertions ---"
assert_ge "IG carousel artifact created" "$IG_EXISTS" 1
assert_ge "exec brief artifact created" "$BRIEF_EXISTS" 1
assert_ge "research report artifact created" "$REPORT_EXISTS" 1
assert_gt "IG shorter than brief" "$BRIEF_SIZE" "$IG_SIZE"
assert_gt "report longer than brief" "$REPORT_SIZE" "$BRIEF_SIZE"
assert_ge "at least 1 findings dataset" "$REPORT_FINDINGS" 1
assert_ge "at least 4 new artifacts total" "$NEW_COUNT" 4
assert_eq "IG: no status polling" "$(jsonl_status_polls "$IG_EVENTS")" 0
assert_eq "brief: no status polling" "$(jsonl_status_polls "$BRIEF_EVENTS")" 0
assert_eq "report: no status polling" "$(jsonl_status_polls "$REPORT_EVENTS")" 0

summary

write_report "$REPORT" "# E2E-22: Output Style Control

**Date:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Result:** $_PASS/$_TESTS passed, $_FAIL failed

## Output Comparison

| Style | Artifact | Size | Turns | Exists |
|-------|----------|------|-------|--------|
| IG Carousel | ig-carousel-productivity.md | ${IG_SIZE}B | $IG_TURNS | $IG_EXISTS |
| Exec Brief | remote-work-brief.md | ${BRIEF_SIZE}B | $BRIEF_TURNS | $BRIEF_EXISTS |
| Research Report | ai-orchestration-report.md | ${REPORT_SIZE}B | $REPORT_TURNS | $REPORT_EXISTS |

## Research Quality
- Findings datasets: $REPORT_FINDINGS
- Total new artifacts: $NEW_COUNT

## Tool Breakdown
- IG: \`$(jsonl_tool_breakdown "$IG_EVENTS")\`
- Brief: \`$(jsonl_tool_breakdown "$BRIEF_EVENTS")\`
- Report: \`$(jsonl_tool_breakdown "$REPORT_EVENTS")\`"
