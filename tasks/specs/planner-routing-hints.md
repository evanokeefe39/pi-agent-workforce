# Planner Routing Hints — Rendering Delegation & Publisher Integration

## Intent

Add explicit routing knowledge to the Planner agent so it correctly chains agents for visual content production. The rendering delegation pattern (Writer → Coder → Publisher) is non-obvious — without explicit guidance, Planner would either skip Coder (sending raw content briefs to Publisher for rendering it can't do) or skip Publisher (letting Coder publish directly). Planner needs to know the boundaries between agents and the canonical chains for each content type.

## Context Package

### Relevant existing code

- `src/agents/planner/.pi/agent/AGENTS.md` — 73 lines. Defines workflow (discover, elicit, create tasks, delegate, assess, iterate). Has phase/wave examples but no rendering delegation or publisher integration.
- `src/agents/planner/.pi/agent/extensions/subagent-http/config.json` — currently lists researcher, data, writer only. Publisher and coder not registered.

### Current planner knowledge gap

Planner discovers agents via `subagent({ action: "list" })` which returns agent names and capabilities strings from agent.json. Current capabilities:
- Researcher: "Information gathering, web research..."
- Data: "Code-first data analysis..."
- Writer: "Transform research findings into structured documents..."
- Publisher: "External publishing with HITL gating..." (stale, to be updated)
- Coder: "Code execution, analysis, implementation..." (doesn't mention rendering)

Even with updated capabilities strings, Planner wouldn't know:
- That visual content requires a Coder rendering step before Publisher
- That Publisher writes render briefs and Coder fulfills them
- Which content types need Coder vs which skip straight to Publisher
- That document packaging (PDF/ebook) also routes through Coder

### Architectural constraints

- Planner cannot call agents it doesn't have in its subagent config
- Planner discovers capabilities at runtime, but routing heuristics should be in AGENTS.md (stable guidance, not dynamic discovery)
- Planner never tells agents which tools to use — it sets quality bars and lets agents decide how

## Implementation

### Add to Planner AGENTS.md

New section titled "Content Production Routing" after the "Quality Assessment" section (after line 56). Content:

**Routing heuristics for content production tasks:**

When a task involves producing content for external audiences (social media posts, reports, ebooks, presentations, dashboards), the following chains apply:

| Content type | Chain | Notes |
|-------------|-------|-------|
| Text-only social post | Writer → Publisher | No visual rendering needed |
| Social post with visuals | Writer → Coder → Publisher | Coder renders carousel/cover from Writer's brief |
| Report / ebook / presentation | Writer or Data → Coder → Publisher | Coder renders styled document, Publisher packages for distribution |
| Content calendar / posting guide | Data → Publisher | Publisher assembles from Data's analysis, no rendering needed |
| Dashboard / analytics view | Data → Coder | Publisher not involved unless distributing |
| Brand asset creation | Coder | One-off creative work, Publisher not involved |

**The rendering delegation pattern:**

When Publisher needs styled visual output, it produces a render brief artifact describing what it needs (content, dimensions, theme, component types). Route this render brief to Coder. Coder produces rendered artifacts (images, PDFs). Route rendered artifacts back to Publisher for platform-specific assembly and HITL publishing.

This is a multi-hop chain within a single orchestration phase:
1. Publisher reads content → determines rendering needed → writes render brief → escalates
2. Planner routes render brief to Coder
3. Coder renders → produces visual artifacts
4. Planner routes visual artifacts to Publisher
5. Publisher assembles final package → runs checklist → stages for HITL

For simple cases where rendering is known upfront, Planner can dispatch Writer, Coder, and Publisher in sequential phases without the mid-task escalation:

```
Phase 1 (parallel): Researcher gathers data, Data analyzes existing posts
Phase 2 (sequential): Writer produces content briefs from phase 1 artifacts
Phase 3 (sequential): Coder renders visuals from Writer's briefs using design system
Phase 4 (sequential): Publisher assembles platform packages, runs checklist, stages for HITL
```

**Publisher capabilities (for delegation decisions):**

Publisher assembles platform-ready packages from content + visual artifacts. Three modes: social media assembly (caption + hashtags + visuals → platform package), document packaging (rendered report → trimmed distributable), content brief assembly (data findings → content calendar). All publishing requires HITL approval.

### Update subagent config

Add publisher and coder to `config.json`:

```json
{
  "agents": [
    { "name": "researcher", "url": "http://researcher:8080" },
    { "name": "data", "url": "http://data:8080" },
    { "name": "writer", "url": "http://writer:8080" },
    { "name": "publisher", "url": "http://publisher:8080" },
    { "name": "coder", "url": "http://coder:8080" }
  ]
}
```

### Update agent.json capabilities strings

Publisher capabilities should be updated (covered in publisher-agent spec) to clearly signal the three modes and rendering delegation to Planner's discovery.

Coder capabilities should mention rendering: "Code execution, analysis, implementation, visual rendering from design system (carousels, reports, presentations), testing within sandboxed container."

## Behavioral Contracts

GIVEN a task "create an Instagram carousel about the top 5 AI tools"
WHEN Planner decomposes it
THEN Planner creates phases: Writer (content brief) → Coder (render carousel) → Publisher (assemble + checklist + HITL)

GIVEN a task "produce a weekly report PDF from this week's tracking data"
WHEN Planner decomposes it
THEN Planner creates phases: Data (analysis) → Writer (report) → Coder (render PDF) → Publisher (package for distribution)

GIVEN a task "create a content calendar for next week"
WHEN Planner decomposes it
THEN Planner creates phases: Data (classify + correlate) → Publisher (assemble calendar). Coder not involved.

GIVEN a task "post this text update to LinkedIn"
WHEN Planner decomposes it
THEN Planner routes directly: Writer (caption) → Publisher (format + HITL). Coder not involved.

## Definition of Done

- [ ] Planner AGENTS.md has "Content Production Routing" section with chain table
- [ ] Rendering delegation pattern documented in Planner AGENTS.md
- [ ] Publisher and Coder added to subagent-http config.json
- [ ] Coder agent.json capabilities updated to mention rendering
- [ ] E2E: Planner correctly decomposes a visual content task into Writer → Coder → Publisher chain

## Negative Space

Out of scope: changes to the subagent-http extension itself (HTTP protocol unchanged). QA integration into the chain (QA reviews between Coder output and Publisher intake — future work). Automated chain selection (Planner uses judgment based on routing hints, not a programmatic router).
