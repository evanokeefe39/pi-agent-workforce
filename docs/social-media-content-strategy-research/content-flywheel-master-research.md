# Content Flywheel Research — Master Document
**Solo dev, building in public, faceless AI/tech account**
**Research completed: June 2026 | Sources: 15 YouTube transcripts, 90+ TikTok posts, 24 Instagram posts, 3 hashtag datasets, web research**

---

## Executive Summary

This research answers one question: how does a solo dev building in public produce 5–7 pieces of content per week without creating each one from scratch, within a 2–3 hr/day budget, starting faceless?

The answer from all sources is consistent: **one screen-recording anchor per week, decomposed into platform-native derivatives, posted without obsessing over production quality.** The formats that work are demonstrations of real things being built or broken down — not AI-generated explainers, not polished talking heads, not generic AI news.

The strategic gap this research identified: there is no creator at 100K+ followers who explicitly serves developers building products with AI, shows their actual build process, and documents the journey honestly. Rowan Cheung serves business people. Kallaway serves business owners. Riley Brown now serves his own product. Marc Lou documents builds but doesn't teach. That position is open.

---

## Part 1: The Frameworks — What the Major Creators Actually Do

### 1.1 The universal architecture

Every creator at scale, regardless of their starting format, runs the same underlying loop:

**One anchor piece per week → decompose into platform-native derivatives → distribute → track winners → recycle → repeat**

The anchor varies by creator type. The decomposition logic is always: start from the most constrained format (Twitter's 280 chars, or a short-form hook), then expand outward. The recycling cadence is 6 months for most (Justin Welsh's "730-day content library"), or continuous for high-volume accounts.

### 1.2 Matt Gray — Content Waterfall (YouTube-first)

**Who:** Founder/CEO, 2.7M+ followers across platforms, ~$700K/month revenue from Founder OS. Sept 2025–Mar 2026 videos analysed.

**Anchor:** Long-form YouTube video (15–30 min).

**Derivatives from one video:**
- 3 Instagram Reels
- 3 TikTok videos
- 3 YouTube Shorts
- 3 LinkedIn posts
- 3 X threads
- 1 newsletter
= 16+ pieces, all from one filming session

**AI tool:** Poppy AI — a canvas workspace where you paste YouTube/Instagram links, it auto-transcribes them, and you prompt AI with the full context loaded. His workflow: load 3–4 reference videos + his own recent content into Poppy → prompt for LinkedIn carousels, X threads, Reel scripts, all in his voice. He says explicitly this isn't replicable in ChatGPT or Claude because Poppy ingests live content.

**Time model:** 4 focused hours/day total (content creation is ~1 hour, the rest is strategic decisions, team management, revenue). Batch shoots (10 videos over 7 days in a single location).

**2026 update — the "Affluence Paradox":** His most significant recent shift (Mar 2026). Chase "profit per content" not views. Viral content attracts beginners; specific high-value content attracts buyers. Before posting anything: "Would someone pay $10,000 for this information?" If no, it's entertainment. His best-converting formats are systems breakdowns, screen-share demos, and live whiteboard coaching sessions — not polished brand content.

**Relevance for target user:** The waterfall system is directly applicable once you're recording screen-sharing tutorials. His "rule of five" (every piece of content lives in at least 5 places) is the minimum distribution standard.

### 1.3 Dan Koe — Newsletter-First Cascade

**Who:** 5M+ followers across all platforms. May 2026 video + Oct 2025 Greg Isenberg interview analysed.

**Anchor:** Weekly newsletter, written in 30–60 min sessions each morning, 5–6 days/week, building section by section. The newsletter IS the weekly YouTube video — he reads it directly to camera, looks down at the text, and his editor adds B-roll over the downward glances.

**Daily rhythm:** 2 hours writing every morning → finish 1 newsletter section + 3 social posts. Post those 3 posts to X first (280-char constraint forces compression), then copy-paste to Threads, LinkedIn, Instagram. Best posts become Reels/TikToks/Shorts by recording himself reading and riffing on them. 1 day/week: record the full newsletter as YouTube video.

**AI workflow (the most tactically detailed source in this research):**
1. Use Gemini 2.5 (large context window) to compress 3–6 hour YouTube videos on his topic into ~1,000 words of research notes
2. After writing, run the newsletter through 3 custom prompts:
   - YouTube title generator (trained on his 15 best-performing titles)
   - "Deep post generator" — deconstructs content into paradoxes, key quotes, transformation arcs, core problems (building blocks, not finished posts)
   - Idea generator outputting 60 ideas based on his best tweet patterns
3. For learning to write better: takes 3 posts he wants to emulate → asks AI to break down each one (structure, psychological patterns, why it works) → combines into a guide → uses a meta-prompt to turn that guide into a two-phase interviewing prompt that writes variations in his voice

**2026 update — anti-AI-slop stance:** He built Eden (his own tool) specifically because "everyone sounds the same now." His explicit position: AI should never write your content — it's a thought partner for ideation and research, not a ghostwriter. "The people who will win are those who consistently iterate and evolve, not those who take the easy route."

**Newsletter-first cascade structure:**
- Pain point intro
- Novel perspective / counterintuitive insight
- Practical steps (the "unique mechanism")
- Core takeaway that makes people think "that changed how I see this"

**Relevance for target user:** The newsletter-first cascade is more applicable to someone with a writing-heavy anchor. For a dev account, substitute "weekly written synthesis of what you built/learned" for newsletter. The AI workflow (especially the deep post generator and title generator prompts) is directly copyable.

### 1.4 Justin Welsh — Hub and Spoke (LinkedIn/X text)

**Who:** ~1.5M followers, ~$10.5M solopreneur revenue. LinkedIn/X text-based creator.

**Key 2026 update:** Published a dedicated "How to Grow on LinkedIn in 2026" guide. Core shift: text-only is now largely invisible. Visuals (carousels, infographics) now dominate LinkedIn's feed — they increase dwell time, which is the #1 algorithm signal. His new advice: "If you aren't using carousels, infographics, or visuals, you're basically invisible."

**Workflow:** The "5-12-3 rule" — every piece of content must work in 5 seconds (hook grabs), 12 seconds (body delivers), 3 seconds (CTA is clear). Content recycling via a "730-day library" — every post tagged for recycling at 6/12/18/24 months.

**Relevance for target user:** Welsh operates on text-native platforms (LinkedIn, X). His visual-first 2026 update matters for LinkedIn posts. The recycling library concept is worth implementing from day one.

### 1.5 Greg Isenberg — ACP model + content triplets

**Who:** Holding company founder, early-stage AI investor, 500K+ X followers.

**Framework:** "ACP" — Audience → Community → Product. Build one platform to 10K followers first ("become the Mr. Beast of your category"), then build. Every successful idea becomes 3 things: thread + blog post + video.

**Practical finding from Oct 2025 interview with Dan Koe:** Isenberg showed that adding an image to an X post that had "basically nowhere" performance took it from negligible to 148K impressions. His lesson: good ideas + compelling images > good ideas alone for X/Twitter distribution.

**Relevance for target user:** The 10K threshold before expanding platforms is the right starting constraint. Don't try to be everywhere before you have signal on what works.

---

## Part 2: The Dev/Builder Niche Specifically

### 2.1 Riley Brown — the closest real-world model

**Who:** 1.5M followers, raised $9M to start Vibecode (AI-powered mobile app builder). Apr 2026 Jay Clouse interview analysed + 20 most recent TikTok posts.

**Why he's the most relevant creator in this research:** Dev-adjacent, screen-recording native, started solo with no production budget, faceless-compatible, now at significant scale.

**Origin:** First video on TikTok about ChatGPT (the day it launched) got 20M views. 0 → 200K followers in 2 weeks. His framing: "It wasn't skill. I was the only person making videos about the most transformational technology of our generation." The lesson is deep niche knowledge, not timing.

**Current short-form workflow (2026):**
- Films short-form separately from long-form — not clips of YouTube videos
- 30 minutes end-to-end to make one short-form video
- Format: screen share of something he's building, or quick AI tool demo
- "Finger pointer" format: films his phone screen with a plastic pointer stick tapping, no face, pure screen demo — some of these get 1M+ views
- Sends to editing agency, gets multiple variations back next morning

**Current long-form workflow:**
- 2 hours to film (screen recording + webcam)
- Editing agency: 10-hour turnaround (fast agency) or 3 days (high quality)
- Cost: $800–1,200/episode at high end
- Separate thumbnail designer

**The multi-account X strategy (tripling revenue in 2 months):**
- 7 X accounts, all about vibe coding, combined 200K+ followers
- Uses Typefully to schedule across all 9 accounts (including co-founder's and first hire's)
- Every Sunday: review previous week, identify viral videos, schedule each to repost from all accounts 1 week apart
- "If I get a viral video, it will be posted every week for the rest of the year"
- Currently migrating to Instagram too

**Content philosophy:**
- "Find what people are paying for, do it, and make it free" — core growth principle
- Never uses AI to write scripts: "The more you use AI for writing your scripts, the more you're going to sound like AI. In the long run, sounding like AI is suicide."
- Advice to someone starting today: make educational screen-share videos on YouTube + X. Webcam to start. $100 wireless mic. Hook structure: "this tool is actually insane, in this video I'll show you how to do X" → immediately dive in → end with subscribe. "Until you hit 50K subs, don't worry about optimising anything else."
- Tool: Tella for screen recording (film in chunks, restart on mistakes, self-edits as you go)

**TikTok content patterns (from 20 most recent posts):**
- Highest performers: screen demos of AI doing something visually surprising (1M+ views for "full stack app in 117 seconds," 700K+ for "Openclaw controls Blender")
- Mid performers: talking head reacting to AI news (150K views)
- Lower performers: long-caption text posts, sponsored posts
- Duration: 70–175 seconds (most just over 1 minute for TikTok Creativity Program eligibility)
- No hashtags on recent posts — stopped using them
- Hook structure on every high performer: "Oh my [god/wow]... [tool] just [did impossible thing]" → immediate demo

### 2.2 Marc Lou — building in public IS the content system

**Who:** Indie maker, 170K+ X followers, 133K+ YouTube, multiple SaaS products. Jun 2026 video (8 days old at time of analysis) documenting 512-day $0 → $20K MRR journey for DataFast.

**The implicit content flywheel:**
1. Ship feature / something happens
2. Tweet about it immediately (primary discovery channel)
3. Document in raw video diary ("Today is day X, here's what happened")
4. Blog/newsletter occasionally

The product generates the content — no separate content strategy needed. Each feature, each crisis, each milestone is a new piece. Grew to $20K MRR without any traditional marketing.

**What performed (visible from transcript):**
- Raw failures and frustrations ("I wanted to give up") outperformed milestone announcements in emotional resonance
- The real-time globe feature (day 165) was the single biggest growth driver — built specifically to be shareable/visual
- Public dashboard sharing turned users into marketers: "every day I see multiple users mentioning DataFast. They post screenshots. All I have to do is build features good enough for them to share."

**Key insight:** Marc Lou's loop is the inverse of Gray/Koe. Not "build audience → sell product." It's "build product → make it shareable → document honestly → audience comes from authenticity." The content is a byproduct of building, not a separate job.

**Relevance for target user:** If you're actually building something, this is the lowest-effort, highest-authenticity content system. The documentation IS the content. No repurposing chain needed at this level — just tweet what happened today, and occasionally record a video diary.

### 2.3 Kallaway — Instagram AI/tech format decoded

**Who:** Kane Kallaway, ~438K Instagram, ~122K @kallawaytech Instagram. Building sandcastles.ai (AI content storytelling agent).

**Key fact corrected from original web research:** Kallaway is NOT a TikTok creator at any meaningful scale. Both TikTok accounts have under 40 followers. His platform is Instagram + YouTube. The research initially cited him as a major TikTok account — this was wrong.

**Content format (from 12 most recent Instagram posts — all Video/Reels, one carousel):**
Every post follows a precise narrative script pattern:

1. **Opening claim** — a superlative that creates disbelief: "This is the most insane tech company in the world..." / "This Russian engineer built a real-life Ironman suit in his garage..." / "These are futuristic contact lenses that let you see in the dark..."
2. **Credibility/context** — one sentence grounding it: "Every single computer chip on Earth is made using their machines." / "He's been documenting the full 6-year journey on YouTube."
3. **"But here's the crazy part..."** — a pivot that escalates the hook. Used in almost every post.
4. **Explanation** — the actual content, structured as a linear story with numbered or sequential steps
5. **Scale/proof** — a specific number or comparison to ground the claim
6. **Takeaway/wonder** — "Shoutout science." / "How insane is that?" / light wrap
7. **Follow CTA** — "Follow @kallaway for more videos like this"
8. **Hashtags** — 5–10, including #ai #artificialintelligence #tech #technology + topic-specific

**Engagement data (12 posts):**
- Top performer: Iron Man suit video — 1.12M likes
- Second: Reflect Orbital (sunlight from app) — 387K likes
- Third: Vegas Sphere audio — 329K likes
- Fourth: ASML chip manufacturing — 362K likes
- Fifth: AI reverse aging — 85K likes

**What makes Kallaway's content perform:**
The subject matter is always "thing that seems like science fiction but is real." Not AI tools, not business strategy, not dev workflows — concrete physical technology that makes people feel like they're living in the future. The Ironman suit, the satellite sunlight service, the ASML machine shooting lasers at molten tin. The developer tool angle (Perplexity Computer building NYC real estate app) performed 7x worse (46K likes) than the pure tech wonder content.

**Relevance for target user:** Kallaway's format works for a general tech/AI audience, not a developer audience. The "thing that seems impossible but is real" narrative structure is worth borrowing, but the subject matter needs to be developer-relevant: "I just built X in 2 prompts" rather than "this company makes chips using plasma hotter than the sun."

### 2.4 Rowan Cheung — faceless AI news model

**Who:** Founder/CEO of The Rundown AI, 2M+ newsletter, ~420K Instagram, ~48K TikTok.

**TikTok format (from 30 posts):**
- Every post: 60–90 seconds, dense research summary in caption with source DOIs, no hashtags on recent posts
- Completely faceless — b-roll or screen recordings only

**What actually performs on TikTok (from engagement data):**
- Physical AI doing things (robots, new materials, hardware): 350K–1.3M views
- Abstract business/funding news: 3K–20K views
- Interview clips ("watch full interview on YouTube"): 2.8K–3.6K views

The pattern is clear: Rowan's TikTok is a spoke, not an anchor. His 2M newsletter and YouTube are the anchors. TikTok gets the leftovers — clips, summaries, teasers. His best TikTok views are on stories that visually demonstrate something real.

**Relevance for target user:** The news-summary format is replicable but saturated. The differentiation for a dev account is the practitioner angle: not "here's what was announced" but "here's what I'd actually build with this."

---

## Part 3: Platform and Distribution Data

### 3.1 Posting frequency (evidence-based)

**TikTok:** Buffer's controlled study (11.4M posts, fixed-effects regression): 2–5 posts/week gives up to 17% more views per post vs 1/week. 6–10/week gives up to 29%. The mechanism is lottery tickets, not quality — more posts = more chances at an algorithmic spike. Small accounts (<5K) see ~269% annual growth when posting regularly; accounts posting 3+/week are 2.5x more likely to see >8% monthly follower growth.

**Instagram Reels:** 3–5 Reels/week is the evidence-based sweet spot. Past ~10/week shows diminishing returns.

**YouTube Shorts:** 1–3/week. 74% of Shorts views come from non-subscribers (the strongest discovery format on YouTube). Channels using Shorts + long-form grow ~41% faster. Shorts have a longer shelf life than Reels — the algorithm resurfaces evergreen Shorts for months.

**Practical target for solo creator:** 4 TikTok/Reels/Shorts posts/week + 1 YouTube/week + X freely. Riley Brown's current cadence: 4 high-quality short-form posts + 2 other posts/week.

### 3.2 TikTok hashtag landscape for dev/builder niche

| Hashtag | Creators | Total Views | Notes |
|---------|----------|-------------|-------|
| #buildinpublic | 141,718 | 721M | Best primary tag for this niche |
| #vibecoding | 85,528 | 576M | Strong for vibe coding angle |
| #vibecode | 11,128 | 64M | Use alongside #vibecoding |
| #buildinginpublic | 44,206 | 69M | Alt spelling, use both |
| #indiedev | 277,964 | 2.65B | Dominated by game devs — use selectively |
| #indiegamedev | 124,101 | 908M | Avoid — wrong audience |
| #indiedevtips | 53 | 49K | Low competition, niche |
| #vibecodingdev | 54 | 234K | Very low competition |

**Key insight:** #indiedev looks large but is ~80% indie game developers. Using it will route content to a gaming audience, not a SaaS/web builder audience. Stick to #buildinpublic + #vibecoding as primary tags.

### 3.3 Platform architecture for the dev/builder niche

Based on all three phases, the platform hierarchy for reaching developers is:

1. **X (primary discovery + community)** — where developers actually are. Pieter Levels (600K+), Marc Lou (170K+), and Riley Brown built audiences here first. Low friction to post. Algorithm is relatively open to new accounts.
2. **YouTube (compounds, discovery via search)** — screen-share tutorials get discovered via search for months/years. Riley Brown's current primary platform for depth. Long shelf life.
3. **TikTok (volume, fastest follower growth)** — fastest platform to grow from zero if you hit the algorithm. High churn if content isn't consistent. 74% non-subscriber reach via Shorts equivalent.
4. **Instagram (secondary distribution)** — Kallaway (438K) and Rowan (420K) are here but it's not where dev discovery happens. Use as a spoke.
5. **LinkedIn (professional credibility, B2B)** — slower growth but higher-quality connections for someone eventually selling to businesses or raising money.

---

## Part 4: The Repurposing System — Synthesised for Target User

### 4.1 The anchor

**Screen-recording video of something you actually built or broke down**, 15–20 minutes for YouTube, filmed in one session using Tella (chunk-recording) or Descript.

The content is one of three buckets:
- **Tool breakdown:** "I just used [AI tool] to [do X]. Here's the exact workflow." Screen demo, specific, immediately actionable.
- **Build-in-public update:** "This week I built/shipped/broke [X]. Here's what happened." Raw, honest, with the failures.
- **Developer framing of AI news:** "Here's what [announcement] actually means if you're building a product." Not generic AI news — the practitioner angle.

**One rule for all three:** Never use AI to write the script. Outline only, then speak. Every creator with longevity says the same thing.

### 4.2 The repurposing chain (7 pieces from 1 anchor, ~2–3 hrs total)

From one 15–20 min screen-recording anchor:

| # | Format | Platform | How | Time |
|---|--------|----------|-----|------|
| 1 | Anchor video | YouTube | Record with Tella + edit in Descript | 90 min |
| 2 | Short clip A | TikTok | 60–90 sec from the most surprising moment | 15 min |
| 3 | Short clip B | Instagram Reels | Same clip, cross-posted clean (no watermark) | 2 min |
| 4 | Short clip C | YouTube Shorts | Third angle or follow-up demo | 15 min |
| 5 | X thread | X/Twitter | Write the key insight in 280 chars first, then expand to 5–7 tweets | 20 min |
| 6 | Phone demo | TikTok/Reels | Quick phone screen recording — the "what it looks like in 30 seconds" version | 10 min |
| 7 | LinkedIn post | LinkedIn | Business framing of the same insight, adapted for professional audience | 10 min |

Total: 1 anchor + 6 derivatives = 7 posts/week, ~2.5 hours of production.

### 4.3 Weekly schedule

**Sunday (2–2.5 hrs — content day):**
- Review last week: tag any post hitting 50K+ views for multi-account repost
- Plan anchor topic (what did you build/learn this week that's worth showing?)
- Record anchor video using Tella (90 min)
- Extract best 60–90 sec moment → short clip A
- Write X thread based on the core insight (20 min)

**Monday–Friday (30–45 min/day):**
- Post 1 short-form video (TikTok or Reels) each day
- Post X thread on Monday
- Reply to comments and engage with 10–20 accounts in niche (the Welsh/Isenberg relationship-building habit — 45 min/day)
- Quick phone demo clip on Wednesday or Thursday

**Saturday (~20 min):**
- Check analytics: share rate is the primary metric (shares/views > 0.3% = content is spreading)
- Schedule repost of any viral video from previous weeks to secondary account (once you have one)

### 4.4 The AI workflow (what to use AI for, what not to)

**Use AI for:**
- Research compression: paste a long YouTube transcript or research paper → ask for key points, counterintuitive insights, things builders would find useful
- Idea generation: run your anchor content through a "deep post generator" prompt (deconstruct into paradoxes, transformation arcs, core problems — Dan Koe's system)
- Title generation: build a custom prompt trained on your 5–10 best-performing titles
- Derivative formats: use AI to reframe the core insight for each platform (LinkedIn professional angle, X compressed insight, etc.)

**Never use AI for:**
- Writing scripts or final post copy — your voice is the product
- Generating the anchor content — the demonstration needs to be real
- Making creative decisions — what to cover, what angle to take

### 4.5 Multi-account strategy (Phase 3 — month 4+)

Once you have at least one video hitting 50K+ views on X:
1. Create a second X account focused on a specific sub-niche (e.g., main = AI dev tools broadly; secondary = Claude Code specifically)
2. Repost the viral video natively from the secondary account 1 week later
3. Continue weekly
4. At 3+ accounts: use Typefully to schedule all reposts from a single dashboard

Riley Brown credits this exact play with tripling his company revenue in 2 months. The mechanics are simple: you made the content once, you're distributing it across multiple distribution channels. Each account is a separate algorithm with separate discovery.

---

## Part 5: Key Insights and Tensions

### 5.1 The quality vs. automation tension (2026 state)

Every major creator in this research, without exception, warned against AI-generated content in 2025–2026:
- Dan Koe (May 2026): "Anyone can access the easy route. That's exactly how it becomes commoditised and worthless."
- Riley Brown (Apr 2026): "Sounding like AI is suicide in the long run."
- Matt Gray (Mar 2026): "Content without proof is weak and forgettable."
- Justin Welsh (Feb 2025): "The traditional content funnel is dying. AI generates surface-level content at scale. The creators who survive produce original insight."

The paradox: automation is necessary for volume (no solo creator can manually produce 5–7 posts/week without it), but AI-generated content is increasingly invisible. The resolution: automate distribution and formatting, never automate the thinking.

### 5.2 The platform timing reality

Riley Brown's 0→200K in 2 weeks was a first-mover accident. It won't happen again — there's no equivalent "first ChatGPT video" moment available. Current realistic timelines from other data points:
- Marc Lou: 512 days (1.4 years) from launch to $20K MRR
- Most faceless AI accounts: 2–3 months to 1K followers, 6–12 months to 10K, 18–24 months to 50K+ — with consistent posting
- Buffer data: accounts posting 3+/week are 2.5x more likely to see >8% monthly follower growth

Set expectations accordingly. The system compounds over 12–24 months, not 2 weeks.

### 5.3 The gap that exists

After three phases of research across 15 transcripts, 90+ TikTok posts, and 24 Instagram posts, one gap is consistently visible:

**There is no creator at 100K+ followers who explicitly serves developers building products with AI, shows their actual build process, and documents the journey honestly in a format optimised for social reach.**

- Rowan Cheung: AI news for business people
- Kallaway: AI tools for business owners, narrative format, science-wonder angle
- Riley Brown: now primarily a product marketing channel for Vibecode
- Marc Lou: builds in public but doesn't optimise for short-form reach
- Pieter Levels: X-only, not short-form video

The specific position — "I'm building [X] with AI tools in public, here's the exact workflow, here's what broke, here's what I shipped" — is open at scale on short-form video.

---

## Part 6: What Phase 4 Should Cover

Based on gaps remaining after three phases:

**Priority 1 — Kallaway caption structure analysis**
The 12 Instagram post captions are now fully captured. A detailed breakdown of his narrative script structure (the "opening superlative → but here's the crazy part → explanation → scale proof → CTA" pattern) should be turned into a template. This is directly usable.

**Priority 2 — Small-account discovery**
No accounts in the 5K–50K range were found with documented workflows in the dev/builder niche. The hashtag data shows #buildinpublic has 141K creators — there are active accounts in this range. A direct scrape of recent #buildinpublic or #vibecoding TikTok videos would surface them.

**Priority 3 — Weekly production schedule with time blocking**
The research has enough data to build a realistic week-by-week production schedule for the first 12 weeks, including what to create, in what order, with what tools, and how long each step should take. This is the "missing piece" identified in the original brief.

**Priority 4 — Posting frequency experiment design**
Buffer's data shows posting frequency matters, but the optimal cadence for a brand-new account vs a growing account differs. A simple A/B experiment plan for weeks 1–8 (3x/week vs 5x/week, tracking share rate not view count) would give personalised data.

---

## Appendix: Source Index

### YouTube transcripts analysed (15 total)

| Creator | Title | Published | Views |
|---------|-------|-----------|-------|
| Matt Gray | Copy this content strategy | Sep 2025 | 88K |
| Matt Gray | Create content so fast it feels illegal | Nov 2025 | 24K |
| Matt Gray | Make millions from content without going viral | Mar 2026 | 101K |
| Dan Koe | My Entire Content Ecosystem | Mar 2026 | 19K |
| Dan Koe | After 100M+ views, this is the system I wish I had | May 2026 | 34K |
| Greg Isenberg | I Watched Dan Koe Break Down His AI Workflow | Oct 2025 | 157K |
| The Zinny Studio | My Secret AI Video Workflow | Mar 2026 | 17K |
| Website Learners | Automating Faceless Shorts with AI + n8n | Jul 2025 | 218K |
| Jay Clouse + Riley Brown | Inside Riley Brown's 1.5M Follower Content Machine | Apr 2026 | 7.7K |
| Marc Lou | I documented my SaaS journey to $20K MRR | Jun 2026 | 32K |

### Social data scraped

| Source | Posts/Items | Date |
|--------|-------------|------|
| @rowancheung TikTok | 30 posts | Jun 2026 |
| @rileybrown.ai TikTok | 20 posts | Jun 2026 |
| @kallaway Instagram | 12 posts | Jun 2026 |
| @rowancheung Instagram | 12 posts | Jun 2026 |
| @kallaway Instagram carousel (DUJAQJblGzP) | 17 slides (URLs only) | Jun 2026 |
| TikTok hashtag: #buildinpublic | 29 related tags | Jun 2026 |
| TikTok hashtag: #vibecoding | 27 related tags | Jun 2026 |
| TikTok hashtag: #indiedev | 26 related tags | Jun 2026 |

### Web research

- Buffer TikTok frequency study (11.4M posts, fixed-effects regression)
- Instagram Reels frequency benchmarks (2026)
- YouTube Shorts statistics 2026
- Justin Welsh "How to Grow on LinkedIn in 2026"
- Justin Welsh "Basic content is dying" (Feb 2025)
- Matt Gray Founder OS course documentation
- Dan Koe newsletter repurposing analysis (mikeromaine.com)
- Kallaway LinkedIn profile and WavyWorld documentation
- Stan.store faceless account guide (Apr 2026)
- TikTok AI content policy 2026
- Faceless content creator statistics 2025 (vidBoard.ai)
