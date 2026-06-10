---
name: derivative-formats
description: >
  Work product format catalog for Writer. Maps each deliverable to its platform,
  formula, voice profile, and production notes. Reference when producing any
  specific content format to ensure correct style system integration.
metadata:
  author: evan
  version: 1.0.0
  domain: content-production
---

# Derivative Formats — Writer Work Product Catalog

Each format below specifies the platform, formula, and voice profile to use with `get_style_instructions()` and `load_style_profile`. When producing a deliverable, load the correct combination before writing.

## Format Reference

| Work Product | Platform | Formula | Voice Profile | Notes |
|---|---|---|---|---|
| X thread | twitter | (none or AIDA) | social-voice | 280-char lead tweet, 5-7 tweets total |
| TikTok caption | tiktok | kallaway or PAS | social-voice | First 80 chars = hook, narrative not list, 3-5 hashtags |
| Instagram Reel caption | instagram-reel | kallaway or PAS | social-voice | First 125 chars visible, 5 hashtag cap |
| LinkedIn post | linkedin | (existing) | social-voice | Professional framing, hook-first 2-liner |
| Anchor video outline | (none) | (none) | social-voice | Structured outline for human recording, NOT script |
| Build diary | blog | (none) | social-voice | Raw, honest, failures > milestones |
| Deep post building blocks | (none) | deep-post-generator | (none) | Raw materials only, not finished posts |
| Carousel content brief | (none) | (none) | brief | Structured brief for Publisher → Coder chain |

## Style System Integration

For each deliverable:
1. Call `get_style_instructions({ platform, formula })` to get platform constraints + formula steps
2. Call `load_style_profile("social-voice")` to get voice parameters (tone, readability, rhythm)
3. Apply both — platform constraints are hard limits, voice profile is target ranges

When platform is "(none)" (e.g., anchor outline, deep post blocks), skip platform instructions — apply only formula and/or voice profile.

When voice profile is "(none)" (e.g., deep post building blocks), write in neutral analytical voice — these are raw materials, not audience-facing content.

## Format-Specific Production Notes

### X Thread
- Lead tweet IS the hook — must work standalone in someone's feed
- Each subsequent tweet adds one idea, insight, or data point
- Final tweet: CTA (follow, save, reply)
- Thread should read as a coherent narrative, not disconnected bullets

### TikTok Caption
- First 80 characters appear before "more" — this IS your hook
- Never write the caption as a list — narrative structure required (see kallaway formula)
- Hashtags on separate final line, 3-5 tags
- Caption complements on-screen text, does not duplicate it

### Instagram Reel Caption
- First 125 characters visible without tap — front-load keywords here
- Keywords in first line outperform hashtags for Instagram search
- 5 hashtag hard cap — every tag must earn its slot
- Longer caption OK (2200 chars) — use for context, resources, links

### Carousel Content Brief
- This is a brief for the Publisher → Coder rendering chain, not audience-facing content
- Use brief voice mode (neutral imperative: "Produce a 10-slide carousel...")
- Include: slide count, content per slide, visual direction, CTA slide content
- Specify dimensions (1080x1350 Instagram standard) and any data visualizations needed
