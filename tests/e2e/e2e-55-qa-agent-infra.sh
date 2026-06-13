#!/usr/bin/env bash
# E2E-55: QA Agent Infrastructure Validation
# Tests structural correctness of QA agent configuration:
#   A: QA evaluation skills (5 tests)
#   B: QA agent core config (5 tests)
#   C: Docker integration (4 tests)
#   D: Planner integration (3 tests)
# No running containers required — all tests are file/config checks.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/jsonl-helpers.sh"
TEST_ID="e2e-55"

AGENTS="$REPO_ROOT/src/agents"
QA="$AGENTS/qa"
QA_PI="$QA/.pi/agent"
SKILLS="$AGENTS/skills"
DOCKERFILE="$AGENTS/Dockerfile"
COMPOSE="$REPO_ROOT/docker-compose.yml"
PLANNER="$AGENTS/planner/.pi/agent"

echo "=== E2E-55: QA Agent Infrastructure ==="
echo "  Repo: $REPO_ROOT"

# ============================================================
# TEST A: QA Evaluation Skills (5 tests)
# ============================================================
echo ""; echo "--- Test A: QA Evaluation Skills ---"

for skill in content-quality-audit platform-compliance-audit brand-compliance-audit research-quality-audit publish-readiness-audit; do
  SKILL_FILE="$QA_PI/skills/$skill/SKILL.md"
  if [ -f "$SKILL_FILE" ] && grep -q "name: $skill" "$SKILL_FILE"; then
    pass "A: $skill SKILL.md exists with correct name"
  else
    fail "A: $skill SKILL.md missing or wrong name"
  fi
done

# ============================================================
# TEST B: QA Agent Core Config (5 tests)
# ============================================================
echo ""; echo "--- Test B: QA Agent Core Config ---"

# B1: AGENTS.md >= 100 lines
AGENTS_MD="$QA_PI/AGENTS.md"
if [ -f "$AGENTS_MD" ]; then
  LINES=$(wc -l < "$AGENTS_MD")
  if [ "$LINES" -ge 100 ]; then
    pass "B1: QA AGENTS.md has $LINES lines (>=100)"
  else
    fail "B1: QA AGENTS.md only $LINES lines (need >=100)"
  fi
else
  fail "B1: QA AGENTS.md not found"
fi

# B2: AGENTS.md documents verdict scale
if grep -q "exemplary" "$AGENTS_MD" && grep -q "catastrophic" "$AGENTS_MD" && grep -q "needs_revision" "$AGENTS_MD"; then
  pass "B2: AGENTS.md documents verdict scale (exemplary to catastrophic)"
else
  fail "B2: AGENTS.md missing verdict scale levels"
fi

# B3: workproduct.ts has record_violation and record_commendation
WP="$QA_PI/extensions/workproduct.ts"
if grep -q "record_violation" "$WP" && grep -q "record_commendation" "$WP"; then
  pass "B3: workproduct.ts has record_violation and record_commendation"
else
  fail "B3: workproduct.ts missing evaluation tools"
fi

# B4: agent.json has validation config
AJ="$QA/agent.json"
if jq -e '.runtimeConfig.validation.maxTurns' "$AJ" > /dev/null 2>&1; then
  MAX_TURNS=$(jq -r '.runtimeConfig.validation.maxTurns' "$AJ")
  pass "B4: agent.json has validation config (maxTurns=$MAX_TURNS)"
else
  fail "B4: agent.json missing validation config"
fi

# B5: agent.json requiredTools includes evaluation tools
REQ_TOOLS=$(jq -r '.runtimeConfig.validation.requiredTools[]?' "$AJ" 2>/dev/null | tr '\n' ',')
if echo "$REQ_TOOLS" | grep -q "record_violation" && echo "$REQ_TOOLS" | grep -q "publish_artifact"; then
  pass "B5: agent.json requiredTools includes record_violation and publish_artifact"
else
  fail "B5: agent.json requiredTools incomplete: $REQ_TOOLS"
fi

# ============================================================
# TEST C: Docker Integration (4 tests)
# ============================================================
echo ""; echo "--- Test C: Docker Integration ---"

# C1: Dockerfile qa target COPYs 3 shared skills
QA_BLOCK=$(sed -n '/^FROM.*AS qa$/,/^FROM/p' "$DOCKERFILE" | head -n -1)
SKILL_COUNT=0
for sk in brand-guidelines platform-formats content-calendar; do
  if echo "$QA_BLOCK" | grep -q "skills/$sk/"; then
    ((SKILL_COUNT++)) || true
  fi
done
if [ "$SKILL_COUNT" -eq 3 ]; then
  pass "C1: Dockerfile qa target COPYs all 3 shared skills"
else
  fail "C1: Dockerfile qa target only COPYs $SKILL_COUNT/3 shared skills"
fi

# C2: docker-compose has qa service on port 8087
if grep -q 'AGENT_NAME: "qa"' "$COMPOSE" && grep -q '8087:8080' "$COMPOSE"; then
  pass "C2: docker-compose has qa service on port 8087"
else
  fail "C2: docker-compose missing qa service or wrong port"
fi

# C3: docker-compose has qa-workspace volume
if grep -q 'qa-workspace' "$COMPOSE"; then
  pass "C3: docker-compose has qa-workspace volume"
else
  fail "C3: docker-compose missing qa-workspace volume"
fi

# C4: RBAC qa has read all
RBAC="$AGENTS/rbac.json"
if jq -e '.agents.qa.read[0]' "$RBAC" 2>/dev/null | grep -q '\\*\\*'; then
  pass "C4: RBAC qa has read:[\"**\"] (read-all access)"
else
  # Fallback check
  QA_READ=$(jq -r '.agents.qa.read[0]' "$RBAC" 2>/dev/null)
  if [ "$QA_READ" = "**" ]; then
    pass "C4: RBAC qa has read:[\"**\"] (read-all access)"
  else
    fail "C4: RBAC qa read access: $QA_READ"
  fi
fi

# ============================================================
# TEST D: Planner Integration (3 tests)
# ============================================================
echo ""; echo "--- Test D: Planner Integration ---"

# D1: Planner subagent config includes qa
SUBAGENT_CONFIG="$PLANNER/extensions/subagent-http/config.json"
if jq -e '.agents[] | select(.name == "qa")' "$SUBAGENT_CONFIG" > /dev/null 2>&1; then
  QA_URL=$(jq -r '.agents[] | select(.name == "qa") | .url' "$SUBAGENT_CONFIG")
  pass "D1: Planner subagent config includes qa at $QA_URL"
else
  fail "D1: Planner subagent config missing qa agent"
fi

# D2: Planner AGENTS.md has quality gating section
PLANNER_MD="$PLANNER/AGENTS.md"
if grep -qi "quality gating" "$PLANNER_MD" 2>/dev/null; then
  pass "D2: Planner AGENTS.md has quality gating section"
else
  fail "D2: Planner AGENTS.md missing quality gating section"
fi

# D3: Flywheel strategy mentions QA
FLYWHEEL="$PLANNER/skills/content-flywheel-strategy/SKILL.md"
if grep -q "QA" "$FLYWHEEL" 2>/dev/null && grep -qi "gate when" "$FLYWHEEL" 2>/dev/null; then
  pass "D3: Flywheel strategy mentions QA and gate-when heuristic"
else
  fail "D3: Flywheel strategy missing QA references"
fi

# ============================================================
echo ""
summary
