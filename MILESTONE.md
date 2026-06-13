# Milestones

## M0: Platform Proof-of-Concept — COMPLETE

Faceless Instagram/TikTok channel analysis used to validate multi-agent orchestration. Agents register, receive tasks, heartbeat, delegate, and transition status via pi-subagents-http. Writer synthesis failed due to upstream findings format issues (addressed in M0.1). Completed 2026-05-27.

---

## M0.1: Subsystems Wired — MOSTLY COMPLETE

Same brief as M0 but with every subsystem wired correctly. The goal is proving agents work as a system, not just that they can talk to each other.

### What's done

- Artifact store: Bun service + Postgres metadata + MinIO blob storage, RBAC via rbac.json, artifact:// URI scheme, HTTP client in extensions/artifacts/client.ts
- Structured logging: Pino + OTel shipping to OpenObserve (replaced Aspire Dashboard)
- OTel traces: pi-otel → OTel Collector (gRPC :4317) → OpenObserve. Spans: pi.interaction, pi.turn, pi.llm_request per agent invocation
- Standardized workproducts: ADMIRALTY-graded findings via workproduct-lib, JSONL persistence
- Concurrent server: Fastify v5 HTTP server (server.mjs) with SessionManager, per-container MAX_CONCURRENT_SESSIONS
- Planner delegation: pi-subagents-http vendored extension, parallel task dispatch via `tasks: [...]`
- Writer fanout pipeline: parallel section subagents via pi-subagents (local), fan-in synthesis
- RBAC: glob-pattern access control per agent, enforced at artifact service
- All agents on DeepSeek V4 Flash with free fallback chain (Kimi K2.6, GPT-OSS 120B)

### What's NOT done

- Mid-run jidoka escalation — currently warns but doesn't abort or inject correction
- Researcher parallel tool fanout — deep_research + Apify + web_search concurrently

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
- [x] Programmatic output validation (jidoka.ts — zero-output, required tools, max turns, mid-run warnings)
- [x] Data agent functional (DuckDB SQL, record_query_result, record_metric, record_chart, record_dataset_ref)
- [x] Session isolation (per-invocation /workspace/sessions/{id}/, E2E-35 11/11)
- [x] Artifact replication (fs.watch + .meta.json sidecar convention, agent-complete gate)

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

## M1.5: Artifact Lineage — Query Layer and UI — SUPERSEDED

Built lineage tracking (artifact_edges, graph endpoints, React Flow UI). Completed
2026-06-09 then removed as part of R1 refactor — OTel traces replaced artifact-level
lineage. All lineage code, endpoints, UI, and tests deleted.

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

No longer blocked on M1 (done). Blocked on: researcher parallel tool fanout (research quality).

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

No longer blocked on M1 (done). Blocked on: researcher parallel tool fanout (multi-source intelligence gathering).

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

No longer blocked on M1 (done). Blocked on: researcher parallel tool fanout (multi-niche concurrent research).

### Status

Not started.

---

## M5: Niche Growth Analysis — IG & TikTok in Tech/AI/Creator Space

Production-quality social media growth analysis across Instagram and TikTok. Covers tech-adjacent niches (AI, building in public, vibe coding, AI agencies, solopreneurs, tech opinion/investing/news) segmented by follower tier (0-1k, 1-10k, 10-50k, 50-100k, 100k+). Structured data model for growth, engagement, and monetization metrics. Deliverables: detailed analytical report + ready-to-publish IG carousel decks + TikTok content pieces. This is the high-bar version of what M0 prototyped.

Spec: `tasks/specs/niche-growth-analysis.md`

### Success criteria

- [ ] Researcher uses multiple tools (deep_research + Apify + web_search) with at least 30% primary platform data
- [ ] Structured findings cover at least 3 of 5 follower tiers and 3 of 5+ niches
- [ ] Data agent computes tier benchmarks, cross-tier comparisons, engagement/growth metrics from raw findings
- [ ] Report is 3,000+ words, analytical tone, data-backed, with per-tier and per-niche sections
- [ ] Report contains actionable recommendations (specific, not generic) and anti-patterns
- [ ] At least 3 IG carousel decks rendered by coder using design system components
- [ ] At least 2 TikTok content pieces (scripts or visual decks) with platform-native tone
- [ ] Social content uses data from the report — not generic advice
- [ ] Final bundle: 10+ artifacts with traceable lineage from research → analysis → report → content
- [ ] E2E test validates quality (finding specificity, tone, data references, tool diversity, bundle completeness) not just existence
- [ ] Pipeline completes autonomously — no manual intervention beyond initial prompt

### E2E test approach

E2E-60 checks quality, not just pass/fail. Key quality gates:

**Researcher:** tool diversity (2+ tools), finding specificity (50%+ contain handles or numbers), primary data (5+ Apify findings), tier/niche coverage, anti-patterns present, ADMIRALTY grades varied.

**Data agent:** SQL queries ran, metrics computed, cross-tier comparison, at least 1 chart.

**Report:** length, structure (tier + niche sections), 10+ specific numbers cited, confidence hedging, 5+ actionable recs, anti-patterns, analytical tone (no hype words).

**Social content:** 3+ IG pieces, 2+ TikTok pieces, tone shift from report, hooks present, data references, platform differentiation.

**Coder:** design system components used, 3+ rendered slide images, multiple carousel concepts.

**Bundle:** report + research data + IG slides + TikTok content + captions + lineage chain. 10+ total artifacts.

### Blockers

- Researcher parallel tool fanout — critical for multi-source research quality
- Planner routing to coder for carousel rendering (partially done via routing hints)

### Status

Not started.

---

## R1: Provenance and Artifact Architecture Refactor — COMPLETE

Replaced tangled artifact/provenance system. Introduced per-agent tool policies for
workproduct enforcement. Old lineage system (graph.ts, lineage-ui, artifact_edges)
removed. Marquez + OpenLineage provenance extension built and tested, then removed
when OTel traces proved sufficient as sole observability system.

Branch: `refactor/provenance-openlineage`

### What shipped

- Per-agent tool policies in all 7 agent.json configs (researcher/writer/data/qa/publisher block native write+edit, coder full access, planner delegates only)
- Removed old lineage system: graph.ts, lineage-ui/, artifact_edges table, lineage endpoints, graphology deps, readLog tracking, provenance.jsonl (net -2533 lines)
- Removed Marquez + provenance extension: extensions/provenance/ (3 files, 334 lines), Marquez services from docker-compose, marquez DB from init-artifact-db.sql
- Restored .meta.json sidecar creation in write_artifact (replicator trigger mechanism)
- Fixed activeTraceId concurrency bug in subagent-http (module-scoped → closure-scoped)

### Success criteria

- [x] Tool policy enforcement blocks disallowed tools per agent config
- [x] Old lineage system fully removed (graph.ts, lineage-ui, artifact_edges, readLog)
- [x] Marquez + provenance extension fully removed
- [x] Artifact replication preserved (write_artifact creates .meta.json sidecars for replicator)
- [x] All agent.json configs have toolPolicy defined
- [x] OTel traces sole observability system — cross-agent trace propagation working

Completed 2026-06-13.
