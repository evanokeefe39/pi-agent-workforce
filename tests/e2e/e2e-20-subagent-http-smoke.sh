#!/usr/bin/env bash
# E2E-20: pi-subagents-http smoke test
# Validates: agent discovery, single blocking delegation, artifact namespacing
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/jsonl-helpers.sh"
TEST_ID="e2e-20"
REPORT="$RESULTS_DIR/e2e-20-$(date +%Y%m%d-%H%M%S).md"

echo "=== E2E-20: pi-subagents-http Smoke Test ==="
require_agents

# --- Test 1: Agent discovery ---
echo ""; echo "--- Agent Discovery ---"
R_DESC=$(curl -sf "$RESEARCHER_URL/describe" || echo '{}')
W_DESC=$(curl -sf "$WRITER_URL/describe" || echo '{}')
R_NAME=$(echo "$R_DESC" | jq -r '.name // empty')
R_STATUS=$(echo "$R_DESC" | jq -r '.status // empty')
W_NAME=$(echo "$W_DESC" | jq -r '.name // empty')

assert_not_empty "researcher has name" "$R_NAME"
assert_eq "researcher status ready" "$R_STATUS" "ready"
assert_not_empty "writer has name" "$W_NAME"

# --- Test 2: Blocking delegation ---
echo ""; echo "--- Blocking Delegation ---"
EVENTS=$(pi_run 'Use subagent to delegate this task to the researcher agent: Reply with exactly three words: SMOKE TEST PASSED' 120 smoke)

TURNS=$(jsonl_turns "$EVENTS")
SUBAGENT_CALLS=$(jsonl_tool_count "$EVENTS" "subagent")
STATUS_POLLS=$(jsonl_status_polls "$EVENTS")
HAS_OUTPUT=$(jsonl_output_contains "$EVENTS" "SMOKE TEST PASSED")

assert_le "completed in < 10 turns" "$TURNS" 10
assert_le "subagent calls <= 3" "$SUBAGENT_CALLS" 3
assert_eq "no status polling" "$STATUS_POLLS" 0
assert_eq "result contains expected output" "$HAS_OUTPUT" "true"

# --- Test 3: Artifact namespacing ---
echo ""; echo "--- Artifact Namespacing ---"
LATEST=$(artifact_list "limit=1")
LATEST_RUN=$(echo "$LATEST" | jq -r '.[0].run_id // empty')
LATEST_KEY=$(echo "$LATEST" | jq -r '.[0].s3_key // empty')

ARTIFACT_DB_COUNT=$(echo "$LATEST" | jq 'length')
if [ "$ARTIFACT_DB_COUNT" -gt 0 ]; then
  assert_not_empty "latest artifact has run_id" "$LATEST_RUN"
  assert_true "no default/default in path" test -z "$(echo "$LATEST_KEY" | grep 'default/default' || true)"
else
  pass "artifact DB empty (clean slate) — namespacing check skipped"
fi

# --- Report ---
TOOLS=$(jsonl_tool_breakdown "$EVENTS")
summary

write_report "$REPORT" "# E2E-20: Smoke Test

**Date:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Result:** $_PASS/$_TESTS passed, $_FAIL failed

## Metrics
| Metric | Value |
|--------|-------|
| Turns | $TURNS |
| Subagent calls | $SUBAGENT_CALLS |
| Status polls | $STATUS_POLLS |
| Tool breakdown | \`$TOOLS\` |
| Output match | $HAS_OUTPUT |"
