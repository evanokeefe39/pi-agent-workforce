#!/usr/bin/env bash
set -euo pipefail

# Pre-merge validation script.
# Run before creating a PR or merging to master.
#
# Usage:
#   bash scripts/check.sh          # fast checks only (no containers)
#   bash scripts/check.sh --live   # includes live E2E tests (requires Docker)

LIVE=false
if [[ "${1:-}" == "--live" ]]; then
  LIVE=true
fi

PASS=0
FAIL=0
TOTAL=0

run() {
  local label="$1"
  shift
  TOTAL=$((TOTAL + 1))
  echo ""
  echo "── $label ──"
  if "$@"; then
    PASS=$((PASS + 1))
    echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1))
    echo "  ✗ $label"
  fi
}

echo "═══════════════════════════════════════"
echo "  Pre-merge checks"
echo "═══════════════════════════════════════"

# --- Unit tests ---
run "Unit tests (jidoka, rbac, artifact-service)" \
  bun test tests/unit/

# --- Static E2E (no containers) ---
run "E2E-50: Content production infra (32 tests)" \
  bash tests/e2e/e2e-50-content-production-infra.sh

run "E2E-53: Writer style tools (23 tests)" \
  bash tests/e2e/e2e-53-writer-style-tools.sh

run "E2E-55: QA agent infra (17 tests)" \
  bash tests/e2e/e2e-55-qa-agent-infra.sh

# --- Live E2E (requires Docker) ---
if $LIVE; then
  echo ""
  echo "── Live E2E tests (Docker required) ──"

  run "E2E-51: Coder rendering (15 tests)" \
    bash tests/e2e/e2e-51-coder-rendering.sh

  run "E2E-56: QA agent pipeline (6 tests)" \
    bun test tests/e2e/e2e-56-qa-agent-pipeline.test.ts
fi

# --- Summary ---
echo ""
echo "═══════════════════════════════════════"
if [[ $FAIL -eq 0 ]]; then
  echo "  ✓ All $PASS/$TOTAL checks passed"
else
  echo "  ✗ $FAIL/$TOTAL checks failed"
fi
echo "═══════════════════════════════════════"

exit $FAIL
