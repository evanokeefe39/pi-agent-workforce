# Coder Agent — Rendering Capability

## Intent

Expand the Coder agent from a generic "code execution" stub (20-line AGENTS.md) to include explicit rendering capability. Coder is the designated agent for producing styled visual output from the design system — carousels, report PDFs, presentation slides, dashboard components. Other agents (Publisher, Data) request rendering by writing render briefs; Coder fulfills them.

This does not require making Coder a full-featured agent on par with Writer or Data yet. The focus is: Coder can receive a render brief, read the design system from the project workspace, produce rendered artifacts (images, PDFs), and publish them for downstream agents.

## Context Package

### Relevant existing code

- `src/agents/coder/agent.json` — metadata (role: engineer, title: Software Engineer)
- `src/agents/coder/.pi/agent/AGENTS.md` — 20-line stub. "Write, execute, and test code. Analyze codebases. Implement features."
- `src/agents/coder/.pi/agent/config.yml` — model roles and fallback chains (matches other agents)
- `src/agents/coder/.pi/agent/settings.json` — packages include pi-tasks, pi-subagents, pi-otel, pi-permission-system
- Dockerfile target: `FROM base AS coder` — copies .pi/agent/ and agent.json, no additional deps installed
- No skills directory exists for Coder (`src/agents/coder/.pi/agent/skills/` does not exist)

### Rendering toolchain

Coder runs in a sandboxed container with code execution. For rendering it needs:
- Node.js (available in base image)
- React + Tailwind + shadcn (installed at build time or on-demand)
- Playwright or Puppeteer for HTML → screenshot/PDF export
- The design system from project workspace (`/project/design-system/`)

### What Coder renders

| Render type | Input | Output | Toolchain |
|------------|-------|--------|-----------|
| Carousel slides | Content brief + format spec | Numbered PNGs at exact dimensions | React → Playwright screenshot |
| Cover image | Content + dimensions | Single PNG | React → Playwright screenshot |
| PDF report | Markdown/structured content | Styled PDF | React → Playwright PDF export |
| Presentation slides | Structured content + slide count | PDF or numbered PNGs | React → Playwright |
| Ebook | Structured content + format spec | PDF with book margins | React → Playwright PDF |
| Dashboard component | Data + chart spec | HTML or PNG | React + Vega-Lite |

## Implementation

### AGENTS.md expansion

Expand from 20 lines to ~80 lines. Not as deep as Writer/Data (Coder's scope is broader — rendering is one capability, not the whole agent). Add:

- **Rendering workflow:** receive render brief → read design system from `/project/design-system/` → scaffold React component → render to target format → publish artifact
- **Render brief consumption:** document the expected render brief JSON schema (same schema defined in publisher spec and platform-formats skill)
- **Design system reference:** "Design system at `/project/design-system/`. Brand guidelines at `/project/brand/guidelines.md`. Use design tokens for all color, typography, and spacing decisions."
- **Output conventions:** rendered artifacts published via write_artifact with metadata linking back to the render brief that requested them
- **Self-test:** before publishing rendered output, Coder should verify dimensions match the format spec (screenshot at 1080x1350 actually produces 1080x1350)

### Dockerfile changes

Coder needs rendering dependencies installed at build time:

```dockerfile
FROM base AS coder
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    && rm -rf /var/lib/apt/lists/*
COPY coder/.pi/agent/ /root/.pi/agent/
COPY coder/agent.json /app/coder/agent.json
COPY skills/brand-guidelines/ /root/.pi/agent/skills/brand-guidelines/
COPY skills/platform-formats/ /root/.pi/agent/skills/platform-formats/
```

Node.js is in the base image. React, Tailwind, Playwright are npm-installable by Coder at runtime within `/workspace`, or could be pre-installed in a deps stage (like researcher-deps, data-deps patterns).

Note: Playwright with Chromium adds ~400MB to the image. Consider a `coder-deps` stage to keep the build cache efficient:

```dockerfile
FROM base AS coder-deps
RUN apt-get update && apt-get install -y --no-install-recommends chromium && rm -rf /var/lib/apt/lists/*
RUN npm init -y && npm install playwright-core react react-dom tailwindcss @tailwindcss/cli

FROM coder-deps AS coder
COPY coder/.pi/agent/ /root/.pi/agent/
COPY coder/agent.json /app/coder/agent.json
COPY skills/brand-guidelines/ /root/.pi/agent/skills/brand-guidelines/
COPY skills/platform-formats/ /root/.pi/agent/skills/platform-formats/
```

### Skills

Coder gets shared skills via Dockerfile COPY:
- `brand-guidelines` — knows what colors/fonts/style to use
- `platform-formats` — knows target dimensions and render brief schema

No coder-specific skill needed initially. Coder's general code execution capability plus the shared skills is sufficient.

### agent.json update

```json
{
  "capabilities": "Code execution, analysis, implementation, visual rendering from design system (carousels, reports, presentations, dashboards), testing within sandboxed container"
}
```

### docker-compose.yml

Add coder service (not currently deployed):

```yaml
coder:
  <<: *agent
  build:
    <<: *agent-build
    target: coder
  ports:
    - "8086:8080"
  env_file:
    - .env
  environment:
    AGENT_NAME: "coder"
    WORKSPACE: "default"
    ARTIFACT_SERVICE_URL: "http://artifact-service:8090"
    BRIDGE_TIMEOUT_MS: "600000"
    MAX_CONCURRENT_SESSIONS: "2"
    OTEL_EXPORTER_OTLP_ENDPOINT: "http://openobserve:5080/api/default"
    OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Basic ${ZO_OTLP_AUTH}"
  deploy:
    resources:
      limits:
        memory: 4G
  volumes:
    - coder-workspace:/workspace
    - ./project:/project:ro
  depends_on:
    artifact-service:
      condition: service_healthy
```

Higher memory limit (4G) for Chromium + React rendering. Port 8086 (8085 is publisher).

### RBAC update

Coder entry in rbac.json needs expanded read permissions:

```json
"coder": {
  "read": [
    "*/*/coder/**",
    "*/*/researcher/**",
    "*/*/writer/**",
    "*/*/publisher/**"
  ],
  "write": ["*/*/coder/**"]
}
```

Added writer (reads content briefs for rendering) and publisher (reads render briefs).

## Behavioral Contracts

GIVEN a render brief artifact requesting a 5-slide Instagram carousel
WHEN Coder receives the rendering task
THEN Coder reads design system from `/project/design-system/`, creates React components for each slide, screenshots at 1080x1350, publishes 5 PNG artifacts

GIVEN a render brief requesting a PDF report
WHEN Coder renders the report
THEN Coder uses design system tokens for styling, renders via Playwright PDF export, verifies page dimensions match A4, publishes PDF artifact

GIVEN render brief with dimensions that don't match any known format
WHEN Coder validates the brief
THEN Coder flags the mismatch (referencing platform-formats skill) and escalates rather than rendering at wrong dimensions

## Edge Cases

1. Design system not mounted (project workspace missing) — Coder should report clearly, not use default browser styles. Fall back to inline styles matching brand-guidelines skill if possible.
2. Playwright/Chromium crashes during render — Coder retries once, then escalates with error details.
3. Rendered output dimensions don't match spec — Coder must verify before publishing. Re-render with corrected viewport if off.
4. Render brief requests component that doesn't exist in design system — Coder implements a reasonable component following design tokens, notes in artifact metadata that a custom component was created.

## Definition of Done

- [ ] Coder AGENTS.md expanded to ~80 lines with rendering workflow
- [ ] Coder Dockerfile installs Chromium and rendering dependencies
- [ ] Coder receives shared skills (brand-guidelines, platform-formats) via Dockerfile COPY
- [ ] Coder agent.json capabilities updated to mention rendering
- [ ] Coder service added to docker-compose.yml
- [ ] Coder RBAC updated with writer/publisher read access
- [ ] Coder added to planner subagent config (covered in planner-routing-hints spec)
- [ ] Smoke test: Coder renders a single carousel slide from a render brief

## Negative Space

Out of scope: full Coder agent specification (general code execution, analysis, testing — that's a larger effort). Video rendering/editing. Interactive web components (static output only for now). Animation.

Dependencies: project workspace (for design system mount), shared skills infrastructure (for brand-guidelines and platform-formats).
