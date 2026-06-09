# Shared Skills Infrastructure — Subagent Execution Plan

Spec: `tasks/specs/shared-skills-infrastructure.md`

## Key findings from exploration

- `src/agents/skills/` does not exist yet — needs creation
- Existing per-agent skills use frontmatter: name, description, metadata (author, version, domain) + markdown body
- Dockerfile pattern: base stage COPYs extensions to `/root/.pi/agent/extensions/`, then each agent target COPYs `{agent}/.pi/agent/` to `/root/.pi/agent/` (merges, doesn't overwrite)
- Publisher and coder are "lightweight agents" built FROM base with just 2 COPY lines each
- `.gitignore` has `/artifacts` (scoped with `/` prefix) — no conflict with `skills/`
- Publisher AGENTS.md exists but doesn't reference shared skills yet
- Coder AGENTS.md exists, minimal — no skills references

## Wave 1 — 2 parallel subagents

### W1-A: Create shared skill files
- **Files:** `src/agents/skills/brand-guidelines/SKILL.md`, `src/agents/skills/platform-formats/SKILL.md`
- **Depends on:** none
- **Changes:** Create both SKILL.md files with proper frontmatter and content per spec. Brand-guidelines: dark theme colors, typography, voice/tone, visual patterns, anti-patterns. Platform-formats: per-platform dimensions, file format constraints, safe zones, limits, render brief schema.

### W1-B: Dockerfile + AGENTS.md updates
- **Files:** `src/agents/Dockerfile`, `src/agents/publisher/.pi/agent/AGENTS.md`
- **Depends on:** none
- **Changes:**
  1. Dockerfile: Add shared skills COPY to publisher and coder targets (after agent/.pi/agent/ COPY). Publisher gets brand-guidelines + platform-formats. Coder gets brand-guidelines + platform-formats.
  2. Publisher AGENTS.md: Add "Shared Skills" section referencing brand-guidelines and platform-formats by name.

## Verification
- `ls src/agents/skills/brand-guidelines/SKILL.md` — exists
- `ls src/agents/skills/platform-formats/SKILL.md` — exists
- `grep "skills/brand-guidelines" src/agents/Dockerfile` — hits in publisher + coder targets
- `grep "skills/platform-formats" src/agents/Dockerfile` — hits in publisher + coder targets
- `grep "brand-guidelines" src/agents/publisher/.pi/agent/AGENTS.md` — referenced

## Subagent count: 2 (wave 1: 2)
