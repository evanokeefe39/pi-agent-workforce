# V2 Phase 3 Implementation Plan

Branch: `refactor/provenance-openlineage`
Spec: `tasks/specs/provenance-and-artifact-architecture-v2.md`

## Decision: Writer social workproduct deferred

Writer already has 5 workproduct tools (record_report, record_guide, record_article, record_marketing_copy, record_newsletter). Missing social/derivative formats (carousel_brief, caption, thread, anchor_outline, build_diary) deferred to separate feature branch with own spec. This branch only adds publish_artifact to writer's permissions and requiredTools.

---

## Phase 3A — Revert erroneous sidecar restoration ✅

- [x] Revert .meta.json sidecar creation in `src/agents/extensions/artifacts/index.ts`
- [x] write_artifact tool deleted (replaced by publish_artifact)

---

## Phase 3B — Create publish_artifact tool ✅

- [x] Added `publish_artifact` tool to `src/agents/extensions/artifacts/index.ts`
  - Reads file from disk, base64 encodes, POSTs via `client.writeRaw()`
  - Supports binary files (PNG, PDF) via file_path param
  - Returns `{ ref, id, size, hash }`
- [x] Added publish_artifact to provenance classifications.ts (WRITE)

---

## Phase 3C — Delete write_artifact + replicator + sidecars ✅

- [x] Deleted `write_artifact` tool from artifacts/index.ts
- [x] Deleted all .meta.json sidecar creation (artifacts/index.ts + data workproduct.ts)
- [x] Deleted `src/agents/replicator.ts` (203 lines)
- [x] Removed from server.ts: replicator import, REPLICATION_TIMEOUT_MS, initReplicator, startWatcher, waitForSession gate
- [x] Cleaned data agent: removed sidecar code, provenance.jsonl appending, unused imports (createHash, METHOD_MAP, extractInputs)
- [x] Updated Dockerfile: removed replicator.ts from COPY commands

---

## Phase 3D — Extract tool-policy from provenance extension ✅

Finding: pi-permissions.jsonc is NOT enforced by SDK — only agent.json toolPolicy via provenance extension hook was active. Created standalone extension.

- [x] Created `src/agents/extensions/tool-policy/index.ts` — reads agent.json directly, blocks tools per policy
- [x] Removed toolPolicy enforcement from provenance/index.ts (lines 52-63)
- [x] Removed TOOL_ALTERNATIVES from provenance
- [x] Removed toolPolicy from ProvenanceContext interface
- [x] Removed toolPolicy from server.ts (.provenance-context.json no longer carries it)
- [x] Added tool-policy extension to Dockerfile COPY commands

---

## Phase 3E — Update agent configs ✅

- [x] All 7 agents: replaced write_artifact → publish_artifact in pi-permissions.jsonc
- [x] All 7 agents: replaced write_artifact → publish_artifact in agent.json (requiredTools + toolPolicy)
- [x] Coder: added publish_artifact to toolPolicy (was not present before)
- [x] Jidoka unit tests updated (25/25 pass)

---

## Phase 3F — Fix provenance emission ✅ (partial)

- [x] Fixed RUNNING_INTERVAL: 30 → 10
- [ ] Add output facets to COMPLETE events (piAgent_admiralty, piAgent_artifactType) — deferred to Docker testing
- [ ] Debug OpenLineage HTTP POST to Marquez — requires running containers

---

## Phase 3G — Update AGENTS.md documentation ✅

- [x] All 7 agents: documented write → publish two-step pattern
- [x] Added few-shot examples in first 10 lines per lessons.md guidance
- [x] Updated skills, workproduct extensions, reference docs (23+ file changes)
- [x] Updated CLAUDE.md workproduct standard
- [x] Updated e2e-55 assertion to check publish_artifact
- [x] Updated all test prompts and assertions (23 replacements across 9 test files)

---

## Phase 3H — Validation (partial — Docker off)

- [x] Static tests pass: e2e-53 (23/23), e2e-55 (17/17)
- [x] Jidoka unit tests: 25/25 pass
- [x] Codebase grep: no stale write_artifact refs in active code (only historical docs + 2 intentional backward-compat refs)
- [ ] Docker rebuild all agent images — deferred (Docker Desktop off)
- [ ] E2E-00 smoke test — deferred
- [ ] Verify artifacts appear in MinIO after publish_artifact calls — deferred
- [ ] Verify OpenLineage events reach Marquez API — deferred

---

## Out of scope (this branch)

- Writer social workproduct tools (carousel_brief, caption, thread, etc.) → own spec + branch
- Mid-run jidoka escalation (warns but doesn't abort) → separate feature
- Planner SDK crash on multi-hop chains → ISSUES.md, SDK bug
- Output facets on COMPLETE events → Docker testing phase
- Marquez debugging → Docker testing phase
