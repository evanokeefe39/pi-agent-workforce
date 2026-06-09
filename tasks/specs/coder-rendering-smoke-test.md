# Coder Rendering Smoke Test

## Intent

Build the Coder Docker image and verify the full rendering pipeline works end-to-end: receive render brief → read design system → scaffold React component → render via Playwright → produce PNG artifact at correct dimensions. This is the first time the coder container will actually run. Without this smoke test, we have configuration (AGENTS.md, Dockerfile, docker-compose) but zero proof that rendering works.

## Context Package

### Relevant existing code

- `src/agents/Dockerfile` — coder-deps stage installs chromium, playwright-core, react, react-dom, tailwindcss, @tailwindcss/cli. Coder stage copies agent config + shared skills.
- `docker-compose.yml` — coder service on :8086, 4G memory, depends on artifact-service.
- `src/agents/coder/.pi/agent/AGENTS.md` — rendering workflow: RECEIVE BRIEF → READ DESIGN SYSTEM → SCAFFOLD → RENDER → VERIFY → PUBLISH.
- `src/agents/coder/agent.json` — capabilities mention visual rendering, React + Playwright.
- `project/design-system/` — will be populated by design-system-foundation spec (dependency).
- `src/agents/server.ts` — Fastify + Pi SDK agent server. Handles /invoke, /status, /result.
- `src/agents/skills/platform-formats/SKILL.md` — render brief schema, platform dimension table.

### What we're testing

The coder agent receives a task via HTTP POST to /invoke. The task describes a render brief (content to render, dimensions, format). The coder should:

1. Read the render brief from the task or from an artifact
2. Read design system components from `/project/design-system/`
3. Write a React component that composes design system pieces with the brief's content
4. Use Playwright to screenshot/PDF-export the component at exact dimensions
5. Publish the rendered output via write_artifact

### Dependencies

- Design system foundation spec must be implemented first (coder reads from `/project/design-system/`)
- Docker Desktop running
- artifact-service, postgres, minio must be up (coder depends on artifact-service for write_artifact)

### Known risks

- Chromium in Docker on Windows — may need `--no-sandbox` flag. Playwright respects PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH env var.
- Font rendering — Inter/JetBrains Mono may not be in the container. Need either Google Fonts CDN or bundled .woff2 files.
- First build will be slow — coder-deps stage pulls ~400MB of Chromium.
- Coder is an LLM agent — it writes the rendering code itself at runtime. We're testing that it CAN render, not that it always WILL render perfectly. The smoke test validates the toolchain, not the LLM's code quality.

## Implementation

### Phase 1: Build verification

Build the coder Docker image and verify the toolchain is present:

```bash
docker compose build coder
docker compose run --rm coder bash -c "chromium --version && node -e \"require('playwright-core')\" && echo OK"
```

### Phase 2: Service startup

Start the full stack needed for coder:

```bash
docker compose up -d postgres minio artifact-service coder
```

Wait for health checks. Coder should respond to GET /health.

### Phase 3: Render brief task

Send a simple rendering task via HTTP. The task should be minimal — render a single carousel slide with hardcoded content, not requiring upstream artifacts:

```json
{
  "task": "Render a single Instagram carousel slide (1080x1350 PNG). Content: Title 'Top 5 AI Tools for Developers' with subtitle '2026 Edition'. Use the design system at /project/design-system/ for all styling — dark theme, brand colors, Inter font. Save the output PNG to the output/ directory. The file should be exactly 1080x1350 pixels."
}
```

This is a self-contained task — no artifact reads needed, content is in the prompt. Tests the core rendering pipeline.

### Phase 4: Verification

After the task completes:

1. Check run state is "completed" (not "failed")
2. Check output mentions the rendered file
3. Check that a PNG file was produced (via artifact service or output inspection)
4. If possible, verify PNG dimensions are 1080×1350 (ImageMagick `identify` or Node.js sharp)

### Test script

`tests/e2e/e2e-51-coder-rendering.sh` — follows existing test patterns (source jsonl-helpers.sh, pass/fail counters).

Tests:
1. Docker build succeeds for coder target
2. Chromium binary present in container
3. Playwright-core importable in container
4. React importable in container
5. Design system files present at /project/design-system/ in container
6. Coder /health responds OK
7. Render task completes (not timeout, not failed)
8. Output mentions rendered file or write_artifact
9. At least one new artifact created during the run
10. (Stretch) Rendered PNG dimensions match spec

## Behavioral Contracts

GIVEN a running coder service with design system mounted
WHEN a render task for a single carousel slide is posted to /invoke
THEN the coder completes within 300 seconds and produces at least one output artifact

GIVEN the coder Docker image
WHEN the container starts
THEN chromium, playwright-core, react, and tailwindcss are all importable

GIVEN the coder container with /project volume mounted
WHEN the agent reads /project/design-system/tokens.css
THEN the file contains brand color definitions

GIVEN a render task requesting 1080×1350 output
WHEN the coder renders via Playwright screenshot
THEN the output image is exactly 1080×1350 pixels

## Edge Cases

1. Chromium crashes in container — coder AGENTS.md says retry once then escalate. Test should allow for one retry within the timeout window.
2. Design system not mounted — test should verify mount before sending render task. Fail fast with clear message.
3. Coder writes markdown instead of rendering — model-dependent behavior. If coder produces text output instead of a PNG, log it as a rendering pipeline failure, not a test infrastructure failure.
4. Artifact service unavailable — coder can't publish artifacts. Test verifies artifact-service health first.
5. Out of memory — 4G limit may be tight for Chromium + React. Monitor container memory during test.

## Definition of Done

- [ ] Test script at `tests/e2e/e2e-51-coder-rendering.sh`
- [ ] Coder Docker image builds successfully
- [ ] Chromium, Playwright, React available in container
- [ ] Design system accessible at /project/design-system/ in container
- [ ] Coder health endpoint responds
- [ ] At least one successful render task producing a PNG
- [ ] Test follows existing E2E patterns (jsonl-helpers.sh, pass/fail)

## Negative Space

Out of scope: testing all render types (carousel, PDF, slides — just test one). Testing publisher assembly (separate spec). Testing with real upstream artifacts from writer (self-contained task only). Performance benchmarking. Multi-slide rendering (one slide is sufficient proof).

Not changing: Coder AGENTS.md, Dockerfile, docker-compose.yml, server.ts. If those need changes to pass the smoke test, that's a bug to fix, not spec scope.
