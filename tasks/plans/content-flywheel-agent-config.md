# Plan: Content Flywheel Playbook → Agent Configuration (SOLID Revision)

Revised from `iterative-swimming-ocean.md` after SOLID review. Key changes: agent-specific flywheel skills (ISP), Publisher identity correction (SRP), vendor config extraction (DIP), Writer skill split (SRP).

---

## Context

Five-document content strategy playbook defines how a solo dev building in public produces and distributes content. Translate into multi-agent workforce so agents produce standard work products using playbook strategies.

**How Pi skills work**: SKILL.md files discovered by convention, listed in system prompt as `<available_skills>`. Agent reads full skill content when task matches description. Skills are domain knowledge and workflows — instructions for the model, not code. No template interpolation in SKILL.md — plain markdown only.

**How orchestration works**: Planner discovers team via `/describe`, designs workflows on the fly, delegates with requirements. Never dictates HOW — each agent decomposes internally using its own domain skills via TaskCreate.

**Architecture principle**: Shared skills give every agent context about the overall system. Agent-specific skills teach each specialist HOW to do its part. Writing-style extension data files are the mechanical layer making `get_style_instructions()` produce correct output per platform/format.

**Key design decisions from review**:
- Publisher is a general-purpose publishing/distribution agent, not a social media specialist
- Each agent gets a tailored flywheel perspective with deeper detail where relevant
- Vendor references go in `config/vendors.yaml`, skills cross-reference by capability
- Writer's social media knowledge splits into 3 focused skills (derivative-formats, research-consumption, hook-formulas)
- Content calendar is a shared skill (Planner reads for scheduling, Writer creates/updates, Publisher reads and can edit)

---

## 1. Vendor Configuration (DIP compliance)

**New file**: `config/vendors.yaml`

Single source of truth for all vendor/provider references used in skills. Skills reference capabilities and point here for concrete values.

```yaml
scraping:
  tiktok:
    provider: apify
    actor: clockworks/tiktok-scraper
    default_max_items: 50
    notes: "50 posts/tag for small-account competitive intel"
  instagram:
    provider: apify
    actor: apify/instagram-scraper
    default_max_items: 50

scheduling:
  multi_account:
    provider: typefully
    monthly_cost_usd: 19
    notes: "Add accounts after first 50K+ view post"

analytics:
  # future: platform API integrations
```

- [ ] File created at `config/vendors.yaml`
- [ ] All skill files that reference vendors point to this file instead of hardcoding

---

## 2. Agent-Specific Flywheel Skills (ISP compliance)

Instead of one shared `content-flywheel` skill read by all agents, each agent gets a tailored perspective with deeper detail where relevant to its work.

### 2a. Planner: `content-flywheel-strategy`

**New file**: `src/agents/planner/.pi/agent/skills/content-flywheel-strategy/SKILL.md`

Planner's perspective — strategy, decomposition patterns, work product routing:

- The flywheel model: 1 anchor/week → 6 platform-native derivatives → distribute → track → recycle
- Content buckets with descriptions of what each is and when to use them: tool breakdown, build-in-public update, practitioner news framing
- Platform hierarchy and why: X (community/distribution) → TikTok (growth) → YouTube (compounding) → Instagram (secondary) → LinkedIn (credibility)
- Growth phases with what changes at each: weeks 1-4 (find format), 5-8 (build chain, add LinkedIn), 9-12 (multi-account, recycling, lead magnet)
- Complete work product catalog — what exists, which agent chain produces each, what inputs each needs:
  - Research compression notes → Researcher
  - Deep post building blocks → Researcher (decomposition) or Writer (assembly)
  - Anchor video outline → Writer
  - X thread → Writer
  - TikTok/Reel caption → Writer
  - LinkedIn post → Writer
  - Build diary entry → Writer
  - Instagram carousel → Writer (content brief) → Publisher (render brief) → Coder (render)
  - Content calendar → Writer (create/update, with Planner orchestration)
  - Performance analytics → Data
  - Competitive intelligence → Researcher → Data
- Decomposition heuristics: when to parallelize (Researcher + Writer on independent buckets), when to sequence (Writer depends on Researcher output), when to loop (Data → Planner replan based on analytics)
- Quality signal for go/no-go: share rate > 0.3% primary metric, not views or followers

### 2b. Writer: `content-flywheel-production`

**New file**: `src/agents/writer/.pi/agent/skills/content-flywheel-production/SKILL.md`

Writer's perspective — what to produce, derivative chain mechanics, content bucket detail:

- Derivative chain with Writer's role: anchor content → which derivatives Writer produces (X thread, TikTok caption, Reel caption, LinkedIn post, anchor outline, build diary, carousel brief, deep post blocks)
- Content bucket detail for writing: what makes a good tool breakdown vs. build-in-public update vs. practitioner news framing — with examples of tone, structure, and angle for each
- Platform-specific writing constraints (cross-reference `get_style_instructions()` + platform data)
- How derivatives relate: which can share core copy, which need fresh angles, which sequence matters
- Quality signal Writer can self-check: specificity, hook strength, CTA presence

### 2c. Researcher: `content-flywheel-intelligence`

**New file**: `src/agents/researcher/.pi/agent/skills/content-flywheel-intelligence/SKILL.md`

Researcher's perspective — what research feeds the flywheel, output formats downstream consumers expect:

- Research types that feed the flywheel: competitive intelligence, content format analysis, trend identification, source compression
- Output format contract: JSONL dataset artifacts with ADMIRALTY grades, consumed by Writer
- What Writer needs from Researcher: key points, counterintuitive insights, builder-relevant findings, specific numbers. Graded so Writer can hedge appropriately.
- Small-account discovery: what signals matter (follower-to-view ratio, share rate, fans/video), what benchmarks exist
- Dev-niche format analysis: what content formats work at <10K followers, ranked by engagement type

### 2d. Data: `content-flywheel-analytics`

**New file**: `src/agents/data/.pi/agent/skills/content-flywheel-analytics/SKILL.md`

Data's perspective — metrics, benchmarks, decision thresholds:

- Metrics hierarchy: share_rate (primary) > save_rate > engagement_rate > views > followers
- Benchmark thresholds: share rate >0.3% working, >0.5% strong; save rate >3% good, >5% elite
- Decision matrix from 12-week calendar: TikTok <2K avg views after 8 weeks → change format; no posts >10K views → change hook structure; one platform dominant → double down
- Follower tracking targets: TikTok 1K-5K, Instagram 500-2K, YouTube 300-1K, X 500-1.5K at 12 weeks
- Standard analysis workflow: ingest metrics → per-post rates → per-format rates → week-over-week trends → inflection detection → decision matrix → report

- [ ] All 4 agent-specific flywheel skills created
- [ ] Each skill has proper SKILL.md frontmatter (name, description)
- [ ] No shared `content-flywheel` skill — each agent gets tailored version

---

## 3. Content Calendar — Shared Skill

**New file**: `src/agents/skills/content-calendar/SKILL.md`

Shared skill. Planner reads for scheduling decisions. Writer creates/updates calendar artifacts. Publisher reads to know when to publish and can edit directly for last-minute changes.

Contents:

- Weekly cadence template:

| Day | Deliverable | Producer | Distributor |
|-----|-------------|----------|-------------|
| Sunday | Anchor recording outline + 2 clips + X thread | Writer | — |
| Monday | Clip A → TikTok + Reels. X thread post. LinkedIn. | — | Publisher |
| Tuesday | Build update clip (phone, 30 min) → TikTok | — | Publisher |
| Wednesday | Clip B → TikTok + Reels. LinkedIn. | — | Publisher |
| Thursday | Tool tip or build update → TikTok | — | Publisher |
| Friday | Full anchor → YouTube. LinkedIn. | — | Publisher |
| Saturday | Analytics review. Schedule reposts. | Data | Publisher |

- Fallback content matrix — when nothing was shipped this week, what to produce instead (this is Planner/human decision-making context, not execution instructions)
- Calendar artifact format: how the calendar is stored as an artifact, how agents read/update it
- Growth phase adjustments: weeks 1-4 lighter cadence, 5-8 add LinkedIn, 9-12 add recycling slots

- [ ] Shared skill created at `src/agents/skills/content-calendar/SKILL.md`
- [ ] Proper frontmatter with name and description

---

## 4. Brand Guidelines Update

**Existing file**: `src/agents/skills/brand-guidelines/SKILL.md`

Add "Voice Modes" section after existing Voice and Tone section:

| Mode | Context | Rules |
|------|---------|-------|
| `analytical` | Reports, research summaries, data analysis | Third-person. "Analysis showed." Current default. |
| `social` | Social media captions, X threads, video outlines | First-person. "I built X." Personal, specific, honest. References social-voice-profile.json. |
| `brief` | Internal briefs, render briefs, task specs | Neutral imperative. "Produce a 10-slide carousel." |

Existing anti-patterns (no first-person singular) apply to `analytical` mode only.

- [ ] Voice modes section added
- [ ] Existing anti-patterns scoped to analytical mode

---

## 5. Writing-Style Extension Data Files

Pure data additions — no TypeScript changes. OCP-compliant by design.

### 5a. New platforms in `platforms.json`

**File**: `src/agents/extensions/writing-style/data/style/platforms.json`

Add alongside existing twitter/linkedin/blog/whitepaper/email:

- `tiktok`: 4000 char caption, first 80 chars visible before expand, 3-5 hashtags, on-screen text indexed for search, duration sweet spot 60-90s for resource content
- `instagram-reel`: 2200 char caption, first 125 chars visible, 5 hashtag hard cap, keywords in first line outperform hashtags
- `instagram-carousel`: 2200 char caption, 2-20 slides, first slide is hook, save-optimized format, music pushes to Reels feed
- `youtube-short`: searchable title format "How to [X] with [Y]", 60s max, evergreen framing, 74% non-subscriber reach

### 5b. New formulas in `formulas.json`

**File**: `src/agents/extensions/writing-style/data/style/formulas.json`

Add alongside existing AIDA/PAS/BAB/FAB/4Ps:

**`kallaway`** — 7-beat narrative script:
1. Opening superlative — declarative claim (1 sentence)
2. One-line stakes — why it matters (1 sentence)
3. Pivot — "But here's the crazy part..." (1 sentence)
4. Explanation — linear narrative with causality, never list (4-7 sentences)
5. Scale proof — specific number or vivid analogy (1 sentence)
6. Wonder close — light awe, forward implication (1-2 sentences)
7. CTA stack — engagement hook + follow + hashtags

Constraints: no listicles, no rhetorical questions as hooks, no POV openers, specificity required, adapted for dev niche.

**`deep-post-generator`** — Dan Koe decomposition method:
1. Extract 5 compelling standalone post ideas from anchor content
2. Identify 3 core paradoxes or counterintuitive truths
3. Pull key quotable moments
4. Map 3 transformation arcs (before → after)
5. Name core audience pain points
6. Derive 3 actionable steps

Constraints: output is building blocks only, never finished posts.

### 5c. Social voice style profile

**New file**: `src/agents/extensions/writing-style/data/style/social-voice-profile.json`

Profile for first-person social content:
- tone: formality 0.4, enthusiasm 0.6, humor 0.2, irreverence 0.2
- readability: target_grade 8, max_grade 12
- rhythm: burstiness_target 0.65, min_sentence_words 3, max_sentence_words 35
- voice: active_ratio 0.90
- vocabulary: inherit default blocklist + social hype words strict ("game-changing", "revolutionary", "unlock your potential", "skyrocket your growth", "level up")
- structure: max_em_dashes_per_1000 2, no_compulsive_summary true

- [ ] platforms.json updated with 4 new platforms
- [ ] formulas.json updated with kallaway + deep-post-generator
- [ ] social-voice-profile.json created

---

## 6. Writer Skills — Split by Concern (SRP compliance)

Three focused skills replace the single monolithic social-media-content update.

### 6a. `derivative-formats`

**File**: `src/agents/writer/.pi/agent/skills/derivative-formats/SKILL.md`

Work product format catalog — what Writer produces and how:

| Work Product | Platform | Formula | Voice Profile | Notes |
|---|---|---|---|---|
| X thread | twitter | (none or AIDA) | social-voice | 280-char lead tweet, 5-7 tweets total |
| TikTok caption | tiktok | kallaway or PAS | social-voice | First 80 chars = hook, narrative not list, 3-5 hashtags |
| Instagram Reel caption | instagram-reel | kallaway or PAS | social-voice | First 125 chars visible, 5 hashtag cap |
| LinkedIn post | linkedin | (existing) | social-voice | Professional framing, hook-first 2-liner |
| Anchor video outline | (none) | (none) | social-voice | Structured outline for human recording, NOT script |
| Build diary | blog | (none) | social-voice | Raw, honest, failures > milestones |
| Deep post building blocks | (none) | deep-post-generator | (none) | Raw materials only |
| Carousel content brief | (none) | (none) | brief | Structured brief for Publisher → Coder chain |

Each format references `get_style_instructions()` with appropriate platform + formula combination. Voice profile loaded via `load_style_profile`.

### 6b. `research-consumption`

**File**: `src/agents/writer/.pi/agent/skills/research-consumption/SKILL.md`

How Writer consumes Researcher output — ADMIRALTY grade hedging rules:

- A1-B2: use verbatim, cite confidently
- B3-C3: hedge with "reportedly", "data suggests"
- Below C3: exclude or note as unverified
- How to read JSONL dataset artifacts from Researcher
- What fields to expect (finding, grade, source, context)
- How to request additional research if coverage is insufficient (escalate to Planner)

### 6c. `hook-formulas`

**File**: `src/agents/writer/.pi/agent/skills/hook-formulas/SKILL.md`

Dev-niche hook types ranked by performance:

1. numbered_promise (4.54% save rate): "Here are the N things that will..."
2. how_to (1.97%): "How to X in Y minutes"
3. contrarian (1.71%): "Stop doing X. Do this instead."
4. personal_story (1.52%): "I built/launched X"

When to use each, platform-specific hook adjustments (TikTok first 3s decisive, X first tweet is hook, LinkedIn hook-first 2-liner).

- [ ] derivative-formats skill created
- [ ] research-consumption skill created
- [ ] hook-formulas skill created
- [ ] Existing social-media-content/SKILL.md updated to reference these focused skills or deprecated

---

## 7. Researcher Skill Updates

**File**: `src/agents/researcher/.pi/agent/skills/social-media-research/SKILL.md`

Add sections (vendor references point to `config/vendors.yaml`):

**Research compression workflow**:
1. Ingest transcript, paper, or documentation (via deep_research or web_fetch)
2. Extract: key points, counterintuitive insights, builder-relevant findings, specific tools/numbers
3. Record each insight as finding with ADMIRALTY grade (typically B2 for primary source transcripts)
4. Publish as JSONL dataset artifact for Writer consumption

**Small-account competitive intelligence** (vendor config in `config/vendors.yaml`):
1. Scrape target hashtags via TikTok scraper (see vendors.yaml for actor/params)
2. Filter: followers < 50K, videos < 100 (growing, not established)
3. Compute: follower-to-view ratio (>10x = breakout), fans_per_video, share rate
4. Flag anti-patterns: hearts/fans < 1x (ghost followers), high volume low fans/video (<30)
5. Benchmarks: @buildwithfrancis 28x at 89 followers, @startscalr.com 10.7x at 1062, @shepherdttk 2.0% share rate

**Dev-niche content format analysis**:
- Opportunity sharing: 2.0% share rate
- Complete reference guides: 28x follower-to-view ratio
- Counterintuitive safety/risk framing: 1.4% share rate
- Practitioner insider analysis: high share among advanced practitioners
- What doesn't work: generic AI lists, demos without hooks, sub-15s with minimal caption

- [ ] Research compression workflow added
- [ ] Small-account competitive intelligence added (vendors.yaml reference)
- [ ] Dev-niche format analysis added

---

## 8. Publisher Domain Skill (SRP-corrected)

**File**: `src/agents/publisher/.pi/agent/skills/social-media-publishing/SKILL.md`

Framed as domain skill Publisher activates for social media tasks — not Publisher's identity. Publisher is a general-purpose publishing/distribution agent that checks, tweaks, stages, rejects/replans, and actions audience-facing deliverables.

**Content recycling rules** (social media domain):
- Tag any post hitting >10K views as RECYCLE-[original date] in artifact metadata
- Repost schedule: 6, 12, 18, 24 months from original
- TikTok: natively re-upload with refreshed caption, same video
- X: quote-tweet with updated commentary
- Instagram: 10+ reposts in 30 days = excluded from recommendations

**Multi-account strategy** (activate after first 50K+ view post; scheduling tool in `config/vendors.yaml`):
- Create second X account on specific sub-niche
- Sunday: identify best video from past week, schedule repost 7 days later
- Viral videos continue reposting weekly for rest of year
- Scale: 2 accounts solo manageable, 3-5 needs scheduling system

**Cross-posting rules**:
- TikTok first → Instagram 2-4h later
- Re-export without TikTok watermark for Instagram
- Different hashtag sets per platform
- Never cross-post: duets/stitches, platform-specific trends, TikTok-specific phrasing
- Instagram-only: carousels (5-10 slides, listicle or comparison, final slide = save/follow CTA)

- [ ] Publisher skill reframed as domain skill, not identity
- [ ] Vendor references point to vendors.yaml
- [ ] Calendar content removed (now shared skill)
- [ ] Fallback matrix removed (Planner/human concern)

---

## 9. Data Agent Skill Updates

**File**: `src/agents/data/.pi/agent/skills/data-analysis/SKILL.md`

Add content performance analysis section:

1. Ingest post-level metrics (views, saves, shares, likes, comments at 24h and 7d)
2. Compute per-post: save_rate, share_rate, engagement_rate
3. Compute per-format: avg rates, post count — rank by share_rate
4. Track week-over-week trends: rolling 7-day averages, inflection points
5. Compare against benchmarks (see content-flywheel-analytics skill for thresholds)
6. Decision matrix: TikTok <2K avg after 8 weeks → format change; no 10K+ posts → hook change; one platform dominant → double down
7. Follower tracking against 12-week targets

- [ ] Content performance analysis section added
- [ ] References content-flywheel-analytics skill for shared benchmark data

---

## 10. Planner System Prompt Addition

**File**: `src/agents/planner/.pi/agent/AGENTS.md`

Minimal addition under existing task routing section:

**Content production tasks**: When the task involves content creation, distribution, or analytics, read the `content-flywheel-strategy` skill for strategy context. It defines content buckets, derivative chain, platform hierarchy, and work product catalog. Read the `content-calendar` shared skill for current cadence. Use these to inform decomposition — design the workflow based on what the task requires and which agents are available.

- [ ] Content production awareness added to Planner AGENTS.md
- [ ] References agent-specific flywheel skill, not a shared monolith

---

## File Change Summary

| File | Action | Nature | SOLID Fix |
|------|--------|--------|-----------|
| `config/vendors.yaml` | **New** | Vendor config (~30 lines) | DIP |
| `src/agents/planner/.pi/agent/skills/content-flywheel-strategy/SKILL.md` | **New** | Planner flywheel skill (~120 lines) | ISP |
| `src/agents/writer/.pi/agent/skills/content-flywheel-production/SKILL.md` | **New** | Writer flywheel skill (~80 lines) | ISP |
| `src/agents/researcher/.pi/agent/skills/content-flywheel-intelligence/SKILL.md` | **New** | Researcher flywheel skill (~70 lines) | ISP |
| `src/agents/data/.pi/agent/skills/content-flywheel-analytics/SKILL.md` | **New** | Data flywheel skill (~60 lines) | ISP |
| `src/agents/skills/content-calendar/SKILL.md` | **New** | Shared calendar skill (~80 lines) | SRP |
| `src/agents/skills/brand-guidelines/SKILL.md` | **Modify** | Add voice modes (~25 lines) | — |
| `src/agents/extensions/writing-style/data/style/platforms.json` | **Modify** | Add 4 platforms (~80 lines) | — |
| `src/agents/extensions/writing-style/data/style/formulas.json` | **Modify** | Add 2 formulas (~70 lines) | — |
| `src/agents/extensions/writing-style/data/style/social-voice-profile.json` | **New** | Social voice profile (~50 lines) | — |
| `src/agents/writer/.pi/agent/skills/derivative-formats/SKILL.md` | **New** | Writer format catalog (~80 lines) | SRP |
| `src/agents/writer/.pi/agent/skills/research-consumption/SKILL.md` | **New** | Writer research hedging (~40 lines) | SRP |
| `src/agents/writer/.pi/agent/skills/hook-formulas/SKILL.md` | **New** | Writer hook ranking (~50 lines) | SRP |
| `src/agents/researcher/.pi/agent/skills/social-media-research/SKILL.md` | **Modify** | Add compression, intel, format analysis (~100 lines) | — |
| `src/agents/publisher/.pi/agent/skills/social-media-publishing/SKILL.md` | **Modify** | Reframe as domain skill, remove calendar (~120 lines) | SRP |
| `src/agents/data/.pi/agent/skills/data-analysis/SKILL.md` | **Modify** | Add content performance (~80 lines) | — |
| `src/agents/planner/.pi/agent/AGENTS.md` | **Modify** | Add content production awareness (~10 lines) | — |

**Not changing**: Agent AGENTS.md system prompts (except Planner's minimal addition). System prompts define agent identity and constraints; domain workflow lives in skills.

## SOLID Compliance Summary

| Principle | Original Violation | Fix |
|-----------|-------------------|-----|
| **SRP** | Publisher skill had 5 independent concerns | Calendar → shared skill. Fallback matrix → removed (Planner/human). Publisher framed as domain skill. |
| **SRP** | Writer skill mixed formats, research rules, hooks | Split into 3 focused skills: derivative-formats, research-consumption, hook-formulas |
| **OCP** | content-flywheel hardcoded derivative chain | Agent-specific skills — adding new derivatives only changes relevant agent's skill |
| **ISP** | All agents forced to read 200-line shared skill | Each agent gets tailored flywheel skill with deeper relevant detail |
| **DIP** | Skills hardcoded vendor names (Apify actors, Typefully) | `config/vendors.yaml` as single source of truth, skills cross-reference |

## Verification

1. Skill discovery: Start containers, hit `/describe` on each, verify new skills appear in available_skills
2. Style system: Call `get_style_instructions` with platform=tiktok + formula=kallaway on Writer — verify 7-beat structure + TikTok constraints
3. Vendor config: Verify all skills referencing vendors point to `config/vendors.yaml`
4. Content task: Send content creation task to Planner — verify it reads content-flywheel-strategy, routes correctly
5. Carousel chain: Send carousel task — verify Writer → Publisher → Coder chain with render brief
6. Publisher identity: Verify Publisher's AGENTS.md unchanged — social media is domain skill, not identity
