---
name: brand-guidelines
description: >
  Brand identity reference for AI/tech niche social media content. Covers color
  palette, typography, voice and tone, visual identity patterns, and anti-patterns.
  Used by Publisher (verify rendered output), Coder (rendering input), and QA
  (brand consistency checks).
metadata:
  author: evan
  version: 1.0.0
  domain: social-media
---

# Brand Guidelines — AI/Tech Niche Social Media

Canonical brand reference for all agents producing or validating visual content.
When in doubt, consult this document. Do not improvise brand decisions.

## Color Palette

Dark theme. All content uses dark backgrounds with light text and bright accents.

### Backgrounds

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-primary` | `#0D1117` | Card backgrounds, slide backgrounds, primary canvas |
| `bg-secondary` | `#161B22` | Elevated surfaces, code blocks, nested containers |
| `bg-tertiary` | `#21262D` | Borders, dividers, subtle differentiation within cards |

### Accents

| Token | Hex | Usage |
|-------|-----|-------|
| `accent-blue` | `#58A6FF` | Primary accent — links, highlights, key stats, CTAs |
| `accent-green` | `#3FB950` | Success states, positive metrics, growth indicators |
| `accent-red` | `#F85149` | Negative metrics, warnings, decline indicators |
| `accent-orange` | `#D29922` | Neutral alerts, caution states, mid-range indicators |

### Text

| Token | Hex | Usage |
|-------|-----|-------|
| `text-primary` | `#C9D1D9` | Body text, primary content — main reading text |
| `text-secondary` | `#8B949E` | Captions, labels, metadata, supporting text |
| `text-emphasis` | `#F0F6FC` | Headings, hero stats, numbers that need to pop |

### Contrast Rules

- `text-primary` on `bg-primary`: contrast ratio 9.5:1 (exceeds WCAG AAA)
- `text-secondary` on `bg-primary`: contrast ratio 5.0:1 (meets WCAG AA)
- `accent-blue` on `bg-primary`: contrast ratio 5.4:1 (meets WCAG AA)
- Never place `text-secondary` on `bg-secondary` — contrast drops below AA (3.8:1)
- All text must meet WCAG AA minimum (4.5:1 for normal text, 3:1 for large text)

## Typography

### Font Families

| Context | Font | Fallback | Notes |
|---------|------|----------|-------|
| UI, headings, body | Inter | system-ui, -apple-system, sans-serif | Variable weight. Clean, neutral, high x-height for screen readability |
| Code, data, metrics | JetBrains Mono | 'Fira Code', 'Cascadia Code', monospace | Ligatures disabled in rendered content. Use for inline code, stat values, technical labels |

### Size Scale

Base unit: 16px. Scale follows a 1.25 ratio (Major Third).

| Token | Size | Line Height | Use |
|-------|------|-------------|-----|
| `text-xs` | 12px | 1.5 | Fine print, legal, timestamps |
| `text-sm` | 14px | 1.5 | Captions, labels, metadata |
| `text-base` | 16px | 1.6 | Body text, descriptions |
| `text-lg` | 20px | 1.4 | Subheadings, callout text |
| `text-xl` | 24px | 1.3 | Section headings |
| `text-2xl` | 32px | 1.2 | Slide titles, card headings |
| `text-3xl` | 40px | 1.1 | Hero stats, key numbers |
| `text-4xl` | 56px | 1.0 | Single hero metric on full-bleed slides |

### Weight Scale

| Token | Weight | Use |
|-------|--------|-----|
| `font-regular` | 400 | Body text, descriptions |
| `font-medium` | 500 | Labels, UI elements, secondary headings |
| `font-semibold` | 600 | Primary headings, slide titles |
| `font-bold` | 700 | Hero stats, emphasis numbers only — never for body text |

## Voice and Tone

### What the brand sounds like

- **Authoritative but approachable.** Speaks from experience and data, not from a
  pedestal. The reader is a peer, not a student.
- **Specific over generic.** "Save rate above 5% across 12 posts" not "great
  engagement." Numbers, timeframes, and concrete examples always beat abstractions.
- **Evidence-backed claims.** Every stat references a source or method. "Based on
  analysis of 847 posts" not "research shows."
- **Concise and direct.** Short sentences. Active voice. Cut filler words. If a
  sentence adds no information, delete it.
- **Technical without jargon walls.** Use precise terms (save rate, engagement rate,
  A/B test) but define them on first use when the audience may not know them.

### What the brand does NOT sound like

- No hype language: "game-changing," "revolutionary," "unlock your potential,"
  "skyrocket your growth." These are empty.
- No false urgency: "You need to do this NOW," "Don't miss out," "This changes
  everything."
- No hedging without data: "This might work for some people." Either you have
  evidence or you state the limitation directly.
- No first-person singular in content: "I discovered" becomes "Analysis showed" or
  "The data shows." The brand is the authority, not a personality.
- No rhetorical questions as hooks: "Want to know the secret?" Just state the finding.

### Caption tone

Captions are informational, not conversational. Structure:

1. Lead with the insight (one sentence, specific)
2. Support with data or method (one to two sentences)
3. Close with implication or next step (one sentence)
4. Hashtags on a separate line, after a line break

Example:
```
Accounts with save rates above 5% grow followers 3.2x faster than the median.

Based on analysis of 847 AI/tech creator posts across Instagram and TikTok
over 90 days. Save rate correlates with algorithmic distribution more strongly
than likes or comments.

Track save rate as your primary quality signal.

#AIContent #CreatorAnalytics #SaveRate
```

### Voice Modes

Different content contexts require different voice registers. The mode determines which voice rules apply.

| Mode | Context | Rules |
|------|---------|-------|
| `analytical` | Reports, research summaries, data analysis | Third-person. "Analysis showed." No first-person singular. Current default for all non-social content. |
| `social` | Social media captions, X threads, video outlines | First-person permitted. "I built X." Personal, specific, honest. Load social-voice-profile.json for mechanical parameters. |
| `brief` | Internal briefs, render briefs, task specs | Neutral imperative. "Produce a 10-slide carousel." No personality, just clear instructions. |

The anti-patterns in "What the brand does NOT sound like" (no first-person singular, no rhetorical questions as hooks) apply to `analytical` mode only. Social mode permits first-person and uses hook formulas that may include questions. Brief mode has no voice personality constraints.

## Visual Identity Patterns

### Card Style

All content cards follow a consistent structure:

- Background: `bg-primary` (#0D1117)
- Border: 1px solid `bg-tertiary` (#21262D), border-radius 12px
- Padding: 32px (4 grid units)
- Shadow: none — flat design, depth via color only

### Spacing System

8px base grid. All spacing values are multiples of 8.

| Token | Value | Use |
|-------|-------|-----|
| `space-1` | 8px | Inline gaps, icon-to-label spacing |
| `space-2` | 16px | Between related elements, list item spacing |
| `space-3` | 24px | Between content sections within a card |
| `space-4` | 32px | Card padding, major section separation |
| `space-6` | 48px | Between cards, slide content margin from edges |
| `space-8` | 64px | Top/bottom slide padding, hero spacing |

### Layout Conventions

- Content is always left-aligned. Never center body text.
- Headings may be centered on single-stat hero slides only.
- Maximum content width within a card: 85% of card width (prevents edge-to-edge text).
- Stat callouts: number in `text-3xl` or `text-4xl` + `font-bold`, label below in
  `text-sm` + `text-secondary`.

### Data Visualization

- Chart colors follow the accent palette in order: blue, green, orange, red.
- Bar charts preferred over pie charts. Pie charts are never used.
- All axes labeled. All charts titled. Units on every axis.
- Gridlines: `bg-tertiary` (#21262D), 1px, dashed.
- Data labels directly on bars/points when space permits — avoid legends when possible.

## Anti-Patterns

Things that violate the brand. If you see these in rendered output, flag and fix.

- **AP1: Gradients on text.** Never apply gradient fills to text. Text is flat color only.
  Gradients reduce readability and look dated.
- **AP2: Stock photography.** No stock photos of any kind — no handshakes, no laptops
  on desks, no "diverse team looking at screen." Use data visualizations, code snippets,
  or abstract geometric patterns instead.
- **AP3: Generic AI imagery.** No glowing brains, no neural network node visualizations,
  no robot faces, no "digital human" renders. These are visual cliches.
- **AP4: Emoji-heavy captions.** Maximum 0-1 emoji per caption, and only if it adds
  genuine semantic value (e.g., a chart emoji before a data section). Never use emoji
  as decoration or to "add energy."
- **AP5: Unsourced statistics.** Every number in visual content must trace back to a
  dataset or analysis. "80% of marketers agree" with no source is not permitted.
- **AP6: Light theme content.** All published content uses dark theme. No white or
  light gray backgrounds. This is a hard rule, not a preference.
- **AP7: Decorative borders or outlines.** No colored borders around cards, no glow
  effects, no neon outlines. Borders are structural (`bg-tertiary`, 1px) or absent.
- **AP8: Multiple font families in one slide.** Inter and JetBrains Mono only. Never
  introduce a third font. Never use decorative or script fonts.
- **AP9: Body text in bold.** Bold weight (700) is reserved for hero stats and key
  numbers. Body text uses regular (400) or medium (500). Bold paragraphs reduce
  scannability.
- **AP10: Low-contrast text.** Any text below WCAG AA contrast ratio (4.5:1 normal,
  3:1 large) must be fixed before publishing. Use the contrast rules table above.
