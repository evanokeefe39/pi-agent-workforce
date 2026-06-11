---
name: publish-readiness-audit
description: >
  Publish readiness evaluation rubric for QA agent. Covers the 7-item pre-publish
  checklist, publishing anti-patterns AP1-AP8, AI disclosure requirements, engagement
  window timing, and quality gate thresholds (share rate, save rate). Each rule has
  a unique rule_id, violation criteria, commendation criteria, and severity classification.
metadata:
  author: evan
  version: 1.0.0
  domain: publish-readiness
---

# Publish Readiness Audit

Evaluation rubric for pre-publish quality assurance. Every piece of content must pass
the pre-publish checklist and clear all anti-pattern checks before publishing is
authorized. Rules are ordered by evaluation sequence.

---

## Pre-Publish Checklist

Seven mandatory checks. All must pass before content is cleared for publishing.

### PUBLISH-SAVEABLE

**What to check:** Can you articulate why someone would save this? Content must have
a clear save-worthy value proposition: reference material, resource list, step-by-step
guide, reusable template.

- **Violation:** No articulable save reason. Content is entertaining or informative
  but offers nothing worth returning to.
- **Commendation:** Clear, specific save value ("list of 7 tools to reference later").
- **Severity:** critical

### PUBLISH-SPECIFIC

**What to check:** Names at least one specific tool, book, or resource. Generic
"AI tips" = 49% fewer saves than specific tool mentions.

- **Violation:** No specific tool or resource named. Content stays at the level of
  generic advice.
- **Commendation:** Multiple specific tools with context explaining why each matters.
- **Severity:** major

### PUBLISH-SPOKEN-CTA

**What to check:** For Type A (resource listicle) and Type C (tool demo) content:
video must include spoken "save this" or "comment [keyword] and I'll DM you."
Caption-only CTA is insufficient. Evidence: spoken CTA = 4.53% vs 3.29% save rate
(p=0.0075, 38% higher).

- **Violation:** Type A/C content without spoken CTA in video.
- **Commendation:** Spoken CTA with specific value reference ("save this so you have
  all 7 tools when you need them").
- **Severity:** major
- **Note:** Only applies to video content with Type A/C format.

### PUBLISH-DURATION

**What to check:** Content meets format-specific duration targets:

| Format                    | Target duration | Evidence                                              |
|---------------------------|-----------------|-------------------------------------------------------|
| Resource lists / tool breakdowns | 50-90s   | Sub-30s = 1.4% saves, 60s+ = 4.9% (68% penalty)     |
| Tool demos                | 30-60s          |                                                       |
| Build journals            | 30-45s          |                                                       |
| Opinion / hot take        | 20-30s          |                                                       |

- **Violation:** Content outside target range for its format.
- **Commendation:** Content in sweet spot for format.
- **Severity:** critical for sub-30s resource content, minor for slightly out of range.

### PUBLISH-NICHE-CONSISTENT

**What to check:** Content is recognizably about the same topic as the account's other
content. Off-niche = immediate reach collapse (not gradual). Example: @christieangelica
972K followers → 371 views after going off-niche.

- **Violation:** Content topic doesn't match account niche.
- **Commendation:** Content reinforces established niche with new angle.
- **Severity:** critical

### PUBLISH-HOOK-3S

**What to check:** Hook appears in first 3 seconds of video / first words of text. No
greetings, no intros, no preamble. 50% of viewers drop before second 4.

- **Violation:** Any preamble before hook.
- **Commendation:** Hook IS the first element.
- **Severity:** critical

### PUBLISH-ONSCREEN-TEXT

**What to check:** For TikTok: on-screen text is indexed for search. Must be present,
must complement caption (not duplicate). For Instagram: optional but recommended for
accessibility.

- **Violation:** TikTok content without on-screen text, or on-screen text that
  duplicates caption verbatim.
- **Commendation:** On-screen text that adds searchable keywords complementing caption.
- **Severity:** major for TikTok (search indexing), minor for other platforms.

---

## Publishing Anti-Patterns

Eight anti-patterns that must be checked before publish authorization. Any critical
anti-pattern match is a publish blocker.

### PUBLISH-AP1-NO-SPOKEN-CTA

**What to check:** Type A/C content published without spoken save CTA in video.

- **Impact:** 4.53% vs 3.29% save rate.
- **Violation:** Type A/C published without spoken CTA. Must return for re-recording,
  not publish without it.
- **Severity:** major

### PUBLISH-AP2-SUB-30S-RESOURCE

**What to check:** Resource list or tool demo published at under 30 seconds.

- **Impact:** 1.4% save rate vs 4.9% for 60s+ (68% penalty).
- **Exception:** Opinion content can be 20-30s, build journals 30-45s.
- **Violation:** Resource-dense content under 30s.
- **Severity:** critical

### PUBLISH-AP3-WATERMARK

**What to check:** Instagram content with TikTok or CapCut watermark. Instagram
detects and deprioritizes watermarked content. Mechanical check — verify absence
before Instagram publish.

- **Violation:** Watermark visible.
- **Severity:** critical

### PUBLISH-AP4-SAME-HASHTAGS

**What to check:** Identical hashtag set used on consecutive posts. Instagram flags
repeated identical sets as spam. Must rotate at least 2-3 tags per post while keeping
1-2 consistent niche tags.

- **Violation:** Same hashtag set as previous post.
- **Commendation:** Thoughtful rotation with consistent niche anchors.
- **Severity:** major

### PUBLISH-AP5-OFF-NICHE

**What to check:** Off-niche content published without strategic authorization.
Algorithm doesn't give grace period. Strategic niche expansion is a planner decision,
not publisher's.

- **Violation:** Off-niche content published without planner approval.
- **Severity:** critical

### PUBLISH-AP6-SIMULTANEOUS-CROSSPOST

**What to check:** Same content posted to TikTok and Instagram at the exact same time.
Signals automation to algorithm. Must space by 2-4 hours, primary platform first.

- **Violation:** Same-time cross-posting detected.
- **Severity:** major

### PUBLISH-AP7-ENGAGEMENT-WINDOW

**What to check:** Content published when no one available to respond to comments in
first 60 minutes. First 60 minutes critical for engagement velocity.

- **Violation:** Publishing outside active engagement hours with no one available.
- **Commendation:** Publishing during peak hours with active comment engagement planned.
- **Severity:** minor

### PUBLISH-AP8-AI-NO-DISCLOSURE

**What to check:** AI-generated content published on Instagram without "AI info" label
(required since May 2026). Applies if any part is AI-generated: voiceover, images,
scripts. Unlabeled AI content faces reach suppression and potential removal.

- **Violation:** AI-generated content without disclosure label.
- **Severity:** critical (platform compliance risk)

---

## Quality Gate Thresholds

### PUBLISH-QUALITY-GATE

**What to check:** Content must pass quality gate thresholds before publishing.

- **Primary:** share_rate > 0.3% (flywheel signal).
- **Secondary:** save_rate > 1.5% (content worth returning to).

These are post-publish metrics used to evaluate whether content SHOULD HAVE been
published. QA checks whether the content structurally supports these outcomes.

- **Violation:** Content structurally unlikely to meet thresholds (no save reason,
  no share reason, generic).
- **Commendation:** Content structurally optimized for saves and shares (specific
  tools, resource value, CTA).
- **Severity:** major

### PUBLISH-NEVER-LOW-QUALITY

**What to check:** Go/no-go publishing principle: never publish low-quality content to
maintain cadence. Missing a posting slot is better than publishing weak content that
damages account quality signals.

- **Violation:** Content pushed to publish despite known quality issues.
- **Commendation:** Quality held as gate even when behind schedule.
- **Severity:** critical

---

## Metrics Capture Requirements

### PUBLISH-METRICS-CAPTURE

**What to check:** Publisher must plan to capture metrics at two checkpoints: 24 hours
and 7 days post-publish.

**Required metrics:** views, saves, shares, likes, comments.

**Computed metrics:** save_rate (saves/views * 100), share_rate (shares/views * 100).

- **Violation:** No metrics capture plan.
- **Commendation:** Automated capture at both checkpoints.
- **Severity:** minor
