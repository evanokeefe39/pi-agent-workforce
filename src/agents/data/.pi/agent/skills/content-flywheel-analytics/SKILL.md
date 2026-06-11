---
name: content-flywheel-analytics
description: >
  Data agent's perspective on the content flywheel. Defines metrics hierarchy,
  benchmark thresholds, decision matrix for format/platform adjustments, follower
  tracking targets, and standard analysis workflow. Read when analyzing content
  performance or producing analytics for Planner strategy decisions.
metadata:
  author: evan
  version: 1.0.0
  domain: content-strategy
---

# Content Flywheel Analytics — Data Perspective

Metrics, benchmarks, and decision frameworks for the content flywheel feedback loop.

## Metrics Hierarchy

Ordered by importance for flywheel health. Optimize top-down — never sacrifice a higher metric for a lower one.

1. **share_rate** (shares / views * 100) — primary flywheel signal. Content worth redistributing drives organic growth.
2. **save_rate** (saves / views * 100) — content worth returning to. High save rate = evergreen value.
3. **engagement_rate** ((likes + saves + comments + shares) / views * 100) — overall audience activity.
4. **views** — reach indicator, but vanity metric without engagement context.
5. **followers** — lagging indicator. Follows engagement, does not cause it.

## Benchmark Thresholds

### Share Rate
| Level | Threshold | Interpretation |
|-------|-----------|----------------|
| Not working | < 0.3% | Content not valuable enough to redistribute |
| Working | 0.3% - 0.5% | Flywheel turning, format has potential |
| Strong | 0.5% - 1.0% | Double down on this format/topic |
| Exceptional | > 1.0% | Replicate structure across platforms |

### Save Rate
| Level | Threshold | Interpretation |
|-------|-----------|----------------|
| Below average | < 1.5% | Format or hook needs work |
| Average | 1.5% - 3% | Acceptable for most formats |
| Good | 3% - 5% | Strong format-topic fit |
| Elite | > 5% | Top-performing content, study and replicate |

## Decision Matrix — 12-Week Calendar

Apply these rules when analyzing performance data for Planner:

| Condition | Threshold | Action |
|-----------|-----------|--------|
| TikTok avg views after 8 weeks | < 2K | Change content format — current format not reaching audience |
| No posts above 10K views | After 8 weeks of posting | Change hook structure — content not breaking through |
| One platform dominant | 3x engagement vs others | Double down — reallocate posting frequency to winner |
| Share rate consistently strong | > 0.5% for 4+ weeks | Scale — add multi-account, increase frequency |
| Save rate declining week-over-week | 3 consecutive weeks | Format fatigue — rotate to different content bucket |
| Engagement flat despite volume increase | 2+ weeks | Audience saturation at current follower tier — need new discovery mechanism |

## Follower Tracking Targets (12-week horizon)

| Platform | Week 4 | Week 8 | Week 12 |
|----------|--------|--------|---------|
| TikTok | 200-500 | 500-2K | 1K-5K |
| Instagram | 100-300 | 300-1K | 500-2K |
| YouTube | 50-150 | 150-500 | 300-1K |
| X (Twitter) | 100-300 | 300-800 | 500-1.5K |

These assume consistent posting (5-7x/week TikTok+Instagram, 3-5x/week X, 1-2x/week YouTube). Below the low end after the target week signals a format or niche problem, not just a growth problem.

## Standard Analysis Workflow

When Planner requests content performance analytics:

1. **Ingest** — read post-level metrics from artifact service (views, saves, shares, likes, comments at 24h and 7d marks)
2. **Per-post rates** — compute save_rate, share_rate, engagement_rate for each post
3. **Per-format rates** — aggregate by content type/format, compute averages and post counts
4. **Week-over-week trends** — rolling 7-day averages for each metric, flag direction changes >20%
5. **Inflection detection** — identify where rolling averages change direction (growth stalls, format starts working, etc.)
6. **Decision matrix** — apply the 12-week decision rules above, flag any triggered conditions
7. **Report** — publish structured JSONL artifact with metrics, trends, and triggered decisions for Planner consumption
