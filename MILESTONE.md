# Milestones

## M0: Platform Proof-of-Concept — COMPLETE

Faceless Instagram/TikTok channel analysis used to validate multi-agent orchestration. Agents register, receive tasks, heartbeat, delegate, and transition status via pi-subagents-http. Writer synthesis failed due to upstream findings format issues (addressed in M0.1). Completed 2026-05-27.

---

## M0.1: Subsystems Wired — MOSTLY COMPLETE

Same brief as M0 but with every subsystem wired correctly. The goal is proving agents work as a system, not just that they can talk to each other.

### What's done

- Artifact store: Bun service + Postgres metadata + MinIO blob storage, RBAC via rbac.json, artifact:// URI scheme, HTTP client in extensions/artifacts/client.ts
- Structured logging: Pino + OTel shipping to OpenObserve (replaced Aspire Dashboard)
- Standardized workproducts: ADMIRALTY-graded findings via workproduct-lib, JSONL persistence
- Concurrent server: Fastify v5 HTTP server (server.mjs) with SessionManager, per-container MAX_CONCURRENT_SESSIONS
- Planner delegation: pi-subagents-http vendored extension, parallel task dispatch via `tasks: [...]`
- Writer fanout pipeline: parallel section subagents via pi-subagents (local), fan-in synthesis
- RBAC: glob-pattern access control per agent, enforced at artifact service
- All agents on DeepSeek V4 Flash with free fallback chain (Kimi K2.6, GPT-OSS 120B)

### What's NOT done

- Programmatic output validation (jidoka hooks) — no automated quality gates on agent output
- Data agent proper implementation — container exists but agent lacks meaningful ETL/analysis capability

### Success criteria

- [x] Planner delegates all research work via subagent tool
- [x] Researcher writes structured findings using workproduct/findings system (ADMIRALTY-graded, JSONL-persisted)
- [x] Writer reads Researcher findings from artifacts and synthesizes report
- [ ] Final report delivered as artifact with cross-platform comparison and actionable insights
- [x] All agents produce structured logs visible in OpenObserve
- [x] Permissions use layered model — no BRIDGE_EXTENSIONS env var
- [x] Workproducts follow standardized format (ULID, session ID, validated fields)
- [x] Artifacts stored via artifact service with artifact:// URIs
- [x] Full agent turn traces visible in OpenObserve (LLM calls, tool executions, timing)
- [ ] No manual intervention beyond initial prompt
- [ ] Programmatic output validation (jidoka hooks)
- [ ] Data agent functional for ETL/analysis tasks

---

## M1: Artifact Store v2 — COMPLETE

Bun-based REST service, MinIO for blob storage, Postgres for metadata. Agents interact over HTTP via extensions/artifacts/client.ts. RBAC enforced at the service layer. `docker compose up -d` brings up full stack from clean state.

### Success criteria

- [x] `docker compose up -d` brings up full stack (Postgres, MinIO, artifact service, OpenObserve, agents)
- [x] Agent writes artifact via `write_artifact` and gets `artifact://` URI back
- [x] Another agent reads artifact via `read_artifact` with that URI
- [x] `list_artifacts` returns filtered results from artifact service
- [x] RBAC enforced (agent can't write outside own namespace, read rules respected)
- [x] MinIO Console at :9001 shows stored blobs

Completed as part of M0.1 infrastructure work. Spec: `tasks/specs/artifact-store-v2.md`.

---

## M0.5: Ad Hoc Scraping — Design Aesthetics from Instagram

Extract a structured taxonomy of every design aesthetic, style, and visual movement referenced by @vinny_creative on Instagram. Tests the Apify integration + data agent in a small, self-contained scope. Good next target.

### Success criteria

- [ ] Structured output with at least 20 distinct design aesthetics/movements
- [ ] Each aesthetic traceable to source post(s)
- [ ] Agent completes in a single ad hoc session
- [ ] Agent escalates appropriately if blocked (auth walls, rate limits, content locked in video)

### Status

Not started.

---

## M2: Social Media Trend Analysis for the Developer Space

Full research task across X/Twitter, LinkedIn, YouTube, Bluesky, Threads. Four dimensions: trends, established growth accounts, fast-rising new accounts, legacy accounts. Deliverables: trend report, account taxonomy, pattern library, actionable recommendations.

### Success criteria

- [ ] Agents can discover and profile accounts across at least two platforms
- [ ] Trend detection produces non-obvious insights (not just "AI is popular")
- [ ] Account categorization is defensible with data
- [ ] Pattern library contains at least 10 distinct, replicable templates
- [ ] Final report is useful to someone entering the space cold

### Blockers

No longer blocked on M1 (done). Blocked on: jidoka hooks (output reliability), data agent implementation (analysis capability), researcher parallel tool fanout (research quality).

### Status

Not started.

---

## M3: AI Model Intelligence Pipeline

Recurring agent-driven intelligence system tracking the LLM/AI model landscape. Weekly briefs, monthly deep-dives, model comparison cards, competitive displacement tracker. Six dimensions: adoption leaders, why they win, how they're used, challenger models, sovereign AI/open-source, self-hosting economics.

### Success criteria

- [ ] Planner decomposes goal into recurring issues with appropriate cadences
- [ ] Researcher can discover and track model releases, community adoption signals, and self-hosting stories
- [ ] Writer produces standardized model comparison cards with consistent format
- [ ] At least 3 weekly briefs delivered with actionable intelligence
- [ ] At least 1 monthly deep-dive completed
- [ ] Self-hosting cost comparison delivers concrete economics for at least 2 model families
- [ ] Competitive displacement tracker surfaces at least 3 documented real-world migrations

### Blockers

No longer blocked on M1 (done). Blocked on: jidoka hooks (reliability for recurring output), data agent implementation (automated tracking), researcher parallel tool fanout (multi-source intelligence gathering).

### Status

Not started.

---

## M4: YouTube Revenue Intelligence — Faceless Channels & Ambience Niche

Two-phase research: Phase 1 wide survey of faceless YouTube channels across 8 niches, Phase 2 deep-dive into cozy ambience/lo-fi/soundscape. Deliverables: landscape report, deep-dive report, opportunity map, example channel P&L.

### Success criteria

- [ ] Phase 1 covers at least 6 of 8 target niches with data-backed revenue estimates
- [ ] At least 3 exemplar channels per niche with estimated monthly revenue ranges
- [ ] Phase 2 deep-dive analyzes at least 4 of 7 ambience sub-niches
- [ ] TAM estimate backed by observable data
- [ ] Opportunity map contains at least 8 specific, ranked ideas
- [ ] Example channel P&L with pessimistic/base/optimistic scenarios

### Blockers

No longer blocked on M1 (done). Blocked on: jidoka hooks (reliability), data agent implementation (YouTube Data API tooling, automated scraping at scale), researcher parallel tool fanout (multi-niche concurrent research).

### Status

Not started.
