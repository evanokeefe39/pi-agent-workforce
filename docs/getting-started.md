# Getting Started

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) with Docker Compose v2
- At least one LLM provider API key (DeepSeek recommended — $0.10/M tokens)
- ~8 GB free RAM (all agents + infrastructure)
- Git

## Setup

### 1. Clone and configure

```bash
git clone https://github.com/evanokeefe39/pi-agent-workforce.git
cd pi-agent-workforce
cp .env.example .env
```

Edit `.env` and add your API keys. At minimum you need `DEEPSEEK_API_KEY`. Optional keys enable fallback chains and additional capabilities:

| Key | Purpose | Required |
|-----|---------|----------|
| `DEEPSEEK_API_KEY` | Primary LLM provider for all agents | Yes |
| `OPENROUTER_API_KEY` | Free model fallback chains | Recommended |
| `EXA_API_KEY` | Web search (researcher agent) | For research tasks |
| `APIFY_API_TOKEN` | Web scraping (researcher/data agents) | For scraping tasks |
| `GROQ_API_KEY` | Groq free tier (smol tasks) | Optional |
| `NVIDIA_NIM_API_KEY` | NIM free tier (dev/test) | Optional |

### 2. Build and start

```bash
docker compose up -d --build
```

First build takes 5-10 minutes (installs Pi SDK, Python, Chromium, etc.). Subsequent builds use Docker layer cache.

### 3. Wait for health

Agents take ~60 seconds to initialize (Pi SDK extension loading).

```bash
# Watch containers come up
docker compose ps

# Check a specific agent
curl http://localhost:8082/health | jq .status
```

All agents should report `"status": "ok"`.

### 4. Send your first task

```bash
# Direct agent invocation (researcher)
curl -X POST http://localhost:8082/invoke \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Research the top 3 AI agent frameworks. Record findings with ADMIRALTY grades. Publish as a dataset artifact."}'
```

This returns immediately with a run ID:

```json
{ "runId": "abc123", "status": "accepted" }
```

Poll for the result:

```bash
# Check progress
curl http://localhost:8082/status/abc123

# Get result when complete
curl http://localhost:8082/result/abc123 | jq .
```

### 5. Use the planner for multi-agent tasks

The planner orchestrates multi-step workflows across agents:

```bash
curl -X POST http://localhost:8081/invoke \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Research the current state of AI agent frameworks, then write a comparison report with recommendations."}'
```

The planner will:
1. Delegate research to the researcher agent
2. Wait for findings
3. Delegate report writing to the writer agent
4. Return the final output

## Viewing traces

Open [http://localhost:5080](http://localhost:5080) for OpenObserve. Login with the credentials from `.env` (defaults: `admin@example.com` / `pi-agent-workforce`).

Navigate to Traces to see the full execution tree — every agent invocation, LLM call, and tool execution as spans.

## Viewing artifacts

Query the artifact service directly:

```bash
# List recent artifacts
curl http://localhost:8090/artifacts?limit=10 \
  -H "x-agent-name: system" | jq .

# Get a specific artifact
curl http://localhost:8090/artifacts/{id} \
  -H "x-agent-name: system"
```

## Stopping

```bash
docker compose down       # stop containers, keep data
docker compose down -v    # stop and delete all data (postgres, minio, workspaces)
```

## Troubleshooting

**Agent stuck in "starting" state:** Pi SDK initialization takes ~60s. Check logs:
```bash
docker logs pi-agent-workforce-researcher-1 --tail 50
```

**429 from planner:** All concurrent slots are busy. The planner only runs 1 session at a time. Wait for the current run to complete or cancel it.

**Empty output / "failed" state:** Check jidoka validation. The agent may have hit maxTurns or failed to call required tools. Look for `andon_*` log events:
```bash
docker logs pi-agent-workforce-researcher-1 2>&1 | grep andon
```

**No traces in OpenObserve:** Verify the OTel collector is healthy and `ZO_OTLP_AUTH` in `.env` matches the OpenObserve credentials.
