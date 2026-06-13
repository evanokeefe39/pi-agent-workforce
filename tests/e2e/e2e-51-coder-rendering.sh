#!/usr/bin/env bash
# E2E-51: Coder Rendering Smoke Test
# Tests:
#   A: Docker toolchain (chromium, playwright, react, esbuild in container)
#   B: Design system mounted and accessible (incl. render.mjs)
#   C: Live render task produces PNG at correct dimensions
#   D: Artifact replication succeeds
# Requires: coder + artifact-service running (docker compose up -d coder)
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/jsonl-helpers.sh"
TEST_ID="e2e-51"
CODER_URL="${CODER_URL:-http://localhost:8086}"

echo "=== E2E-51: Coder Rendering Smoke Test ==="

# ============================================================
# Preflight: wait for coder health
# ============================================================
echo "  Waiting for coder..."
elapsed=0
while [ "$elapsed" -lt 90 ]; do
  status=$(curl -sf "$CODER_URL/health" 2>/dev/null | jq -r '.status // "unreachable"')
  if [ "$status" = "ok" ]; then break; fi
  sleep 3; elapsed=$((elapsed + 3))
done
if [ "$status" != "ok" ]; then
  echo "[FATAL] coder not healthy at $CODER_URL after 90s"
  exit 1
fi
echo "  Coder healthy."

# ============================================================
# TEST A: Docker toolchain (4 tests)
# ============================================================
echo ""; echo "--- Test A: Container Toolchain ---"

CONTAINER=$(docker ps --filter "name=coder" --format '{{.Names}}' | head -1)
if [ -z "$CONTAINER" ]; then
  fail "A0: coder container not found"
  summary; exit 1
fi

# A1: Chromium binary present
CHROMIUM_VER=$(docker exec "$CONTAINER" bash -c 'chromium --version 2>/dev/null || chromium-browser --version 2>/dev/null' 2>/dev/null)
if echo "$CHROMIUM_VER" | grep -qi "chromium"; then
  pass "A1: Chromium present ($CHROMIUM_VER)"
else
  fail "A1: Chromium not found in container"
fi

# A2: playwright-core importable
if docker exec "$CONTAINER" bash -c 'node -e "require(\"playwright-core\"); console.log(\"ok\")"' 2>/dev/null | grep -q "ok"; then
  pass "A2: playwright-core importable"
else
  fail "A2: playwright-core not importable"
fi

# A3: React importable
if docker exec "$CONTAINER" bash -c 'node -e "require(\"react\"); console.log(\"ok\")"' 2>/dev/null | grep -q "ok"; then
  pass "A3: React importable"
else
  fail "A3: React not importable"
fi

# A4: tailwindcss installed
if docker exec "$CONTAINER" bash -c 'node -e "require(\"tailwindcss\"); console.log(\"ok\")"' 2>/dev/null | grep -q "ok"; then
  pass "A4: Tailwind CSS importable"
else
  fail "A4: Tailwind CSS not importable"
fi

# A5: esbuild installed
if docker exec "$CONTAINER" bash -c 'npx esbuild --version 2>/dev/null' | grep -qE '[0-9]+\.[0-9]+'; then
  pass "A5: esbuild installed"
else
  fail "A5: esbuild not found in container"
fi

# ============================================================
# TEST B: Design system + skills mounted (4 tests)
# ============================================================
echo ""; echo "--- Test B: Design System & Skills ---"

# B1: tokens.css accessible
if docker exec "$CONTAINER" bash -c 'test -f /project/design-system/tokens.css && echo ok' 2>/dev/null | grep -q "ok"; then
  pass "B1: /project/design-system/tokens.css accessible"
else
  fail "B1: tokens.css not found in container"
fi

# B2: brand-guidelines skill present
if docker exec "$CONTAINER" bash -c 'test -f /root/.pi/agent/skills/brand-guidelines/SKILL.md && echo ok' 2>/dev/null | grep -q "ok"; then
  pass "B2: brand-guidelines skill present"
else
  fail "B2: brand-guidelines skill missing"
fi

# B3: platform-formats skill present
if docker exec "$CONTAINER" bash -c 'test -f /root/.pi/agent/skills/platform-formats/SKILL.md && echo ok' 2>/dev/null | grep -q "ok"; then
  pass "B3: platform-formats skill present"
else
  fail "B3: platform-formats skill missing"
fi

# B4: render.mjs present and valid
if docker exec "$CONTAINER" bash -c 'test -f /project/scripts/render.mjs && node --check /project/scripts/render.mjs 2>/dev/null && echo ok' 2>/dev/null | grep -q "ok"; then
  pass "B4: render.mjs present and syntactically valid"
else
  fail "B4: render.mjs missing or invalid"
fi

# ============================================================
# TEST C: Live render task (4 tests)
# ============================================================
echo ""; echo "--- Test C: Live Render Task ---"

SNAP=$(artifact_snapshot)

RUN_ID=$(curl -sf -X POST "$CODER_URL/invoke" \
  -H "Content-Type: application/json" \
  -d '{"task":"Render a single Instagram carousel title slide as PNG. Title: Top 5 AI Coding Tools, subtitle: 2026 Edition. Steps: (1) Read /project/design-system/tokens.css for brand colors. Dark theme bg 0D1117, accent 58A6FF, text F0F6FC. (2) Write an HTML file with the slide design. (3) Use playwright-core with chromium at /usr/bin/chromium (executablePath option, args no-sandbox) to screenshot at viewport 1080x1350. Save PNG to output/slide-1.png. (4) Publish via publish_artifact with file_path=output/slide-1.png (not content). Set type=image. Do NOT run npx playwright install."}' \
  | jq -r '.runId')

if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
  fail "C1: invoke failed (no runId)"
  fail "C2: skipped (no run)" ""
  fail "C3: skipped (no run)" ""
  fail "C4: skipped (no run)" ""
else
  echo "  Dispatched: $RUN_ID"
  pass "C1: render task dispatched"

  # Poll until done (max 300s)
  elapsed=0
  while [ "$elapsed" -lt 300 ]; do
    sleep 10; elapsed=$((elapsed + 10))
    state=$(curl -sf "$CODER_URL/status/$RUN_ID" 2>/dev/null | jq -r '.state // "unknown"')
    if [ "$state" != "running" ] && [ "$state" != "queued" ]; then break; fi
  done

  RESULT=$(curl -sf "$CODER_URL/result/$RUN_ID" 2>/dev/null)
  STATE=$(echo "$RESULT" | jq -r '.state // "unknown"')
  OUTPUT=$(echo "$RESULT" | jq -r '.output // ""')

  # C2: Task completed
  if [ "$STATE" = "completed" ]; then
    pass "C2: render task completed (state=$STATE)"
  else
    fail "C2: render task did not complete (state=$STATE)"
  fi

  # C3: Output mentions rendered file or dimensions
  if echo "$OUTPUT" | grep -qi "1080.*1350\|slide-1.png\|rendered\|screenshot"; then
    pass "C3: output mentions rendered file or dimensions"
  else
    fail "C3: output doesn't mention rendering"
  fi

  # C4: PNG file exists in session dir
  PNG_CHECK=$(docker exec "$CONTAINER" bash -c "find /workspace/sessions/$RUN_ID -name '*.png' -not -name '*.meta*' -exec ls -l {} \; 2>/dev/null" 2>/dev/null)
  if [ -n "$PNG_CHECK" ]; then
    PNG_SIZE=$(echo "$PNG_CHECK" | awk '{print $5}' | head -1)
    if [ "$PNG_SIZE" -gt 1000 ] 2>/dev/null; then
      pass "C4: PNG exists in session dir (${PNG_SIZE} bytes)"
    else
      fail "C4: PNG too small (${PNG_SIZE} bytes — likely truncated)"
    fi
  else
    fail "C4: no PNG file found in session dir"
  fi
fi

# ============================================================
# TEST D: Artifact replication (2 tests)
# ============================================================
echo ""; echo "--- Test D: Artifact Replication ---"

# Wait a moment for replication to complete
sleep 5

# D1: New artifact created
NEW_COUNT=$(artifacts_since "$SNAP")
if [ "$NEW_COUNT" -gt 0 ]; then
  pass "D1: $NEW_COUNT new artifact(s) created since test start"
else
  fail "D1: no new artifacts created"
fi

# D2: Artifact is queryable with correct type
CODER_ARTIFACTS=$(curl -sf "$ARTIFACT_URL/artifacts?agent_name=coder&artifact_type=image&limit=1" 2>/dev/null)
ARTIFACT_SIZE=$(echo "$CODER_ARTIFACTS" | jq '.[0].size_bytes // 0')
if [ "$ARTIFACT_SIZE" -gt 1000 ] 2>/dev/null; then
  pass "D2: image artifact queryable (${ARTIFACT_SIZE} bytes)"
else
  fail "D2: no image artifact found or too small (${ARTIFACT_SIZE} bytes)"
fi

# ============================================================
# Save sample output
# ============================================================
if [ -n "$RUN_ID" ] && [ "$RUN_ID" != "null" ]; then
  SAMPLE_DIR="$RESULTS_DIR/e2e-51-sample"
  mkdir -p "$SAMPLE_DIR"
  docker cp "$CONTAINER:/workspace/sessions/$RUN_ID/output/." "$SAMPLE_DIR/" 2>/dev/null || true
  echo ""; echo "  Sample output: $SAMPLE_DIR/"
fi

# ============================================================
# Summary
# ============================================================
summary
