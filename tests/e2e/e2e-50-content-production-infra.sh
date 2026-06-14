#!/usr/bin/env bash
# E2E-50: Content Production Infrastructure Validation
# Tests structural correctness of 5 specs implemented in the content production sprint:
#   A: Shared skills infrastructure (6 tests)
#   B: Project workspace (5 tests)
#   C: Publisher agent (8 tests)
#   D: Coder rendering capability (8 tests)
#   E: Planner routing hints (5 tests)
# No running containers required — all tests are file/config checks.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/jsonl-helpers.sh"
TEST_ID="e2e-50"

AGENTS="$REPO_ROOT/src/agents"
SKILLS="$AGENTS/skills"
DOCKERFILE="$AGENTS/Dockerfile"
COMPOSE="$REPO_ROOT/docker-compose.yml"
RBAC="$AGENTS/rbac.json"
PROJECT="$REPO_ROOT/project"

echo "=== E2E-50: Content Production Infrastructure ==="
echo "  Repo: $REPO_ROOT"

# ============================================================
# TEST A: Shared Skills Infrastructure (6 tests)
# ============================================================
echo ""; echo "--- Test A: Shared Skills Infrastructure ---"

BG="$SKILLS/brand-guidelines/SKILL.md"
PF="$SKILLS/platform-formats/SKILL.md"

# A1: brand-guidelines exists with correct frontmatter
if [ -f "$BG" ] && grep -q "name: brand-guidelines" "$BG"; then
  pass "A1: brand-guidelines SKILL.md exists with correct name"
else
  fail "A1: brand-guidelines SKILL.md missing or wrong name"
fi

# A2: brand-guidelines has all required sections
A2_MISSING=""
for section in "Color Palette" "Typography" "Voice and Tone" "Visual Identity" "Anti-Patterns"; do
  grep -q "$section" "$BG" 2>/dev/null || A2_MISSING="$A2_MISSING [$section]"
done
if [ -z "$A2_MISSING" ]; then
  pass "A2: brand-guidelines has all 5 required sections"
else
  fail "A2: brand-guidelines missing sections:$A2_MISSING"
fi

# A3: platform-formats exists with correct frontmatter
if [ -f "$PF" ] && grep -q "name: platform-formats" "$PF"; then
  pass "A3: platform-formats SKILL.md exists with correct name"
else
  fail "A3: platform-formats SKILL.md missing or wrong name"
fi

# A4: platform-formats has all required sections
A4_MISSING=""
for section in "Platform Dimension Table" "File Format Constraints" "Safe Zone" "Content Limits" "Render Brief Schema"; do
  grep -q "$section" "$PF" 2>/dev/null || A4_MISSING="$A4_MISSING [$section]"
done
if [ -z "$A4_MISSING" ]; then
  pass "A4: platform-formats has all 5 required sections"
else
  fail "A4: platform-formats missing sections:$A4_MISSING"
fi

# A5: Dockerfile publisher target COPYs both shared skills
if grep -A 10 "AS publisher" "$DOCKERFILE" | grep -q "skills/brand-guidelines/" && \
   grep -A 10 "AS publisher" "$DOCKERFILE" | grep -q "skills/platform-formats/"; then
  pass "A5: Dockerfile publisher target COPYs both shared skills"
else
  fail "A5: Dockerfile publisher target missing shared skill COPY"
fi

# A6: Dockerfile coder target COPYs both shared skills
if grep -A 10 "AS coder" "$DOCKERFILE" | grep -q "skills/brand-guidelines/" && \
   grep -A 10 "AS coder" "$DOCKERFILE" | grep -q "skills/platform-formats/"; then
  pass "A6: Dockerfile coder target COPYs both shared skills"
else
  fail "A6: Dockerfile coder target missing shared skill COPY"
fi

# ============================================================
# TEST B: Project Workspace (5 tests)
# ============================================================
echo ""; echo "--- Test B: Project Workspace ---"

# B1: All 5 subdirectories exist
B1_MISSING=""
for dir in design-system brand templates reference archive; do
  [ -d "$PROJECT/$dir" ] || B1_MISSING="$B1_MISSING [$dir]"
done
if [ -z "$B1_MISSING" ]; then
  pass "B1: project/ has all 5 required subdirectories"
else
  fail "B1: project/ missing subdirectories:$B1_MISSING"
fi

# B2: README documents storage tiers and access model
if [ -f "$PROJECT/README.md" ] && \
   grep -q "Project Workspace" "$PROJECT/README.md" && \
   grep -qi "read.*humans write\|humans write\|read-only" "$PROJECT/README.md"; then
  pass "B2: project/README.md documents workspace and access model"
else
  fail "B2: project/README.md missing or incomplete"
fi

# B3: docker-compose publisher mounts project read-only
if grep -A 30 'AGENT_NAME: "publisher"' "$COMPOSE" | grep -q "./project:/project:ro"; then
  pass "B3: docker-compose publisher mounts ./project:/project:ro"
else
  fail "B3: docker-compose publisher missing project mount"
fi

# B4: docker-compose coder mounts project read-only
if grep -A 30 'AGENT_NAME: "coder"' "$COMPOSE" | grep -q "./project:/project:ro"; then
  pass "B4: docker-compose coder mounts ./project:/project:ro"
else
  fail "B4: docker-compose coder missing project mount"
fi

# B5: docker-compose data mounts project read-only
if grep -A 30 'AGENT_NAME: "data"' "$COMPOSE" | grep -q "./project:/project:ro"; then
  pass "B5: docker-compose data mounts ./project:/project:ro"
else
  fail "B5: docker-compose data missing project mount"
fi

# ============================================================
# TEST C: Publisher Agent (8 tests)
# ============================================================
echo ""; echo "--- Test C: Publisher Agent ---"

PUB_AGENTS="$AGENTS/publisher/.pi/agent/AGENTS.md"
PUB_JSON="$AGENTS/publisher/agent.json"

# C1: AGENTS.md at least 100 lines (was 22-line stub)
if [ -f "$PUB_AGENTS" ]; then
  PUB_LINES=$(wc -l < "$PUB_AGENTS" | tr -d ' ')
  if [ "$PUB_LINES" -ge 100 ]; then
    pass "C1: publisher AGENTS.md has $PUB_LINES lines (≥100)"
  else
    fail "C1: publisher AGENTS.md only $PUB_LINES lines (need ≥100)"
  fi
else
  fail "C1: publisher AGENTS.md not found"
fi

# C2: All 6 pipeline phases present
C2_MISSING=""
for phase in RECEIVE ASSEMBLE CHECKLIST STAGE PUBLISH TRACK; do
  grep -q "$phase" "$PUB_AGENTS" 2>/dev/null || C2_MISSING="$C2_MISSING [$phase]"
done
if [ -z "$C2_MISSING" ]; then
  pass "C2: publisher AGENTS.md has all 6 pipeline phases"
else
  fail "C2: publisher AGENTS.md missing phases:$C2_MISSING"
fi

# C3: Three operating modes documented
C3_COUNT=0
grep -qi "social media assembly" "$PUB_AGENTS" 2>/dev/null && C3_COUNT=$((C3_COUNT + 1))
grep -qi "document packaging" "$PUB_AGENTS" 2>/dev/null && C3_COUNT=$((C3_COUNT + 1))
grep -qi "content brief assembly" "$PUB_AGENTS" 2>/dev/null && C3_COUNT=$((C3_COUNT + 1))
if [ "$C3_COUNT" -eq 3 ]; then
  pass "C3: publisher AGENTS.md documents all 3 operating modes"
else
  fail "C3: publisher AGENTS.md has $C3_COUNT/3 operating modes"
fi

# C4: Rendering delegation with render brief schema
if grep -q "render.brief" "$PUB_AGENTS" 2>/dev/null && \
   grep -q "render_type" "$PUB_AGENTS" 2>/dev/null; then
  pass "C4: publisher AGENTS.md has rendering delegation + render brief schema"
else
  fail "C4: publisher AGENTS.md missing rendering delegation protocol"
fi

# C5: HITL requirement explicit
if grep -qi "never.*without.*approv\|never.*proceed.*without\|never.*publish.*without" "$PUB_AGENTS" 2>/dev/null; then
  pass "C5: publisher AGENTS.md has explicit HITL gating language"
else
  fail "C5: publisher AGENTS.md missing explicit HITL requirement"
fi

# C6: agent.json capabilities mention three modes + HITL
if [ -f "$PUB_JSON" ]; then
  PUB_CAPS=$(jq -r '.capabilities // ""' "$PUB_JSON" 2>/dev/null)
  if echo "$PUB_CAPS" | grep -qi "mode\|HITL\|gating"; then
    pass "C6: publisher agent.json capabilities mention modes/HITL"
  else
    fail "C6: publisher agent.json capabilities missing modes/HITL" "$PUB_CAPS"
  fi
else
  fail "C6: publisher agent.json not found"
fi

# C7: docker-compose publisher service on port 8085
if grep -q '"8085:8080"' "$COMPOSE" 2>/dev/null; then
  pass "C7: docker-compose publisher service on port 8085"
else
  fail "C7: docker-compose publisher not on port 8085"
fi

# C8: RBAC publisher can read writer, coder, data
if [ -f "$RBAC" ]; then
  PUB_READ=$(jq -r '.agents.publisher.read // [] | join(" ")' "$RBAC" 2>/dev/null)
  C8_MISSING=""
  echo "$PUB_READ" | grep -q "writer" || C8_MISSING="$C8_MISSING [writer]"
  echo "$PUB_READ" | grep -q "coder" || C8_MISSING="$C8_MISSING [coder]"
  echo "$PUB_READ" | grep -q "data" || C8_MISSING="$C8_MISSING [data]"
  if [ -z "$C8_MISSING" ]; then
    pass "C8: RBAC publisher reads from writer, coder, data"
  else
    fail "C8: RBAC publisher missing read access:$C8_MISSING"
  fi
else
  fail "C8: rbac.json not found at $RBAC"
fi

# ============================================================
# TEST D: Coder Rendering Capability (8 tests)
# ============================================================
echo ""; echo "--- Test D: Coder Rendering Capability ---"

COD_AGENTS="$AGENTS/coder/.pi/agent/AGENTS.md"
COD_JSON="$AGENTS/coder/agent.json"

# D1: AGENTS.md at least 60 lines (was 20-line stub)
if [ -f "$COD_AGENTS" ]; then
  COD_LINES=$(wc -l < "$COD_AGENTS" | tr -d ' ')
  if [ "$COD_LINES" -ge 60 ]; then
    pass "D1: coder AGENTS.md has $COD_LINES lines (≥60)"
  else
    fail "D1: coder AGENTS.md only $COD_LINES lines (need ≥60)"
  fi
else
  fail "D1: coder AGENTS.md not found"
fi

# D2: Rendering workflow documented
if grep -qi "RECEIVE.*BRIEF\|RENDER.*VERIFY\|SCAFFOLD.*RENDER" "$COD_AGENTS" 2>/dev/null; then
  pass "D2: coder AGENTS.md documents rendering workflow phases"
else
  fail "D2: coder AGENTS.md missing rendering workflow"
fi

# D3: At least 4 render types listed
D3_COUNT=0
for rtype in "arousel" "over image\|cover" "PDF" "resentation\|slides"; do
  grep -qi "$rtype" "$COD_AGENTS" 2>/dev/null && D3_COUNT=$((D3_COUNT + 1))
done
if [ "$D3_COUNT" -ge 4 ]; then
  pass "D3: coder AGENTS.md lists $D3_COUNT render types (≥4)"
else
  fail "D3: coder AGENTS.md only $D3_COUNT/4 render types"
fi

# D4: Design system path reference
if grep -q "/project/design-system/" "$COD_AGENTS" 2>/dev/null; then
  pass "D4: coder AGENTS.md references /project/design-system/"
else
  fail "D4: coder AGENTS.md missing /project/design-system/ reference"
fi

# D5: Dockerfile coder-deps stage with chromium + rendering deps
D5_PASS=true
CODER_DEPS_PKG="$AGENTS/coder-deps/package.json"
grep -q "coder-deps" "$DOCKERFILE" 2>/dev/null || D5_PASS=false
grep -q "chromium" "$DOCKERFILE" 2>/dev/null || D5_PASS=false
grep -q "playwright-core" "$CODER_DEPS_PKG" 2>/dev/null || D5_PASS=false
if [ "$D5_PASS" = true ]; then
  pass "D5: Dockerfile has coder-deps stage with chromium + playwright"
else
  fail "D5: Dockerfile missing coder-deps stage or rendering deps"
fi

# D6: agent.json capabilities mention rendering + design system
if [ -f "$COD_JSON" ]; then
  COD_CAPS=$(jq -r '.capabilities // ""' "$COD_JSON" 2>/dev/null)
  if echo "$COD_CAPS" | grep -qi "rendering\|visual" && \
     echo "$COD_CAPS" | grep -qi "design system"; then
    pass "D6: coder agent.json capabilities mention rendering + design system"
  else
    fail "D6: coder agent.json capabilities incomplete" "$COD_CAPS"
  fi
else
  fail "D6: coder agent.json not found"
fi

# D7: docker-compose coder service on port 8086 with 4G memory
if grep -q '"8086:8080"' "$COMPOSE" 2>/dev/null && \
   grep -A 20 'AGENT_NAME: "coder"' "$COMPOSE" | grep -q "memory: 4G\|memory: 4g"; then
  pass "D7: docker-compose coder on port 8086 with 4G memory limit"
else
  fail "D7: docker-compose coder missing port 8086 or 4G memory"
fi

# D8: RBAC coder can read researcher, writer, publisher
if [ -f "$RBAC" ]; then
  COD_READ=$(jq -r '.agents.coder.read // [] | join(" ")' "$RBAC" 2>/dev/null)
  D8_MISSING=""
  echo "$COD_READ" | grep -q "researcher" || D8_MISSING="$D8_MISSING [researcher]"
  echo "$COD_READ" | grep -q "writer" || D8_MISSING="$D8_MISSING [writer]"
  echo "$COD_READ" | grep -q "publisher" || D8_MISSING="$D8_MISSING [publisher]"
  if [ -z "$D8_MISSING" ]; then
    pass "D8: RBAC coder reads from researcher, writer, publisher"
  else
    fail "D8: RBAC coder missing read access:$D8_MISSING"
  fi
else
  fail "D8: rbac.json not found at $RBAC"
fi

# ============================================================
# TEST E: Planner Routing Hints (5 tests)
# ============================================================
echo ""; echo "--- Test E: Planner Routing Hints ---"

PLN_AGENTS="$AGENTS/planner/.pi/agent/AGENTS.md"
PLN_CONFIG="$AGENTS/planner/.pi/agent/extensions/subagent-http/config.json"

# E1: Content Production Routing section exists
if grep -q "Content Production Routing" "$PLN_AGENTS" 2>/dev/null; then
  pass "E1: planner AGENTS.md has Content Production Routing section"
else
  fail "E1: planner AGENTS.md missing Content Production Routing section"
fi

# E2: Chain table covers at least 5 content types
E2_COUNT=0
for chain in "ext-only social\|Text-only" "visual\|with visuals" "eport.*ebook\|ebook.*report\|Report" "ontent calendar\|calendar.*posting\|posting guide" "ashboard\|analytics view"; do
  grep -qi "$chain" "$PLN_AGENTS" 2>/dev/null && E2_COUNT=$((E2_COUNT + 1))
done
if [ "$E2_COUNT" -ge 5 ]; then
  pass "E2: planner routing table covers $E2_COUNT content types (≥5)"
else
  fail "E2: planner routing table only $E2_COUNT/5 content types"
fi

# E3: Rendering delegation pattern documented
if grep -qi "render.*brief\|rendering delegation" "$PLN_AGENTS" 2>/dev/null && \
   grep -q "Coder" "$PLN_AGENTS" 2>/dev/null; then
  pass "E3: planner AGENTS.md documents rendering delegation pattern"
else
  fail "E3: planner AGENTS.md missing rendering delegation"
fi

# E4: Subagent config has publisher and coder
if [ -f "$PLN_CONFIG" ]; then
  E4_MISSING=""
  jq -r '.agents[].name' "$PLN_CONFIG" 2>/dev/null | grep -q "publisher" || E4_MISSING="$E4_MISSING [publisher]"
  jq -r '.agents[].name' "$PLN_CONFIG" 2>/dev/null | grep -q "coder" || E4_MISSING="$E4_MISSING [coder]"
  if [ -z "$E4_MISSING" ]; then
    pass "E4: subagent config has publisher and coder"
  else
    fail "E4: subagent config missing:$E4_MISSING"
  fi
else
  fail "E4: subagent config not found at $PLN_CONFIG"
fi

# E5: Multi-phase example with parallel and sequential
if grep -qi "Phase 1\|phase 1\|parallel\|sequential" "$PLN_AGENTS" 2>/dev/null && \
   grep -qi "Phase.*parallel\|parallel.*phase\|sequential" "$PLN_AGENTS" 2>/dev/null; then
  pass "E5: planner AGENTS.md has multi-phase example"
else
  fail "E5: planner AGENTS.md missing multi-phase example"
fi

# ============================================================
# Summary
# ============================================================
summary
