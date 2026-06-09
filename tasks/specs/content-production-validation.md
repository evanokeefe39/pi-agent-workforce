# Content Production Infrastructure Validation

## Intent

Validate all 5 content production specs implemented last session: shared skills infrastructure, project workspace, publisher agent, coder rendering capability, and planner routing hints. These were implemented but never tested. Tests are structural — verify files exist, contain required sections, Dockerfile stages build, docker-compose services configured, RBAC entries correct. No running containers needed for most tests; Docker build tests optional.

## Context Package

### What was implemented

1. **Shared skills** — `src/agents/skills/brand-guidelines/SKILL.md`, `src/agents/skills/platform-formats/SKILL.md`. Dockerfile COPY into publisher, coder, qa targets.
2. **Project workspace** — `project/` directory with design-system, brand, templates, reference, archive subdirs. README.md. docker-compose bind mount `./project:/project:ro`.
3. **Publisher agent** — Full AGENTS.md rewrite (~136 lines), agent.json capabilities, docker-compose :8085, RBAC entry.
4. **Coder rendering** — AGENTS.md rewrite (~88 lines) with rendering workflow, Dockerfile coder-deps stage (Chromium + React + Playwright), docker-compose :8086 (4G memory), RBAC entry.
5. **Planner routing** — Content Production Routing section in AGENTS.md with chain table, publisher + coder in subagent config.

### Existing test patterns

- `tests/e2e/e2e-32-model-and-output-validation.sh` — bash, uses pass/fail counters, `check` function, runs against live services
- `tests/e2e/e2e-35-session-isolation.sh` — bash, structural + behavioral tests, uses `check` function pattern

### Test file location

`tests/e2e/e2e-50-content-production-infra.sh` — bash script, self-contained, no external dependencies beyond standard tools (grep, jq, test).

## Behavioral Contracts

### Shared Skills (6 tests)

GIVEN `src/agents/skills/brand-guidelines/SKILL.md` exists
WHEN test reads the file
THEN file contains YAML frontmatter with `name: brand-guidelines` and `domain: social-media`

GIVEN `src/agents/skills/brand-guidelines/SKILL.md`
WHEN test checks content sections
THEN file contains all required sections: Color Palette, Typography, Voice and Tone, Visual Identity Patterns, Anti-Patterns

GIVEN `src/agents/skills/platform-formats/SKILL.md` exists
WHEN test reads the file
THEN file contains YAML frontmatter with `name: platform-formats`

GIVEN `src/agents/skills/platform-formats/SKILL.md`
WHEN test checks content sections
THEN file contains all required sections: Platform Dimension Table, File Format Constraints, Safe Zone Specifications, Content Limits, Render Brief Schema

GIVEN the Dockerfile
WHEN test checks publisher target
THEN publisher target COPYs `skills/brand-guidelines/` and `skills/platform-formats/`

GIVEN the Dockerfile
WHEN test checks coder target
THEN coder target COPYs `skills/brand-guidelines/` and `skills/platform-formats/`

### Project Workspace (5 tests)

GIVEN `project/` directory
WHEN test checks subdirectories
THEN all 5 subdirectories exist: design-system, brand, templates, reference, archive

GIVEN `project/README.md`
WHEN test reads the file
THEN file documents the three storage tiers and the access model (agents read, humans write)

GIVEN `docker-compose.yml`
WHEN test checks publisher service volumes
THEN publisher mounts `./project:/project:ro` (read-only)

GIVEN `docker-compose.yml`
WHEN test checks coder service volumes
THEN coder mounts `./project:/project:ro` (read-only)

GIVEN `docker-compose.yml`
WHEN test checks data service volumes
THEN data mounts `./project:/project:ro` (read-only)

### Publisher Agent (8 tests)

GIVEN `src/agents/publisher/.pi/agent/AGENTS.md`
WHEN test checks line count
THEN file has at least 100 lines (was 22-line stub, now ~136)

GIVEN publisher AGENTS.md
WHEN test checks pipeline phases
THEN file contains all 6 phases: RECEIVE, ASSEMBLE, CHECKLIST, STAGE, PUBLISH, TRACK

GIVEN publisher AGENTS.md
WHEN test checks operating modes
THEN file documents 3 modes: social media assembly, document packaging, content brief assembly

GIVEN publisher AGENTS.md
WHEN test checks rendering delegation
THEN file contains render brief schema with `render_type` field and self-assembly threshold

GIVEN publisher AGENTS.md
WHEN test checks HITL requirement
THEN file contains explicit "never publish without" or "never proceed without" human approval language

GIVEN `src/agents/publisher/agent.json`
WHEN test reads capabilities field
THEN capabilities mentions three modes and HITL gating

GIVEN `docker-compose.yml`
WHEN test checks publisher service
THEN publisher service exists on port 8085, depends on artifact-service

GIVEN `src/artifact-service/rbac.json`
WHEN test checks publisher entry
THEN publisher can read from writer, coder, data namespaces and write to publisher namespace

### Coder Rendering (8 tests)

GIVEN `src/agents/coder/.pi/agent/AGENTS.md`
WHEN test checks line count
THEN file has at least 60 lines (was 20-line stub, now ~88)

GIVEN coder AGENTS.md
WHEN test checks rendering workflow
THEN file documents rendering pipeline phases (RECEIVE, READ DESIGN SYSTEM, SCAFFOLD, RENDER, VERIFY, PUBLISH or equivalent)

GIVEN coder AGENTS.md
WHEN test checks render types
THEN file lists at least 4 render types: carousel, cover image, PDF, presentation

GIVEN coder AGENTS.md
WHEN test checks design system reference
THEN file references `/project/design-system/` path

GIVEN `src/agents/Dockerfile`
WHEN test checks coder-deps stage
THEN Dockerfile has `coder-deps` stage that installs chromium and npm packages (playwright-core, react, tailwindcss)

GIVEN `src/agents/coder/agent.json`
WHEN test reads capabilities
THEN capabilities mentions "visual rendering" and "design system"

GIVEN `docker-compose.yml`
WHEN test checks coder service
THEN coder service exists on port 8086 with memory limit 4G

GIVEN `src/artifact-service/rbac.json`
WHEN test checks coder entry
THEN coder can read from researcher, writer, publisher namespaces and write to coder namespace

### Planner Routing (5 tests)

GIVEN `src/agents/planner/.pi/agent/AGENTS.md`
WHEN test checks for routing section
THEN file contains "Content Production Routing" section header

GIVEN planner AGENTS.md routing section
WHEN test checks chain table
THEN section contains chain entries for at least: text-only social, social with visuals, report/ebook, content calendar, dashboard

GIVEN planner AGENTS.md
WHEN test checks rendering delegation
THEN file documents the multi-hop rendering delegation pattern (Publisher → render brief → Coder → rendered artifacts → Publisher)

GIVEN planner subagent config
WHEN test checks registered agents
THEN config lists publisher and coder alongside researcher, data, writer

GIVEN planner AGENTS.md
WHEN test checks phase example
THEN file contains a multi-phase example showing parallel and sequential phases

## Edge Cases

1. Dockerfile COPY context — skills COPY must be relative to Docker build context (`src/agents/`), so paths are `skills/brand-guidelines/` not `src/agents/skills/brand-guidelines/`
2. docker-compose volume syntax — test must handle both anchor-reference (`*project-volume`) and inline (`./project:/project:ro`) formats
3. AGENTS.md line count — count non-empty lines to avoid false positives from blank-line-heavy formatting
4. Subagent config location — could be `config.json` in the extensions directory, not config.yml. Test checks the actual file.

## Definition of Done

- [ ] Test script at `tests/e2e/e2e-50-content-production-infra.sh`
- [ ] 32 tests total (6 shared skills + 5 project workspace + 8 publisher + 8 coder + 5 planner routing)
- [ ] All tests pass against current codebase
- [ ] Script follows existing test pattern (check function, pass/fail counters, colored output, summary)
- [ ] Script is executable and self-contained (no Docker required, reads files directly)
- [ ] Script exits 0 on all pass, 1 on any fail

## Negative Space

Out of scope: testing that Docker images actually build (expensive, separate CI concern). Testing agent runtime behavior (covered by E2E-30, E2E-32). Testing artifact service integration. Testing actual rendering output.

Not testing: content quality of SKILL.md files (that's editorial, not structural). Whether agents actually discover and use shared skills at runtime (requires running containers).
