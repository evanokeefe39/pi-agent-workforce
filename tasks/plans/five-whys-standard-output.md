# Five Whys: Agents Not Producing Standard Output

## Problem Statement

Across all E2E-30 runs, agents consistently produce markdown reports instead of structured output (JSONL findings via record_finding). Even after updating AGENTS.md with mandatory instructions, few-shot examples, and a mandatory first-call pattern, the behavior persists in planner-delegated runs. The only time it works is direct invocation with explicit tool names in the task (E2E-31 trials).

## Evidence

| Run | Agent | Expected | Actual | Model |
|-----|-------|----------|--------|-------|
| Smoke test (direct) | researcher | JSONL | JSONL | deepseek-chat |
| E2E-31 trials (direct, explicit) | researcher | JSONL | JSONL | deepseek-chat |
| E2E-30 run 1 (pi -p) | researcher | JSONL | markdown | deepseek-chat |
| E2E-30 run 2 (planner) | researcher | JSONL | markdown | deepseek-chat |
| E2E-30 run 3 (planner) | researcher | JSONL | markdown | deepseek-chat |
| E2E-30 run 4 (planner, concurrent) | researcher | JSONL | markdown | deepseek-chat |
| E2E-30 run 4 (planner, concurrent) | data | JSONL | markdown | deepseek-chat |
| E2E-30 run 4 (planner, concurrent) | writer | complete report | partial/timeout | deepseek-chat |

Pattern: works when task explicitly says "record_finding" + "JSONL". Fails when task is goal-oriented.

## Five Whys

### Why 1: Why do agents produce markdown instead of JSONL?

Because the model (deepseek-chat) ignores the system prompt instructions about record_finding and write_artifact JSONL when the incoming task prompt doesn't mention those tools explicitly.

### Why 2: Why does deepseek-chat ignore the system prompt?

Because deepseek-chat weighs the user message (task prompt) more heavily than the system prompt when they conflict or when the system prompt is long. The AGENTS.md is 125+ lines. The task from the planner says "research strategies and accounts" — markdown is the natural output format for that prompt. The system prompt says "MUST produce JSONL" but the task implies prose.

### Why 3: Why does the task prompt override the system prompt?

Two factors:
1. **Model architecture**: deepseek-chat is not as instruction-following as Claude or GPT-4. It was trained primarily on chat, not agentic tool-use workflows. It follows explicit instructions in the immediate prompt but has weaker compliance with system-level constraints.
2. **System prompt length**: at 125+ lines, the AGENTS.md is too long for the model to maintain all constraints simultaneously. The mandatory output section is in the first 20 lines but by the time the model is 10+ turns deep in research, it has lost the constraint.

### Why 4: Why is deepseek-chat being used instead of a model that follows tool-use instructions better?

Because MiniMax-M2.7 (the primary model) consistently fails and falls back to deepseek-chat. The config.yml fallback chain is: minimax/MiniMax-M2.7 → deepseek/deepseek-chat. MiniMax has documented tool-calling problems (parameter casing errors, batch signature crashes). The fallback is silent — no log of WHY MiniMax failed.

### Why 5: Why is the fallback silent and why hasn't MiniMax been replaced?

Because the retry system in Pi handles fallback internally without exposing the failure reason to the server logs. We see the result model in request_complete but never see "MiniMax failed because X, falling back to deepseek-chat." Without visibility into the failure, MiniMax stays as primary and keeps silently failing.

## Root Causes (Systemic)

### RC1: Model selection is wrong for agentic tasks

deepseek-chat is a chat model, not an agent model. It's optimized for conversational responses, not multi-step tool-use workflows. It will take the simplest path (write markdown) over a complex tool chain (record_finding → query_findings → get_finding → write_artifact JSONL).

**Evidence**: Same model follows the workflow when the task explicitly names the tools (E2E-31) but ignores it when the task is abstract (E2E-30). This is classic instruction-following weakness — compliance with explicit instructions, non-compliance with implicit system constraints.

### RC2: System prompt instructions don't survive long sessions

The AGENTS.md is read at session start but the model's attention to it degrades over 15-20+ turns. By the time the researcher finishes data collection and should switch to the record_finding → JSONL workflow, the constraint has faded. This is the "lost in the middle" problem documented in the Manus engineering blog.

**Evidence**: The researcher creates a plan that INCLUDES "record-findings" and "publish-artifact" items, marks them "done", but actually writes markdown. The model "remembers" the plan items but not the specific tool workflow.

### RC3: No runtime enforcement of output format

The system relies entirely on the model following its system prompt. There is no programmatic check that the agent actually called record_finding or produced JSONL. The plan tool gives a false sense of completion — the agent can mark "record-findings: done" without actually calling record_finding.

**Evidence**: Plan items marked done but zero record_finding calls, zero .jsonl files in workspace.

### RC4: MiniMax fails silently, deepseek-chat is an inadequate fallback

MiniMax-M2.7 was chosen as primary for agentic tasks but consistently fails. deepseek-chat is the first fallback but isn't suited for agentic work. The fallback is invisible — we only know after the fact by checking the model field in request_complete.

**Evidence**: Every E2E-30 run shows model=deepseek-chat despite config setting minimax as primary.

### RC5: Writer is undertested and over-complex

The writer AGENTS.md has a 180-line 4-step pipeline (PLAN → EXPAND → STITCH → POLISH) with subagent delegation, Vale linting, style profiles, copy formulas, and manifest tracking. This is too complex for deepseek-chat (or possibly any model) to execute reliably within a 600s timeout. The writer uses 74 turns and still produces incomplete output.

**Evidence**: Writer timeout in 2 of 3 E2E-30 runs. When it does produce output, it's partial (13KB vs expected 25KB+). The planner had to write the final report itself.

## Proposed Fixes (by root cause)

### Fix RC1: Replace model for agentic tasks

Options:
- a) deepseek-reasoner as primary (strong instruction following, but expensive — 228K input tokens in E2E-31 trial)
- b) Move to a model with native tool-calling training (Claude Haiku via API, Qwen3-Coder)
- c) Test which free/cheap model actually follows record_finding instructions under abstract briefs

Action: Run E2E-31 style trial but with abstract briefs (not explicit tool names) across models.

### Fix RC2: Reinforce constraints mid-session

Options:
- a) Inject a "checkpoint" prompt after data collection: "You have completed data collection. Now execute the mandatory output workflow: record_finding for each claim, then query_findings → write_artifact JSONL."
- b) Use the plan tool as a reinforcement mechanism — when plan item "record-findings" transitions to in_progress, inject the specific tool workflow as context
- c) Shorten AGENTS.md drastically — strip everything except the mandatory workflow. Move tool descriptions to promptSnippet/promptGuidelines fields on the tools themselves.

### Fix RC3: Add runtime output validation

Options:
- a) Post-execution hook in server.mjs: check if agent called record_finding at least N times. If not, log a warning or re-run.
- b) QA agent as a gate: before accepting researcher output, QA checks for JSONL artifacts.
- c) Extension-level enforcement: write_artifact rejects type="report" from researcher agent (researcher MUST publish datasets, not reports).

### Fix RC4: Fix model selection

Options:
- a) Remove MiniMax from agentic fallback chain entirely. Use deepseek-reasoner → deepseek-chat → cerebras/llama-3.3-70b.
- b) Add fallback visibility: log the failure reason when MiniMax fails so we can diagnose whether it's fixable.
- c) Test MiniMax with simpler tool schemas to determine if the issue is schema complexity.

### Fix RC5: Simplify writer

Options:
- a) Strip the writer pipeline to 2 steps: READ artifacts → WRITE report. No skeleton, no subagents, no Vale, no manifest.
- b) Increase writer timeout to 900s.
- c) Have the planner pass a simpler brief to writer ("combine these artifacts into a report") rather than triggering the full pipeline.
