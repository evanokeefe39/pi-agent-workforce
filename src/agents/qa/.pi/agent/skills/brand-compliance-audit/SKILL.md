---
name: brand-compliance-audit
description: >
  Brand compliance evaluation rubric for QA agent. Covers color palette adherence,
  WCAG contrast requirements, typography rules, visual identity patterns, voice/tone
  consistency, and visual anti-patterns AP1-AP10. Each rule has a unique rule_id,
  violation criteria, commendation criteria, and severity classification.
metadata:
  author: evan
  version: 1.0.0
  domain: brand-compliance
---

# Brand Compliance Audit

Evaluation rubric for the QA agent. Every rule has a unique `rule_id`. The QA agent references these IDs in its assessment output so findings are traceable to the rubric.

---

## Color Palette Rules

### BRAND-DARK-THEME

Dark theme is a hard rule. All visual content must use dark backgrounds.

- **Violation:** Light theme or white backgrounds anywhere in the rendered content.
- **Commendation:** Consistent dark theme throughout all visual elements.
- **Severity:** critical

### BRAND-COLOR-PALETTE

All colors must come from the defined palette:

| Token | Hex | Usage |
|-------|-----|-------|
| bg-primary | #0D1117 | Page/section backgrounds |
| bg-secondary | #161B22 | Cards, sidebars, inset areas |
| bg-tertiary | #21262D | Borders, dividers, subtle fills |
| accent-blue | #58A6FF | Links, primary actions, chart color 1 |
| accent-green | #3FB950 | Success states, positive metrics, chart color 2 |
| accent-red | #F85149 | Error states, negative metrics, chart color 4 |
| accent-orange | #D29922 | Warnings, neutral metrics, chart color 3 |
| text-primary | #C9D1D9 | Body text |
| text-secondary | #8B949E | Captions, labels, supporting text |
| text-emphasis | #F0F6FC | Headings, hero stats |

- **Violation:** Colors outside this palette used in rendered content.
- **Commendation:** Strict palette adherence with intentional use of accent colors to convey meaning.
- **Severity:** major

### BRAND-WCAG-AA

All text must meet WCAG AA minimum contrast ratios:

| Requirement | Ratio |
|-------------|-------|
| Normal text (below 18px, or below 14px bold) | 4.5:1 minimum |
| Large text (18px+ or 14px+ bold) | 3:1 minimum |

Known passing combinations:

| Foreground | Background | Ratio | Level |
|------------|------------|-------|-------|
| text-primary #C9D1D9 | bg-primary #0D1117 | 9.5:1 | AAA |
| text-secondary #8B949E | bg-primary #0D1117 | 5.0:1 | AA |
| accent-blue #58A6FF | bg-primary #0D1117 | 5.4:1 | AA |

Known failing combination:

| Foreground | Background | Result |
|------------|------------|--------|
| text-secondary #8B949E | bg-secondary #161B22 | Below AA -- NEVER use this combination |

- **Violation:** Text below AA contrast ratio.
- **Commendation:** All text at AAA level (7:1+).
- **Severity:** critical (accessibility requirement)

---

## Typography Rules

### BRAND-FONT-FAMILIES

Only two font families are allowed:

| Purpose | Font | Notes |
|---------|------|-------|
| Body / UI | Inter | Variable weight |
| Code / data | JetBrains Mono | Ligatures disabled |

- **Violation:** Any other font family used in rendered content.
- **Commendation:** Correct font usage throughout with appropriate application of each family.
- **Severity:** major

### BRAND-FONT-BOLD

Bold weight (700) is reserved for hero stats and numbers ONLY. Never use bold for body text, headings, or emphasis.

- **Violation:** Bold used on body text, paragraphs, or non-stat content.
- **Commendation:** Bold used only on prominent numbers and statistics.
- **Severity:** major

### BRAND-FONT-SCALE

Font sizes follow the Major Third scale (1.25 ratio):

| Token | Size |
|-------|------|
| text-xs | 12px |
| text-sm | 14px |
| text-base | 16px |
| text-lg | 20px |
| text-xl | 24px |
| text-2xl | 32px |
| text-3xl | 40px |
| text-4xl | 56px |

- **Violation:** Font sizes outside this scale.
- **Commendation:** Consistent scale usage with clear typographic hierarchy.
- **Severity:** minor

---

## Spacing Rules

### BRAND-SPACING-GRID

8px base grid. All spacing values must be multiples of 8:

| Token | Size |
|-------|------|
| space-1 | 8px |
| space-2 | 16px |
| space-3 | 24px |
| space-4 | 32px |
| space-5 | 48px |
| space-6 | 64px |

- **Violation:** Spacing values not on the 8px grid.
- **Commendation:** Consistent grid adherence throughout layout.
- **Severity:** minor

---

## Data Visualization Rules

### BRAND-DATAVIZ-CHARTS

Bar charts are the preferred chart type. Never use pie charts.

Chart color order: blue (#58A6FF), green (#3FB950), orange (#D29922), red (#F85149).

Gridlines: bg-tertiary (#21262D), 1px, dashed.

Data labels directly on bars when space permits.

- **Violation:** Pie chart used, or chart colors in wrong order.
- **Commendation:** Clean bar chart following all conventions (correct color order, dashed gridlines, direct labels).
- **Severity:** minor for color order violations, major for pie chart usage

---

## Visual Anti-Pattern Rules

### BRAND-AP1-GRADIENTS-TEXT

No gradients on text. Text must be flat solid color only.

- **Violation:** Gradient applied to any text element.
- **Commendation:** Clean flat-color text throughout.
- **Severity:** major

### BRAND-AP2-STOCK-PHOTOGRAPHY

No stock photography. Use data visualizations, code snippets, screenshots, or geometric patterns instead.

- **Violation:** Stock photo used anywhere in the content.
- **Commendation:** Custom data visualizations or code-based visuals used in place of photography.
- **Severity:** major

### BRAND-AP3-GENERIC-AI-IMAGERY

No generic AI imagery: no glowing brains, neural network diagrams, robot faces, or "AI concept" stock art.

- **Violation:** Any generic AI visual trope present.
- **Commendation:** Concrete, specific visuals used instead (actual tool screenshots, real data).
- **Severity:** major

### BRAND-AP4-EMOJI-HEAVY

Maximum 0-1 emoji per piece, only if it carries semantic value.

- **Violation:** 2+ emojis or decorative emoji usage.
- **Commendation:** Zero emojis or a single emoji carrying genuine semantic value.
- **Severity:** minor

### BRAND-AP5-UNSOURCED-STATS

Every number and statistic must trace back to a dataset or source. No made-up or approximate numbers.

- **Violation:** Statistic presented without source attribution.
- **Commendation:** All stats sourced and traceable to originating data.
- **Severity:** critical

### BRAND-AP6-LIGHT-THEME

Dark theme is a hard rule. Duplicate of BRAND-DARK-THEME for anti-pattern completeness.

- **Violation:** Any light theme content rendered or delivered.
- **Severity:** critical

### BRAND-AP7-DECORATIVE-BORDERS

No decorative borders or neon outlines. Borders are structural only (dividers, card edges).

- **Violation:** Decorative or glowing border elements present.
- **Commendation:** Clean structural borders only.
- **Severity:** minor

### BRAND-AP8-MULTIPLE-FONTS

Only Inter + JetBrains Mono allowed. No additional font families in a single piece. Duplicate of BRAND-FONT-FAMILIES for visual rendering context.

- **Violation:** Third font family introduced in rendered content.
- **Severity:** major

### BRAND-AP9-BODY-BOLD

Bold reserved for hero stats only. Duplicate of BRAND-FONT-BOLD for anti-pattern completeness.

- **Violation:** Bold applied to body text or non-stat elements.
- **Severity:** major

### BRAND-AP10-LOW-CONTRAST

All text must meet WCAG AA. Duplicate of BRAND-WCAG-AA for anti-pattern completeness.

- **Violation:** Text below 4.5:1 contrast ratio for normal text or 3:1 for large text.
- **Severity:** critical

---

## Voice/Tone Rules

### BRAND-VOICE-TRAITS

Brand voice is defined by five traits:

1. Authoritative but approachable
2. Specific over generic
3. Evidence-backed
4. Concise and direct
5. Technical without jargon

- **Violation:** Content that is vague, unsubstantiated, verbose, or uses unnecessary jargon.
- **Commendation:** Content demonstrating all 5 traits consistently.
- **Severity:** minor per trait violation

### BRAND-VOICE-FORBIDDEN

The following are forbidden in analytical mode:

- Hype language: "game-changing", "revolutionary", "unlock your potential", "skyrocket your growth"
- False urgency
- Hedging without data
- First-person singular
- Rhetorical questions as hooks

- **Violation:** Any forbidden element present in analytical content.
- **Commendation:** Analytical content free of all forbidden elements, relying on evidence instead.
- **Severity:** major
