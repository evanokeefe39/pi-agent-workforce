# pi-agent-workforce

Multi-agent workforce powered by [Pi](https://github.com/badlogic/pi-mono) agents in Docker containers, orchestrated via [pi-subagents-http](https://github.com/nicobailon/pi-subagents).

## Agents

| Agent | Port | Role |
|-------|------|------|
| Researcher | 8082 | Web research, structured findings with ADMIRALTY grading |
| Data | 8083 | Data scraping, ETL, database analytics |
| Writer | 8084 | Document generation, style engine, copy formulas |
| Coder | — | Code execution and analysis (not deployed yet) |
| QA | — | Review gating, verdicts (not deployed yet) |
| Publisher | — | Content distribution with HITL gating (not deployed yet) |

## How it works

A Pi session on the host uses the `pi-subagents-http` extension to delegate tasks:

```
subagent({ agent: "researcher", task: "Research X" })       # blocks until done
subagent({ tasks: [{ agent: "researcher", task: "A" },
                    { agent: "writer", task: "B" }] })      # parallel
subagent({ action: "list" })                                 # discovery
```

Each agent runs in its own container with isolated dependencies, its own LLM provider, and specialized extensions.

## Setup

See [CLAUDE.md](CLAUDE.md) for quick start instructions.

## Infrastructure

- **MinIO** — S3-compatible artifact storage
- **Postgres** — Artifact metadata + search
- **OpenObserve** — Traces, logs, metrics via OTel
- **Artifact Service** — Bun HTTP service bridging agents ↔ MinIO/Postgres

## Background

Architecture chosen after evaluating Paperclip (issue-based delegation) and pi-subagents (subprocess spawning). See [paperclip-eval EVALUATION.md](https://github.com/evanokeefe39/paperclip-eval/blob/main/EVALUATION.md) for the full comparison.
