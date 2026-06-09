# Known Issues

## OPEN: V4 Pro unsuitable as default agentic model

**Status:** Open
**Severity:** Critical

**Problem:** DeepSeek V4 Pro ignores structured output requirements when used as the default agentic model. Researcher ran 42 turns producing markdown prose with 0 findings recorded via `record_finding`. Writer timed out at 600s twice. Possible DeepSeek shared rate limiting contributing to writer timeouts.

**Evidence:**
- Researcher: 42 turns, 0 `record_finding` calls, output was unstructured markdown
- Writer: 600s timeout hit twice in succession
- V4 Flash (cheaper model) follows structured output requirements correctly

**Current status:** V4 Pro demoted to plan/review fallback only. V4 Flash is the default agentic model for all workers.

**Remaining work:** Evaluate whether V4 Pro can be used reliably for non-agentic tasks (planning, review) or if it should be removed from fallback chains entirely.

---

## OPEN: Writer invents confidence scales instead of passing through ADMIRALTY grades

**Status:** Open
**Severity:** Medium

**Problem:** Writer fabricates H/M/L confidence ratings instead of passing through the ADMIRALTY grades (A-F reliability, 1-6 credibility) attached to findings. The planner reinforced this by telling the writer to use H/M/L in its delegation brief.

**Fix applied:** Citation format added to `src/agents/writer/.pi/agents/section-writer.md` specifying ADMIRALTY grade passthrough.

**Remaining work:** Test that the section-writer actually uses ADMIRALTY grades in output. Verify planner delegation briefs no longer instruct writer to use H/M/L.

---

## OPEN: E2E-30 report generation fails silently

**Status:** Open
**Severity:** Medium

**Problem:** E2E-30 full pipeline test produces no report file. `write_report` fails silently when the LLM-as-judge section errors. Test output is truncated, masking the failure.

**Next steps:**
- Investigate LLM-as-judge section error in E2E-30
- Make `write_report` fail loudly when a section errors instead of silently dropping
- Ensure test output is not truncated so failures are visible

---

## PARTIALLY RESOLVED: Agents ignore standard output format under abstract briefs

**Status:** Partially resolved
**Severity:** High

**What changed:** V4 Flash follows structured output requirements (record_finding workflow, JSONL artifacts). V4 Pro does not (42 turns, 0 findings). Prompt-only enforcement is model-dependent.

**Remaining work:** Programmatic enforcement via hooks is still needed. Mid-run validation should detect when an agent has consumed N turns without producing expected artifacts and intervene. Prompt-only enforcement is insufficient across model changes.

---

## PARTIALLY RESOLVED: Model identity has no single source of truth

**Status:** Partially resolved
**Severity:** High

**What changed:** server.mjs now reads from settings.json at boot. PI_MODEL/PI_PROVIDER removed from docker-compose.yml. Down from 4 sources of truth to 2.

**Remaining sources:**
| Source | What it controls |
|--------|-----------------|
| `settings.json` defaultProvider/defaultModel | Pi CLI runtime model selection + server.mjs reporting |
| `config.yml` modelRoles | Role-based model routing, fallback chains |

**Remaining work:** config.yml and settings.json still require manual alignment. When the default model changes, both files in every agent must be updated. A single source of truth (one file generates or validates the other) has not been implemented.

---

## OPEN: Agents need hardening with jidoka/hooks for mid-run validation

**Status:** Open
**Severity:** High

**Problem:** When a model provider removes models or goes down, agents silently return empty responses. No error, no fallback, no alert. The Pi SDK treats a 0-token completion as success. Beyond provider failures, agents can also silently produce wrong-format output for many turns without any programmatic check.

**This ties to Toyota Production System principles:**
- **Jidoka** (autonomation): detect abnormality, stop the line, fix, resume. Agents should detect mid-run that output format is wrong and self-correct.
- **Andon cord**: programmatic signal that something is wrong (0-token completion, N turns without expected artifact, output format mismatch).
- **Poka-yoke**: make it impossible to produce wrong output (hooks that validate each turn's output against expected schema).

**Failure modes observed:**
1. Provider removes model (Cerebras dropped Qwen3 32B) -> Pi SDK returns empty completion -> server reports "completed" with 0 output -> tests pass
2. Model ignores structured output format (V4 Pro, 42 turns, 0 findings) -> no mid-run detection
3. API key expires -> silent empty response
4. Rate limiting -> unknown behavior, may silently degrade

**Hardening needed:**
- **server.mjs:** Detect 0-token completions and treat as failure. Log clear error on 0 output tokens. Report actual model used from API response, not configured model.
- **Mid-run hooks:** After every N turns, validate that expected artifacts exist. If researcher has run 10 turns with 0 `record_finding` calls, raise andon. If writer has run 15 turns with no section output, raise andon.
- **Tests:** E2E tests should check output length as baseline assertion (output > 100 chars). Add model smoke test before full suite. Test fallback chain behavior.
- **Monitoring:** Alert on 0 output token completions via OpenObserve/OTLP. Track model identity per request from API response.

---

## OPEN: Researcher should fan out deep_research + Apify + web_search in parallel

**Status:** Open
**Severity:** Medium

**Previous framing:** "Researcher does not use Apify." The issue is broader: researcher should fan out deep_research, Apify, and web_search in parallel rather than treating them as a hierarchy.

**Current behavior:** Researcher independently chooses to scrape structured aggregators for profile metrics. Uses web_scrape for first-party-ish data, web_search for context. Acceptable but suboptimal.

**Desired behavior:** For any research task, researcher fires deep_research + Apify + web_search concurrently, then merges and deduplicates findings. Apify gives actual API data (A1 reliability). Aggregators are B2. Web search articles are C3.

**Additional gap:** Data agent needs implementation for numerical analysis of scraped data. Currently data agent can scrape but does not perform statistical or trend analysis on the results.

---

## OPEN: Writing-style extension tools not usable by writer agent

**Status:** Investigating
**Severity:** Medium — writer adapts by crafting its own style block, but misses mechanical validation

**Symptoms:** Writer agent said "I don't have a get_style_instructions tool" and crafted its own style block manually. Agent never attempted calling the tool — it inspected its tool list and determined the tool wasn't available.

**Investigation so far:**
- Extension files present in container at `/root/.pi/agent/extensions/writing-style/` (index.ts, lint.ts, profile.ts, metrics.ts)
- Data files present at `/app/data/style/`
- Startup logs show 12 extensions loaded, no errors
- /describe endpoint shows 12 extensions but tools array is empty (endpoint doesn't enumerate tools)
- Agent DID use `write_artifact` (from artifacts extension) successfully, proving some extension tools work
- The `|| true` in Dockerfile `pi extensions install` swallows any compilation errors

**Unknown:** Whether the model change to V4 Flash resolves this. V4 Flash has better tool-calling compliance than previous models but this has not been retested.

**Next steps:**
- Rebuild with V4 Flash and retest
- Remove `|| true` from Dockerfile temporarily to surface compilation errors
- Create targeted test that sends a task requesting `validate_style` and checks the result

---

## OPEN: Session isolation and artifact replication architecture

**Status:** Open — architectural change
**Severity:** High

**Problem:** All concurrent sessions share `/workspace/scratch`. server.ts computes a per-invocation `workDir` (line 217) but never passes it to the Pi session or extensions. Workproduct extensions use `process.cwd()` directly, so concurrent sessions write to the same directory. This is a session scoping bug confirmed by industry research — LangGraph has a documented cross-thread contamination bug (langchain-ai/langgraphjs#2040) from the same pattern.

**Design decisions (agreed):**

1. **Session-scoped directories.** Each invocation gets `/workspace/sessions/{session_id}/` as its working directory. All tools write within it. Convention: `workproduct/{type}/{ulid}_{name}.{ext}` for outputs, `scratch/` for temp files.

2. **Metadata at write time, not publish time.** Workproduct tools write a `.meta.json` sidecar alongside each file when it's created locally. Contains artifact type, agent name, session ID, lineage inputs, provenance chain. No delayed "publish" step.

3. **Triggered replication to object storage.** A sync layer replicates session directories to MinIO, excluding `scratch/`. Replication is event-triggered (inotify/fswatch), not polling. Files appear in S3 as they're written.

4. **Agent-complete gate.** On session completion, a hook checks whether any file replication is still outstanding. If pending, waits with timeout. If timeout expires, marks run as failed with error or suggests planner wait and retry.

5. **Artifact service role changes.** Becomes a read/query/index layer over what's in S3, not a write endpoint. Still needed for: user uploads (files attached to prompts), cross-agent discovery (query by type/agent/run_id/tags), lineage graph queries.

6. **Provenance manifest.** Each session has `provenance.jsonl` at session root. Workproduct tools append lineage entries as they run. Replicated to S3 like any other file. Artifact service indexes it for lineage graph queries.

**Affected components:**
- `src/agents/server.ts` — pass session-scoped workDir to session creation
- `src/agents/extensions/*/workproduct.ts` — write to session dir, write .meta.json sidecars, append to provenance.jsonl
- `src/agents/extensions/artifacts/index.ts` — write_artifact becomes local-fs write + metadata, not HTTP POST
- `src/artifact-service/` — new sync/replication layer, shift to read/query role
- All agent containers — volume mount strategy for sessions

**Industry precedent:** AWS Bedrock AgentCore managed session storage, Azure Foundry hosted agent persistent $HOME, Kubernetes Agent Sandbox PVC-per-session pattern.

---

<details>
<summary>Resolved Issues</summary>

## RESOLVED: Cerebras removed Qwen3 32B and Llama 3.3 70B from API

**Status:** Resolved 2026-06-08
**Fix:** All agents migrated to DeepSeek V4 Flash as default agentic model. Cerebras removed from provider catalog entirely. Fallback chains updated across all agent config.yml and settings.json files.

---

## RESOLVED: MiniMax-M2.7 silently fails as primary agentic model

**Status:** Resolved 2026-06-08
**Fix:** Removed MiniMax from all fallback chains. Replaced with Qwen3 32B (Cerebras, free, BFCL #2) as primary agentic model. Llama 3.3 70B as fallback. deepseek-chat removed entirely. Subsequently migrated again to DeepSeek V4 when Cerebras removed models.

---

## RESOLVED: Server uses process.env for per-request state

**Status:** Resolved 2026-06-08
**Fix:** Replaced process.env.RUN_ID with ctx.sessionManager.getSessionId(). Removed FIFO queue, added semaphore (MAX_CONCURRENT_SESSIONS). All extensions updated.

---

## RESOLVED: Planner timeout on multi-agent research tasks

**Status:** Resolved 2026-06-08
**Fix:** Concurrent session support (MAX_CONCURRENT_SESSIONS=3 on researcher). Planner timeout bumped to 1800s. Parallel research tasks now execute simultaneously.

---

## RESOLVED: Writer pipeline too complex for current models

**Status:** Resolved 2026-06-08
**Fix:** Replaced 193-line 4-stage pipeline (PLAN->EXPAND->STITCH->POLISH) with 3-phase fanout/fan-in: PLAN -> WRITE+FIX (parallel subagents) -> ASSEMBLE. Each section-writer subagent owns its section end-to-end. Dropped from 74 turns to 21 turns, 118s to completion.

---

## RESOLVED: settings.json defaultModel misaligned with config.yml across all workers

**Status:** Resolved 2026-06-08
**Fix:** Updated settings.json in all workers to match config.yml. Subsequently migrated to DeepSeek V4 with both files aligned.

---

## RESOLVED: OpenObserve OTLP auth mismatch

**Status:** Resolved 2026-06-08
**Fix:** Updated `.env` ZO_OTLP_AUTH to match docker-compose OpenObserve password.

</details>
