# Shared Skills Infrastructure

## Intent

Create a shared skills directory (`src/agents/skills/`) for domain knowledge that multiple agents consume. Currently each agent's skills live in isolation under `.pi/agent/skills/`. Skills like brand guidelines and platform format specs are needed by multiple agents and should have a single source of truth, copied into each agent's container at Docker build time — same pattern as the existing shared extensions directory.

## Context Package

### Relevant existing code

- `src/agents/extensions/` — shared extensions directory. Extensions are copied into agent containers via Dockerfile COPY steps.
- `src/agents/{agent}/.pi/agent/skills/{name}/SKILL.md` — per-agent skill pattern. YAML frontmatter (name, description, metadata with author/version/domain) + markdown content.
- `src/agents/Dockerfile` — multi-stage build. Each agent target COPYs its `.pi/agent/` directory. No shared skills COPY exists yet.

### Existing per-agent skills

| Agent | Skill | Path |
|-------|-------|------|
| Researcher | social-media-research | `researcher/.pi/agent/skills/social-media-research/SKILL.md` |
| Writer | social-media-content | `writer/.pi/agent/skills/social-media-content/SKILL.md` |
| Publisher | social-media-publishing | `publisher/.pi/agent/skills/social-media-publishing/SKILL.md` |
| Data | data-analysis | `data/.pi/agent/skills/data-analysis/SKILL.md` |

These are agent-specific and should stay where they are. Shared skills are for cross-cutting domain knowledge.

### Architectural constraints

- Pi SDK discovers skills from `.pi/agent/skills/` inside the agent's working directory
- Docker build is multi-stage — each agent target has its own COPY steps
- Skills must end up at `/root/.pi/agent/skills/{name}/SKILL.md` inside the container to be discovered
- No runtime file sharing between containers — all sharing happens at build time

## Behavioral Contracts

GIVEN a skill in `src/agents/skills/{name}/SKILL.md`
WHEN an agent's Dockerfile target includes a COPY for shared skills
THEN the skill appears in the agent's container at `/root/.pi/agent/skills/{name}/SKILL.md` alongside any agent-specific skills

GIVEN a shared skill is updated
WHEN Docker images are rebuilt
THEN every agent that consumes that skill gets the updated version

## Implementation

### Directory structure

```
src/agents/skills/
  brand-guidelines/
    SKILL.md
    references/
      visual-identity.md
  platform-formats/
    SKILL.md
```

### Dockerfile changes

Add a shared skills COPY step to each agent target that needs it. Example for publisher:

```dockerfile
FROM base AS publisher
COPY publisher/.pi/agent/ /root/.pi/agent/
COPY publisher/agent.json /app/publisher/agent.json
COPY skills/brand-guidelines/ /root/.pi/agent/skills/brand-guidelines/
COPY skills/platform-formats/ /root/.pi/agent/skills/platform-formats/
```

Each agent target explicitly lists which shared skills it needs. No blanket "copy all shared skills" — agents only get what they consume, keeping images minimal and intent clear.

### Which agents get which shared skills

| Shared Skill | Publisher | Coder | QA | Data | Writer |
|-------------|-----------|-------|----|------|--------|
| brand-guidelines | yes | yes | yes | no | no |
| platform-formats | yes | yes | no | no | no |

## Initial Shared Skills

### brand-guidelines

Brand identity reference that Publisher uses to verify rendered output and QA uses to check brand consistency. Coder uses it as rendering input.

Content:
- Brand colors (hex values) — default dark theme: dark backgrounds, bright accent, neutral text
- Typography — font families, size scale, weight scale
- Voice/tone rules — how the brand sounds (AI/tech niche: authoritative but approachable, no hype)
- Logo usage rules (if applicable)
- Visual identity patterns — consistent card style, spacing, contrast requirements
- What NOT to do — brand anti-patterns

### platform-formats

Platform dimension specs and constraints that Publisher needs for assembly and Coder needs for rendering.

Content:
- Per-platform dimension table (Instagram carousel 1080x1350, TikTok cover 1080x1920, etc.)
- File format constraints (PNG/JPG, max sizes)
- Safe zone specifications (text-safe areas for platform UI overlays)
- Slide count limits, caption length limits, hashtag limits
- Render brief schema (the contract between Publisher and Coder)

## Edge Cases

1. Agent-specific skill and shared skill name collision — shared skills should use names that don't collide with existing per-agent skills. Current per-agent names: social-media-research, social-media-content, social-media-publishing, data-analysis. No collision risk with brand-guidelines or platform-formats.
2. Shared skill references another shared skill — use `{baseDir}` relative paths in references, same pattern as existing per-agent skills.

## Definition of Done

- [ ] `src/agents/skills/` directory created
- [ ] brand-guidelines SKILL.md written with design tokens and brand rules
- [ ] platform-formats SKILL.md written with dimension specs and render brief schema
- [ ] Dockerfile updated to COPY shared skills into publisher and coder targets
- [ ] Pi discovers shared skills alongside agent-specific skills in running container
- [ ] AGENTS.md for publisher references shared skills by name

## Negative Space

Out of scope: migrating existing per-agent skills to shared (they're agent-specific, they stay put). Creating a runtime skill-sharing mechanism (build-time COPY is sufficient). Design system code artifacts (those are Coder workspace assets, not skills).
