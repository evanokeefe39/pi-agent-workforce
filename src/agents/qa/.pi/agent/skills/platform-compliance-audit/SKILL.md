---
name: platform-compliance-audit
description: >
  Platform compliance evaluation rubric for QA agent. Covers per-platform character
  limits, hashtag rules, format constraints, caption structure, and cross-posting
  rules. Each rule has a unique rule_id, violation criteria, commendation criteria,
  and severity classification.
metadata:
  author: evan
  version: 1.0.0
  domain: platform-compliance
---

# Platform Compliance Audit

Evaluation rubric for auditing content against platform-specific rules. Each rule has a unique `rule_id`, describes what to check, defines violation and commendation criteria, and assigns a severity classification.

Severity levels:
- **critical** — platform hard limit or rule that causes suppression/rejection. Must fix before publishing.
- **major** — significant impact on reach, engagement, or content quality. Should fix before publishing.
- **minor** — best-practice deviation. Fix if time allows; log for future improvement.

---

## TikTok Rules

### PLATFORM-TIKTOK-HOOK-80CHAR

**What to check:** First 80 characters of the caption are visible before the user taps "more." This IS the hook. It must work as standalone text that communicates the core value proposition without requiring the reader to expand.

**Violation:** Hook text exceeds 80 characters, or the first 80 characters do not contain the core value proposition.

**Commendation:** Hook is under 80 characters and stops the scroll — clear value proposition front-loaded in the visible preview.

**Severity:** critical

---

### PLATFORM-TIKTOK-NARRATIVE

**What to check:** Caption body must use narrative structure. TikTok captions read as stories, not lists. Never use listicle or bullet format.

**Violation:** Bulleted list or numbered list appears in the caption body.

**Commendation:** Flowing narrative with causality connectors (So, Then, From there, Now) that reads as a natural story.

**Severity:** major

---

### PLATFORM-TIKTOK-HASHTAGS

**What to check:** Hashtag count and composition. 3-5 hashtags is optimal (captions matter more than hashtags on TikTok). Pattern: 1 niche + 1 broad + 1 format + 1-2 rotating.

**Violation:** 0 hashtags, or 6+ hashtags, or 15+ hashtags.

**Commendation:** 3-5 well-chosen hashtags matching the pattern (niche + broad + format + rotating).

**Severity:** minor

---

### PLATFORM-TIKTOK-NO-EMDASH

**What to check:** No em dashes allowed in TikTok captions.

**Violation:** Em dash character (—) is present anywhere in the caption.

**Commendation:** Clean punctuation throughout — no em dashes used.

**Severity:** minor

---

### PLATFORM-TIKTOK-DURATION

**What to check:** Video duration sweet spots. Resource content (tutorials, guides, deep dives) should be 60-90 seconds. Demos and quick tips should be 30-60 seconds.

**Violation:** Resource content under 30 seconds (1.4% vs 4.9% save rate penalty observed in data).

**Severity:** major for sub-30s resource content

---

### PLATFORM-TIKTOK-ONSCREEN

**What to check:** On-screen text is indexed for TikTok search. It must complement the caption, not duplicate it.

**Violation:** On-screen text duplicates the caption verbatim.

**Commendation:** On-screen text adds searchable keywords that complement the caption without repeating it.

**Severity:** minor

---

### PLATFORM-TIKTOK-DM-CTA

**What to check:** DM call-to-action format. Must follow the pattern: "comment [keyword] and I'll DM you."

**Violation:** DM CTA uses a different format than "comment [keyword] and I'll DM you."

**Severity:** minor

---

## Instagram Reel Rules

### PLATFORM-IG-REEL-FIRST-125

**What to check:** First 125 characters are visible without tapping "more." Front-load keywords here. Keywords in the first line outperform hashtags for Instagram search.

**Violation:** First 125 characters do not contain primary keywords or the value proposition.

**Commendation:** Keyword-rich first line optimized for Instagram search discovery.

**Severity:** major

---

### PLATFORM-IG-HASHTAG-CAP

**What to check:** Instagram enforces a 5 hashtag hard cap (rule since December 2025). Every hashtag must earn its slot. Pattern: niche community, topic, format, branded/rotating, discovery.

**Violation:** More than 5 hashtags in the caption.

**Commendation:** Exactly 5 well-chosen hashtags following the pattern (niche community + topic + format + branded/rotating + discovery).

**Severity:** critical (platform rule, not suggestion)

---

### PLATFORM-IG-CAPTION-LIMIT

**What to check:** Caption length must not exceed the platform hard limit.

**Violation:** Caption exceeds 2200 characters.

**Severity:** critical (platform hard limit)

---

## Instagram Carousel Rules

### PLATFORM-IG-CAROUSEL-HOOK-SLIDE

**What to check:** First slide IS the hook. It must be readable at thumbnail size in the feed grid.

**Violation:** First slide has small text or does not convey the hook clearly.

**Commendation:** Bold, readable hook visible at thumbnail size that communicates the core value immediately.

**Severity:** major

---

### PLATFORM-IG-CAROUSEL-SLIDES

**What to check:** Slide count. 5-10 slides is optimal for listicle/comparison format. Platform limits: minimum 2 slides, maximum 20 slides.

**Violation:** 1 slide (not a carousel) or more than 20 slides (platform limit).

**Commendation:** 5-10 slides with clear progression and logical flow.

**Severity:** minor for suboptimal count, critical for platform limit violation

---

### PLATFORM-IG-CAROUSEL-CTA-SLIDE

**What to check:** Final slide must include a save and/or follow call-to-action.

**Violation:** Last slide has no CTA.

**Commendation:** Clear save + follow CTA on the final slide.

**Severity:** major

---

## X/Twitter Rules

### PLATFORM-X-CHAR-LIMIT

**What to check:** Tweet length must not exceed the platform hard limit.

**Violation:** Tweet exceeds 280 characters.

**Severity:** critical (platform hard limit)

---

### PLATFORM-X-HASHTAGS

**What to check:** Hashtag count. 0-2 hashtags maximum on X/Twitter.

**Violation:** 3 or more hashtags in a tweet.

**Commendation:** 0-1 well-placed hashtags that add discoverability without cluttering the tweet.

**Severity:** minor

---

### PLATFORM-X-HOOK-FIRST

**What to check:** Hook must be in the first tweet. It must work standalone in the feed because users may not click into the thread.

**Violation:** First tweet is setup or context, with the actual hook buried in tweet 2 or later.

**Commendation:** First tweet IS the hook and works independently without requiring the thread for value.

**Severity:** major

---

### PLATFORM-X-NO-EMDASH

**What to check:** No em dashes in tweets.

**Violation:** Em dash character (—) is present anywhere in the tweet.

**Severity:** minor

---

## LinkedIn Rules

### PLATFORM-LINKEDIN-HOOK-2LINER

**What to check:** First 2 lines are visible before the "see more" click. They must compel the reader to expand.

**Violation:** First 2 lines are generic, vague, or do not contain the hook.

**Commendation:** Compelling 2-liner that drives "see more" clicks through curiosity or clear value.

**Severity:** major

---

### PLATFORM-LINKEDIN-PARAGRAPHS

**What to check:** Paragraph density. LinkedIn content should use 1-2 sentences per paragraph with generous white space for scannability.

**Violation:** Dense paragraphs with 3 or more sentences.

**Commendation:** Scannable, well-spaced paragraphs with 1-2 sentences each.

**Severity:** minor

---

### PLATFORM-LINKEDIN-HASHTAGS

**What to check:** Hashtag count and placement. 2-4 relevant hashtags placed at the end of the post.

**Violation:** 5 or more hashtags, or hashtags scattered throughout the body text.

**Severity:** minor

---

### PLATFORM-LINKEDIN-CHAR-LIMIT

**What to check:** Post length must not exceed the platform hard limit.

**Violation:** Post exceeds 3000 characters.

**Severity:** critical (platform hard limit)

---

## YouTube Shorts Rules

### PLATFORM-YOUTUBE-DURATION

**What to check:** YouTube Shorts has a 60 second maximum duration enforced by the platform.

**Violation:** Video exceeds 60 seconds.

**Severity:** critical (platform hard limit)

---

### PLATFORM-YOUTUBE-TITLE

**What to check:** Title must be searchable. "How to [X] with [Y]" format is preferred for discoverability.

**Violation:** Non-searchable title that lacks keywords or clear topic framing.

**Commendation:** SEO-optimized title using "How to" format with relevant keywords.

**Severity:** minor

---

### PLATFORM-YOUTUBE-EVERGREEN

**What to check:** Content must use evergreen framing. Avoid time-sensitive references that will date the content.

**Violation:** References to specific dates, "just dropped," "this week," or other time-bound events.

**Commendation:** Content that works equally well in 6 months as it does today.

**Severity:** minor

---

## Cross-Posting Rules

### PLATFORM-CROSSPOST-NO-WATERMARK

**What to check:** Instagram detects and deprioritizes content with TikTok or CapCut watermarks. Content must be re-exported clean for Instagram.

**Violation:** TikTok or CapCut watermark visible in Instagram content.

**Severity:** critical

---

### PLATFORM-CROSSPOST-DELAY

**What to check:** Cross-posts must be spaced by 2-4 hours. Post to the primary platform first (TikTok), then Instagram. Simultaneous posting signals automation to platforms.

**Violation:** Same-time cross-posting across platforms.

**Commendation:** 2-4 hour staggered posting with primary-platform-first order.

**Severity:** major

---

### PLATFORM-CROSSPOST-UNIQUE-CAPTION

**What to check:** Each platform needs its own caption optimized for that platform's specific rules and audience behavior. No copy-paste across platforms.

**Violation:** Identical caption copy-pasted across platforms.

**Commendation:** Platform-native captions that follow each platform's specific rules (character limits, hook placement, hashtag counts, formatting style).

**Severity:** major

---

### PLATFORM-CROSSPOST-UNIQUE-HASHTAGS

**What to check:** Different hashtag sets per platform. Each platform's hashtag strategy is distinct.

**Violation:** Identical hashtags used on TikTok and Instagram.

**Severity:** minor
