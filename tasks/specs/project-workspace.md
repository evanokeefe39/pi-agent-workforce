# Project Workspace — Persistent Versioned Asset Storage

## Intent

Introduce a third storage tier for long-lived, version-controlled project assets that persist across agent sessions. Currently the system has ephemeral agent workspaces (wiped per session) and session-scoped artifact storage (MinIO/Postgres). Neither handles assets like design systems, brand guidelines, approved templates, reference datasets, or published content archives — things that evolve slowly, need version history, and are consumed by many agents across many sessions.

The project workspace is a git-backed directory mounted into agent containers. Locally it lives on the user's filesystem for easy drag-and-drop access. Agents read from it. Writes to it are deliberate, gated actions — not automatic replication.

## Context Package

### Current storage tiers

| Tier | Location | Lifetime | Versioned | Cross-agent | Write pattern |
|------|----------|----------|-----------|-------------|---------------|
| Agent workspace | `/workspace/sessions/{id}/` | Per-session | No | No | Agent writes freely |
| Artifact service | MinIO + Postgres | Persistent | By SHA-256 dedup | Yes (via artifact:// URIs) | Agent calls write_artifact |
| **Project workspace (new)** | `/project/` in container, local FS on host | Permanent | Git | Yes (mounted read-only) | Human commits, or HITL-gated agent action |

### Relevant existing infrastructure

- `docker-compose.yml` — defines volumes and bind mounts. Agent containers already mount named volumes at `/workspace`.
- `src/agents/rbac.json` — controls artifact read/write per agent. Project workspace needs its own access model.
- `src/artifact-service/` — REST API for artifact discovery and lineage. Could index project workspace contents for discoverability without owning the storage.

### What lives in the project workspace

Assets that are:
- Consumed by multiple agents across multiple sessions
- Slowly evolving (updated weekly/monthly, not per-session)
- Worth version-controlling (rollback, history, blame)
- Useful for the human to inspect/edit directly

Examples:
- Design system code (CSS, Tailwind config, React components) — consumed by Coder
- Brand guidelines document — consumed by Publisher, QA, Coder
- Approved templates (carousel layouts, report templates) — consumed by Coder
- Reference datasets (competitor watchlists, content taxonomy) — consumed by Data, Publisher
- Published content archive (what was posted, when, with what results) — consumed by Publisher, Researcher
- Configuration files (posting schedules, platform API configs)

### What does NOT live in the project workspace

- Session outputs (artifacts — they go to MinIO)
- Ephemeral scratch files (agent workspace)
- Secrets/credentials (env vars, auth.json)
- Agent system prompts (AGENTS.md, skills — baked into Docker images)

## Architectural Approach

### Local development

```yaml
# docker-compose.yml addition
x-project-volume: &project-volume
  - ./project:/project:ro

services:
  publisher:
    volumes:
      - publisher-workspace:/workspace
      - *project-volume
  coder:
    volumes:
      - coder-workspace:/workspace
      - *project-volume
```

`./project/` is a directory in the pi-agent-workforce repo (or a separate git repo, user's choice). Mounted read-only into containers at `/project`. The user manages it locally: edit files in their IDE, drag-and-drop assets, `git commit` when ready.

### Directory structure

```
project/
  design-system/
    tokens.css
    tailwind.config.js
    components/          # React component library
  brand/
    guidelines.md
    assets/              # Logos, fonts, brand imagery
  templates/
    carousel/            # Carousel layout templates
    report/              # Report/ebook templates
    presentation/        # Slide templates
  reference/
    content-taxonomy.json
    watchlist.json
    posting-schedule.json
  archive/
    posts/               # Published content history
    analytics/           # Post-publish metrics snapshots
```

### Access model

- **Agents read, humans write.** Containers mount `/project` as read-only. Agents can reference project assets in their work but cannot modify them directly.
- **Deliberate updates only.** When Coder proposes a design system change or Publisher suggests a template update, the output goes to the artifact service as a proposal. The human reviews and commits to the project workspace manually.
- **Future: HITL-gated writes.** A future enhancement could allow agents to propose changes via a PR-like mechanism — write to a staging area, human approves, changes merge into project workspace. But read-only is the right starting point.

### Agent integration

Agents reference project workspace via a known path `/project/`. AGENTS.md instructions tell each agent what's available:

- Coder: "Design system at `/project/design-system/`. Templates at `/project/templates/`. Use these as the foundation for all rendering tasks."
- Publisher: "Brand guidelines at `/project/brand/guidelines.md`. Content taxonomy at `/project/reference/content-taxonomy.json`. Published archive at `/project/archive/posts/`."
- Data: "Reference datasets at `/project/reference/`. Published analytics at `/project/archive/analytics/`."

### Artifact service integration

The artifact service could optionally index project workspace contents for discoverability (list what's available, search by type). This is a convenience, not a requirement — agents can read files directly from `/project/`. Indexing would be a future enhancement.

### Git workflow

```
cd project/
git init
git add .
git commit -m "initial project assets"

# After updating design tokens
git add design-system/tokens.css
git commit -m "update accent color to #7C3AED"

# After agent proposes template change (artifact in MinIO)
# Human reviews, copies to project workspace
cp /path/to/proposed-template.html templates/carousel/type-a.html
git add templates/carousel/type-a.html
git commit -m "adopt agent-proposed Type A carousel template"
```

## Behavioral Contracts

GIVEN a project workspace mounted at `/project/` read-only
WHEN an agent reads a file from `/project/design-system/tokens.css`
THEN the agent receives the current committed version of that file

GIVEN a Coder agent rendering a carousel
WHEN the task references the design system
THEN Coder reads component templates and tokens from `/project/design-system/` and uses them as rendering input

GIVEN a Publisher agent checking brand consistency
WHEN Publisher receives rendered output from Coder
THEN Publisher reads `/project/brand/guidelines.md` and verifies the output against brand rules

GIVEN the human updates a file in the project workspace and rebuilds containers
WHEN agents read from `/project/`
THEN agents see the updated content (bind mount reflects host filesystem in real-time, no rebuild needed)

## Edge Cases

1. Project workspace not mounted — agent should detect missing `/project/` and report clearly, not crash. Graceful degradation: work without project assets, note in output that brand/design system checks were skipped.
2. Stale project assets — design system was updated but containers are running with cached reads. Bind mounts reflect changes immediately, but any in-memory caching by agents would be stale. Mitigation: agents read from disk per-task, not at boot.
3. Large binary assets (fonts, images) — git handles these poorly. Mitigation: use git-lfs for binary assets, or accept that the project workspace is small enough that this doesn't matter initially.
4. Multiple humans editing concurrently — standard git workflow handles this. Not a platform concern.

## Definition of Done

- [ ] `project/` directory structure created with subdirectories
- [ ] docker-compose.yml updated with read-only bind mount for agents that need it
- [ ] At least one agent (Coder or Publisher) successfully reads from `/project/` in a running container
- [ ] AGENTS.md for Coder and Publisher reference `/project/` paths
- [ ] .gitignore updated to exclude large binaries or add git-lfs config
- [ ] README or project/README.md documents the workspace structure and workflow

## Negative Space

Out of scope: HITL-gated write mechanism (start read-only, add writes later). Artifact service indexing of project workspace (convenience, not MVP). Remote/cloud sync of project workspace (local-first). Automated CI/CD for project workspace changes.

Reserved for human: all decisions about what goes into the project workspace. Agent proposals go through artifact service, human curates what gets committed.

## Dependencies

- Shared skills infrastructure (the brand-guidelines and platform-formats skills reference project workspace paths)
- Session isolation spec (defines the `/workspace/sessions/` pattern that coexists with `/project/`)
