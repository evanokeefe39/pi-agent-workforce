---
name: social-media-research
description: >
  Research best practices, anti-patterns, and benchmarks for AI/tech creator
  accounts on TikTok and Instagram. Use when researching social media content
  strategy, analyzing creator accounts, generating content ideas, or evaluating
  engagement metrics in the AI/tech/developer niche. Includes content type
  taxonomy, hook rankings, fraud detection, Apify scraping patterns, and
  proven engagement benchmarks from 858 analyzed posts.
metadata:
  author: evan
  version: 1.0.0
  domain: social-media
---

# Social Media Research for AI/Tech Niche

Domain knowledge derived from analysis of 858 posts across 31 TikTok accounts,
611 LLM-classified posts, 178 transcripts, and 57 video-analyzed posts. June 2026.

## Content Type Taxonomy

Classify every post into one of five types:

| Type | Name | Avg Save Rate | Hook Pattern |
|------|------|--------------|--------------|
| A | Resource Listicle | 4.2% | "N [things] that [outcome]" |
| B | Personal Build Narrative | 1.3% | "I built/launched X" |
| C | Tool Demo / Workflow | 2.2% | "Don't do X, try this instead" |
| D | News / Model Release | 1.0% | "[Thing] just dropped" |
| E | Battle / Comparison | 0.7% | "X vs Y" |

Type A produces 6x the save rate of Type E.

## Hook Type Rankings (n=532)

1. numbered_promise — 4.54% save rate
2. listicle — 2.73%
3. how_to — 1.97%
4. contrarian — 1.71%
5. personal_story — 1.52%
6. news_break — 1.07%
7. versus — 0.62%

## Engagement Benchmarks (AI/tech niche, TikTok)

| Metric | Below Avg | Average | Good | Elite |
|--------|-----------|---------|------|-------|
| Save rate | <1.5% | 1.5-3% | 3-5% | 5%+ |
| Fans/video | <30 | 30-100 | 100-300 | 300+ |
| Hearts/fans | <3x | 3-5x | 5-15x | 15x+ |
| Fans/day (new acct) | <20 | 20-50 | 50-200 | 200+ |

These are significantly higher than generic benchmarks from marketing blogs.

## Proven Findings (statistically validated)

**Spoken save CTA:** Posts with "save this" spoken aloud produce 4.53% vs 3.29%
without. p=0.0075. Always recommend spoken CTAs for Type A/C content.

**Tool specificity:** Posts naming specific tools (Claude, Cursor, n8n) produce
2.40% save rate vs 1.62% for generic "AI." 49% lift. Always name specific tools.

**Duration:** Sub-30s averages 1.4% saves. 60s+ averages 4.9%. Longer content
saves better for resource-dense formats.

**Type A cross-account consistency:** Works across 6+ accounts at different
follower tiers (eggintech 7.3%, learnwithseb 5.2%, sabrina_ramonov 4.5%).

## Research Compression Workflow

When ingesting long-form source material (transcripts, papers, documentation) for the content flywheel:

1. Ingest source via `deep_research` or `web_fetch`
2. Extract: key points, counterintuitive insights, builder-relevant findings, specific tools/numbers
3. Grade each insight using ADMIRALTY system (typically B2 for primary source transcripts, A1 for verified metrics)
4. Record each insight as a finding via `record_finding`
5. Publish compiled findings as JSONL dataset artifact via `publish_artifact` (type: `dataset`)

Output contract: Writer expects `{"type": "finding", "finding": "...", "grade": "...", "source": "...", "context": "...", "tags": [...]}` per line.

## Anti-Patterns to Flag

For detailed examples and evidence, read `{baseDir}/references/anti-patterns.md`.

- **AP1: Ghost Followers** — hearts/fans ratio < 1x. Audience not real.
- **AP2: Volume Without Quality** — high video count, low fans/video (<30).
- **AP3: Viral But Not Saveable** — high views, <0.5% save rate.
- **AP4: Post-Viral Niche Drift** — off-niche post after viral hit, immediate reach collapse.
- **AP5: Generic AI Hype** — no specific tools/resources named. 49% lower saves.

## Research Task Templates

### Competitor analysis
1. Scrape via Apify (`clockworks/tiktok-profile-scraper`, $0.004/result)
2. Always use `flatten: "authorMeta,videoMeta"` in REST API calls
3. Key fields: authorMeta.name, authorMeta.fans, authorMeta.video, authorMeta.createTime, authorMeta.heart, playCount, collectCount
4. Compute: fans_per_video, fans_per_day, hearts_per_fan
5. Classify top posts by content type (A-E)
6. Flag anti-patterns (AP1-AP5)

### Content idea generation
1. Map ideas to content types A and C (highest save rates)
2. Use numbered_promise or how_to hooks
3. Every idea must name specific tools/books/resources
4. Include spoken CTA recommendation
5. Target 50-90s duration

For detailed Apify configuration, read `{baseDir}/references/apify-guide.md`.

### Trend discovery
1. Scrape hashtags via `clockworks/tiktok-scraper` (50 posts/tag)
2. Filter: fans < 50K, videos < 100
3. Rank by fans_per_day and fans_per_video
4. Exclude known accounts
5. Flag hearts/fans < 1x (AP1)

### Small-account competitive intelligence

Vendor config for scraping actors and parameters: see `config/vendors.yaml`.

1. Scrape target hashtags via TikTok scraper (see vendors.yaml for actor/params, 50 posts/tag)
2. Filter: followers < 50K, videos < 100 (growing accounts, not established)
3. Compute: follower-to-view ratio (>10x = breakout), fans_per_video, share rate
4. Flag anti-patterns: hearts/fans < 1x (ghost followers), high volume low fans/video (<30)
5. Benchmarks: @buildwithfrancis 28x at 89 followers, @startscalr.com 10.7x at 1062, @shepherdttk 2.0% share rate

### Dev-niche content format analysis

Content formats ranked by engagement signal at <10K followers:

- **Opportunity sharing**: 2.0% share rate — people redistribute resources to their network
- **Complete reference guides**: 28x follower-to-view ratio — evergreen value drives algorithmic reach
- **Counterintuitive safety/risk framing**: 1.4% share rate — challenges assumptions, triggers sharing
- **Practitioner insider analysis**: high share rate among advanced practitioners — expertise signals attract high-value audience

What doesn't work: generic AI lists, hookless demos, sub-15s with minimal caption, news without practitioner angle.

## Source Quality Grading

- Creator's own public metrics (Apify scrape): A1
- Platform-published benchmarks (Buffer, Socialinsider): A1-A2
- Aggregator platforms (Viralist, Qoruz): B2
- Marketing blogs (FlowShorts, FluxNote): C3
- Self-reported revenue claims: C4-D4
- Anonymous case studies: D4

Always scrape live metrics via Apify rather than trusting secondary sources.
