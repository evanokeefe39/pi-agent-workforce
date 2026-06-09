# Publisher Agent — Full Specification

## Intent

Bring the publisher agent from stub (22-line AGENTS.md) to production-grade specification matching the depth and rigor of Writer and Data agents. Publisher assembles platform-ready content packages from upstream artifacts, runs quality checks against brand guidelines, gates all external publishing through mandatory human approval, and tracks post-publish analytics.

Publisher does NOT render styled visuals (Coder owns the rendering toolchain), does NOT write content (Writer owns authoring), and does NOT analyze data (Data owns computation). Publisher's value is platform expertise, quality gating, and the HITL publish workflow.

## Context Package

### Relevant existing code

- `src/agents/publisher/agent.json` — metadata stub (role: cmo, title: Publishing Manager)
- `src/agents/publisher/.pi/agent/AGENTS.md` — 22-line stub with basic responsibilities
- `src/agents/publisher/.pi/agent/skills/social-media-publishing/SKILL.md` — pre-publish checklist, caption templates, hashtag strategy, posting schedule, cross-posting rules (good, keep as-is)
- `src/agents/publisher/.pi/agent/skills/social-media-publishing/references/publish-anti-patterns.md` — 8 anti-patterns with evidence (good, keep as-is)
- `src/agents/publisher/.pi/agent/config.yml` — model roles, fallback chains (matches other agents)
- `src/agents/publisher/.pi/agent/settings.json` — packages, otel config (matches other agents)

### Pattern to match

- `src/agents/writer/.pi/agent/AGENTS.md` — 100 lines. Phased pipeline (PLAN → WRITE → ASSEMBLE), subagent fanout, intel quality handling, input/output contract, constraints.
- `src/agents/data/.pi/agent/AGENTS.md` — 166 lines. 4-phase workflow (DISCOVER → ANALYZE → VALIDATE → PUBLISH), example workflow, categorized tools section, workproduct standard, domain knowledge references.

### Architectural constraints

- Agents communicate via artifacts only (no shared filesystem)
- All publish actions require HITL gating — hard constraint
- Styled visual rendering routes through Coder agent (Publisher writes render briefs, receives rendered artifacts)
- Lightweight assembly (plain text, basic HTML tables) can be done by Publisher directly

### Anti-patterns to avoid

- Publisher rendering React/styled HTML itself (Coder's job)
- Publisher writing/editing content (Writer's job)
- Publisher making strategic content decisions (Planner's job)
- Publishing without running pre-publish checklist
- Autonomous publishing without human confirmation

## Behavioral Contracts

GIVEN a content brief artifact from Writer and visual artifacts from Coder
WHEN Publisher receives a social media assembly task
THEN Publisher produces a platform-ready package artifact containing: formatted caption, hashtags, scheduling metadata, visual asset references, and pre-publish checklist results

GIVEN a task requiring styled visual output (carousel, branded PDF)
WHEN Publisher determines visual rendering is needed
THEN Publisher writes a render brief artifact with content + format spec + design system reference and escalates to Planner for routing to Coder, rather than rendering itself

GIVEN a platform-ready package
WHEN all pre-publish checklist items pass
THEN Publisher stages the package and requests HITL approval before any external action

GIVEN HITL approval
WHEN Publisher publishes to a platform
THEN Publisher writes a publish receipt artifact with: platform, timestamp, content hash, source artifact chain, HITL approver reference

GIVEN classified posts and correlation data from Data agent
WHEN Publisher receives a content brief assembly task
THEN Publisher produces a structured content calendar artifact mapping data findings to content types from the taxonomy

## Publisher AGENTS.md Structure

### Identity

Assembles platform-ready content, does NOT render (Coder) or write (Writer). Three operating modes.

### Pipeline

```
RECEIVE → ASSEMBLE → CHECKLIST → STAGE (HITL) → PUBLISH → TRACK
```

### Operating Modes

**Mode 1: Social Media Assembly** — content briefs from Writer + visuals from Coder → platform packages with captions, hashtags, scheduling metadata. Cross-posting handled (TikTok-first, Instagram 2-4h later, watermark removal noted, hashtag sets differ).

**Mode 2: Document Packaging** — reports from Writer/Data → render brief to Coder for PDF/ebook/slides → Publisher applies format-specific post-processing (page count, metadata injection, file size check) → distributable artifact.

**Mode 3: Content Brief Assembly** — classified data from Data → structured content calendars and posting guides for Writer. Maps correlations to content type recommendations.

### Phase Detail

Phase 1 RECEIVE: TaskCreate decomposition, read_artifact for all inputs, validate input completeness, determine mode, if visual rendering needed write render brief and escalate.

Phase 2 ASSEMBLE: Mode-dependent. Social: caption templates + hashtags + scheduling. Document: format metadata + render brief. Brief: calendar structure + content type mapping.

Phase 3 CHECKLIST: Mandatory for Mode 1. Run every item from social-media-publishing skill. Reference anti-patterns. Fail = return to Writer with specific reason.

Phase 4 STAGE: Write staging artifact. Present to human with preview, platform targets, scheduled time, checklist results. Wait for explicit approval. Never publish without it.

Phase 5 PUBLISH: Execute publish action. Write receipt artifact with full provenance.

Phase 6 TRACK: Set up post-publish monitoring per skill guidance. Record initial metrics. Schedule follow-up analytics.

### Rendering Delegation Protocol

Rule: anything using branded components, the design system, or styled layouts routes through Coder. Publisher writes a render brief, not rendered output.

Self-assembly threshold: plain text formatting, basic HTML tables, simple lists. If it needs CSS beyond basic typography or any branded visual element, it goes to Coder.

Render brief schema:
```json
{
  "render_type": "carousel | cover_image | pdf | slides | ebook",
  "content_ref": "artifact://...",
  "format_spec": {
    "platform": "instagram | tiktok | linkedin",
    "dimensions": { "width": 1080, "height": 1350 },
    "slide_count": 5,
    "theme": "social-media-brand | report | dashboard"
  },
  "design_system_ref": "brand-guidelines artifact URI or skill reference"
}
```

### Input/Output Contract

Receives: content brief artifacts (Writer), rendered visual artifacts (Coder), dataset artifacts (Data), QA verdict artifacts (QA).

Produces: platform-ready packages, publish receipts, content calendars, render brief requests.

Does NOT: write content, render styled visuals, analyze data, research topics, make strategic decisions.

### Tools

Planning: TaskCreate, TaskUpdate, TaskList, TaskGet
Artifacts: read_artifact, write_artifact, list_artifacts
Escalation: escalate

### Domain Knowledge

- `skills/social-media-publishing/SKILL.md` — pre-publish checklist, caption templates, hashtag strategy, posting schedule, cross-posting rules
- `skills/brand-guidelines/SKILL.md` — brand identity rules for checking rendered output consistency (shared skill)

### Constraints

- All publish actions require explicit human confirmation
- Only process QA-approved content (check QA verdict before proceeding)
- No strategic decisions — escalate to orchestrating agent
- No code execution
- No rendering of styled/branded visuals
- One publish task per invocation

## Edge Case Inventory

1. Visual artifacts not yet rendered — Publisher must write render brief and wait, not proceed without visuals
2. Pre-publish checklist partial failure — specific items fail. Publisher must identify which items failed and return to Writer with actionable feedback, not generic "failed checklist"
3. Cross-platform publish with different requirements — Instagram and TikTok versions of same content need separate packages with platform-specific adaptations
4. HITL rejection — human rejects staged content. Publisher must record rejection reason and route back to appropriate upstream agent
5. Content type mismatch — content brief says Type A but visual artifacts are wrong dimensions. Publisher catches this in checklist, not at publish time
6. No QA verdict available — Publisher must not proceed. Escalate to Planner.

## Definition of Done

- [ ] AGENTS.md rewritten to ~150 lines matching Writer/Data depth
- [ ] All six pipeline phases documented with clear instructions
- [ ] Three operating modes specified with input/output per mode
- [ ] Rendering delegation protocol documented with render brief schema
- [ ] Input/output contract explicit (receives/produces/does-not-do)
- [ ] Tools section complete
- [ ] Domain knowledge references correct
- [ ] Constraints section matches actual agent boundaries
- [ ] agent.json capabilities field updated to reflect three modes
- [ ] Publisher added to planner subagent config
- [ ] Publisher added to rbac.json with correct read/write permissions
- [ ] Publisher service added to docker-compose.yml (port 8085)
- [ ] Reasoning trace written
- [ ] Assumption log written

## Negative Space

What must not change: existing social-media-publishing SKILL.md and publish-anti-patterns.md (both good as-is). Existing config.yml, settings.json, models.json, auth.json patterns.

Out of scope: actual platform API integration (manual HITL posting for now). Design system implementation (separate feature). Project workspace storage layer (separate feature). QA agent integration beyond "check QA verdict exists."

Reserved for human review: brand color/typography decisions, content strategy decisions, niche expansion decisions.
