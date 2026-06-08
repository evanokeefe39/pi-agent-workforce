#!/usr/bin/env bash
# =============================================================================
# E2E-33: Writer fanout/fan-in pipeline test
#
# Tests the writer agent's new 3-phase pipeline:
#   PLAN → WRITE+FIX (parallel fanout) → ASSEMBLE
#
# Sends a briefing-style task with inline findings (no artifact dependency).
# Verifies: the writer plans sections, fans out to section-writer subagents,
# and assembles a final document.
# =============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/../results"
mkdir -p "$RESULTS_DIR"

WRITER_URL="${WRITER_URL:-http://localhost:8084}"
TIMEOUT_S="${TIMEOUT_S:-300}"

# ---- Colors ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[e2e-33]${NC} $*"; }
warn() { echo -e "${YELLOW}[e2e-33]${NC} $*"; }
fail() { echo -e "${RED}[e2e-33 FAIL]${NC} $*"; exit 1; }

# ---- Health check ----
log "Checking writer health at $WRITER_URL..."
HEALTH=$(curl -sf "$WRITER_URL/health" 2>/dev/null) || fail "Writer not reachable at $WRITER_URL"
echo "$HEALTH" | jq -r '.status' | grep -q "ok" || fail "Writer not healthy: $HEALTH"
log "Writer healthy."

# ---- Describe ----
log "Getting writer agent description..."
DESCRIBE=$(curl -sf "$WRITER_URL/describe" 2>/dev/null) || warn "Could not get /describe"
echo "$DESCRIBE" | jq '.' 2>/dev/null || true

# ---- Build task payload ----
# We embed findings directly in the task prompt since there's no artifact service
# dependency for this test. The writer should plan sections, create briefs, fan out
# to section-writer subagents, and assemble.

TASK_PAYLOAD=$(cat <<'TASKEOF'
{
  "task": "Write a briefing-style report based on the following research findings. doc_style: briefing.\n\nFINDINGS:\n\n1. Claim: Faceless Instagram accounts in the tech/AI niche grew 340% faster than personal brand accounts in Q1 2026. Source: Social Media Examiner annual report. Grade: B2.\n\n2. Claim: Posting frequency of 4-5 reels per week correlates with 2.3x higher follower growth rate versus 1-2 posts per week. Source: Later.com 2026 Instagram benchmark study, n=12,000 accounts. Grade: B1.\n\n3. Claim: AI-generated carousel posts using Midjourney v7 achieve 45% higher save rates than stock photography. Source: HubSpot content lab experiment, sample size 500 posts. Grade: C3.\n\n4. Claim: Optimal posting times for tech content are 7-9am EST and 6-8pm EST on weekdays, with Saturday 10am-12pm as a secondary window. Source: Sprout Social 2026 data, aggregated from 30K+ accounts. Grade: B2.\n\n5. Claim: Accounts using a consistent color palette (3-5 brand colors) see 28% higher profile visit-to-follow conversion. Source: Instagram Creator Insights beta program Q4 2025. Grade: C3.\n\n6. Claim: Caption length between 125-200 words generates the highest engagement rate for educational content. Source: Socialinsider benchmark, 1M posts analyzed. Grade: B2.\n\n7. Claim: Collaborations with micro-influencers (10K-50K followers) yield 4.2x ROI compared to macro-influencer partnerships for niche tech content. Source: CreatorIQ 2026 influencer marketing report. Grade: B3.\n\nWrite a 3-5 section briefing covering growth strategy, content creation, and engagement optimization. Each section should cite specific data from the findings above."
}
TASKEOF
)

# ---- Invoke ----
log "Invoking writer with briefing task..."
INVOKE_RESPONSE=$(curl -sf -X POST "$WRITER_URL/invoke" \
  -H "Content-Type: application/json" \
  -d "$TASK_PAYLOAD") || fail "Failed to invoke writer"

RUN_ID=$(echo "$INVOKE_RESPONSE" | jq -r '.runId')
[ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ] && fail "No runId in response: $INVOKE_RESPONSE"
log "Run started: $RUN_ID"

# ---- Poll ----
log "Polling for completion (timeout: ${TIMEOUT_S}s)..."
ELAPSED=0
POLL_INTERVAL=5
LAST_STATE=""

while [ $ELAPSED -lt $TIMEOUT_S ]; do
  STATUS_RESPONSE=$(curl -sf "$WRITER_URL/status/$RUN_ID" 2>/dev/null) || true
  STATE=$(echo "$STATUS_RESPONSE" | jq -r '.state' 2>/dev/null)
  TURNS=$(echo "$STATUS_RESPONSE" | jq -r '.turnCount // 0' 2>/dev/null)
  DURATION=$(echo "$STATUS_RESPONSE" | jq -r '.durationMs // 0' 2>/dev/null)

  if [ "$STATE" != "$LAST_STATE" ]; then
    log "State: $STATE | Turns: $TURNS | Duration: ${DURATION}ms | Elapsed: ${ELAPSED}s"
    LAST_STATE="$STATE"
  fi

  if [ "$STATE" = "completed" ] || [ "$STATE" = "failed" ] || [ "$STATE" = "error" ]; then
    break
  fi

  sleep $POLL_INTERVAL
  ELAPSED=$((ELAPSED + POLL_INTERVAL))

  # Adaptive polling: slow down after 60s
  if [ $ELAPSED -gt 60 ] && [ $POLL_INTERVAL -lt 10 ]; then
    POLL_INTERVAL=10
  fi
done

if [ $ELAPSED -ge $TIMEOUT_S ]; then
  warn "Timed out after ${TIMEOUT_S}s"
  STATE="timeout"
fi

# ---- Result ----
log "Fetching result..."
RESULT=$(curl -sf "$WRITER_URL/result/$RUN_ID" 2>/dev/null) || warn "Could not fetch result"

# Save full result
RESULT_FILE="$RESULTS_DIR/e2e-33-writer-fanout.jsonl"
echo "$RESULT" | jq -c '.' > "$RESULT_FILE" 2>/dev/null || true
log "Result saved to $RESULT_FILE"

# ---- Extract output ----
OUTPUT=$(echo "$RESULT" | jq -r '.output // "NO OUTPUT"' 2>/dev/null)
MODEL=$(echo "$RESULT" | jq -r '.model // "unknown"' 2>/dev/null)
FINAL_STATE=$(echo "$RESULT" | jq -r '.state // "unknown"' 2>/dev/null)
USAGE=$(echo "$RESULT" | jq -c '.usage // {}' 2>/dev/null)

# ---- Report ----
echo ""
echo "============================================================"
echo "E2E-33 Writer Fanout Pipeline Test Results"
echo "============================================================"
echo "State:    $FINAL_STATE"
echo "Model:    $MODEL"
echo "Duration: ${DURATION}ms"
echo "Turns:    $TURNS"
echo "Usage:    $USAGE"
echo ""

# ---- Checks ----
PASS=0
FAIL_COUNT=0

check() {
  local desc="$1"
  local result="$2"
  if [ "$result" = "true" ]; then
    echo -e "  ${GREEN}PASS${NC} $desc"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} $desc"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

echo "Checks:"

# 1. Completed successfully
check "Run completed" "$([ "$FINAL_STATE" = "completed" ] && echo true || echo false)"

# 2. Output is non-empty
OUTPUT_LEN=${#OUTPUT}
check "Output non-empty (${OUTPUT_LEN} chars)" "$([ $OUTPUT_LEN -gt 100 ] && echo true || echo false)"

# 3. Contains section headings (evidence of multi-section document)
HAS_HEADINGS=$(echo "$OUTPUT" | grep -c '^##' 2>/dev/null || echo 0)
check "Has section headings ($HAS_HEADINGS found)" "$([ $HAS_HEADINGS -ge 2 ] && echo true || echo false)"

# 4. Contains data citations (evidence findings were used)
HAS_CITATIONS=$(echo "$OUTPUT" | grep -ci 'percent\|%\|340\|2\.3x\|45%\|4\.2x\|28%' 2>/dev/null || echo 0)
check "Contains data citations ($HAS_CITATIONS matches)" "$([ $HAS_CITATIONS -ge 2 ] && echo true || echo false)"

# 5. No AI tell words
AI_TELLS=$(echo "$OUTPUT" | grep -ci 'delve\|tapestry\|multifaceted\|utilize\|harness\|leverage' 2>/dev/null || echo 0)
check "No AI tell words ($AI_TELLS found)" "$([ $AI_TELLS -eq 0 ] && echo true || echo false)"

# 6. Completed within timeout
check "Completed within timeout" "$([ "$STATE" != "timeout" ] && echo true || echo false)"

echo ""
echo "Results: $PASS passed, $FAIL_COUNT failed"
echo "============================================================"

# ---- Output preview ----
echo ""
echo "Output preview (first 2000 chars):"
echo "------------------------------------------------------------"
echo "$OUTPUT" | head -c 2000
echo ""
echo "------------------------------------------------------------"

# Save readable report
REPORT_FILE="$RESULTS_DIR/e2e-33-writer-fanout-report.md"
cat > "$REPORT_FILE" <<REPORTEOF
# E2E-33: Writer Fanout Pipeline Test

| Metric | Value |
|--------|-------|
| State | $FINAL_STATE |
| Model | $MODEL |
| Duration | ${DURATION}ms |
| Turns | $TURNS |
| Output length | ${OUTPUT_LEN} chars |
| Section headings | $HAS_HEADINGS |
| Data citations | $HAS_CITATIONS |
| AI tells | $AI_TELLS |

## Checks
- Passed: $PASS
- Failed: $FAIL_COUNT

## Full Output

$OUTPUT
REPORTEOF
log "Report saved to $REPORT_FILE"

[ $FAIL_COUNT -eq 0 ] && exit 0 || exit 1
