---
name: content-flywheel-strategy
description: >
  Content flywheel strategy for Planner decomposition. Defines the flywheel model
  (anchor → derivatives → distribute → track → recycle), content buckets, platform
  hierarchy, growth phases, work product catalog with agent chains, decomposition
  heuristics, and quality signals. Read when orchestrating content production tasks.
metadata:
  author: evan
  version: 1.0.0
  domain: content-strategy
---

# Content Flywheel Strategy — Planner Perspective

Strategy context for decomposing and orchestrating content production tasks across the agent team.

## The Flywheel Model

1 anchor piece/week → 6+ platform-native derivatives → distribute across platforms → track performance → recycle top performers.

The flywheel compounds: each cycle produces content AND performance data that improves the next cycle. Planner's job is to orchestrate the full loop, not just individual pieces.

## Content Buckets

| Bucket | What It Is | When to Use | Example |
|--------|-----------|-------------|---------|
| Tool Breakdown | Deep dive on a specific tool, library, or workflow | When Researcher surfaces a tool with strong engagement signal | "5 Claude Code features that replace 3 tools" |
| Build-in-Public Update | Honest progress report — failures > milestones | Weekly or after significant project events | "Week 3: what broke and what I learned" |
| Practitioner News Framing | Industry news through a builder's lens | When major releases or shifts happen in AI/dev space | "Why DeepSeek V4 changes the agent game for solo devs" |
| Resource Compilation | Curated list of tools/resources with specific recommendations | When Researcher has accumulated enough graded findings | "7 free APIs every AI builder should know" |
| Counterintuitive Insight | Data-backed finding that challenges common belief | When Data agent surfaces surprising metrics | "Why shorter videos get fewer saves (and why that matters)" |

## Platform Hierarchy

Priority order based on growth mechanics and audience overlap:

1. **X (Twitter)** — community building, distribution, fastest feedback loop
2. **TikTok** — growth engine, algorithmic reach independent of follower count
3. **YouTube** — compounding asset, evergreen search traffic
4. **Instagram** — secondary distribution, carousel format for saves
5. **LinkedIn** — credibility, professional audience, repurpose analytical content

## Growth Phases

### Weeks 1-4: Find Format
- Post 5-7x/week on TikTok + Instagram
- Test 3+ content formats from the bucket list
- Track save rate as primary signal (not views, not followers)
- Goal: identify 1-2 formats that consistently hit >1.5% save rate

### Weeks 5-8: Build Chain
- Add LinkedIn to distribution (repurpose analytical content)
- Establish anchor → derivative chain for winning formats
- Begin competitive intelligence cycle (Researcher → Data)
- Goal: weekly derivative chain producing 6+ pieces from 1 anchor

### Weeks 9-12: Scale and Recycle
- Add multi-account strategy if any post hits 50K+ views
- Begin recycling top performers (6-month repost cycle)
- Introduce lead magnet / DM automation
- Goal: self-sustaining flywheel with data-driven format selection

## Work Product Catalog

Complete inventory of what the team produces and which agent chain creates each:

| Work Product | Agent Chain | Inputs Needed |
|-------------|-------------|---------------|
| Research compression notes | Researcher | Source material (transcript, paper, docs) |
| Deep post building blocks | Researcher (decomposition) or Writer (assembly) | Anchor content or research findings |
| Anchor video outline | Writer | Topic + research findings |
| X thread | Writer | Topic + research findings or anchor content |
| TikTok/Reel caption | Writer | Video content or anchor summary |
| LinkedIn post | Writer | Anchor content or research findings |
| Build diary entry | Writer | Project status + recent events |
| Instagram carousel | Writer (content brief) → Publisher (render brief) → Coder (render) | Topic + data/findings |
| Content calendar | Writer (create/update, with Planner orchestration) | Performance data + content backlog |
| Performance analytics | Data | Post-level metrics (views, saves, shares) |
| Competitive intelligence | Researcher → Data | Target accounts or hashtags |
| Quality evaluation report | QA | Content artifacts from Writer/Coder/Publisher |

## Decomposition Heuristics

**Parallelize when:** Researcher and Writer work on independent buckets (e.g., Researcher does competitive intel while Writer produces derivatives from last week's anchor). Data agent can run alongside both if analyzing historical metrics.

**Sequence when:** Writer depends on Researcher output (e.g., Writer needs graded findings before writing a resource list). Always: research → write → render → publish.

**Loop when:** Data produces analytics → Planner replans based on what's working → next cycle adjusts format mix. This is the flywheel feedback loop.

**Single-agent when:** Simple derivative (X thread from existing anchor) or standalone task (build diary from project status).

**Gate when:** Content is audience-facing. Route through QA before Publisher. QA evaluates against content quality, platform compliance, brand compliance, and publish readiness. Only skip QA for internal operational artifacts (analytics, calendars, intel reports).

## Quality Signals

Primary metric: **share rate > 0.3%**. Not views, not followers. Share rate indicates the content is valuable enough to redistribute — the fundamental flywheel mechanic.

Secondary: save rate > 1.5% (content worth returning to), engagement rate (audience is active, not passive).

Go/no-go for publishing: if Writer's output doesn't pass Publisher's pre-publish checklist, iterate before publishing. Never publish low-quality content to maintain cadence.
