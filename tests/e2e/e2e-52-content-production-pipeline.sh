#!/usr/bin/env bash
# E2E-52: Content Production Pipeline — Writer → Coder → Publisher
# Tests the full visual content chain via planner orchestration.
# Requires: all 6 agents + artifact-service running
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/jsonl-helpers.sh"
TEST_ID="e2e-52"
PUBLISHER_URL="${PUBLISHER_URL:-http://localhost:8085}"
CODER_URL="${CODER_URL:-http://localhost:8086}"

echo "=== E2E-52: Content Production Pipeline ==="

# ============================================================
# Preflight: all agents healthy
# ============================================================
echo "  Checking all agents..."
ALL_HEALTHY=true
for port in 8081 8082 8083 8084 8085 8086; do
  elapsed=0
  while [ "$elapsed" -lt 90 ]; do
    status=$(curl -sf "http://localhost:$port/health" 2>/dev/null | jq -r '.status // "unreachable"')
    if [ "$status" = "ok" ]; then break; fi
    sleep 3; elapsed=$((elapsed + 3))
  done
  if [ "$status" != "ok" ]; then
    echo "  [FATAL] :$port not healthy after 90s"
    ALL_HEALTHY=false
  fi
done

# Artifact service
ARTIFACT_STATUS=$(curl -sf "$ARTIFACT_URL/health" 2>/dev/null | jq -r '.status // "unreachable"')
if [ "$ARTIFACT_STATUS" != "ok" ]; then
  echo "  [FATAL] artifact-service not healthy"
  ALL_HEALTHY=false
fi

if [ "$ALL_HEALTHY" = true ]; then
  pass "P1: all agents + artifact-service healthy"
else
  fail "P1: some agents not healthy"
  summary; exit 1
fi

# ============================================================
# Dispatch: planner orchestrates carousel creation
# ============================================================
echo ""; echo "--- Dispatching Content Production Task ---"

SNAP=$(artifact_snapshot)
START_TIME=$(date +%s)

GOAL="Create a 5-slide Instagram carousel about the top 5 AI coding tools for developers in 2026. The carousel needs: a title slide, 3 content slides (one tool per slide with name and brief description), and a CTA slide. Dark theme, branded styling per the design system. Writer produces the content brief, Coder renders the slides as PNGs, Publisher assembles the platform package with caption and hashtags."

RUN_ID=$(curl -sf -X POST "$PLANNER_URL/invoke" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg t "$GOAL" '{task: $t}')" \
  | jq -r '.runId // empty')

if [ -z "$RUN_ID" ]; then
  fail "P2: planner dispatch failed"
  summary; exit 1
fi
pass "P2: planner dispatched ($RUN_ID)"

# ============================================================
# Poll: wait for planner completion (15 min max for 3-agent chain)
# ============================================================
echo "  Polling planner (max 900s)..."
elapsed=0
poll_interval=10
while [ "$elapsed" -lt 900 ]; do
  sleep "$poll_interval"; elapsed=$((elapsed + poll_interval))
  state=$(curl -sf "$PLANNER_URL/status/$RUN_ID" 2>/dev/null | jq -r '.state // "unknown"')
  if [ "$((elapsed % 60))" -eq 0 ]; then echo "  [$elapsed s] state=$state"; fi
  if [ "$state" != "running" ] && [ "$state" != "queued" ]; then break; fi
  if [ "$elapsed" -gt 120 ]; then poll_interval=15; fi
  if [ "$elapsed" -gt 300 ]; then poll_interval=30; fi
done

RESULT=$(curl -sf "$PLANNER_URL/result/$RUN_ID" 2>/dev/null)
STATE=$(echo "$RESULT" | jq -r '.state // "unknown"')
OUTPUT=$(echo "$RESULT" | jq -r '.output // ""')
DURATION=$(( $(date +%s) - START_TIME ))

echo "  Final state: $STATE (${DURATION}s elapsed)"

# ============================================================
# TEST: Planner orchestration (4 tests)
# ============================================================
echo ""; echo "--- Planner Orchestration ---"

# P3: Planner completed
if [ "$STATE" = "completed" ]; then
  pass "P3: planner completed (${DURATION}s)"
elif [ "$STATE" = "failed" ]; then
  fail "P3: planner failed" "check logs"
else
  fail "P3: planner did not finish (state=$STATE, ${DURATION}s)"
fi

# P4-P6: Planner mentioned delegating to each agent
for agent in writer coder publisher; do
  TAG="P$((4 + $(echo "writer coder publisher" | tr ' ' '\n' | grep -n "$agent" | cut -d: -f1) - 1))"
  if echo "$OUTPUT" | grep -qi "$agent"; then
    pass "$TAG: planner output mentions $agent"
  else
    fail "$TAG: planner output does not mention $agent"
  fi
done

# ============================================================
# TEST: Artifacts produced (4 tests)
# ============================================================
echo ""; echo "--- Artifact Production ---"

NEW_COUNT=$(artifacts_since "$SNAP")
if [ "$NEW_COUNT" -gt 0 ]; then
  pass "A1: $NEW_COUNT new artifact(s) created during pipeline"
else
  fail "A1: no new artifacts created"
fi

# A2: Writer artifact exists
WRITER_ARTS=$(curl -sf "$ARTIFACT_URL/artifacts?agent_name=writer&limit=10" 2>/dev/null | jq 'length')
if [ "$WRITER_ARTS" -gt 0 ] 2>/dev/null; then
  pass "A2: writer produced $WRITER_ARTS artifact(s)"
else
  fail "A2: no writer artifacts found"
fi

# A3: Coder artifact exists (image type)
CODER_ARTS=$(curl -sf "$ARTIFACT_URL/artifacts?agent_name=coder&artifact_type=image&limit=10" 2>/dev/null | jq 'length')
if [ "$CODER_ARTS" -gt 0 ] 2>/dev/null; then
  pass "A3: coder produced $CODER_ARTS image artifact(s)"
else
  # Also check without type filter
  CODER_ANY=$(curl -sf "$ARTIFACT_URL/artifacts?agent_name=coder&limit=10" 2>/dev/null | jq 'length')
  if [ "$CODER_ANY" -gt 0 ] 2>/dev/null; then
    pass "A3: coder produced $CODER_ANY artifact(s) (not typed 'image')"
  else
    fail "A3: no coder artifacts found"
  fi
fi

# A4: Publisher artifact exists
PUB_ARTS=$(curl -sf "$ARTIFACT_URL/artifacts?agent_name=publisher&limit=10" 2>/dev/null | jq 'length')
if [ "$PUB_ARTS" -gt 0 ] 2>/dev/null; then
  pass "A4: publisher produced $PUB_ARTS artifact(s)"
else
  fail "A4: no publisher artifacts found"
fi

# ============================================================
# Save sample output
# ============================================================
SAMPLE_DIR="$RESULTS_DIR/e2e-52-sample"
mkdir -p "$SAMPLE_DIR"
echo "$OUTPUT" > "$SAMPLE_DIR/planner-output.txt"
echo ""; echo "  Planner output saved: $SAMPLE_DIR/planner-output.txt"

# Save pipeline duration and artifact counts
cat > "$SAMPLE_DIR/summary.json" <<EOFSUM
{
  "run_id": "$RUN_ID",
  "state": "$STATE",
  "duration_s": $DURATION,
  "artifacts": {
    "total_new": $NEW_COUNT,
    "writer": $WRITER_ARTS,
    "coder_images": $CODER_ARTS,
    "publisher": $PUB_ARTS
  }
}
EOFSUM

echo "  Summary: $SAMPLE_DIR/summary.json"

# ============================================================
# Summary
# ============================================================
summary
