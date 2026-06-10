#!/usr/bin/env bash
# E2E-53: Writer Style Tools — permission and extension validation
# Tests that writer agent has proper permissions for writing-style extension tools
# and that all required data and extension files exist.
#
# Static test — no containers required.
set -euo pipefail

_PASS=0 _FAIL=0 _TOTAL=0

pass() { ((_TOTAL++)) || true; ((_PASS++)) || true; printf "  ✓ %s\n" "$1"; }
fail() { ((_TOTAL++)) || true; ((_FAIL++)) || true; printf "  ✗ %s\n" "$1"; }

WRITER_PERMS="src/agents/writer/.pi/agent/pi-permissions.jsonc"
SECTION_WRITER="src/agents/writer/.pi/agents/section-writer.md"
EXT_DIR="src/agents/extensions/writing-style"
DATA_DIR="src/agents/data/style"

echo ""
echo "=== E2E-53: Writer Style Tools ==="
echo ""

# ─── A: Permission checks ───
echo "--- A: Writer permissions include style tools ---"

STYLE_TOOLS=("validate_style" "fix_violations" "vale_lint" "load_style_profile" "analyze_writing_samples" "get_style_instructions")

for tool in "${STYLE_TOOLS[@]}"; do
  if grep -q "\"$tool\"" "$WRITER_PERMS" 2>/dev/null; then
    if grep "\"$tool\"" "$WRITER_PERMS" | grep -q "allow"; then
      pass "A: $tool permitted in writer"
    else
      fail "A: $tool present but not allowed in writer"
    fi
  else
    fail "A: $tool missing from writer permissions"
  fi
done

# ─── B: Section-writer has style tools ───
echo ""
echo "--- B: Section-writer tool access ---"

if grep -q "validate_style" "$SECTION_WRITER" 2>/dev/null; then
  pass "B1: section-writer has validate_style"
else
  fail "B1: section-writer missing validate_style"
fi

if grep -q "fix_violations" "$SECTION_WRITER" 2>/dev/null; then
  pass "B2: section-writer has fix_violations"
else
  fail "B2: section-writer missing fix_violations"
fi

if grep -q "get_style_instructions" "$SECTION_WRITER" 2>/dev/null; then
  pass "B3: section-writer has get_style_instructions"
else
  fail "B3: section-writer missing get_style_instructions"
fi

# ─── C: Extension files exist ───
echo ""
echo "--- C: Writing-style extension files ---"

for f in index.ts lint.ts profile.ts metrics.ts; do
  if [[ -f "$EXT_DIR/$f" ]]; then
    pass "C: $EXT_DIR/$f exists"
  else
    fail "C: $EXT_DIR/$f missing"
  fi
done

# ─── D: Extension registers tools ───
echo ""
echo "--- D: Extension tool registration ---"

for tool in validate_style fix_violations load_style_profile get_style_instructions analyze_writing_samples; do
  if grep -rq "name.*['\"]$tool['\"]" "$EXT_DIR/" 2>/dev/null; then
    pass "D: $tool registered in extension code"
  else
    fail "D: $tool not found in extension registration"
  fi
done

if grep -q "vale_lint" "$EXT_DIR/lint.ts" 2>/dev/null; then
  pass "D: vale_lint conditionally registered (requires Vale binary)"
else
  fail "D: vale_lint not found in lint.ts"
fi

# ─── E: Style data files exist ───
echo ""
echo "--- E: Style data files ---"

for f in default-profile.json excess-words.json platforms.json formulas.json; do
  if [[ -f "$DATA_DIR/$f" ]]; then
    pass "E: $DATA_DIR/$f exists"
  else
    fail "E: $DATA_DIR/$f missing"
  fi
done

# ─── Summary ───
echo ""
echo "=== Results: $_PASS/$_TOTAL passed, $_FAIL failed ==="
[[ $_FAIL -eq 0 ]] && exit 0 || exit 1
