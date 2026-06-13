#!/usr/bin/env bash
# E2E-21: Research depth calibration
# Validates: shallow vs deep research produces proportionally different output
# Measures: findings count, artifact count/size, turns, duration
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/jsonl-helpers.sh"
TEST_ID="e2e-21"
REPORT="$RESULTS_DIR/e2e-21-$(date +%Y%m%d-%H%M%S).md"

echo "=== E2E-21: Research Depth Calibration ==="
require_agents

# --- Phase 1: Shallow ---
echo ""; echo "--- Phase 1: Shallow Research ---"
SNAP_BEFORE_SHALLOW=$(artifact_snapshot)
SHALLOW_START=$SECONDS

SHALLOW_EVENTS=$(pi_run 'Use subagent to delegate to the researcher agent:

Quick scan: find 3 faceless Instagram accounts in the fitness niche. For each, note the account name and approximate follower count. Use web_search only (no scraping). Record each account as a finding via record_finding with style intelligence. Publish findings via publish_artifact with type research.

This is a SHALLOW scan — speed over depth. 3 accounts, basic metrics only.' 180 shallow)

SHALLOW_DURATION=$((SECONDS - SHALLOW_START))
SHALLOW_TURNS=$(jsonl_turns "$SHALLOW_EVENTS")
SHALLOW_SUBAGENT=$(jsonl_tool_count "$SHALLOW_EVENTS" "subagent")
SHALLOW_NEW_ARTIFACTS=$(artifacts_since "$SNAP_BEFORE_SHALLOW")
SHALLOW_TOTAL_BYTES=$(artifact_list "limit=200" | jq '[.[] | .size_bytes] | add // 0')

echo "  Duration: ${SHALLOW_DURATION}s | Turns: $SHALLOW_TURNS | Artifacts: $SHALLOW_NEW_ARTIFACTS | Bytes: $SHALLOW_TOTAL_BYTES"

# --- Phase 2: Deep ---
echo ""; echo "--- Phase 2: Deep Research ---"
SNAP_BEFORE_DEEP=$(artifact_snapshot)
DEEP_START=$SECONDS

DEEP_EVENTS=$(pi_run 'Use subagent to delegate to the researcher agent:

Deep research: Analyze 5 faceless Instagram accounts in the fitness niche. For EACH account:
1. Use scrape_apify with an Instagram profile scraper for verified metrics (followers, posts, engagement)
2. Use web_search to find articles about each account growth strategy
3. Create separate findings via record_finding (style: intelligence) for: follower count (A1), engagement rate, content format, posting frequency, monetization method
4. Minimum 3-5 findings PER account (15-25 total)
5. Cross-reference metrics from Apify (A1) with web sources (C3)
6. Publish all findings as JSONL via publish_artifact type dataset
7. Publish markdown analysis via publish_artifact type research

DEEP analysis — thoroughness over speed. Do not stop until 15+ structured findings.' 600 deep)

DEEP_DURATION=$((SECONDS - DEEP_START))
DEEP_TURNS=$(jsonl_turns "$DEEP_EVENTS")
DEEP_SUBAGENT=$(jsonl_tool_count "$DEEP_EVENTS" "subagent")
DEEP_NEW_ARTIFACTS=$(artifacts_since "$SNAP_BEFORE_DEEP")
DEEP_FINDINGS=$(artifact_findings_count "artifact_type=dataset")
DEEP_TOTAL_BYTES=$(artifact_list "limit=200" | jq '[.[] | .size_bytes] | add // 0')

echo "  Duration: ${DEEP_DURATION}s | Turns: $DEEP_TURNS | Artifacts: $DEEP_NEW_ARTIFACTS | Findings: $DEEP_FINDINGS | Bytes: $DEEP_TOTAL_BYTES"

# --- Assertions ---
echo ""; echo "--- Assertions ---"
assert_gt "deep takes longer than shallow" "$DEEP_DURATION" "$SHALLOW_DURATION"
assert_gt "deep produces more artifacts" "$DEEP_NEW_ARTIFACTS" "$SHALLOW_NEW_ARTIFACTS"
assert_le "shallow completes in < 3 minutes" "$SHALLOW_DURATION" 180
assert_ge "deep produces >= 5 findings" "$DEEP_FINDINGS" 5
assert_le "shallow uses <= 5 turns (blocking)" "$SHALLOW_TURNS" 5
assert_le "deep uses <= 10 turns (blocking)" "$DEEP_TURNS" 10
assert_eq "shallow: no status polling" "$(jsonl_status_polls "$SHALLOW_EVENTS")" 0
assert_eq "deep: no status polling" "$(jsonl_status_polls "$DEEP_EVENTS")" 0

RATIO=$(echo "scale=1; $DEEP_DURATION / ($SHALLOW_DURATION + 1)" | bc 2>/dev/null || echo "?")

summary

write_report "$REPORT" "# E2E-21: Research Depth Calibration

**Date:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Result:** $_PASS/$_TESTS passed, $_FAIL failed

## Comparison

| Metric | Shallow | Deep | Ratio |
|--------|---------|------|-------|
| Duration | ${SHALLOW_DURATION}s | ${DEEP_DURATION}s | ${RATIO}x |
| Turns | $SHALLOW_TURNS | $DEEP_TURNS | — |
| Subagent calls | $SHALLOW_SUBAGENT | $DEEP_SUBAGENT | — |
| New artifacts | $SHALLOW_NEW_ARTIFACTS | $DEEP_NEW_ARTIFACTS | — |
| Structured findings | — | $DEEP_FINDINGS | — |
| Total bytes | $SHALLOW_TOTAL_BYTES | $DEEP_TOTAL_BYTES | — |

## Tool Breakdown
- Shallow: \`$(jsonl_tool_breakdown "$SHALLOW_EVENTS")\`
- Deep: \`$(jsonl_tool_breakdown "$DEEP_EVENTS")\`"
