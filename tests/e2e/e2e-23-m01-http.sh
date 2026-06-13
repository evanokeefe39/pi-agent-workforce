#!/usr/bin/env bash
# E2E-23: M0.1 Milestone via pi-subagents-http
# Full orchestration: parallel researcher → writer pipeline via HTTP
# Replaces e2e-19 (Paperclip CEO delegation chain)
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/jsonl-helpers.sh"
TEST_ID="e2e-23"
REPORT="$RESULTS_DIR/e2e-23-$(date +%Y%m%d-%H%M%S).md"

echo "=== E2E-23: M0.1 Milestone (pi-subagents-http) ==="
require_agents

SNAP_BEFORE=$(artifact_snapshot)
START_TIME=$SECONDS

# --- Run M0.1 ---
echo ""; echo "--- Running M0.1 Brief ---"
EVENTS=$(pi_run 'You have remote agents available via the subagent tool. Use subagent({ action: "list" }) to discover them.

Task: Faceless social media channel analysis.

Step 1 — Parallel research (delegate BOTH to researcher using tasks parameter):
Task A: "Research 5 faceless Instagram accounts across niches (fitness, finance, motivation, cooking, tech). For EACH account: use scrape_apify for verified metrics, use web_search for growth strategy. Create findings via record_finding (style: intelligence) for: follower count, engagement rate, content format, posting frequency, monetization. Minimum 15 findings total. Publish JSONL via publish_artifact type dataset. Publish markdown summary via publish_artifact type research."

Task B: "Research 5 faceless TikTok accounts across niches (fitness, finance, motivation, cooking, tech). Same methodology. Minimum 15 findings. Publish via publish_artifact."

Step 2 — Report (delegate to writer):
"Write cross-platform comparison report. Read researcher artifacts. Include: per-account cards with metrics, comparison table, top 5 actionable insights, ADMIRALTY quality assessment. Publish via publish_artifact type report filename m01-faceless-channel-report.md. doc_style: report"

Execute step 1 (parallel), wait for results, then step 2.' 900 m01)

TOTAL_DURATION=$((SECONDS - START_TIME))

# --- Analyze ---
echo ""; echo "--- Analyzing Results ---"

TURNS=$(jsonl_turns "$EVENTS")
SUBAGENT_CALLS=$(jsonl_tool_count "$EVENTS" "subagent")
STATUS_POLLS=$(jsonl_status_polls "$EVENTS")
NEW_ARTIFACTS=$(artifacts_since "$SNAP_BEFORE")
TOOLS=$(jsonl_tool_breakdown "$EVENTS")

ALL=$(artifact_list "limit=$((NEW_ARTIFACTS + 10))")
RESEARCH_COUNT=$(echo "$ALL" | jq '[.[] | select(.artifact_type == "research")] | length')
DATASET_COUNT=$(echo "$ALL" | jq '[.[] | select(.artifact_type == "dataset")] | length')
REPORT_COUNT=$(echo "$ALL" | jq '[.[] | select(.artifact_type == "report")] | length')
RESEARCHER_COUNT=$(echo "$ALL" | jq '[.[] | select(.agent_name == "researcher")] | length')
WRITER_COUNT=$(echo "$ALL" | jq '[.[] | select(.agent_name == "writer")] | length')
HAS_FINAL=$(echo "$ALL" | jq '[.[] | select(.filename | test("m01-faceless"))] | length')
UNIQUE_RUNS=$(echo "$ALL" | jq '[.[].run_id | select(. != null)] | unique | length')
TOTAL_FINDINGS=$(artifact_findings_count "artifact_type=dataset")

# Agent completions
R_COMPLETED=$(curl -sf "$RESEARCHER_URL/metrics" 2>/dev/null | jq -r '.runs_completed // 0')
W_COMPLETED=$(curl -sf "$WRITER_URL/metrics" 2>/dev/null | jq -r '.runs_completed // 0')

echo "  Duration: ${TOTAL_DURATION}s"
echo "  Turns: $TURNS (subagent=$SUBAGENT_CALLS, polls=$STATUS_POLLS)"
echo "  Artifacts: $NEW_ARTIFACTS (research=$RESEARCH_COUNT, dataset=$DATASET_COUNT, report=$REPORT_COUNT)"
echo "  By agent: researcher=$RESEARCHER_COUNT, writer=$WRITER_COUNT"
echo "  Findings: $TOTAL_FINDINGS"
echo "  Unique runs: $UNIQUE_RUNS"
echo "  Tools: $TOOLS"

# --- Assertions ---
echo ""; echo "--- Assertions ---"

# Orchestration
assert_le "< 15 minutes" "$TOTAL_DURATION" 900
assert_le "< 40 turns (blocking + local work)" "$TURNS" 40
assert_le "< 6 subagent calls" "$SUBAGENT_CALLS" 6
assert_eq "zero status polls" "$STATUS_POLLS" 0

# Research quality
assert_ge ">= 2 research artifacts" "$RESEARCH_COUNT" 2
assert_ge ">= 1 dataset (JSONL findings)" "$DATASET_COUNT" 1
assert_ge ">= 10 structured findings" "$TOTAL_FINDINGS" 10

# Writer output
assert_ge "final report exists" "$HAS_FINAL" 1
assert_ge ">= 1 report artifact" "$REPORT_COUNT" 1
assert_ge "writer produced output" "$WRITER_COUNT" 1

# Namespacing
assert_ge "artifacts have run IDs" "$UNIQUE_RUNS" 1
assert_true "no default/default paths" \
  test -z "$(echo "$ALL" | jq -r '.[].s3_key' | grep 'default/default' || true)"

# Participation
assert_ge "researcher completed >= 1" "$R_COMPLETED" 1

summary

write_report "$REPORT" "# E2E-23: M0.1 Milestone (pi-subagents-http)

**Date:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Result:** $_PASS/$_TESTS passed, $_FAIL failed
**Duration:** ${TOTAL_DURATION}s

## Orchestration
| Metric | Value | Target |
|--------|-------|--------|
| Wall clock | ${TOTAL_DURATION}s | < 900s |
| Turns | $TURNS | < 10 |
| Subagent calls | $SUBAGENT_CALLS | < 6 |
| Status polls | $STATUS_POLLS | 0 |

## Research Output
| Metric | Value | Target |
|--------|-------|--------|
| Research artifacts | $RESEARCH_COUNT | >= 2 |
| Dataset artifacts | $DATASET_COUNT | >= 1 |
| Report artifacts | $REPORT_COUNT | >= 1 |
| Structured findings | $TOTAL_FINDINGS | >= 10 |
| Total new artifacts | $NEW_ARTIFACTS | >= 4 |

## Agent Participation
| Agent | Artifacts | Completions |
|-------|-----------|-------------|
| Researcher | $RESEARCHER_COUNT | $R_COMPLETED |
| Writer | $WRITER_COUNT | $W_COMPLETED |

## Tool Breakdown
\`\`\`json
$TOOLS
\`\`\`

## M0.1 Criteria
- [$([ "$SUBAGENT_CALLS" -lt 6 ] && echo x || echo " ")] Orchestrator delegates all work
- [$([ "$TOTAL_FINDINGS" -ge 10 ] && echo x || echo " ")] Researcher writes structured findings (ADMIRALTY)
- [$([ "$HAS_FINAL" -ge 1 ] && echo x || echo " ")] Writer synthesizes final report
- [$([ "$REPORT_COUNT" -ge 1 ] && echo x || echo " ")] Report delivered as artifact
- [$([ "$UNIQUE_RUNS" -ge 1 ] && echo x || echo " ")] Artifacts namespaced (workspace/run/agent/type)
- [$([ "$STATUS_POLLS" -eq 0 ] && echo x || echo " ")] No polling (blocking delegation)"
