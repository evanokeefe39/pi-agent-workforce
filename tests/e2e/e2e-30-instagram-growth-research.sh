#!/usr/bin/env bash
# E2E-30: Instagram Growth Strategy Research (via Planner)
# Sends goal to planner agent, which decomposes, delegates to researcher + writer,
# and manages quality. Produces play-by-play + LLM-as-judge quality assessment.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/jsonl-helpers.sh"
TEST_ID="e2e-30"
REPORT="$RESULTS_DIR/e2e-30-$(date +%Y%m%d-%H%M%S).md"

echo "=== E2E-30: Instagram Growth Strategy Research (Planner) ==="
require_agents

# Check planner health
echo "Checking planner health..."
PLANNER_STATUS=$(curl -sf "$PLANNER_URL/health" 2>/dev/null | jq -r '.status // "unreachable"')
if [ "$PLANNER_STATUS" != "ok" ]; then
  echo "[FATAL] Planner not healthy at $PLANNER_URL (status=$PLANNER_STATUS)"
  exit 1
fi
echo "  Planner healthy."

SNAP_BEFORE=$(artifact_snapshot)
START_TIME=$SECONDS

# --- Single goal to planner — it handles decomposition + delegation ---
echo ""; echo "--- Sending goal to planner ---"

RESULT_FILE=$(planner_run 'I want to grow a new Instagram account from 0 to 10,000 followers using faceless content. My niche is tech, AI, vibe coding, social media growth, software development, creative software development, and adjacent trends (tech layoffs, data center controversies, tech sovereignty, global mobility, lifestyle, opinion, tech culture, terminally online culture).

Produce a comprehensive, actionable research report I can execute on immediately. I need to understand what works, what does not, who is succeeding, and what strategy I should follow. The report should include source citations and confidence levels so I can fact-check the findings.' 1800 goal)

TOTAL_DURATION=$((SECONDS - START_TIME))
echo "  Total duration: ${TOTAL_DURATION}s"

# --- Extract planner result ---
PLANNER_OUTPUT=$(jq -r '.output // ""' "$RESULT_FILE" 2>/dev/null)
PLANNER_MODEL=$(jq -r '.model // "unknown"' "$RESULT_FILE" 2>/dev/null)
PLANNER_TURNS=$(jq -r '.usage.turns // 0' "$RESULT_FILE" 2>/dev/null)
PLANNER_INPUT_TOKENS=$(jq -r '.usage.input // 0' "$RESULT_FILE" 2>/dev/null)
PLANNER_OUTPUT_TOKENS=$(jq -r '.usage.output // 0' "$RESULT_FILE" 2>/dev/null)
PLANNER_STATE=$(jq -r '.state // "unknown"' "$RESULT_FILE" 2>/dev/null)

# Save planner output for review
echo "$PLANNER_OUTPUT" > "$RESULTS_DIR/e2e-30-planner-output.txt"
echo "  Planner state: $PLANNER_STATE"
echo "  Planner model: $PLANNER_MODEL"
echo "  Planner turns: $PLANNER_TURNS ($PLANNER_INPUT_TOKENS in / $PLANNER_OUTPUT_TOKENS out)"

# --- Analyze artifacts ---
echo ""; echo "--- Analyzing Results ---"

NEW_ARTIFACTS=$(artifacts_since "$SNAP_BEFORE")
ALL=$(artifact_list "limit=$((NEW_ARTIFACTS + 20))")
RESEARCH_ARTS=$(echo "$ALL" | jq '[.[] | select(.artifact_type == "research")] | length')
DATASET_ARTS=$(echo "$ALL" | jq '[.[] | select(.artifact_type == "dataset")] | length')
REPORT_ARTS=$(echo "$ALL" | jq '[.[] | select(.artifact_type == "report")] | length')
BRIEF_ARTS=$(echo "$ALL" | jq '[.[] | select(.artifact_type == "brief")] | length')
RESEARCHER_ARTS=$(echo "$ALL" | jq '[.[] | select(.agent_name == "researcher")] | length')
WRITER_ARTS=$(echo "$ALL" | jq '[.[] | select(.agent_name == "writer")] | length')
TOTAL_FINDINGS=$(artifact_findings_count "artifact_type=dataset")

# Agent run metrics
R_COMPLETED=$(curl -sf "http://localhost:8082/metrics" 2>/dev/null | jq -r '.runs_completed // 0')
W_COMPLETED=$(curl -sf "http://localhost:8084/metrics" 2>/dev/null | jq -r '.runs_completed // 0')

# --- Researcher container tool usage ---
RESEARCHER_LOGS=$(docker logs pi-agent-workforce-researcher-1 2>&1 || true)
R_WEB_SEARCHES=$(echo "$RESEARCHER_LOGS" | grep -c 'web_search' || true)
R_SCRAPES=$(echo "$RESEARCHER_LOGS" | grep -c 'scrape_apify' || true)
R_FINDINGS_RECORDED=$(echo "$RESEARCHER_LOGS" | grep -c 'record_finding' || true)
R_ARTIFACTS_WRITTEN=$(echo "$RESEARCHER_LOGS" | grep -c 'write_artifact' || true)
R_DEEP_RESEARCH=$(echo "$RESEARCHER_LOGS" | grep -c 'deep_research' || true)

# --- Planner container logs (delegation decisions) ---
PLANNER_LOGS=$(docker logs pi-agent-workforce-planner-1 2>&1 || echo "")
P_REQUESTS=$(echo "$PLANNER_LOGS" | grep -c 'request_complete' || true)

echo ""
echo "  === PLAY-BY-PLAY ==="
echo "  Planner: $PLANNER_TURNS turns, model=$PLANNER_MODEL, state=$PLANNER_STATE"
echo "  Duration: ${TOTAL_DURATION}s"
echo ""
echo "  Researcher Activity (container logs):"
echo "    web_search: $R_WEB_SEARCHES"
echo "    scrape_apify: $R_SCRAPES"
echo "    deep_research: $R_DEEP_RESEARCH"
echo "    record_finding: $R_FINDINGS_RECORDED"
echo "    write_artifact: $R_ARTIFACTS_WRITTEN"
echo ""
echo "  Agent completions: researcher=$R_COMPLETED, writer=$W_COMPLETED"
echo ""
echo "  Artifacts: $NEW_ARTIFACTS total"
echo "    Research: $RESEARCH_ARTS | Dataset: $DATASET_ARTS | Report: $REPORT_ARTS | Brief: $BRIEF_ARTS"
echo "    By researcher: $RESEARCHER_ARTS | By writer: $WRITER_ARTS"
echo "    Structured findings: $TOTAL_FINDINGS"

# --- Extract and display the final report ---
# Prefer writer report, fall back to researcher report
FINAL_REPORT_ID=$(echo "$ALL" | jq -r '([.[] | select(.agent_name == "writer" and .artifact_type == "report")][0].id // empty)' 2>/dev/null)
if [ -z "$FINAL_REPORT_ID" ]; then
  FINAL_REPORT_ID=$(echo "$ALL" | jq -r '([.[] | select(.artifact_type == "report")][0].id // empty)' 2>/dev/null)
fi

FINAL_REPORT_CONTENT=""
REPORT_WORD_COUNT=0
REPORT_SECTION_COUNT=0
REPORT_CITATION_COUNT=0
if [ -n "$FINAL_REPORT_ID" ]; then
  FINAL_REPORT_CONTENT=$(artifact_content "$FINAL_REPORT_ID")
  REPORT_WORD_COUNT=$(echo "$FINAL_REPORT_CONTENT" | wc -w | tr -d ' ')
  REPORT_SECTION_COUNT=$(echo "$FINAL_REPORT_CONTENT" | grep -c '^##' || true)
  REPORT_CITATION_COUNT=$(echo "$FINAL_REPORT_CONTENT" | grep -coE 'https?://[^ ]+' || true)
  echo ""
  echo "  Report Stats:"
  echo "    Words: $REPORT_WORD_COUNT"
  echo "    Sections (##): $REPORT_SECTION_COUNT"
  echo "    URL citations: $REPORT_CITATION_COUNT"
fi

# --- Extract findings for source analysis ---
FINDINGS_CONTENT=""
FINDINGS_IDS=$(echo "$ALL" | jq -r '[.[] | select(.artifact_type == "dataset")][].id // empty' 2>/dev/null || echo "")
SOURCE_URLS=0
UNIQUE_DOMAINS=0
if [ -n "$FINDINGS_IDS" ]; then
  for fid in $FINDINGS_IDS; do
    FC=$(artifact_content "$fid")
    FINDINGS_CONTENT="${FINDINGS_CONTENT}${FC}"$'\n'
  done
  SOURCE_URLS=$(echo "$FINDINGS_CONTENT" | grep -coE '"url"\s*:\s*"https?://[^"]+' || true)
  UNIQUE_DOMAINS=$(echo "$FINDINGS_CONTENT" | grep -oE '"url"\s*:\s*"https?://[^"/]+' 2>/dev/null | sort -u | wc -l | tr -d ' ')
  echo "  Source Analysis:"
  echo "    Source URLs in findings: $SOURCE_URLS"
  echo "    Unique domains: $UNIQUE_DOMAINS"
fi

# --- LLM-as-Judge quality assessment ---
echo ""; echo "--- LLM-as-Judge Quality Assessment ---"

JUDGE_RESULT=""
if [ -n "$FINAL_REPORT_CONTENT" ] && [ "${#FINAL_REPORT_CONTENT}" -gt 100 ]; then
  TRUNCATED_REPORT=$(echo "$FINAL_REPORT_CONTENT" | head -c 8000)
  TRUNCATED_PLAN=$(echo "$PLANNER_OUTPUT" | head -c 2000)

  JUDGE_PROMPT="You are a quality assessor. You will evaluate both the PLAN the planner agent communicated and the REPORT that was produced.

=== PLANNER OUTPUT (what the coordinating agent said/decided) ===
$TRUNCATED_PLAN

=== FINAL REPORT (first 8000 chars of what was produced) ===
$TRUNCATED_REPORT

=== EVALUATION ===

PART A — Plan Quality (1-10 each):
1. PLAN SPECIFICITY — Did the planner articulate concrete requirements for delegation?
2. PLAN COVERAGE — Did the planner identify the right dimensions to research for this goal?
3. PLAN FEASIBILITY — Was the delegation realistic?

PART B — Report Quality (1-10 each):
4. ACTIONABILITY — Can someone execute on this immediately? Specific tactics, not vague advice?
5. EVIDENCE QUALITY — Are claims backed by data, citations, or named examples?
6. NICHE SPECIFICITY — Is this specific to faceless tech/AI content, or generic Instagram advice?
7. COMPLETENESS — Does it cover formats, algorithm, growth tactics, monetization, tools, case studies?
8. SOURCE DIVERSITY — Multiple source types (profiles, articles, case studies) or single-source?

PART C — Plan vs Output Alignment:
9. PLAN FULFILLMENT — Did the report deliver on what the plan required?
10. EMERGENT VALUE — Did the report surface insights beyond what was requested?

Output format (exactly):
PLAN_SPECIFICITY: [1-10] — [one sentence]
PLAN_COVERAGE: [1-10] — [one sentence]
PLAN_FEASIBILITY: [1-10] — [one sentence]
ACTIONABILITY: [1-10] — [one sentence]
EVIDENCE: [1-10] — [one sentence]
SPECIFICITY: [1-10] — [one sentence]
COMPLETENESS: [1-10] — [one sentence]
SOURCES: [1-10] — [one sentence]
PLAN_FULFILLMENT: [1-10] — [one sentence]
EMERGENT_VALUE: [1-10] — [one sentence]
OVERALL: [1-10] — [one sentence verdict]
STRONGEST: [what the system does best]
WEAKEST: [biggest gap or improvement needed]
PLAN_GAPS: [what the plan missed]
EXECUTION_GAPS: [what was planned but not delivered]"

  JUDGE_EVENTS=$(pi_run "$JUDGE_PROMPT" 120 judge)
  JUDGE_RESULT=$(jsonl_all_text "$JUDGE_EVENTS")
  echo "$JUDGE_RESULT"
else
  echo "  [SKIP] No report content to judge"
  JUDGE_RESULT="No report produced — cannot assess quality"
fi

# --- Assertions ---
echo ""; echo "--- Assertions ---"

# Timing
assert_le "total < 20 minutes" "$TOTAL_DURATION" 1200
assert_eq "planner completed" "$PLANNER_STATE" "completed"

# Research output
assert_ge ">= 1 dataset artifact" "$DATASET_ARTS" 1
assert_ge ">= 10 structured findings" "$TOTAL_FINDINGS" 10

# Report output
assert_ge ">= 1 report artifact" "$REPORT_ARTS" 1

# Quality gates (if report exists)
if [ -n "$FINAL_REPORT_ID" ]; then
  assert_ge "report >= 500 words" "$REPORT_WORD_COUNT" 500
  assert_ge "report >= 3 sections" "$REPORT_SECTION_COUNT" 3
fi

# Agent participation
assert_ge "researcher completed >= 1 run" "$R_COMPLETED" 1

summary

# --- Write detailed report ---
write_report "$REPORT" "# E2E-30: Instagram Growth Strategy Research (Planner)

**Date:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Result:** $_PASS/$_TESTS passed, $_FAIL failed
**Total Duration:** ${TOTAL_DURATION}s
**Planner Model:** $PLANNER_MODEL

## Play-by-Play

### Planner
| Metric | Value |
|--------|-------|
| State | $PLANNER_STATE |
| Model | $PLANNER_MODEL |
| Turns | $PLANNER_TURNS |
| Input tokens | $PLANNER_INPUT_TOKENS |
| Output tokens | $PLANNER_OUTPUT_TOKENS |

### Researcher (container logs)
| Tool | Mentions |
|------|----------|
| web_search | $R_WEB_SEARCHES |
| scrape_apify | $R_SCRAPES |
| deep_research | $R_DEEP_RESEARCH |
| record_finding | $R_FINDINGS_RECORDED |
| write_artifact | $R_ARTIFACTS_WRITTEN |

### Agent Completions
| Agent | Runs Completed |
|-------|---------------|
| Researcher | $R_COMPLETED |
| Writer | $W_COMPLETED |

## Artifacts Produced
| Type | Count |
|------|-------|
| Research | $RESEARCH_ARTS |
| Dataset | $DATASET_ARTS |
| Report | $REPORT_ARTS |
| Brief | $BRIEF_ARTS |
| Total new | $NEW_ARTIFACTS |

By agent: researcher=$RESEARCHER_ARTS, writer=$WRITER_ARTS

## Research Quality
| Metric | Value | Target |
|--------|-------|--------|
| Structured findings | $TOTAL_FINDINGS | >= 10 |
| Source URLs | $SOURCE_URLS | — |
| Unique domains | $UNIQUE_DOMAINS | — |

## Report Quality
| Metric | Value | Target |
|--------|-------|--------|
| Word count | $REPORT_WORD_COUNT | >= 500 |
| Sections | $REPORT_SECTION_COUNT | >= 3 |
| URL citations | $REPORT_CITATION_COUNT | — |

## LLM-as-Judge Assessment
\`\`\`
$JUDGE_RESULT
\`\`\`

## Planner Output
<details>
<summary>Click to expand planner reasoning and decisions</summary>

$PLANNER_OUTPUT

</details>

## Final Report Content
<details>
<summary>Click to expand full report</summary>

$FINAL_REPORT_CONTENT

</details>

## Raw Findings Data
<details>
<summary>Click to expand structured findings</summary>

\`\`\`jsonl
$FINDINGS_CONTENT
\`\`\`

</details>"
