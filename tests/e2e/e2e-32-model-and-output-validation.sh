#!/usr/bin/env bash
# E2E-32: Model selection + structured output + concurrency validation
# Tests the three resolved issues in sequence:
#   Test A: Qwen3 32B is actually used (no silent fallback to deepseek-chat)
#   Test B: Concurrent requests produce distinct artifacts
#   Test C: Researcher produces JSONL under abstract brief (not explicit tool names)
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/jsonl-helpers.sh"
TEST_ID="e2e-32"
REPORT="$RESULTS_DIR/e2e-32-$(date +%Y%m%d-%H%M%S).md"

echo "=== E2E-32: Model + Output + Concurrency Validation ==="
require_agents

# ============================================================
# TEST A: Model selection — Qwen3 32B is used, not deepseek-chat
# ============================================================
echo ""; echo "--- Test A: Model Selection ---"

RUN_A=$(curl -sf -X POST "$RESEARCHER_URL/invoke" \
  -H "Content-Type: application/json" \
  -d '{"task":"List 2 popular AI tools and their pricing. Record each as a finding and publish as JSONL."}' \
  | jq -r '.runId')

if [ -z "$RUN_A" ] || [ "$RUN_A" = "null" ]; then
  fail "Test A: invoke failed"
else
  # Wait for completion
  local_elapsed=0
  while [ "$local_elapsed" -lt 300 ]; do
    sleep 5; local_elapsed=$((local_elapsed + 5))
    state=$(curl -sf "$RESEARCHER_URL/status/$RUN_A" | jq -r '.state // "unknown"')
    if [ "$state" != "running" ] && [ "$state" != "queued" ]; then break; fi
  done

  RESULT_A=$(curl -sf "$RESEARCHER_URL/result/$RUN_A")
  MODEL_A=$(echo "$RESULT_A" | jq -r '.usage.provider // "unknown"')
  MODEL_NAME_A=$(echo "$RESULT_A" | jq -r '.usage.model // "unknown"')
  STATE_A=$(echo "$RESULT_A" | jq -r '.state // "unknown"')

  echo "  Model: $MODEL_A / $MODEL_NAME_A"
  echo "  State: $STATE_A"

  assert_eq "completed" "$STATE_A" "completed"

  # Should NOT be deepseek-chat or minimax
  if [ "$MODEL_NAME_A" = "deepseek-chat" ] || echo "$MODEL_NAME_A" | grep -qi "minimax"; then
    fail "Test A: wrong model used ($MODEL_NAME_A) — expected qwen3 or llama"
  else
    pass "Test A: correct model ($MODEL_A/$MODEL_NAME_A)"
  fi
fi

# ============================================================
# TEST B: Concurrency — 3 parallel requests, distinct session IDs
# ============================================================
echo ""; echo "--- Test B: Concurrency ---"

SNAP_B=$(artifact_snapshot)

RUN_B1=$(curl -sf -X POST "$RESEARCHER_URL/invoke" -H "Content-Type: application/json" \
  -d '{"task":"Find 1 popular Python library for web scraping. Record as finding, publish as JSONL."}' | jq -r '.runId')
RUN_B2=$(curl -sf -X POST "$RESEARCHER_URL/invoke" -H "Content-Type: application/json" \
  -d '{"task":"Find 1 popular JavaScript framework for frontend. Record as finding, publish as JSONL."}' | jq -r '.runId')
RUN_B3=$(curl -sf -X POST "$RESEARCHER_URL/invoke" -H "Content-Type: application/json" \
  -d '{"task":"Find 1 popular database for analytics. Record as finding, publish as JSONL."}' | jq -r '.runId')

echo "  Dispatched: $RUN_B1 $RUN_B2 $RUN_B3"

# Check runs_active immediately
sleep 2
ACTIVE=$(curl -sf "$RESEARCHER_URL/health" | jq '.runs_active')
echo "  runs_active after dispatch: $ACTIVE"
assert_ge "multiple runs active" "$ACTIVE" 2

# Wait for all to complete
for rid in $RUN_B1 $RUN_B2 $RUN_B3; do
  local_elapsed=0
  while [ "$local_elapsed" -lt 300 ]; do
    sleep 5; local_elapsed=$((local_elapsed + 5))
    state=$(curl -sf "$RESEARCHER_URL/status/$rid" | jq -r '.state // "unknown"')
    if [ "$state" != "running" ] && [ "$state" != "queued" ]; then break; fi
  done
done

# Check artifacts have distinct run_ids
NEW_B=$(artifacts_since "$SNAP_B")
ALL_B=$(artifact_list "limit=$((NEW_B + 5))")
UNIQUE_RUNS=$(echo "$ALL_B" | jq '[.[].run_id] | unique | length')

echo "  New artifacts: $NEW_B"
echo "  Unique run_ids: $UNIQUE_RUNS"

assert_ge ">= 3 new artifacts" "$NEW_B" 3
assert_ge ">= 3 unique run_ids" "$UNIQUE_RUNS" 3

# Verify no run_id is "unknown" (would mean ctx.sessionManager failed)
UNKNOWN_RUNS=$(echo "$ALL_B" | jq '[.[] | select(.run_id == "unknown")] | length')
assert_eq "no unknown run_ids" "$UNKNOWN_RUNS" 0

# ============================================================
# TEST C: Structured output under abstract brief
# ============================================================
echo ""; echo "--- Test C: Structured Output (Abstract Brief) ---"

SNAP_C=$(artifact_snapshot)

# Abstract brief — does NOT mention record_finding, JSONL, or any tool names
RUN_C=$(curl -sf -X POST "$RESEARCHER_URL/invoke" -H "Content-Type: application/json" \
  -d '{"task":"Research the current state of faceless Instagram accounts in the tech niche. Find 3 accounts, their follower counts, content formats, and engagement patterns. I need verified data with source citations."}' \
  | jq -r '.runId')

echo "  Dispatched: $RUN_C"

# Wait for completion (longer — this is a real research task)
local_elapsed=0
while [ "$local_elapsed" -lt 600 ]; do
  sleep 10; local_elapsed=$((local_elapsed + 10))
  state=$(curl -sf "$RESEARCHER_URL/status/$RUN_C" | jq -r '.state // "unknown"')
  if [ "$state" != "running" ] && [ "$state" != "queued" ]; then break; fi
done

RESULT_C=$(curl -sf "$RESEARCHER_URL/result/$RUN_C")
STATE_C=$(echo "$RESULT_C" | jq -r '.state // "unknown"')
MODEL_C=$(echo "$RESULT_C" | jq -r '.usage.model // "unknown"')
TURNS_C=$(echo "$RESULT_C" | jq -r '.usage.turns // 0')
echo "  State: $STATE_C | Model: $MODEL_C | Turns: $TURNS_C"

assert_eq "completed" "$STATE_C" "completed"

# Check for JSONL dataset artifact (NOT markdown research)
NEW_C=$(artifacts_since "$SNAP_C")
ALL_C=$(artifact_list "limit=$((NEW_C + 5))")
DATASET_C=$(echo "$ALL_C" | jq '[.[] | select(.artifact_type == "dataset")] | length')
JSONL_C=$(echo "$ALL_C" | jq '[.[] | select(.filename | test("\\.jsonl$"))] | length')

echo "  New artifacts: $NEW_C"
echo "  Dataset artifacts: $DATASET_C"
echo "  JSONL files: $JSONL_C"

assert_ge "produced dataset artifact" "$DATASET_C" 1
assert_ge "produced JSONL file" "$JSONL_C" 1

# Check the JSONL content has structured findings (not markdown)
if [ "$JSONL_C" -gt 0 ]; then
  JSONL_ID=$(echo "$ALL_C" | jq -r '[.[] | select(.filename | test("\\.jsonl$"))][0].id // empty')
  if [ -n "$JSONL_ID" ]; then
    CONTENT=$(artifact_content "$JSONL_ID")
    FINDING_COUNT=$(echo "$CONTENT" | grep -c '"claim"' || true)
    HAS_SOURCES=$(echo "$CONTENT" | grep -c '"sources"' || true)
    echo "  Findings in JSONL: $FINDING_COUNT"
    echo "  Findings with sources: $HAS_SOURCES"
    assert_ge "JSONL has findings" "$FINDING_COUNT" 1
    assert_ge "findings have sources" "$HAS_SOURCES" 1
  fi
fi

# ============================================================
# Summary
# ============================================================
echo ""
summary

write_report "$REPORT" "# E2E-32: Model + Output + Concurrency Validation

**Date:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Result:** $_PASS/$_TESTS passed, $_FAIL failed

## Test A: Model Selection
- Model used: $MODEL_A / ${MODEL_NAME_A:-unknown}
- Expected: NOT deepseek-chat, NOT minimax

## Test B: Concurrency
- Runs active after dispatch: ${ACTIVE:-0}
- New artifacts: ${NEW_B:-0}
- Unique run_ids: ${UNIQUE_RUNS:-0}
- Unknown run_ids: ${UNKNOWN_RUNS:-0}

## Test C: Structured Output (Abstract Brief)
- Model: ${MODEL_C:-unknown}
- Turns: ${TURNS_C:-0}
- Dataset artifacts: ${DATASET_C:-0}
- JSONL files: ${JSONL_C:-0}
- Findings in JSONL: ${FINDING_COUNT:-0}"
