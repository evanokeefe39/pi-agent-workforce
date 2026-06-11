#!/usr/bin/env bash
# JSONL test helpers for pi-subagents-http e2e tests.
# Source this file; do not execute directly.
# Requires: jq, pi, curl

set -euo pipefail

# --- Config ---
PLANNER_URL="${PLANNER_URL:-http://localhost:8081}"
RESEARCHER_URL="${RESEARCHER_URL:-http://localhost:8082}"
DATA_URL="${DATA_URL:-http://localhost:8083}"
WRITER_URL="${WRITER_URL:-http://localhost:8084}"
QA_URL="${QA_URL:-http://localhost:8087}"
ARTIFACT_URL="${ARTIFACT_URL:-http://localhost:8090}"
RESULTS_DIR="${RESULTS_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../tests/results" 2>/dev/null && pwd || echo "/tmp/e2e-results")}"
mkdir -p "$RESULTS_DIR"

# --- State ---
_PASS=0; _FAIL=0; _TESTS=0

# --- Output ---
pass() { ((_PASS++)) || true; ((_TESTS++)) || true; echo "  ✓ $1"; }
fail() { ((_FAIL++)) || true; ((_TESTS++)) || true; echo "  ✗ $1${2:+ — $2}"; }

assert_true() {
  local name="$1"; shift
  if "$@" 2>/dev/null; then pass "$name"; else fail "$name" "condition false"; fi
}

assert_eq() {
  local name="$1" actual="$2" expected="$3"
  if [ "$actual" = "$expected" ]; then pass "$name"; else fail "$name" "expected=$expected got=$actual"; fi
}

assert_ge() {
  local name="$1" actual="$2" min="$3"
  if [ "$actual" -ge "$min" ] 2>/dev/null; then pass "$name"; else fail "$name" "expected >= $min, got $actual"; fi
}

assert_le() {
  local name="$1" actual="$2" max="$3"
  if [ "$actual" -le "$max" ] 2>/dev/null; then pass "$name"; else fail "$name" "expected <= $max, got $actual"; fi
}

assert_gt() {
  local name="$1" actual="$2" other="$3"
  if [ "$actual" -gt "$other" ] 2>/dev/null; then pass "$name"; else fail "$name" "expected > $other, got $actual"; fi
}

assert_not_empty() {
  local name="$1" value="$2"
  if [ -n "$value" ] && [ "$value" != "null" ]; then pass "$name"; else fail "$name" "empty or null"; fi
}

summary() {
  echo ""
  echo "═══════════════════════════════════════"
  echo "  $_PASS/$_TESTS passed, $_FAIL failed"
  echo "═══════════════════════════════════════"
  [ "$_FAIL" -eq 0 ]
}

# --- Pi invocation ---

# Run pi with JSON output, separated stderr. Returns path to events file.
# Usage: EVENTS=$(pi_run "prompt text" [timeout_seconds])
pi_run() {
  local prompt="$1"
  local timeout="${2:-300}"
  local tag="${3:-run}"
  local events_file="$RESULTS_DIR/${TEST_ID:-test}-${tag}.jsonl"
  local stderr_file="$RESULTS_DIR/${TEST_ID:-test}-${tag}.stderr"

  timeout "$timeout" bash -c "pi --mode json --no-session -p $(printf '%q' "$prompt")" \
    > "$events_file" \
    2> "$stderr_file" || true

  echo "$events_file"
}

# --- Planner invocation (HTTP) ---

# Invoke the planner agent via HTTP and poll until completion.
# Returns path to result JSON file.
# Usage: RESULT=$(planner_run "goal text" [timeout_seconds] [tag])
planner_run() {
  local prompt="$1"
  local timeout="${2:-900}"
  local tag="${3:-planner}"
  local result_file="$RESULTS_DIR/${TEST_ID:-test}-${tag}.json"

  # POST /invoke
  local invoke_resp
  invoke_resp=$(curl -sf -X POST "$PLANNER_URL/invoke" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg t "$prompt" '{task: $t}')" 2>/dev/null)

  local run_id
  run_id=$(echo "$invoke_resp" | jq -r '.runId // empty')

  if [ -z "$run_id" ]; then
    echo '{"error":"invoke_failed","output":""}' > "$result_file"
    echo "$result_file"
    return
  fi

  # Poll /status until done or timeout
  local elapsed=0
  local poll_interval=5
  while [ "$elapsed" -lt "$timeout" ]; do
    sleep "$poll_interval"
    elapsed=$((elapsed + poll_interval))

    local state
    state=$(curl -sf "$PLANNER_URL/status/$run_id" 2>/dev/null | jq -r '.state // "unknown"')

    if [ "$state" != "running" ] && [ "$state" != "queued" ]; then break; fi

    # Adaptive backoff
    if [ "$elapsed" -gt 120 ]; then poll_interval=10; fi
    if [ "$elapsed" -gt 300 ]; then poll_interval=20; fi
  done

  # Fetch result
  curl -sf "$PLANNER_URL/result/$run_id" > "$result_file" 2>/dev/null || \
    echo '{"error":"result_fetch_failed","output":""}' > "$result_file"
  echo "$result_file"
}

# --- JSONL parsing (all use jq -s for reliability) ---

# Count events by type
jsonl_count() {
  local file="$1" type="$2"
  jq -s --arg t "$type" '[.[] | select(.type == $t)] | length' "$file" 2>/dev/null || echo 0
}

# Count tool calls by tool name (from tool_execution_end events)
jsonl_tool_count() {
  local file="$1" tool="$2"
  jq -s --arg t "$tool" \
    '[.[] | select(.type == "tool_execution_end" and .toolName == $t)] | length' \
    "$file" 2>/dev/null || echo 0
}

# Tool call breakdown: { "subagent": 3, "read": 1, ... }
jsonl_tool_breakdown() {
  local file="$1"
  jq -s '
    [.[] | select(.type == "tool_execution_end")]
    | group_by(.toolName)
    | map({(.[0].toolName): length})
    | add // {}
  ' "$file" 2>/dev/null || echo '{}'
}

# Count turns
jsonl_turns() {
  jsonl_count "$1" "turn_end"
}

# Check if specific text appears in any message content
jsonl_output_contains() {
  local file="$1" text="$2"
  jq -s --arg t "$text" '
    [.[] | select(.type == "message_end") | .message.content[]? | select(.type == "text") | .text]
    | any(test($t))
  ' "$file" 2>/dev/null || echo "false"
}

# Extract all assistant text (final output)
jsonl_all_text() {
  local file="$1"
  jq -j '
    select(.type == "message_end" and .message.role == "assistant")
    | .message.content[]? | select(.type == "text") | .text
  ' "$file" 2>/dev/null || echo ""
}

# Count subagent status/polling calls specifically
jsonl_status_polls() {
  local file="$1"
  jq -s '
    [.[] | select(.type == "tool_execution_end" and .toolName == "subagent")
     | select(.args | tostring | test("status"))]
    | length
  ' "$file" 2>/dev/null || echo 0
}

# --- Artifact service helpers ---

# Count artifacts matching filters
artifact_count() {
  local query="$1"
  curl -sf "$ARTIFACT_URL/artifacts?$query&limit=200" 2>/dev/null \
    | jq 'length' 2>/dev/null || echo 0
}

# Get artifacts as JSON array
artifact_list() {
  local query="${1:-limit=50}"
  curl -sf "$ARTIFACT_URL/artifacts?$query" 2>/dev/null || echo '[]'
}

# Get artifact content by ID (qa agent has read-all RBAC access)
artifact_content() {
  local id="$1"
  curl -sf -H "x-agent-name: qa" "$ARTIFACT_URL/artifacts/$id" 2>/dev/null || echo ""
}

# Count structured findings in JSONL artifact(s)
# Uses Node.js helper to avoid bash pipe/stdin issues with curl loops
artifact_findings_count() {
  local query="${1:-artifact_type=dataset}"
  node "$SCRIPT_DIR/artifact-query.mjs" findings_count "$query" 2>/dev/null || echo 0
}

# Snapshot artifact count (call before test, compare after)
artifact_snapshot() {
  curl -sf "$ARTIFACT_URL/artifacts?limit=1000" 2>/dev/null \
    | jq 'length' 2>/dev/null || echo 0
}

# New artifacts since snapshot
artifacts_since() {
  local before="$1"
  local after
  after=$(artifact_snapshot)
  echo $((after - before))
}

# --- Agent health ---

require_agents() {
  echo "Checking agent health..."
  local agents=("$RESEARCHER_URL" "$DATA_URL" "$WRITER_URL")
  local names=("researcher" "data" "writer")
  local max_wait=90
  for i in "${!agents[@]}"; do
    local elapsed=0
    local status="unknown"
    while [ "$elapsed" -lt "$max_wait" ]; do
      status=$(curl -sf "${agents[$i]}/health" 2>/dev/null | jq -r '.status // "unreachable"')
      if [ "$status" = "ok" ]; then break; fi
      sleep 3
      elapsed=$((elapsed + 3))
    done
    if [ "$status" != "ok" ]; then
      echo "[FATAL] ${names[$i]} not healthy at ${agents[$i]} after ${max_wait}s (status=$status)"
      exit 1
    fi
  done
  echo "  All agents healthy."
}

# --- Report generation ---

write_report() {
  local file="$1"
  shift
  cat > "$file" <<EOF
$@
EOF
  echo "Report: $file"
}
