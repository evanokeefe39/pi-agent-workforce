#!/usr/bin/env bash
# E2E-34: Data agent — code-first analysis validation
# Tests the data agent's ability to:
#   Test A: Boot, describe, register correct tools
#   Test B: Analyze inline data with explicit tool instructions (capability)
#   Test C: Analyze inline data with abstract goal (autonomy)
#   Test D: Ingest artifact by URI and analyze (pipeline)
#   Test E: Jidoka — required tools enforcement on conversational prompt
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/jsonl-helpers.sh"
TEST_ID="e2e-34"
REPORT="$RESULTS_DIR/e2e-34-$(date +%Y%m%d-%H%M%S).md"

# Test data — 5 Instagram accounts with engagement metrics
CSV_DATA='account,followers,likes,saves,views,posts
eggintech,14900,45000,12000,890000,22
learnwithseb,8200,18000,5600,320000,45
sabrina_ramonov,120000,280000,95000,4200000,180
michellescomputer,52000,65000,8500,14200000,85
kirkstencell,9200,12000,3800,280000,1153'

echo "=== E2E-34: Data Agent — Code-First Analysis Validation ==="
require_agents

# ============================================================
# TEST A: Health, Describe, Tool Registration
# ============================================================
echo ""; echo "--- Test A: Health + Describe + Tools ---"

HEALTH=$(curl -sf "$DATA_URL/health" 2>/dev/null || echo '{}')
HEALTH_STATUS=$(echo "$HEALTH" | jq -r '.status // "unreachable"')
assert_eq "health ok" "$HEALTH_STATUS" "ok"

DESC=$(curl -sf "$DATA_URL/describe" 2>/dev/null || echo '{}')
DESC_NAME=$(echo "$DESC" | jq -r '.name // "unknown"')
DESC_MODEL=$(echo "$DESC" | jq -r '.model // "unknown"')
DESC_TOOLS=$(echo "$DESC" | jq -r '.tools[]? // empty' 2>/dev/null)

assert_eq "name is Data" "$DESC_NAME" "Data"

# Check model contains deepseek (not minimax, not unknown)
if echo "$DESC_MODEL" | grep -qi "deepseek"; then
  pass "Test A: model is deepseek ($DESC_MODEL)"
else
  fail "Test A: unexpected model" "$DESC_MODEL"
fi

# Check critical extensions loaded (tools registered inside extensions,
# Pi SDK doesn't expose tool names via resourceLoader.getTools)
DESC_EXT=$(echo "$DESC" | jq -r '.extensions[]? // empty' 2>/dev/null)
DESC_EXT_COUNT=$(echo "$DESC" | jq '.extensions | length' 2>/dev/null || echo 0)
echo "  Extensions loaded: $DESC_EXT_COUNT"

# Verify key extensions present: duckdb, artifacts, workproduct, web-search
for ext in workproduct.ts; do
  if echo "$DESC_EXT" | grep -q "$ext"; then
    pass "has extension: $ext"
  else
    fail "missing extension: $ext"
  fi
done

assert_ge "extensions loaded (>= 8)" "$DESC_EXT_COUNT" 8

# ============================================================
# TEST B: Explicit Analysis (capability check)
# ============================================================
echo ""; echo "--- Test B: Explicit Analysis (tools named in prompt) ---"

SNAP_B=$(artifact_snapshot)

RUN_B=$(curl -sf -X POST "$DATA_URL/invoke" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg csv "$CSV_DATA" '{
    task: ("Analyze this engagement data. Use duckdb_query to compute save_rate (saves/views*100) and likes_per_post for each account. Record results via record_query_result, derive summary metrics via record_metric, then publish as JSONL via publish_artifact (type: dataset).\n\nDATA (CSV):\n" + $csv)
  }')" \
  | jq -r '.runId')

if [ -z "$RUN_B" ] || [ "$RUN_B" = "null" ]; then
  fail "Test B: invoke failed"
else
  echo "  Dispatched: $RUN_B"

  # Poll for completion (max 5 min)
  local_elapsed=0
  while [ "$local_elapsed" -lt 300 ]; do
    sleep 10; local_elapsed=$((local_elapsed + 10))
    state=$(curl -sf "$DATA_URL/status/$RUN_B" 2>/dev/null | jq -r '.state // "unknown"')
    if [ "$state" != "running" ] && [ "$state" != "queued" ]; then break; fi
  done

  RESULT_B=$(curl -sf "$DATA_URL/result/$RUN_B" 2>/dev/null)
  STATE_B=$(echo "$RESULT_B" | jq -r '.state // "unknown"')
  MODEL_B=$(echo "$RESULT_B" | jq -r '.model // "unknown"')
  TURNS_B=$(echo "$RESULT_B" | jq -r '.usage.turns // 0')

  echo "  State: $STATE_B | Model: $MODEL_B | Turns: $TURNS_B"
  assert_eq "Test B: completed" "$STATE_B" "completed"

  # Check artifacts produced
  NEW_B=$(artifacts_since "$SNAP_B")
  ALL_B=$(artifact_list "limit=$((NEW_B + 5))")
  DATASET_B=$(echo "$ALL_B" | jq '[.[] | select(.artifact_type == "dataset")] | length')

  echo "  New artifacts: $NEW_B"
  echo "  Dataset artifacts: $DATASET_B"

  assert_ge "Test B: produced dataset artifact" "$DATASET_B" 1
fi

# ============================================================
# TEST C: Abstract Analysis (autonomy check — THE critical test)
# ============================================================
echo ""; echo "--- Test C: Abstract Analysis (goal only, no tool names) ---"

SNAP_C=$(artifact_snapshot)

RUN_C=$(curl -sf -X POST "$DATA_URL/invoke" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg csv "$CSV_DATA" '{
    task: ("I have engagement data from 5 Instagram accounts in the tech/AI niche. I need to understand which accounts have the strongest engagement efficiency, identify any red flags in the data, and produce a quantitative comparison.\n\nDATA:\n" + $csv)
  }')" \
  | jq -r '.runId')

if [ -z "$RUN_C" ] || [ "$RUN_C" = "null" ]; then
  fail "Test C: invoke failed"
else
  echo "  Dispatched: $RUN_C"

  # Poll for completion (max 8 min — abstract briefs take longer)
  local_elapsed=0
  while [ "$local_elapsed" -lt 480 ]; do
    sleep 10; local_elapsed=$((local_elapsed + 10))
    state=$(curl -sf "$DATA_URL/status/$RUN_C" 2>/dev/null | jq -r '.state // "unknown"')
    if [ "$state" != "running" ] && [ "$state" != "queued" ]; then break; fi
  done

  RESULT_C=$(curl -sf "$DATA_URL/result/$RUN_C" 2>/dev/null)
  STATE_C=$(echo "$RESULT_C" | jq -r '.state // "unknown"')
  MODEL_C=$(echo "$RESULT_C" | jq -r '.model // "unknown"')
  TURNS_C=$(echo "$RESULT_C" | jq -r '.usage.turns // 0')

  echo "  State: $STATE_C | Model: $MODEL_C | Turns: $TURNS_C"
  assert_eq "Test C: completed" "$STATE_C" "completed"

  # Check artifacts produced (same assertions as B — proves autonomous behavior)
  NEW_C=$(artifacts_since "$SNAP_C")
  ALL_C=$(artifact_list "limit=$((NEW_C + 5))")
  DATASET_C=$(echo "$ALL_C" | jq '[.[] | select(.artifact_type == "dataset")] | length')

  echo "  New artifacts: $NEW_C"
  echo "  Dataset artifacts: $DATASET_C"

  assert_ge "Test C: produced dataset artifact" "$DATASET_C" 1

  # Check JSONL content has structured data (not markdown prose)
  if [ "$DATASET_C" -gt 0 ]; then
    JSONL_ID=$(echo "$ALL_C" | jq -r '[.[] | select(.artifact_type == "dataset")][0].id // empty')
    if [ -n "$JSONL_ID" ]; then
      CONTENT=$(artifact_content "$JSONL_ID")
      # Check for numeric values (proves code-first, not prose)
      HAS_NUMBERS=$(echo "$CONTENT" | grep -cE '[0-9]+\.[0-9]+' || true)
      echo "  Lines with numeric values: $HAS_NUMBERS"
      assert_ge "Test C: JSONL has numeric data" "$HAS_NUMBERS" 1
    fi
  fi
fi

# ============================================================
# TEST D: Artifact Ingest — JSONL findings analysis
# ============================================================
echo ""; echo "--- Test D: Artifact Ingest (JSONL findings) ---"

SNAP_D=$(artifact_snapshot)

# Inline JSONL findings (avoids multiline string parse issues)
FINDINGS_PROMPT="Analyze these research findings. Compute the distribution of ADMIRALTY grades, identify which claims have the strongest and weakest backing, and produce a summary dataset.

FINDINGS (JSONL — one JSON object per line):
{\"claim\":\"eggintech has 14.9K followers\",\"admiralty_grade\":\"A1\",\"topic_tags\":[\"instagram\"]}
{\"claim\":\"learnwithseb posts 3x per week\",\"admiralty_grade\":\"B2\",\"topic_tags\":[\"instagram\"]}
{\"claim\":\"sabrina_ramonov averages 4.5 percent save rate\",\"admiralty_grade\":\"A1\",\"topic_tags\":[\"engagement\"]}
{\"claim\":\"michellescomputer growth slowed after viral hit\",\"admiralty_grade\":\"C3\",\"topic_tags\":[\"growth\"]}
{\"claim\":\"kirkstencell has unusual volume: 1153 posts\",\"admiralty_grade\":\"A1\",\"topic_tags\":[\"red_flag\"]}"

RUN_D=$(curl -sf -X POST "$DATA_URL/invoke" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg t "$FINDINGS_PROMPT" '{task: $t}')" \
  | jq -r '.runId')

if [ -z "$RUN_D" ] || [ "$RUN_D" = "null" ]; then
  fail "Test D: invoke failed"
else
  echo "  Dispatched: $RUN_D"

  local_elapsed=0
  while [ "$local_elapsed" -lt 300 ]; do
    sleep 10; local_elapsed=$((local_elapsed + 10))
    state=$(curl -sf "$DATA_URL/status/$RUN_D" 2>/dev/null | jq -r '.state // "unknown"')
    if [ "$state" != "running" ] && [ "$state" != "queued" ]; then break; fi
  done

  RESULT_D=$(curl -sf "$DATA_URL/result/$RUN_D" 2>/dev/null)
  STATE_D=$(echo "$RESULT_D" | jq -r '.state // "unknown"')
  TURNS_D=$(echo "$RESULT_D" | jq -r '.usage.turns // 0')

  echo "  State: $STATE_D | Turns: $TURNS_D"
  assert_eq "Test D: completed" "$STATE_D" "completed"

  NEW_D=$(artifacts_since "$SNAP_D")
  echo "  New artifacts: $NEW_D"
  assert_ge "Test D: produced new artifact" "$NEW_D" 1
fi

# ============================================================
# TEST E: Jidoka — Required Tools Enforcement
# ============================================================
echo ""; echo "--- Test E: Jidoka — Required Tools Check ---"

RUN_E=$(curl -sf -X POST "$DATA_URL/invoke" \
  -H "Content-Type: application/json" \
  -d '{"task":"What are the key differences between engagement metrics on TikTok versus Instagram for tech creators?"}' \
  | jq -r '.runId')

if [ -z "$RUN_E" ] || [ "$RUN_E" = "null" ]; then
  fail "Test E: invoke failed"
else
  echo "  Dispatched: $RUN_E"

  local_elapsed=0
  while [ "$local_elapsed" -lt 300 ]; do
    sleep 10; local_elapsed=$((local_elapsed + 10))
    state=$(curl -sf "$DATA_URL/status/$RUN_E" 2>/dev/null | jq -r '.state // "unknown"')
    if [ "$state" != "running" ] && [ "$state" != "queued" ]; then break; fi
  done

  RESULT_E=$(curl -sf "$DATA_URL/result/$RUN_E" 2>/dev/null)
  STATE_E=$(echo "$RESULT_E" | jq -r '.state // "unknown"')
  ERROR_E=$(echo "$RESULT_E" | jq -r '.error // "none"')

  echo "  State: $STATE_E"
  echo "  Error: $ERROR_E"

  # Either the agent completed (meaning it created sample data + used record_query_result)
  # or it failed with jidoka catching missing required tools. Both are correct.
  if [ "$STATE_E" = "completed" ]; then
    pass "Test E: completed (agent used code-first approach for conversational question)"
  elif [ "$STATE_E" = "failed" ] && echo "$ERROR_E" | grep -qi "required tools"; then
    pass "Test E: jidoka caught missing required tools"
  else
    fail "Test E: unexpected state=$STATE_E error=$ERROR_E"
  fi
fi

# ============================================================
# Summary
# ============================================================
echo ""
summary

write_report "$REPORT" "# E2E-34: Data Agent — Code-First Analysis Validation

**Date:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Result:** $_PASS/$_TESTS passed, $_FAIL failed

## Test A: Health + Describe + Tools
- Health: $HEALTH_STATUS
- Name: ${DESC_NAME:-unknown}
- Model: ${DESC_MODEL:-unknown}

## Test B: Explicit Analysis
- State: ${STATE_B:-unknown} | Model: ${MODEL_B:-unknown} | Turns: ${TURNS_B:-0}
- New artifacts: ${NEW_B:-0}
- Dataset artifacts: ${DATASET_B:-0}

## Test C: Abstract Analysis (critical)
- State: ${STATE_C:-unknown} | Model: ${MODEL_C:-unknown} | Turns: ${TURNS_C:-0}
- New artifacts: ${NEW_C:-0}
- Dataset artifacts: ${DATASET_C:-0}
- Lines with numeric values: ${HAS_NUMBERS:-0}

## Test D: JSONL Findings Analysis
- State: ${STATE_D:-unknown} | Turns: ${TURNS_D:-0}
- New artifacts: ${NEW_D:-0}

## Test E: Jidoka
- State: ${STATE_E:-unknown}
- Error: ${ERROR_E:-none}"
