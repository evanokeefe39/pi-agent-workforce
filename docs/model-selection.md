# Model Selection and Configuration

Last updated: 2026-06-08

This document is the source of truth for which models are used, why, where they
are configured, and how to verify what is actually running. All model changes
start here, then propagate to config files, then rebuild containers.

## Decision log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-06-07 | MiniMax M2.7 removed | Fundamentally broken for tool calling (XML format, concatenated tool names) |
| 2026-06-08 | deepseek-chat removed from worker fallback chains | Not suited for agentic tool-use; prefer loud failures |
| 2026-06-08 | Cerebras removed entirely | Dropped Qwen3 32B, Llama 3.3 70B, Llama 3.1 8B from API. Only GPT-OSS 120B and GLM-4.7 remain, both with 8K context cap on free tier |
| 2026-06-08 | Groq demoted from primary to smol-only | Free tier TPM limits (6K for Qwen3, 12K for Llama 3.3) too low for fully-loaded agent system prompts (~15K tokens) |
| 2026-06-08 | OpenRouter selected as primary provider | No TPM limit, 131K+ context, free models with tool-calling support |
| 2026-06-08 | DeepSeek V4 Flash selected as primary worker model | $0.14/M, no rate limits, 1M context, 98% cache discount. Free tier rate limits (Groq TPM, OpenRouter RPD) are persistent friction across projects |
| 2026-06-08 | DeepSeek V4 Pro selected as planner model | Replaces deepseek-reasoner (retiring 2026-07-24) |
| 2026-06-08 | OpenRouter free models as fallback chain | meta-llama/llama-3.3-70b-instruct:free, openai/gpt-oss-120b:free, z-ai/glm-4.5-air:free |

## Approved models

### Primary: Worker agents (researcher, data, writer, coder, qa, publisher)

These agents need strong tool calling, handle 15K+ token system prompts, and
should cost zero or near-zero.

| Priority | Provider | Model ID | Context | BFCL v3 | Cost | Notes |
|----------|----------|----------|---------|---------|------|-------|
| 1st | OpenRouter | `meta-llama/llama-3.3-70b-instruct:free` | 131K | ~85% (v1) | Free | Proven tool calling, well-tested, stable |
| 2nd | OpenRouter | `openai/gpt-oss-120b:free` | 131K | unranked | Free | Parallel tool calls, large model |
| 3rd | OpenRouter | `z-ai/glm-4.5-air:free` | 131K | 69.1% | Free | Good tool calling but below Qwen3/Llama |
| Fallback | DeepSeek | `deepseek-v4-flash` | 1M | unranked | $0.14/M in | Ultra-cheap paid, cache hits $0.0028/M |

### Primary: Planner agent

Planner needs strong reasoning for task decomposition. Can be paid.

| Priority | Provider | Model ID | Context | Cost | Notes |
|----------|----------|----------|---------|------|-------|
| 1st | DeepSeek | `deepseek-v4-pro` | 1M | $0.435/M in | Replaces deepseek-reasoner (retiring 2026-07-24) |
| Fallback | OpenRouter | `openai/gpt-oss-120b:free` | 131K | Free | Backup if DeepSeek is down |
| Fallback | OpenRouter | `openrouter/deepseek/deepseek-r1:free` | 131K | Free | DeepSeek R1 via OpenRouter |

### Lightweight: Smol tasks (commit messages, classification)

| Priority | Provider | Model ID | Context | Cost | Notes |
|----------|----------|----------|---------|------|-------|
| 1st | Groq | `llama-3.1-8b-instant` | 128K | Free | 6K TPM is fine for small prompts |
| Fallback | OpenRouter | `meta-llama/llama-3.2-3b-instruct:free` | 131K | Free | Smallest free option |

## Rejected / deprecated models

| Model | Provider | Reason | Date |
|-------|----------|--------|------|
| MiniMax-M2.7 | MiniMax | XML tool format, concatenated names, parameter casing errors | 2026-06-07 |
| deepseek-chat | DeepSeek | Ignores system prompt over long sessions, not agentic | 2026-06-08 |
| qwen-3-32b | Cerebras | Removed from Cerebras API | 2026-06-08 |
| llama-3.3-70b | Cerebras | Removed from Cerebras API | 2026-06-08 |
| llama3.1-8b | Cerebras | Removed from Cerebras API | 2026-06-08 |
| qwen/qwen3-32b | Groq | 6K TPM limit, unusable for 15K system prompts | 2026-06-08 |
| llama-3.3-70b-versatile | Groq | 12K TPM limit, marginal for 15K system prompts | 2026-06-08 |
| deepseek-reasoner | DeepSeek | Alias retiring 2026-07-24, migrate to deepseek-v4-pro | pending |
| deepseek-chat | DeepSeek | Alias retiring 2026-07-24, migrate to deepseek-v4-flash | pending |

## Provider analysis

### OpenRouter (primary for workers)

**Rate limits (free tier):**
- 20 requests per minute (RPM)
- 50 requests per day (RPD) base
- 1,000 RPD with one-time $10 deposit (never consumed, stays in account)
- No tokens-per-minute (TPM) limit
- Limits are per-model, not aggregate

**Strengths:** No TPM cap (critical for 15K system prompts), 27+ free models,
OpenAI-compatible API, tool calling support on most models.

**Risks:** 50 RPD base is tight for multi-agent (3 agents x 20 requests = 60).
Need the $10 deposit for 1000 RPD. Free model availability can change.

**BYOK alternative:** 1M free routing requests/month when using your own
provider API keys through OpenRouter. 5% fee above that.

### DeepSeek (primary for planner, fallback for workers)

**Pricing (per 1M tokens):**

| Model | Cache hit | Cache miss (input) | Output |
|-------|-----------|-------------------|--------|
| V4 Flash | $0.0028 | $0.14 | $0.28 |
| V4 Pro | $0.003625 | $0.435 | $0.87 |

**Rate limits:** No per-user request caps. Concurrency limits: V4 Flash 2500,
V4 Pro 500.

**Context:** 1M tokens input, up to 384K output.

**Strengths:** Cheapest paid option. Cache hits are 98% cheaper ($0.0028/M).
Repeated system prompts benefit massively. No TPM/RPM limits. 1M context.
OpenAI-compatible API format. Also supports Anthropic format.

**Risks:** Paid (no free tier beyond 5M signup tokens). China-based, potential
geopolitical risk. deepseek-chat and deepseek-reasoner aliases retire
2026-07-24 — must migrate to deepseek-v4-flash and deepseek-v4-pro.

**Why DeepSeek is a strong option:** For a planner agent that makes 5-10
requests per task, V4 Pro costs ~$0.02 per task (assuming 4K output tokens,
15K input with cache hits after first request). For worker agents as fallback,
V4 Flash at $0.14/M input is cheaper than most "free" models when accounting
for rate limit friction. The 98% cache hit discount means repeated system
prompts (identical across invocations) cost almost nothing.

### Groq (smol tasks only)

**Rate limits (free tier):**

| Model | RPM | RPD | TPM |
|-------|-----|-----|-----|
| qwen/qwen3-32b | 60 | 1K | 6K |
| llama-3.3-70b-versatile | 30 | 1K | 12K |
| llama-3.1-8b-instant | 30 | 14.4K | 6K |

**Strengths:** Fast inference (custom hardware), generous RPD for small models.

**Risks:** TPM limits are hard blockers for agents with extensions. 6K TPM
means a single request with 15K system prompt fails silently. Pi SDK returns
empty completion on 413 errors instead of falling back.

### Cerebras (removed)

Dropped Qwen3 32B, Llama 3.3 70B, and Llama 3.1 8B from their API. Only
GPT-OSS 120B ($0.25/M) and GLM-4.7 ($2.25/M) remain, both with 8K context
cap on free tier and 5 RPM. Not viable.

## BFCL v3 tool-calling rankings (June 2026)

Rankings from Berkeley Function Calling Leaderboard v3, which tests multi-turn
tool calling with state tracking across 1000 test cases.

| Rank | Model | Score | Free on OpenRouter? |
|------|-------|-------|---------------------|
| 1 | GLM 4.5 Thinking | 76.7% | No (air variant is free: 69.1%) |
| 2 | Qwen3 32B | 75.7% | No (qwen3-coder:free available) |
| 3 | Qwen3 Max | 74.9% | No |
| 5 | GLM-4.7-Flash | 74.6% | No |
| 7 | GLM 4.5 Air | 69.1% | Yes: `z-ai/glm-4.5-air:free` |
| 8 | Nova Pro 1.0 | 67.9% | No |
| 12 | Llama 4 Scout | 55.7% | No |
| -- | Llama 3.3 70B | ~85% (v1) | Yes: `meta-llama/llama-3.3-70b-instruct:free` |

Note: Llama 3.3 70B scored 85% on BFCL v1 (simpler benchmark). Not yet tested
on v3 multi-turn. GLM 4.5 Air is the highest-ranked model available free.

## Configuration files

Model identity is configured in multiple files. This is a known issue (see
ISSUES.md: "Model identity has no single source of truth"). Until resolved,
all files must be updated together.

### Where model is configured

| File | What it controls | Format |
|------|-----------------|--------|
| `settings.json` defaultProvider/defaultModel | Pi CLI runtime model selection | `"groq"` / `"llama-3.1-8b-instant"` |
| `config.yml` modelRoles | Role-based routing (default, agentic, plan, smol) | `groq/llama-3.1-8b-instant` |
| `config.yml` fallbackChains | Ordered fallback when primary fails | Array of `provider/model` |
| `models.json` providers | API endpoints, auth, available model IDs | Provider objects with model arrays |
| `auth.json` | API keys per provider | Provider name → key |
| `server.mjs` PI_PROVIDER/PI_MODEL | /describe, /health reporting (env vars) | Defaults in code |
| `docker-compose.yml` environment | Override PI_PROVIDER/PI_MODEL per service | Env vars |

### File locations per agent

All config files live at `src/agents/{name}/.pi/agent/`:
- `settings.json` — runtime defaults
- `config.yml` — model roles + fallback chains
- `models.json` — provider catalog (shared, identical across agents)
- `auth.json` — API keys (shared, identical across agents)

### How to change the primary model

1. Update this document (decision log + approved models)
2. Update `models.json` — add model ID to provider's models array if not present
3. Update `settings.json` — change defaultProvider and defaultModel
4. Update `config.yml` — change modelRoles.default, modelRoles.agentic, and
   the default/agentic fallback chains
5. Update `server.mjs` — change PI_PROVIDER/PI_MODEL defaults (or set in
   docker-compose.yml per service)
6. Copy models.json and auth.json to all agents:
   `for agent in researcher data writer coder qa publisher planner; do cp src/agents/writer/.pi/agent/models.json src/agents/$agent/.pi/agent/models.json; done`
7. Rebuild: `docker compose build researcher data writer planner`
8. Restart: `docker compose up -d`
9. Verify: `curl localhost:808{1,2,3,4}/describe | jq .model`

### How to verify what model is running

```bash
# Check configured model per agent
for port in 8081 8082 8083 8084; do
  curl -sf http://localhost:$port/describe | jq "{name: .name, model: .model}"
done

# Check actual model used in a completed run
curl -sf http://localhost:8084/result/$RUN_ID | jq "{model: .model, provider: .usage.provider}"

# Search logs for model identity
docker logs pi-agent-workforce-writer-1 2>&1 | grep '"model"'

# Grep config for model references
grep -r "defaultModel" src/agents/*/. pi/agent/settings.json
grep -r "default:" src/agents/*/.pi/agent/config.yml | head -7
```

## OpenRouter free models with tool calling (June 2026)

Complete list of free models on OpenRouter that support tool calling, sorted by
context window. Any of these can be used in fallback chains.

| Model ID | Context | Creator |
|----------|---------|---------|
| `nvidia/nemotron-3-ultra-550b-a55b:free` | 1M | NVIDIA |
| `nvidia/nemotron-3-super-120b-a12b:free` | 1M | NVIDIA |
| `qwen/qwen3-coder:free` | 1M | Alibaba |
| `openrouter/owl-alpha` | 1M | OpenRouter |
| `qwen/qwen3-next-80b-a3b-instruct:free` | 262K | Alibaba |
| `google/gemma-4-31b-it:free` | 262K | Google |
| `google/gemma-4-26b-a4b-it:free` | 262K | Google |
| `moonshotai/kimi-k2.6:free` | 262K | Moonshot |
| `poolside/laguna-m.1:free` | 262K | Poolside |
| `poolside/laguna-xs.2:free` | 262K | Poolside |
| `meta-llama/llama-3.3-70b-instruct:free` | 131K | Meta |
| `openai/gpt-oss-120b:free` | 131K | OpenAI |
| `openai/gpt-oss-20b:free` | 131K | OpenAI |
| `z-ai/glm-4.5-air:free` | 131K | Z.AI |
| `nvidia/nemotron-3-nano-30b-a3b:free` | 256K | NVIDIA |
| `nvidia/nemotron-nano-9b-v2:free` | 128K | NVIDIA |

## Migration timeline

| Deadline | Action | Status |
|----------|--------|--------|
| 2026-07-24 | Migrate planner from `deepseek-reasoner` → `deepseek-v4-pro` | Pending |
| 2026-07-24 | Migrate any `deepseek-chat` references → `deepseek-v4-flash` | Pending |
| Ongoing | Monitor OpenRouter free model availability | Active |
| Ongoing | Monitor Groq TPM limits for smol role | Active |

Sources:
- [OpenRouter Free Tier](https://klymentiev.com/blog/openrouter-free-tier)
- [OpenRouter Free Models List](https://costgoat.com/pricing/openrouter-free-models)
- [DeepSeek API Pricing](https://api-docs.deepseek.com/quick_start/pricing)
- [Groq Rate Limits](https://console.groq.com/docs/rate-limits)
- [BFCL v3 Leaderboard](https://pricepertoken.com/leaderboards/benchmark/bfcl-v3)
- [Models.dev Database](https://models.dev/)
