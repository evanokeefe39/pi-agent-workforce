---
name: content-quality-audit
description: >
  Content quality evaluation rubric for QA agent. Covers specificity, hook formula
  compliance, duration targets, CTA presence, voice consistency, blocked word detection,
  and writing anti-pattern identification. Each rule has a unique rule_id, violation
  criteria, commendation criteria, and severity classification.
metadata:
  author: evan
  version: 1.0.0
  domain: content-quality
---

# Content Quality Audit Rubric

Structured evaluation rules for QA review of content produced by writer, coder, and publisher agents. Each rule has a unique `rule_id`, violation criteria, commendation criteria, and severity grade (critical/major/minor). Based on 858 analyzed posts, 611 classified, 57 video-analyzed. June 2026.

---

## Specificity Rules

### CONTENT-SPECIFICITY

**What to check:** Every post must name at least one specific tool, book, number, or concrete example. Generic advice is not publishable content.

**Violation:** Generic statements without a named tool, specific number, or concrete example.
- BAD: "Use AI tools to boost your productivity"
- BAD: "There are many great options available"

**Commendation:** Named tool with workflow, specific numbers, or concrete actionable detail.
- GOOD: "Use Claude Code to scaffold a Next.js app in 10 minutes"
- GOOD: "Cursor's tab completion saved me 3 hours on a 2,000-line refactor"

**Evidence:** Generic posts produce 1.62% save rate vs 2.40% with specificity (49% lift).

**Severity:** major

---

## Hook Formula Rules

### CONTENT-HOOK-FORMULA

**What to check:** Hook must match one of the ranked formula types. Evaluate which type is used and whether it is optimal for the content format.

**Hook type rankings by save rate:**

| Rank | Hook Type | Save Rate |
|------|-----------|-----------|
| 1 | numbered_promise | 4.54% |
| 2 | listicle | 2.73% |
| 3 | how_to | 1.97% |
| 4 | contrarian | 1.71% |
| 5 | personal_story | 1.52% |
| 6 | news_break | 1.07% |
| 7 | versus | 0.62% |

**Violation:** Using `versus` hook type (0.62%, worst performer).
- BAD: "Claude vs ChatGPT — which is better?"

**Commendation:** Using `numbered_promise` or `listicle` (top 2 performers).
- GOOD: "Here are the 5 AI tools that replaced my entire tech stack"
- GOOD: "The 7 best free APIs for your next side project"

**Severity:** major for `versus`, minor for suboptimal but not worst (ranks 4-6).

---

### CONTENT-HOOK-FIRST-3S

**What to check:** Hook must appear in the first word/sentence. No preamble, no greeting, no intro before the hook. 50% of viewers drop before second 4.

**Violation:** Any greeting or introductory phrase before the hook.
- BAD: "Hey everyone, welcome back to another video..."
- BAD: "So I've been thinking about something recently..."
- BAD: "Before we get started, make sure to like and subscribe"

**Commendation:** Hook IS the first word. Zero preamble.
- GOOD: "5 AI tools that will save you 10 hours a week" (opens the content)
- GOOD: "Stop using ChatGPT for coding. Here's why." (hook is the opener)

**Severity:** critical

---

## Duration Rules

### CONTENT-DURATION-TARGET

**What to check:** Content must meet format-specific duration targets. Duration directly correlates with save rate for resource content.

**Duration targets by format:**

| Format | Target Duration | Notes |
|--------|----------------|-------|
| Resource lists / tool breakdowns | 50-90s | Sub-30s averages 1.4% saves; 60s+ averages 4.9% (68% penalty for short) |
| Tool demos | 30-60s | |
| Build journals | 30-45s | |
| Opinion / hot take | 20-30s | |

**Violation:** Resource content under 30s duration.
- BAD: 22s video listing "5 best AI tools" (too rushed, no depth, 1.4% save rate)

**Commendation:** Resource content in the 60-90s sweet spot.
- GOOD: 75s video covering 5 tools with specific use cases for each (4.9% save rate zone)

**Severity:** critical for sub-30s resource content, minor for slightly outside target range.

---

## CTA Rules

### CONTENT-CTA-SPOKEN

**What to check:** Type A (resource listicle) and Type C (tool demo) content must include a spoken save CTA in the video. Caption-only CTA is not sufficient.

**Evidence:** Spoken CTA = 4.53% save rate vs 3.29% without (p=0.0075, 38% lift).

**Violation:** Type A or Type C content without a spoken CTA in the video.
- BAD: Resource list with CTA only in the caption, nothing spoken

**Commendation:** Spoken CTA with specific value reference tied to the post content.
- GOOD: "Save this list for your next project"
- GOOD: "Bookmark this so you have these tools ready when you need them"

**Severity:** major

---

### CONTENT-CTA-WRITTEN

**What to check:** Caption must include a written CTA. The CTA must reference specific value delivered in the post, not generic engagement bait.

**Violation:** No CTA in caption, or generic engagement bait with no save reason.
- BAD: "Like if you agree!"
- BAD: "Follow for more!"
- BAD: No CTA at all

**Commendation:** CTA references specific value from the post.
- GOOD: "Save this list of 5 free APIs for your next side project"
- GOOD: "Bookmark this Claude Code workflow for your next refactor"

**Severity:** minor

---

## Voice Consistency Rules

### CONTENT-VOICE-MODE

**What to check:** Content must match the correct voice mode for its target platform. Mixing modes within a single piece is a violation.

**Two voice modes:**

**Analytical (non-social):**
- Authoritative tone
- No first-person singular
- Evidence-backed claims
- No rhetorical questions as hooks
- Suitable for documentation, reports, analysis

**Social (first-person OK):**
- Personal, specific, honest
- Practitioner sharing experience
- Formality: 0.4
- Enthusiasm: 0.6
- Target readability: grade 8
- Active voice ratio: 90%
- Burstiness: 0.65 (mix of short punchy sentences and longer explanatory ones)

**Violation:** Using analytical voice in social content or vice versa.
- BAD (analytical in social): "One should consider the implications of utilizing Claude Code for development workflows"
- BAD (social in analytical): "I personally think this architecture is pretty cool honestly"

**Commendation:** Consistent voice throughout with correct mode for the target platform.
- GOOD (social): "I switched to Claude Code last month. My deploy time dropped from 45 minutes to 12."
- GOOD (analytical): "Claude Code reduces average deploy time by 73% in measured trials across 50 repositories."

**Severity:** major

---

## Blocked Word Rules

### CONTENT-BLOCKED-WORD-STRICT

**What to check:** Content must not contain any words from the strict blocklist. These 46 words are AI-telltale vocabulary that signal generic LLM output. Any occurrence is a violation.

**Strict blocklist (46 words):**
delve, tapestry, multifaceted, utilize, harness, leverage, furthermore, moreover, realm, intricate, pivotal, crucial, embark, landscape, comprehensive, nuanced, underscore, foster, facilitate, encompass, navigating, testament, paramount, noteworthy, commendable, intrinsically, groundbreaking, transformative, indispensable, meticulous, spearhead, illuminating, unravel, burgeoning, elucidate, substantive, overarching, whilst, amidst, aforementioned, henceforth, notwithstanding, pertaining, culmination, juxtaposition, synergy, plethora.

**Violation:** Any strict-list word present in content.
- BAD: "Let's delve into the nuanced landscape of AI tooling"
- BAD: "This comprehensive guide will harness the transformative power of..."

**Commendation:** Zero blocked words and natural, conversational vocabulary.
- GOOD: "Here's how I actually use Claude Code every day"

**Severity:** major (per occurrence)

---

### CONTENT-BLOCKED-WORD-SOFT

**What to check:** Content should minimize words from the soft blocklist. These 49 words are corporate/marketing buzzwords that weaken credibility when overused.

**Soft blocklist (49 words) includes:**
innovative, cutting-edge, seamless, robust, holistic, dynamic, scalable, game-changing, revolutionary, unprecedented, best-in-class, world-class, next-generation, mission-critical, bleeding-edge, disruptive, state-of-the-art, end-to-end, future-proof, paradigm-shifting, turnkey, enterprise-grade, battle-tested, production-ready, industry-leading, data-driven, AI-powered, machine-learning-enabled, cloud-native, hyper-scale, full-stack, cross-functional, stakeholder, synergize, operationalize, democratize, ecosystem, vertical, bandwidth, deep-dive, greenfield, low-hanging-fruit, move-the-needle, circle-back, double-down, take-offline, boil-the-ocean, run-it-up-the-flagpole, thought-leader.

**Violation:** 3 or more soft-list words in one piece of content.
- BAD: "This innovative, cutting-edge, seamless tool is a game-changer"

**Commendation:** Zero soft-list words throughout.
- GOOD: "This tool loads in 200ms, handles 10K concurrent users, and costs $0"

**Severity:** minor

---

### CONTENT-BLOCKED-SOCIAL

**What to check:** Social voice content must not contain social-specific blocked phrases. These are hype words that erode trust and signal low-effort content.

**Social-blocked phrases:**
game-changing, revolutionary, unlock your potential, skyrocket your growth, level up, 10x, crushing it, insane, mind-blowing, next level.

**Violation:** Any social-blocked phrase present in social voice content.
- BAD: "This game-changing tool will 10x your productivity and take you to the next level"
- BAD: "Mind-blowing AI update just dropped and it's insane"

**Commendation:** Enthusiastic tone achieved without hype words.
- GOOD: "This tool cut my build time from 4 hours to 20 minutes. Here's the setup."

**Severity:** major

---

## Writing Anti-Pattern Rules

### WRITE-AP1-GENERIC-HYPE

**Rule ID:** WRITE-AP1-GENERIC-HYPE

**What to check:** Content that makes broad AI claims without naming a specific tool or providing an actionable step.

**Evidence:** 1.62% save rate (generic) vs 2.40% with specificity.

**Violation:** Generic AI hype without a named tool, workflow, or resource link.
- BAD: "AI is revolutionizing everything"
- BAD: "The future of coding is here"

**Commendation:** Specific tool, specific workflow, specific outcome.
- GOOD: "Claude Code refactored 47 files in my monorepo in 8 minutes. Here's the prompt I used."

**Fix recommendation:** Name the tool, show the workflow, give the resource link.

**Severity:** critical

---

### WRITE-AP2-NEWS-NO-ANALYSIS

**Rule ID:** WRITE-AP2-NEWS-NO-ANALYSIS

**What to check:** News announcement content that reports a release without adding an analysis layer. Stale within 24 hours, no reason for viewers to save.

**Evidence:** 1.07% save rate for pure news content.

**Violation:** News announcement without analysis, takeaways, or actionable steps.
- BAD: "GPT-5 just dropped and it's INSANE"
- BAD: "New Claude model released today!"

**Commendation:** News plus analysis layer with actionable takeaways.
- GOOD: "Claude Opus 4.6 shipped today. What this means for coding agents + 3 things to try today."

**Fix recommendation:** Add "What this means for [audience] + 3 things to try today."

**Severity:** major

---

### WRITE-AP3-VERSUS-NO-VERDICT

**Rule ID:** WRITE-AP3-VERSUS-NO-VERDICT

**What to check:** Comparison content that presents two options without taking a position. Punts the conclusion to comments, giving the viewer no reason to save.

**Evidence:** 0.62% save rate, worst hook type measured.

**Violation:** Comparison without taking a position or providing a verdict.
- BAD: "Claude vs ChatGPT -- let me know in comments!"
- BAD: "Which AI tool is better? You decide!"

**Commendation:** Clear position with evidence supporting the verdict.
- GOOD: "Claude vs ChatGPT for coding -- Claude wins for refactoring, here's proof from 3 real projects."

**Fix recommendation:** Take a position with evidence. State who should use which and why.

**Severity:** major

---

### WRITE-AP4-ENGAGEMENT-BAIT

**Rule ID:** WRITE-AP4-ENGAGEMENT-BAIT

**What to check:** CTA that asks for engagement (likes, follows) without providing a save-worthy reason. Algorithm deprioritizes content generating likes without saves/shares.

**Violation:** Engagement bait without value proposition.
- BAD: "Like if you agree! Follow for more!"
- BAD: "Drop a fire emoji if you found this helpful"
- BAD: "Share this with a friend who needs to see it"

**Commendation:** CTA tied to specific value delivered in the post.
- GOOD: "Save this list -- you'll need these tools when you start your next project"

**Fix recommendation:** CTA must reference specific value the viewer gets from saving/sharing.

**Severity:** major

---

### WRITE-AP5-OVERLONG-INTRO

**Rule ID:** WRITE-AP5-OVERLONG-INTRO

**What to check:** Content that wastes the first 3 seconds with greetings, intros, or preamble before delivering the hook.

**Violation:** Any preamble before the hook.
- BAD: "Hey everyone, welcome back to my channel..."
- BAD: "So today I wanted to talk about something..."
- BAD: "Before we dive in, quick reminder to subscribe"

**Commendation:** Hook is the first word, zero preamble.
- GOOD: "5 free tools that replaced my $200/month stack" (this IS the opening)

**Fix recommendation:** Hook in first word. Zero preamble. Cut everything before the value proposition.

**Severity:** critical

---

### WRITE-AP6-OFF-NICHE

**Rule ID:** WRITE-AP6-OFF-NICHE

**What to check:** Content not aligned with the account's established topic. Effect is immediate cliff-edge drop in performance, not gradual decline.

**Evidence:** @christieangelica 972K views on AI tools, then 371 views on a quiz. Immediate cliff-edge, not gradual.

**Violation:** Content that is not recognizably about the account's established topic.
- BAD: AI tools account posting a cooking recipe
- BAD: Tech tutorial account posting a travel vlog

**Commendation:** Content clearly within the account's niche, recognizable to returning viewers.
- GOOD: AI tools account posting a new tool breakdown with specific use cases

**Fix recommendation:** Every post must be recognizably about the account's core topic. No exceptions for "fun" or "variety" content.

**Severity:** critical

---

## Format Save Rate Reference

Use this table as baseline context when evaluating content quality. Content that matches a high-save-rate format but violates rubric rules is underperforming its potential.

| Format | Save Rate | Duration |
|--------|-----------|----------|
| Numbered Resource List | 4-8% | 50-90s |
| Tier Rating | 4-6% | 45-75s |
| Book Breakdown | 4-6% | 50-90s |
| Tool Demo | 2-3% | 30-60s |
| Comparison | 3-5% | 45-75s |
| Build Journal | 1-2% | 30-45s |
| Opinion / Analysis | 1-2% | 20-30s |

---

## Evaluation Output Format

For each piece of content evaluated, the QA agent should produce:

1. **Rule-by-rule assessment** -- each rule_id with PASS, VIOLATION, or COMMENDATION
2. **Severity summary** -- count of critical/major/minor violations
3. **Overall verdict** -- PUBLISH, REVISE (with specific fixes), or REJECT (with rationale)
4. **Specific fix instructions** -- for each violation, what exactly to change

A piece with any critical violation should be marked REVISE or REJECT. A piece with 3+ major violations should be marked REVISE. Minor violations are noted but do not block publishing.
