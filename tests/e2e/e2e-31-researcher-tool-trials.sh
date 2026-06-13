#!/usr/bin/env bash
# E2E-31: Researcher Tool Usage Trials
# Sends identical task directly to researcher agent, varying model and system prompt.
# Measures: did it use record_finding? did it use scrape_apify/list_actors?
# Short task — 3 Instagram accounts, should take 2-5 min per trial.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/jsonl-helpers.sh"
TEST_ID="e2e-31"
REPORT="$RESULTS_DIR/e2e-31-$(date +%Y%m%d-%H%M%S).md"

echo "=== E2E-31: Researcher Tool Usage Trials ==="
require_agents

TASK='Research 3 faceless Instagram accounts in the tech/AI niche. For each account:
- Get their profile metrics (follower count, post count, engagement rate)
- Identify their content format (carousels, reels, static posts)
- Note their posting frequency

Record each account as a separate finding via record_finding. Publish all findings as JSONL via publish_artifact with type dataset.'

# --- Helper: run one trial against researcher directly ---
run_trial() {
  local trial_name="$1"
  local trial_start=$SECONDS

  echo ""
  echo "--- Trial: $trial_name ---"

  # Snapshot artifacts before
  local snap_before
  snap_before=$(artifact_snapshot)

  # POST directly to researcher
  local invoke_resp
  invoke_resp=$(curl -sf -X POST "$RESEARCHER_URL/invoke" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg t "$TASK" '{task: $t}')")

  local run_id
  run_id=$(echo "$invoke_resp" | jq -r '.runId // empty')

  if [ -z "$run_id" ]; then
    echo "  [FAIL] invoke failed"
    return
  fi

  # Poll until done (5 min max)
  local elapsed=0
  while [ "$elapsed" -lt 300 ]; do
    sleep 5
    elapsed=$((elapsed + 5))
    local state
    state=$(curl -sf "$RESEARCHER_URL/status/$run_id" | jq -r '.state // "unknown"')
    if [ "$state" != "running" ] && [ "$state" != "queued" ]; then break; fi
  done

  # Get result
  local result
  result=$(curl -sf "$RESEARCHER_URL/result/$run_id")
  local state model turns input_tok output_tok duration
  state=$(echo "$result" | jq -r '.state // "unknown"')
  model=$(echo "$result" | jq -r '.model // "unknown"')
  turns=$(echo "$result" | jq -r '.usage.turns // 0')
  input_tok=$(echo "$result" | jq -r '.usage.input // 0')
  output_tok=$(echo "$result" | jq -r '.usage.output // 0')
  local trial_duration=$((SECONDS - trial_start))

  # Count new artifacts
  local new_arts
  new_arts=$(artifacts_since "$snap_before")
  local all_new
  all_new=$(artifact_list "limit=$((new_arts + 5))")
  local dataset_count research_count
  dataset_count=$(echo "$all_new" | jq '[.[] | select(.artifact_type == "dataset")] | length')
  research_count=$(echo "$all_new" | jq '[.[] | select(.artifact_type == "research")] | length')

  # Count findings in any new dataset artifacts
  local findings_count=0
  local dataset_ids
  dataset_ids=$(echo "$all_new" | jq -r '[.[] | select(.artifact_type == "dataset")][].id // empty' || true)
  if [ -n "$dataset_ids" ]; then
    for did in $dataset_ids; do
      local fc
      fc=$(artifact_content "$did" | grep -c '"claim"\|"finding"' || true)
      findings_count=$((findings_count + fc))
    done
  fi

  # Check researcher logs for tool usage (only lines since this trial started)
  local logs
  logs=$(docker logs pi-agent-workforce-researcher-1 2>&1 || true)
  local used_record_finding used_scrape_apify used_list_actors used_web_search
  # Count from the request_complete for this specific run
  used_record_finding=$(echo "$result" | jq -r '.output // ""' | grep -ci 'record_finding' || true)
  used_scrape_apify=$(echo "$result" | jq -r '.output // ""' | grep -ci 'scrape_apify\|apify' || true)
  used_list_actors=$(echo "$result" | jq -r '.output // ""' | grep -ci 'list_actors' || true)
  used_web_search=$(echo "$result" | jq -r '.output // ""' | grep -ci 'web_search' || true)

  # Determine pass/fail
  local pf_findings="FAIL"
  local pf_apify="FAIL"
  if [ "$findings_count" -gt 0 ] || [ "$dataset_count" -gt 0 ]; then pf_findings="PASS"; fi
  if [ "$used_scrape_apify" -gt 0 ]; then pf_apify="PASS"; fi

  echo "  State: $state | Model: $model | Turns: $turns | ${trial_duration}s"
  echo "  Tokens: ${input_tok}in / ${output_tok}out"
  echo "  Artifacts: $new_arts (dataset=$dataset_count, research=$research_count)"
  echo "  Structured findings: $findings_count"
  echo "  Output mentions: record_finding=$used_record_finding, scrape_apify=$used_scrape_apify, list_actors=$used_list_actors, web_search=$used_web_search"
  echo "  STRUCTURED FINDINGS: $pf_findings | APIFY USAGE: $pf_apify"

  # Save result for report
  echo "$result" > "$RESULTS_DIR/e2e-31-${trial_name}.json"

  # Append to report data
  printf "| %s | %s | %s | %s | %ss | %s | %s | %s | %s |\n" \
    "$trial_name" "$model" "$turns" "$state" "$trial_duration" \
    "$findings_count" "$pf_findings" "$pf_apify" "${input_tok}/${output_tok}" \
    >> "$RESULTS_DIR/e2e-31-trials.tsv"
}

# --- Initialize ---
echo "" > "$RESULTS_DIR/e2e-31-trials.tsv"

# --- Trial 1: Baseline (current config — MiniMax primary, deepseek-chat fallback) ---
run_trial "baseline"

# --- Trial 2: Force deepseek-chat (skip MiniMax) ---
# Swap researcher config to deepseek-chat as primary
docker exec pi-agent-workforce-researcher-1 sh -c "
  sed -i 's/agentic: minimax\/MiniMax-M2.7/agentic: deepseek\/deepseek-chat/' /root/.pi/agent/config.yml
" 2>/dev/null || true
run_trial "deepseek-chat-forced"

# --- Trial 3: Force deepseek-reasoner (strongest instruction follower) ---
docker exec pi-agent-workforce-researcher-1 sh -c "
  sed -i 's/agentic: deepseek\/deepseek-chat/agentic: deepseek\/deepseek-reasoner/' /root/.pi/agent/config.yml
" 2>/dev/null || true
run_trial "deepseek-reasoner"

# --- Trial 4: Revert model, modify system prompt — move constraints to top ---
docker exec pi-agent-workforce-researcher-1 sh -c "
  sed -i 's/agentic: deepseek\/deepseek-reasoner/agentic: minimax\/MiniMax-M2.7/' /root/.pi/agent/config.yml
" 2>/dev/null || true

# Prepend critical instructions to AGENTS.md
docker exec pi-agent-workforce-researcher-1 sh -c "
cat > /tmp/prepend.md << 'PREPEND'
# CRITICAL WORKFLOW — READ FIRST

You MUST follow this workflow for EVERY research task:

1. For social media profiles: call list_actors to find scrapers, then scrape_apify for first-party data
2. Record EVERY factual claim via record_finding with ADMIRALTY grades
3. When done: query_findings → get_finding for each → publish_artifact as JSONL (type dataset)

Do NOT skip these steps. Do NOT write markdown reports instead of structured findings.

---

PREPEND
cat /tmp/prepend.md /root/.pi/agent/AGENTS.md > /tmp/agents_new.md
cp /tmp/agents_new.md /root/.pi/agent/AGENTS.md
" 2>/dev/null || true
run_trial "prompt-constraints-top"

# --- Trial 5: deepseek-reasoner + prompt constraints at top ---
docker exec pi-agent-workforce-researcher-1 sh -c "
  sed -i 's/agentic: minimax\/MiniMax-M2.7/agentic: deepseek\/deepseek-reasoner/' /root/.pi/agent/config.yml
" 2>/dev/null || true
run_trial "reasoner-plus-prompt"

# --- Restore original config ---
docker cp src/agents/researcher/.pi/agent/config.yml pi-agent-workforce-researcher-1:/root/.pi/agent/config.yml 2>/dev/null || true
docker cp src/agents/researcher/.pi/agent/AGENTS.md pi-agent-workforce-researcher-1:/root/.pi/agent/AGENTS.md 2>/dev/null || true

# --- Report ---
echo ""
echo "=== Trial Results ==="
echo "| Trial | Model | Turns | State | Duration | Findings | Structured | Apify | Tokens |"
echo "|-------|-------|-------|-------|----------|----------|------------|-------|--------|"
cat "$RESULTS_DIR/e2e-31-trials.tsv"

write_report "$REPORT" "# E2E-31: Researcher Tool Usage Trials

**Date:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Task:** Research 3 faceless Instagram accounts — record findings, use Apify for profile data

## Trial Results

| Trial | Model | Turns | State | Duration | Findings | Structured | Apify | Tokens |
|-------|-------|-------|-------|----------|----------|------------|-------|--------|
$(cat "$RESULTS_DIR/e2e-31-trials.tsv")

## Hypotheses Tested

1. **baseline** — current config (MiniMax primary → deepseek-chat fallback). Establishes whether current setup uses record_finding or scrape_apify.
2. **deepseek-chat-forced** — isolate deepseek-chat behavior. If same as baseline, confirms model is the variable (not fallback timing).
3. **deepseek-reasoner** — strongest instruction follower. If this uses record_finding + scrape_apify, model capability is the root cause.
4. **prompt-constraints-top** — same model as baseline but CRITICAL WORKFLOW section prepended to AGENTS.md. Tests if prompt position matters.
5. **reasoner-plus-prompt** — best model + best prompt. Expected highest compliance. If this fails too, the tool descriptions or workflow is the issue.

## Diagnosis

If reasoner passes but others fail → model capability issue → change default model for research tasks.
If prompt-top passes but baseline fails → prompt structure issue → restructure AGENTS.md.
If all fail → tool description or workflow complexity issue → simplify the record_finding pipeline.
If reasoner-plus-prompt is the only pass → need both better model AND better prompt."
