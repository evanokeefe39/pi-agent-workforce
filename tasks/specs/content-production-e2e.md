# Content Production End-to-End Pipeline

## Intent

Run the full content production chain — Planner decomposes a visual content request into Writer → Coder → Publisher phases, each agent produces artifacts consumed by the next, and the pipeline ends with a staged platform-ready package awaiting HITL approval. This is the first end-to-end test of the content production routing and rendering delegation that was configured last session.

The deliverable is a real rendered carousel (5 PNG slides) assembled into an Instagram-ready package with caption, hashtags, and scheduling metadata. The user can see the actual output.

## Context Package

### Relevant existing code

- `src/agents/planner/.pi/agent/AGENTS.md` — Content Production Routing section with chain table. For "social post with visuals": Writer → Coder → Publisher.
- `src/agents/planner/.pi/agent/extensions/subagent-http/config.json` — all 5 agents registered (researcher, data, writer, coder, publisher).
- `src/agents/writer/.pi/agent/AGENTS.md` — 3-phase pipeline (PLAN → WRITE → ASSEMBLE). Produces content brief artifacts.
- `src/agents/coder/.pi/agent/AGENTS.md` — rendering workflow. Reads render briefs, produces PNGs/PDFs.
- `src/agents/publisher/.pi/agent/AGENTS.md` — 6-phase pipeline (RECEIVE → ASSEMBLE → CHECKLIST → STAGE → PUBLISH → TRACK). Produces platform-ready packages.
- `project/design-system/` — populated by design-system-foundation spec (dependency).
- `tests/e2e/e2e-30-instagram-growth-research.sh` — existing planner pipeline test (research-focused, currently fails silently).

### Dependencies (must be done first)

1. Design system foundation — `/project/design-system/` populated with tokens, components, templates
2. Coder rendering smoke test — confirms coder can render before we chain it into a pipeline
3. All services running: planner, writer, coder, publisher, artifact-service, postgres, minio

### The test scenario

Goal sent to planner: "Create a 5-slide Instagram carousel about the top 5 AI coding tools for developers in 2026. Dark theme, branded styling. Include a title slide and a CTA slide."

Expected planner decomposition:
- Phase 1: Writer produces content brief (title, 5 tool descriptions, CTA text, hashtags)
- Phase 2: Coder renders 5 carousel slides from the content brief using the design system
- Phase 3: Publisher assembles platform package (slides + caption + hashtags + scheduling metadata)

This tests:
- Planner correctly identifies this as a "social post with visuals" chain (Writer → Coder → Publisher)
- Writer produces a content brief artifact that Coder can consume
- Coder reads the design system, renders 5 slides at 1080×1350
- Publisher assembles the final package with pre-publish checklist
- Artifacts flow between agents via the artifact service
- The full chain completes within a reasonable timeout

## Implementation

### Test script

`tests/e2e/e2e-52-content-production-pipeline.sh`

### Test structure

**Setup:** Verify all 5 agents + artifact-service healthy. Take artifact snapshot.

**Phase 1 — Dispatch:**
POST to planner /invoke with the carousel goal. Record run ID.

**Phase 2 — Wait:**
Poll planner /status until completed or timeout (900s — three agents in sequence, each may take 2-5 minutes).

**Phase 3 — Verify planner orchestration:**
- Planner completed (not failed/timeout)
- Planner output mentions writer, coder, publisher delegation
- At least 3 subagent calls made (one per agent in the chain)

**Phase 4 — Verify artifacts produced:**
- New artifacts exist since snapshot
- At least one artifact from writer namespace (content brief)
- At least one artifact from coder namespace (rendered slide)
- At least one artifact from publisher namespace (platform package)

**Phase 5 — Verify rendering quality (best-effort):**
- Coder artifacts include PNG files
- If dimensions checkable, verify 1080×1350
- Publisher artifact includes caption text and hashtags

**Phase 6 — Save sample output:**
Copy rendered slides and publisher package to `tests/results/e2e-52-sample/` so user can inspect.

### Tests (16 total)

1. All agents healthy (planner, writer, coder, publisher, artifact-service)
2. Planner dispatches successfully (runId returned)
3. Planner completes within timeout
4. Planner output references writer delegation
5. Planner output references coder delegation
6. Planner output references publisher delegation
7. New artifacts created during run
8. Writer artifact exists (content brief)
9. Coder artifact exists (rendered output)
10. Publisher artifact exists (platform package)
11. Writer artifact contains content text
12. Coder artifact is image/PNG type
13. Publisher artifact contains caption
14. Publisher artifact contains hashtags
15. Chain completed in correct order (writer before coder before publisher, by timestamp)
16. Sample output saved to results directory

## Behavioral Contracts

GIVEN a visual content goal sent to planner
WHEN planner decomposes using Content Production Routing
THEN planner creates a Writer → Coder → Publisher chain (3 sequential phases)

GIVEN writer receives a content brief task from planner
WHEN writer completes
THEN writer publishes a content brief artifact readable by coder

GIVEN coder receives a rendering task referencing writer's content brief
WHEN coder completes
THEN coder publishes 5 carousel slide PNG artifacts at 1080×1350

GIVEN publisher receives an assembly task referencing coder's rendered slides
WHEN publisher completes
THEN publisher produces a platform package artifact with caption, hashtags, slide references, and HITL staging status

GIVEN the full chain Writer → Coder → Publisher
WHEN all agents complete
THEN artifact lineage shows derivation: writer brief → coder slides → publisher package

## Edge Cases

1. Planner routes incorrectly (skips Coder, sends directly to Publisher) — test fails at "coder artifact exists" check. Root cause: planner routing hints not followed.
2. Writer produces unstructured output instead of content brief artifact — coder can't consume it. Test fails at artifact verification.
3. Coder renders at wrong dimensions — check dimensions if possible, log as quality issue if not.
4. Publisher skips checklist — test can't verify this directly (checklist is internal to publisher). Future: check publisher output for checklist results.
5. Timeout — 900s may not be enough for 3 sequential agent runs. Planner may need higher timeout for multi-hop chains. Log partial results on timeout.
6. Agent connectivity — coder or publisher may not be reachable if Docker services aren't up. Health check catches this.

## Definition of Done

- [ ] Test script at `tests/e2e/e2e-52-content-production-pipeline.sh`
- [ ] All 5 services + artifact-service start and pass health checks
- [ ] Planner correctly decomposes into Writer → Coder → Publisher chain
- [ ] Each agent produces at least one artifact
- [ ] Rendered carousel slides are PNG at correct dimensions
- [ ] Publisher produces platform package with caption + hashtags
- [ ] Sample output saved for user inspection
- [ ] Test follows existing E2E patterns (jsonl-helpers.sh, pass/fail)

## Negative Space

Out of scope: testing all content types (just carousel). Testing HITL approval flow (Publisher stages but we don't simulate human approval). Testing researcher or data agent in the chain (this is a visual content test, not a research test). Performance optimization. Testing failure recovery (what happens when coder fails mid-chain).

Not changing: any agent AGENTS.md, server.ts, docker-compose.yml, artifact service. This test exercises the existing implementation as-is.
