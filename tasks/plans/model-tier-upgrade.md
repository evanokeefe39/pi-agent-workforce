# Model Tier Upgrade: Opus-Level Primary Agents

## Intent
Move all primary agents from haiku-tier (V4 Flash) to opus-tier (V4 Pro) as default. Establish 3-tier fallback chain (opus → free opus → haiku). Integrate NIM as dev/test provider.

## New Model Architecture

| Role | Primary (Opus) | Free Fallback (Opus) | Paid Fallback (Haiku) |
|------|---------------|---------------------|----------------------|
| All agents default/agentic | deepseek-v4-pro | kimi-k2.6:free | deepseek-v4-flash |
| Plan/review | deepseek-v4-pro | deepseek-r1:free | — |
| Smol/commit | groq/llama-3.1-8b-instant | — | — |

## NIM Dev/Test Models

| Model ID | Params (active) | Tier | Use |
|----------|----------------|------|-----|
| qwen/qwen3.5-122b-a10b | 122B (10B) | Haiku | Fast dev iteration |
| qwen/qwen3-235b-a22b | 235B (22B) | Sonnet | General dev |
| z-ai/glm5 | 744B (40B) | Opus | Dev testing opus behavior |
| z-ai/glm5.1 | ~744B | Opus | Agentic/coding dev |

## Files to Edit

- [x] models.json (template → copy to all 7 agents)
- [x] config.yml (planner + 6 workers)
- [x] settings.json (6 workers)
- [x] docker-compose.yml
- [x] server.mjs
- [x] docs/model-selection.md
- [x] CLAUDE.md model table
