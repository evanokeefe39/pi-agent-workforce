# Project Workspace — Subagent Execution Plan

Spec: `tasks/specs/project-workspace.md`

## Key findings from exploration

- `project/` dir does not exist yet
- docker-compose.yml uses YAML anchors (`x-agent-build`, `x-agent`) — add `x-project-volume` anchor
- Publisher, coder, data need the mount. Researcher does not (ephemeral research).
- Planner does not need it (delegates, doesn't render).
- Publisher and coder AGENTS.md already exist and were updated in spec #1 (shared skills references added)
- Data AGENTS.md exists at `src/agents/data/.pi/agent/AGENTS.md`

## Wave 1 — 2 parallel subagents

### W1-A: Create project/ scaffold + README
- **Files:** `project/design-system/.gitkeep`, `project/brand/.gitkeep`, `project/templates/carousel/.gitkeep`, `project/templates/report/.gitkeep`, `project/templates/presentation/.gitkeep`, `project/reference/.gitkeep`, `project/archive/posts/.gitkeep`, `project/archive/analytics/.gitkeep`, `project/README.md`
- **Depends on:** none
- **Changes:** Create directory structure with .gitkeep files. Write README.md documenting structure and workflow.

### W1-B: docker-compose.yml + AGENTS.md updates
- **Files:** `docker-compose.yml`, `src/agents/publisher/.pi/agent/AGENTS.md`, `src/agents/coder/.pi/agent/AGENTS.md`, `src/agents/data/.pi/agent/AGENTS.md`
- **Depends on:** none
- **Changes:**
  1. docker-compose.yml: Add `x-project-volume` anchor, add volume to publisher, coder, data services
  2. Publisher AGENTS.md: Add project workspace section referencing /project/ paths
  3. Coder AGENTS.md: Add project workspace section referencing /project/ paths
  4. Data AGENTS.md: Add project workspace section referencing /project/ paths

## Verification
- `ls project/README.md` — exists
- `ls project/design-system/.gitkeep` — exists
- `grep "project" docker-compose.yml` — x-project-volume and volume mounts present
- `grep "/project/" src/agents/publisher/.pi/agent/AGENTS.md` — referenced
- `grep "/project/" src/agents/coder/.pi/agent/AGENTS.md` — referenced

## Subagent count: 2 (wave 1: 2)
