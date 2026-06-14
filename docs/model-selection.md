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
| 2026-06-08 | All agents upgraded to DeepSeek V4 Pro (opus-tier) | Primary agents need opus-level reasoning for tool calling, planning, and complex delegation |
| 2026-06-08 | 3-tier fallback chains: opus → free opus → haiku | V4 Pro → Kimi K2.6:free → V4 Flash for workers; V4 Pro → Kimi K2.6:free → GPT-OSS:free for planner |
| 2026-06-08 | NIM integrated as dev/test provider | 40 RPM free (upgradable to 200), no daily cap. GLM-5, GLM-5.1, Qwen3.5 models available |
| 2026-06-08 | Cerebras, MiniMax, Mistral removed from provider catalog | Dead or unused. Keeps models.json clean |
| 2026-06-08 | V4 Pro demoted from default to plan/review only | V4 Pro failed agentic tasks: researcher ignored structured output requirements (42 turns of markdown, 0 findings), writer timed out at 600s twice. V4 Flash completed same tasks in 4 min with 30 findings. Cause unclear — may be model behavior regression or DeepSeek shared rate limiting under high V4 Pro traffic |
| 2026-06-08 | All agents reverted to V4 Flash as default/agentic | V4 Flash proven reliable for tool calling and structured output. V4 Pro retained in plan/review fallback chains only |

## Model tier architecture

All agents run on V4 Flash by default. V4 Pro is retained for plan/review roles
only (fallback chains). V4 Pro was tested as primary but failed: ignored structured
output requirements, caused timeouts, and exhibited possible shared rate limiting
under load.

**DeepSeek shared rate limiting caveat:** DeepSeek rate limits are shared across all
users, not per-account. Under high platform traffic, V4 Pro (smaller concurrency
pool: 500 vs V4 Flash's 2500) may experience degraded latency or throttling even
when your account is well within limits. This makes V4 Pro unreliable as a default
model for time-sensitive agentic workloads.

### Primary — DeepSeek V4 Flash (all agents default/agentic)

| Model | Provider | Cost (input/output per MTok) | Context | Notes |
|-------|----------|------------------------------|---------|-------|
| DeepSeek V4 Flash | DeepSeek | $0.10 / $0.20 | 1M | Proven reliable for tool calling and structured output. Cache: $0.0028/M. 2500 concurrency |

### Fallback — free models

| Model | Provider | Cost | Context | Notes |
|-------|----------|------|---------|-------|
| Kimi K2.6 | OpenRouter (free) | $0 | 262K | 1T total / 32B active MoE. Free fallback |
| GPT-OSS 120B | OpenRouter (free) | $0 | 131K | Last-resort free fallback |
| Llama 3.1 8B | Groq (free) | $0 | 128K | Smol/commit role only. 6K TPM limit |

### Plan/review only — DeepSeek V4 Pro

| Model | Provider | Cost | Context | Notes |
|-------|----------|------|---------|-------|
| DeepSeek V4 Pro | DeepSeek | $1.74 / $3.48 | 1M | Reserved for plan/review roles in fallback chains. Not used as default — see decision log |

### Dev/test — NIM

| Model | Provider | Cost | Context | Notes |
|-------|----------|------|---------|-------|
| GLM-5.1 | NIM (free) | $0 | 203K | Best for long-running software agents. Dev/test only |
| GLM-5 | NIM (free) | $0 | 203K | 744B / 40B active. Dev/test only |
| Qwen3.5 122B (10B active) | NIM (free) | $0 | 262K | Fast dev iteration. Dev/test only |

### Tier 2 — Sonnet equivalent (future / not yet integrated)

| Model | Provider | Cost | Context | Notes |
|-------|----------|------|---------|-------|
| MiMo-V2.5-Pro | Xiaomi / DeepInfra | $0.435 / $0.87 | 1M | Frontier reasoning at mid-tier price. Needs provider setup |
| MiniMax M3 | MiniMax | $0.30 / $1.20 | 1M | Promo pricing. Multimodal. Needs testing |
| Qwen3.7-Plus | Alibaba | $0.40 / $1.60 | 1M | Multimodal, GUI interaction. Needs testing |

## Fallback chains

### All agents (default/agentic roles)

```
DeepSeek V4 Flash ($0.10/M)
  ↓ fail
Kimi K2.6:free (OpenRouter, 262K)
  ↓ fail
GPT-OSS 120B:free (OpenRouter)
```

### Plan/review roles

```
DeepSeek V4 Pro ($1.74/M)
  ↓ fail
DeepSeek R1:free (OpenRouter)
```

### Smol/commit roles

```
Groq Llama 3.1 8B (free)
```

## Cost analysis with caching

DeepSeek V4 Flash cache hits cost $0.0028/M — a 97% discount on input. System
prompts (10-15K tokens) are identical across invocations and cache automatically.

Per-task cost estimate (3 workers, 20 requests each, 15K input):
- First request per agent: ~$0.0015 (cold cache)
- Subsequent requests: ~$0.0005 (system prompt cached)
- Total per task: ~$0.03

## NIM dev/test strategy

### Available models

| NIM Model ID | Params (active) | Tier | Context |
|-------------|----------------|------|---------|
| `z-ai/glm5.1` | ~744B (40B) | Opus | 203K |
| `z-ai/glm5` | 744B (40B) | Opus | 203K |
| `qwen/qwen3-235b-a22b` | 235B (22B) | Sonnet | 262K |
| `qwen/qwen3.5-122b-a10b` | 122B (10B) | Haiku | 262K |
| `meta/llama-4-maverick-17b-128e-instruct` | 17B (128 experts) | Haiku | 1M |

### Usage

NIM at 40 RPM with no daily cap = 57,600 theoretical requests/day. Route all
dev/test traffic through NIM. Apply for 200 RPM upgrade via NVIDIA Developer Forums.

To switch an agent to NIM for dev/test, update its config.yml:
```yaml
modelRoles:
  default: nvidia/z-ai/glm5.1
  agentic: nvidia/z-ai/glm5.1
```

### Dev/test vs production routing

| Phase | Primary | Fallback | Cost |
|-------|---------|----------|------|
| Dev/test | NIM free (40 RPM) | OpenRouter :free | $0 |
| Production | DeepSeek V4 Flash (paid) | Kimi K2.6:free → GPT-OSS:free | ~$0.10/MTok (cache: $0.0028) |

## Provider catalog

### DeepSeek (production primary)

**Pricing (per 1M tokens):**

| Model | Cache hit | Cache miss (input) | Output |
|-------|-----------|-------------------|--------|
| V4 Pro | $0.003625 | $1.74 | $3.48 |
| V4 Flash | $0.0028 | $0.10 | $0.20 |

**Rate limits:** No per-user request caps. Concurrency: V4 Pro 500, V4 Flash 2500.
**Context:** 1M input, up to 384K output. OpenAI-compatible API.

**Production requirements:**
- Exponential backoff with jitter on 429/503
- Retry 1: 1-2s ±50% jitter → Retry 2: 4-8s → Retry 3: 16-32s → fallback
- Prefix caching: keep system prompt at front, identical across calls

### OpenRouter (free fallback)

**Rate limits (free tier):**
- 20 RPM per model
- 1,000 RPD with $10 deposit (50 RPD base)
- No TPM limit
- Limits are per-model, not aggregate

**Free models in catalog:**

| Model ID | Context | Creator |
|----------|---------|---------|
| `moonshotai/kimi-k2.6:free` | 262K | Moonshot |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | 1M | NVIDIA |
| `nvidia/nemotron-3-super-120b-a12b:free` | 1M | NVIDIA |
| `meta-llama/llama-3.3-70b-instruct:free` | 131K | Meta |
| `openai/gpt-oss-120b:free` | 131K | OpenAI |
| `z-ai/glm-4.5-air:free` | 131K | Z.AI |
| `qwen/qwen3-coder:free` | 1M | Alibaba |
| `deepseek/deepseek-r1:free` | 131K | DeepSeek |

### NVIDIA NIM (dev/test)

**Rate limits:** 40 RPM default, upgradable to 200 RPM. No daily cap. Credit-based, free.
**Base URL:** `https://integrate.api.nvidia.com/v1`
**Auth:** `$NVIDIA_NIM_API_KEY`

### Groq (smol only)

**Rate limits:**

| Model | RPM | RPD | TPM |
|-------|-----|-----|-----|
| llama-3.1-8b-instant | 30 | 14.4K | 6K |

Only viable for smol role (commit messages, classification). 6K TPM blocks agent
system prompts.

## Rejected / deprecated models

| Model | Provider | Reason | Date |
|-------|----------|--------|------|
| MiniMax-M2.7 | MiniMax | XML tool format, concatenated names, parameter casing errors | 2026-06-07 |
| deepseek-chat | DeepSeek | Ignores system prompt over long sessions, not agentic | 2026-06-08 |
| deepseek-reasoner | DeepSeek | Alias retiring 2026-07-24, migrated to deepseek-v4-pro | 2026-06-08 |
| qwen-3-32b | Cerebras | Removed from Cerebras API | 2026-06-08 |
| llama-3.3-70b | Cerebras | Removed from Cerebras API | 2026-06-08 |
| llama3.1-8b | Cerebras | Removed from Cerebras API | 2026-06-08 |
| qwen/qwen3-32b | Groq | 6K TPM limit, unusable for 15K system prompts | 2026-06-08 |
| llama-3.3-70b-versatile | Groq | 12K TPM limit, marginal for 15K system prompts | 2026-06-08 |
| All Cerebras models | Cerebras | Provider dropped all viable models from API | 2026-06-08 |
| All MiniMax models | MiniMax | Provider removed from catalog. M3 available for future testing | 2026-06-08 |
| All Mistral models | Mistral | Not used, removed to keep catalog clean | 2026-06-08 |
| DeepSeek V4 Pro (as default) | DeepSeek | Ignored structured output requirements (researcher: 42 turns, 0 findings). Writer timeout at 600s. Possible shared rate limiting. Retained for plan/review only | 2026-06-08 |

## Configuration files

Model identity is configured in multiple files. This is a known issue (see
ISSUES.md: "Model identity has no single source of truth"). Until resolved,
all files must be updated together.

### Where model is configured

| File | What it controls | Format |
|------|-----------------|--------|
| `settings.json` defaultProvider/defaultModel | Pi CLI runtime model selection + server metadata | `"deepseek"` / `"deepseek-v4-flash"` |
| `config.yml` modelRoles | Role-based routing (default, agentic, plan, smol) | `deepseek/deepseek-v4-flash` |
| `config.yml` fallbackChains | Ordered fallback when primary fails | Array of `provider/model` |
| `models.json` providers | API endpoints, auth, available model IDs | Provider objects with model arrays |

### File locations per agent

All config files live at `src/agents/{name}/.pi/agent/`:
- `settings.json` — runtime defaults
- `config.yml` — model roles + fallback chains
- `models.json` — provider catalog (shared, identical across agents)

### How to change the primary model

1. Update this document (decision log + approved models)
2. Update `models.json` — add model ID to provider's models array if not present
3. Update `settings.json` — change defaultProvider and defaultModel
4. Update `config.yml` — change modelRoles and fallback chains
5. Copy models.json to all agents:
   `for agent in researcher data writer coder qa publisher planner; do cp src/agents/researcher/.pi/agent/models.json src/agents/$agent/.pi/agent/models.json; done`
6. Rebuild: `docker compose build researcher data writer planner`
7. Restart: `docker compose up -d`
8. Verify: `curl localhost:808{1,2,3,4}/describe | jq .model`

Note: server.ts reads model identity from settings.json at boot. No separate
env var or server.ts edit needed. PI_PROVIDER/PI_MODEL env vars are accepted
as optional overrides but should not be set in docker-compose.

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
grep -r "defaultModel" src/agents/*/.pi/agent/settings.json
grep -r "default:" src/agents/*/.pi/agent/config.yml | head -7
```

## Immediate actions

1. **Apply for NIM 200 RPM upgrade.** Post request on NVIDIA Developer Forums. Free, routine, 1-5 days.
2. **Deposit $10 on OpenRouter if not done.** Unlocks 1,000 free RPD from 50.
3. **Implement prefix caching on DeepSeek.** System prompt at front, identical across calls. 99.8% input discount on cache hits.
4. **Add request counter for OpenRouter quota.** Stop routing at 800/day, reserve 200 for critical.
5. **Wire up backoff on DeepSeek.** Exponential + jitter on 429/503. Required for production.
6. **Test MiMo-V2.5-Pro.** Available via DeepInfra ($0.435/M). If it matches V4 Pro quality, can replace as sonnet-tier fallback.

## Migration timeline

| Deadline | Action | Status |
|----------|--------|--------|
| 2026-07-24 | Remove `deepseek-chat` and `deepseek-reasoner` references | Done (removed from models.json) |
| Ongoing | Monitor OpenRouter free model availability | Active |
| Ongoing | Monitor Groq TPM limits for smol role | Active |
| Pending | Test MiMo-V2.5-Pro as sonnet-tier fallback | Not started |
| Pending | Test NIM GLM-5.1 for dev/test parity with V4 Pro | Not started |

Sources:
- [NVIDIA NIM Qwen Models](https://build.nvidia.com/qwen)
- [NVIDIA NIM GLM-5](https://docs.api.nvidia.com/nim/reference/z-ai-glm5)
- [NVIDIA NIM GLM-5.1](https://docs.api.nvidia.com/nim/reference/z-ai-glm5.1)
- [OpenRouter Free Models](https://costgoat.com/pricing/openrouter-free-models)
- [DeepSeek API Pricing](https://api-docs.deepseek.com/quick_start/pricing)
- [Groq Rate Limits](https://console.groq.com/docs/rate-limits)
- [BFCL v3 Leaderboard](https://pricepertoken.com/leaderboards/benchmark/bfcl-v3)
- [MiMo-V2.5-Pro on OpenRouter](https://openrouter.ai/xiaomi/mimo-v2.5-pro)
- [MiMo-V2.5-Pro Providers](https://artificialanalysis.ai/models/mimo-v2-5-pro/providers)
