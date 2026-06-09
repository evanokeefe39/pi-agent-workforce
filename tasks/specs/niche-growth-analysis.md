# Niche Growth Analysis — IG & TikTok in Tech/AI/Creator Niches

## Intent

Produce a detailed, data-backed growth analysis of Instagram and TikTok accounts across tech-adjacent niches, segmented by follower tier. The output is two things: (1) an actionable research report identifying what's working and what's not at each growth stage, and (2) a bundle of ready-to-publish content pieces for IG and TikTok that leverage the report's insights. This is the production-quality version of M0's prototype — same domain, vastly higher bar for research depth, analytical rigor, and content quality.

## Niches

Primary: AI, developer building-in-public, vibe coding, AI agencies, solopreneurs/indie hackers.

Adjacent (include when relevant): tech opinion/commentary, culture and trends in tech, AI/tech investing, tech news creators, no-code/low-code builders, dev tools.

Accounts can span multiple niches. Tag all that apply.

## Follower Tiers

| Tier | Range | Analysis focus |
|------|-------|----------------|
| Seed | 0 - 1,000 | What early moves matter, content-market fit signals, what stalls accounts |
| Rising | 1,000 - 10,000 | Growth inflection patterns, what separates accounts that break through vs plateau |
| Established | 10,000 - 50,000 | Content format optimization, early monetization, community building |
| Scaled | 50,000 - 100,000 | Platform algorithm leverage, brand deal economics, content team indicators |
| Authority | 100,000+ | Category leadership, cross-platform strategy, revenue diversification |

## Data Model

Research must produce structured data, not just prose. These types define what agents collect and analyze.

### Account

```
handle: string              // @username
platform: "instagram" | "tiktok"
niches: string[]            // from niche list above
follower_tier: string       // seed | rising | established | scaled | authority
follower_count: number
following_count: number
post_count: number
account_age_months: number  // approximate
bio_summary: string
verified: boolean
snapshot_date: string       // when this data was captured
```

### GrowthMetrics

```
account_handle: string
platform: string
follower_growth_30d: number         // absolute
follower_growth_rate_30d: number    // percentage
follower_growth_90d: number
follower_growth_rate_90d: number
posting_frequency_weekly: number
growth_trajectory: "accelerating" | "steady" | "decelerating" | "stalled" | "declining"
breakout_event: string | null       // viral post, collab, trend ride — if identifiable
time_to_current_tier: string        // "~6 months from 0 to 10k"
```

### EngagementMetrics

```
account_handle: string
platform: string
avg_likes: number
avg_comments: number
avg_shares: number                  // reposts, stitches, remixes
avg_saves: number                   // IG saves, TT favorites
engagement_rate: number             // (likes+comments+shares+saves) / followers
top_content_format: string          // carousel, reel, static, story, duet, stitch, etc.
content_format_mix: Record<string, number>  // percentage breakdown
hook_patterns: string[]             // high-performing opening patterns
hashtag_strategy: string
avg_video_duration_s: number        // for reels / TikToks
reply_rate: number                  // creator reply frequency on comments
```

### MonetizationSignals

```
account_handle: string
platform: string
methods: string[]                   // affiliate, brand_deal, course, saas, consulting, merch, paid_community
link_in_bio_type: string            // linktree, stan.store, gumroad, direct, beacons, none
revenue_tier: string                // pre-revenue, <$1k/mo, $1-5k/mo, $5-20k/mo, $20k+
brand_deal_frequency: string        // none, occasional, regular, frequent
products: string[]                  // identified offerings
cross_platform: string[]            // other platforms active on
email_list: boolean                 // lead magnet / newsletter signal
community: boolean                  // discord, skool, circle, etc.
```

### ContentPattern

```
niche: string
platform: string
follower_tier: string
name: string                        // "hook-first tutorial carousel"
description: string
effectiveness_signal: string        // metric or observation proving it works
example_accounts: string[]
example_posts: string[]             // URLs or descriptions
is_anti_pattern: boolean            // true = what doesn't work
```

### TierBenchmark

```
platform: string
follower_tier: string
median_engagement_rate: number
median_posting_freq_weekly: number
median_growth_rate_30d: number
top_formats: string[]
common_monetization: string[]
avg_time_to_next_tier: string
tier_graduation_differentiator: string  // what separates those who advance vs plateau
```

## Research Dimensions

Researcher must cover all of these across niches and tiers:

1. **Growth mechanics** — how accounts grow at each tier, breakout events, growth stalls, platform algorithm signals
2. **Content format effectiveness** — which formats drive growth/engagement at each tier (carousel vs reel vs static vs story vs TikTok native formats)
3. **Hook and retention patterns** — opening hooks, storytelling structures, retention curves
4. **Engagement quality** — comment sentiment, save-to-like ratio (depth signal), share-to-like ratio (virality signal)
5. **Monetization progression** — when accounts monetize, which methods at which tier, estimated revenue ranges
6. **Cross-platform arbitrage** — accounts leveraging one platform to grow another, content repurposing strategies
7. **Anti-patterns** — what stalls growth, what kills engagement, common mistakes per tier
8. **Niche-specific patterns** — what works differently in AI vs solopreneur vs vibe coding niches

## Deliverables

### 1. Research Report

Long-form analytical document. Structure:

- Executive summary (key findings, surprising insights, top opportunities)
- Methodology (data sources, sample sizes, confidence notes)
- Per-tier analysis (each tier gets a section with growth, engagement, monetization, patterns)
- Cross-tier progression map (what changes as accounts grow through tiers)
- Per-niche spotlight (unique dynamics in each niche)
- Content format deep-dive (what formats work where and why)
- Anti-pattern catalog (organized by tier — what to avoid)
- Actionable recommendations (specific, not generic — backed by data from the analysis)
- Appendix: account profiles, data tables, methodology notes

Tone: clear, analytical, data-driven. No promotional language. Hedge appropriately based on evidence quality (ADMIRALTY grades). Specific numbers over vague claims.

### 2. Instagram Content Bundle

Multiple carousel slide decks optimized for IG:

- At least 3 carousel decks (e.g., "What's Actually Working on Tech IG in 2026", "Growth Playbook by Follower Count", "Monetization Ladder: $0 to $20k/mo")
- Each deck: 5-10 slides using design system components (CarouselSlide, Typography, DataViz, Card)
- Rendered as images by coder agent via Playwright
- Social-optimized copy: punchy hooks, data callouts, clear takeaways, CTAs
- Captions with relevant hashtags

### 3. TikTok Content Bundle

- At least 2 TikTok-format pieces (scripts for talking-head or voiceover, or visual/text-on-screen format)
- Platform-native tone — conversational, opinion-forward, hook in first 2 seconds
- Each script includes: hook, key insight, supporting data point, CTA
- Duration guidance: 30-60 seconds per piece
- Could also include carousel-style TikTok slides (static image series with text overlay)

### 4. Supporting Data Artifacts

- Structured account profiles (JSON/JSONL) — the raw data model instances
- Tier benchmark tables (CSV or structured)
- Content pattern library (structured, reusable)

## E2E Test Quality Checks

The E2E test validates quality, not just existence. Each check has a rationale.

### Researcher Quality

| Check | What to verify | Why |
|-------|---------------|-----|
| Tool diversity | Used at least 2 of: deep_research, Apify scraper, web_search | Lesson: researcher defaults to web_search only — multi-tool produces richer primary data |
| Finding count | Minimum 20 structured findings (record_finding calls) | Below this means shallow coverage across 5+ niches and 5 tiers |
| Finding specificity | At least 50% of findings contain an @handle OR a specific number (follower count, engagement rate, percentage) | Generic findings ("accounts in AI niche grow fast") are noise |
| Source diversity | Findings cite at least 3 distinct source types (platform data, blog/article, research report, interview, tool/database) | Single-source research is just content aggregation |
| Primary data | At least 5 findings from Apify (actual scraped platform data) | Blog articles about "what works on IG" are secondhand — need actual account data |
| ADMIRALTY grades | Grades present on all findings, at least 2 distinct reliability grades used | All-A1 = fake confidence; varied grades show the researcher is assessing source quality |
| Tier coverage | Findings span at least 3 of 5 follower tiers | Single-tier analysis misses the progression story |
| Niche coverage | Findings span at least 3 niches | Narrow coverage defeats the brief |
| Anti-patterns present | At least 3 findings flagged as anti-patterns or "what doesn't work" | One-sided analysis (only positives) is less actionable |

### Data Agent Quality

| Check | What to verify | Why |
|-------|---------------|-----|
| SQL queries ran | At least 2 record_query_result calls | Data agent should compute, not just pass through |
| Metrics computed | At least 3 record_metric calls (benchmarks, aggregates, comparisons) | Raw data without computed benchmarks is incomplete |
| Cross-tier comparison | At least one metric comparing tiers (e.g., median engagement by tier) | Tier comparison is central to the brief |
| Charts/viz | At least 1 record_chart call | Visual data representations for the report |

### Report Quality (Writer)

| Check | What to verify | Why |
|-------|---------------|-----|
| Length | Minimum 3,000 words | Detailed analysis across 5 niches and 5 tiers requires depth |
| Structure | Contains sections for at least 3 tiers AND at least 2 niches | Brief requires per-tier and per-niche analysis |
| Data references | Report body contains at least 10 specific numbers (percentages, follower counts, rates) | Analytical reports cite data, not just opinions |
| Hedging | Report uses confidence language ("suggests", "indicates", "likely") for lower-grade findings | Overstating weak evidence erodes trust |
| Actionable recs | Report ends with at least 5 specific recommendations | "Post consistently" is not specific; "post 4-5 carousels/week with hook-first format in the 1-10k tier" is |
| Anti-patterns | Report identifies at least 3 things that don't work | What to avoid is as actionable as what to do |
| Tone | Analytical, not promotional — absence of hype words (revolutionary, game-changing, explosive, hack, secret) | Credibility requires measured language |

### Social Content Quality (Writer)

| Check | What to verify | Why |
|-------|---------------|-----|
| IG pieces | At least 3 distinct carousel content pieces produced | Brief requires multiple IG pieces |
| TikTok pieces | At least 2 TikTok content pieces (scripts or slide decks) | Brief explicitly asks for TikTok content |
| Tone shift | Social content avg sentence length < report avg sentence length | Social copy must be punchier than analytical report |
| Hooks present | Each social piece starts with a hook (question, stat, bold claim, pattern interrupt) | Social content without hooks gets scrolled past |
| Data in social | Social pieces reference at least 1 specific stat from the report | Content should leverage research, not be generic advice |
| Platform differentiation | IG content differs from TikTok content in format/structure | Same content on both platforms = lazy, not optimized |

### Coder Quality

| Check | What to verify | Why |
|-------|---------------|-----|
| Design system used | Rendered HTML references design system components or tokens | Coder should use the design system, not inline styles |
| Images rendered | At least 3 PNG/JPEG slide images produced | Carousel needs multiple rendered slides |
| Multiple decks | Images span at least 2 distinct carousel concepts | Not just one topic repeated |
| File size sanity | Each image > 10KB and < 5MB | Too small = blank/broken, too large = unoptimized |

### Bundle Completeness

| Check | What to verify | Why |
|-------|---------------|-----|
| Report artifact | 1 report artifact (type: report or document) | Primary deliverable |
| Research data | Structured findings artifact (type: dataset) | Provenance — raw data backing the report |
| IG slides | Multiple image artifacts for IG carousels | Content deliverable |
| TikTok content | At least 1 artifact for TikTok (script, slide deck, or content brief) | Content deliverable |
| Captions/copy | Social media captions accompanying visual content | Slides without captions aren't publishable |
| Lineage | Traceable chain: research findings → data analysis → report → social content | Proves the pipeline connected, not siloed |

### Meta Quality (Pipeline Health)

| Check | What to verify | Why |
|-------|---------------|-----|
| No manual intervention | Planner completed without human input | Autonomous operation is the standard |
| Researcher didn't just summarize blogs | At least 30% of findings from primary data (Apify) not secondary (web search articles) | M0 lesson: researcher regurgitated blog posts instead of scraping actual accounts |
| Writer used coder | At least 1 subagent delegation to coder for slide rendering | Content production chain must include visual rendering |
| Total artifacts | At least 10 artifacts in final bundle | Comprehensive output requires multiple pieces |
| Runtime reasonable | Pipeline completes in under 30 minutes | Quality check — runaway agents waste compute |

## Negative Space

- Not building new Apify actors — use existing Instagram/TikTok scrapers from the store
- Not doing video production — TikTok deliverable is scripts/concepts, not rendered video
- Not building a dashboard — report is a document, data is structured files
- Not doing real-time monitoring — this is a point-in-time analysis
- Not comparing all social platforms — IG and TikTok only (M2 covers others)
- Not changing agent infrastructure — use existing server.ts, jidoka, replicator as-is

## Dependencies

- Researcher parallel tool fanout (deep_research + Apify + web_search concurrently) — quality depends on this
- Planner routing hints — coder delegation for carousel rendering
- Design system — carousel templates and components for coder
- Artifact lineage — for bundle completeness verification in E2E

## Open Questions

None — brief is self-contained. Research scope is defined by niches and tiers above. Content scope is defined by deliverables. Quality bar is defined by E2E checks.
