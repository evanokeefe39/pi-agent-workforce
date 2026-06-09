# Project Workspace

Persistent, version-controlled project assets. Mounted read-only into agent containers at `/project/` via Docker bind mount.

## Storage tiers

The workforce uses three storage tiers:

1. **Agent workspace** (ephemeral) -- `/workspace/sessions/{traceId}/` inside the container. Destroyed when the container stops. Agents read and write freely here during a run.
2. **Artifact service** (session-scoped) -- Postgres + MinIO at `:8090`. Stores structured outputs (findings, datasets, reports) tagged by session ID. Persists across runs but scoped to sessions.
3. **Project workspace** (permanent, git-backed) -- this directory. Human-curated assets that agents need across all sessions: brand guidelines, design tokens, templates, reference material.

## Directory layout

```
project/
  design-system/   Color palettes, typography scales, spacing tokens
  brand/           Logos, voice guidelines, brand rules
  templates/
    carousel/      Social carousel templates
    report/        Report and brief templates
    presentation/  Slide deck templates
  reference/       Competitive analysis, market data, style references
  archive/
    posts/         Published post history (for consistency checks)
    analytics/     Historical performance data
```

## Access model

Agents read, humans write. Containers mount this directory as read-only (`ro`). When an agent produces something worth keeping permanently, it writes to the artifact service. A human reviews, curates, and commits the asset here. This keeps the project workspace clean and intentional.

## Git workflow

Edit files locally in this directory. Standard git:

```
git add project/brand/logo.svg
git commit -m "add: primary logo"
```

Changes reflect in running containers via the bind mount -- no rebuild needed.

## What does NOT go here

- Session outputs (use artifact service)
- Secrets or credentials (use `.env` files, never committed)
- Agent prompts, skills, or configuration (live in `src/agents/{name}/.pi/`)
- Node modules or build artifacts
