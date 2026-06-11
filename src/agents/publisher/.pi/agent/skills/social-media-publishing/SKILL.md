---
name: social-media-publishing
description: >
  Publish social media content to TikTok and Instagram with platform-specific
  optimization. Includes pre-publish checklist derived from 858 analyzed posts,
  caption templates, hashtag strategy, posting time guidance, cross-posting
  rules, and post-publish tracking setup. Use when preparing content for
  publish, scheduling posts, or setting up analytics tracking.
metadata:
  author: evan
  version: 1.0.0
  domain: social-media
---

# Social Media Publishing — AI/Tech Niche

Publishing guidelines derived from analysis of 858 posts across 31 accounts
and platform algorithm research current to June 2026.

## Pre-Publish Checklist

Run every item before confirming publish. If any item fails, the content
is not ready for publishing — flag the specific failure.

- [ ] **Saveable?** Can you articulate why someone would save this post?
      If not, the post should not be published.
- [ ] **Specific?** Does it name at least one specific tool, book, or resource?
      Generic "AI tips" produce 49% fewer saves.
- [ ] **Spoken CTA?** For Type A/C content: does the video include a spoken
      "save this" or "comment [keyword] and I'll DM you"? Spoken CTAs
      produce 38% higher save rates (p=0.0075).
- [ ] **Duration?** Is it 50-90s for resource lists, 30-60s for demos?
      Sub-30s content averages 1.4% save rate vs 4.9% for 60s+.
- [ ] **Niche consistent?** Is this clearly about the same topic as the
      account's other content? Off-niche posts cause immediate reach collapse.
- [ ] **Hook in first 3s?** 50% of viewers drop before second 4. The first
      words must be the hook, not a greeting or intro.
- [ ] **On-screen text?** TikTok indexes on-screen text for search. Key terms
      must appear visually, not just spoken.

## Caption Templates

### Resource List / Listicle
```
[Hook — first 125 chars are indexed for search, make them count]

[Emoji] [Item 1] — [one line why]
[Emoji] [Item 2] — [one line why]
[Emoji] [Item 3] — [one line why]

Save this for later [bookmark emoji]
Comment "[keyword]" and I'll DM you the links

#tag1 #tag2 #tag3 #tag4 #tag5
```

### Tool Demo
```
[Contrarian hook or how-to statement]

Here's the exact workflow:
1. [Step]
2. [Step]
3. [Step]

Try it yourself — link in bio

#tag1 #tag2 #tag3 #tag4 #tag5
```

### Build Journal
```
[Milestone or learning statement]

[2-3 sentences of context with specific numbers]

[What I'm doing next]

#buildinpublic #tag2 #tag3 #tag4 #tag5
```

## Hashtag Strategy

### TikTok (no hard cap, but 3-5 optimal)
Captions and spoken keywords matter more than hashtags. Use 3-5 tags:
- 1 niche tag: #claudecode, #vibecoding, #aiautomation
- 1 broad tag: #ai, #coding, #learnai
- 1 format tag: #tutorial, #aitools
- 1-2 rotating: test new tags weekly

### Instagram (5 tag hard cap since Dec 2025)
Every tag slot must earn its place:

| Slot | Type | Example | Post volume target |
|------|------|---------|-------------------|
| 1 | Niche community | #AItools | 10K-500K posts |
| 2 | Topic | #ArtificialIntelligence | 500K-5M posts |
| 3 | Format | #CodingReels | 100K-1M posts |
| 4 | Branded/rotating | #ClaudeCode | Rotate weekly |
| 5 | Discovery | #AIforDevelopers | Under 10K posts |

Keywords in caption first line now outperform hashtags for discoverability.

## Content Recycling Rules

Tag any post hitting >10K views as RECYCLE-[original date] in artifact metadata.

### Repost schedule
- 6 months from original: first repost
- 12 months: second repost
- 18 months: third repost
- 24 months: final repost

### Platform-specific recycling
- **TikTok**: natively re-upload with refreshed caption, same video file
- **X**: quote-tweet original with updated commentary
- **Instagram**: 10+ reposts in 30 days = excluded from recommendations (platform penalty). Space reposts accordingly.

## Multi-Account Strategy

Activate after first 50K+ view post. Scheduling tool config: see `config/vendors.yaml`.

### Setup
- Create second X account focused on specific sub-niche
- Sunday: identify best video from past week, schedule repost 7 days later on second account
- Viral videos continue reposting weekly for rest of year

### Scale guidelines
- 2 accounts: manageable solo
- 3-5 accounts: requires scheduling system (see vendors.yaml for provider)

## Cross-Posting Rules

### TikTok to Instagram
- Re-export video WITHOUT TikTok watermark (Instagram detects and deprioritizes)
- Adjust caption: Instagram supports longer captions, add more context
- Add 5 hashtags (Instagram cap) — different from TikTok tags
- Post to Instagram 2-4 hours after TikTok (avoid simultaneous cross-post)

### Instagram-only content
- Carousels: 5-10 slides, listicle or comparison format
- Final slide: save/follow CTA
- Add music to carousels to push them into the Reels feed
- Use Trial Reels (at 1K+ followers) to test with non-followers first

### Never cross-post
- TikTok duets/stitches (Instagram doesn't support the format)
- Platform-specific trends (sounds, challenges) that won't translate
- Content referencing TikTok-specific features ("link in bio" phrasing differs)

## Post-Publish Domain Knowledge

### First 60 minutes matter
Platform algorithms weight early engagement signals heavily. Comments within the first 60 minutes, pinned value-add comments, and Story cross-references all amplify initial distribution. Engagement with 5-10 niche accounts (genuine, not spam) signals community participation to the algorithm.

### Metrics to capture
For each published post, these metrics are needed at 24h and 7d marks:
- Views, saves, shares, likes, comments
- Computed: save_rate = saves/views * 100
- DM triggers received (if CTA was comment-to-DM)

### Performance signals
- Highest save rate post → produce more of that format
- Lowest save rate post → diagnose: wrong hook? Wrong duration? Off-niche?
- Benchmarks: good = 3%+, elite = 5%+ save rate (see content-flywheel-analytics skill for full thresholds)

## Anti-Patterns at Publish Time

For detailed evidence, read `{baseDir}/references/publish-anti-patterns.md`.

### Do not publish if:
- No spoken CTA in Type A/C content
- Duration < 30s for resource content (will underperform)
- Caption is generic ("AI tips" without naming tools)
- Post is off-niche from account's established topic
- Same 5 hashtags as last post (Instagram flags as spam)
- TikTok watermark visible on Instagram version

### Platform-specific penalties to avoid:
- Instagram: 10+ reposts in 30 days = excluded from recommendations
- Instagram: unlabeled AI content faces reach suppression (use "AI info" label)
- TikTok: dormancy penalty — reach takes months to rebuild after breaks
- Both: engagement bait ("like if you agree") actively demoted
