# Design System Foundation

## Intent

Populate `project/design-system/` with actual code artifacts that the Coder agent consumes to render styled visual output. Currently the directory is an empty scaffold. Without tokens, Tailwind config, and base React components, Coder has nothing to render with — it would fall back to browser defaults, violating the brand guidelines skill.

The design system translates the brand-guidelines SKILL.md (prose descriptions of colors, typography, spacing) into executable code (CSS custom properties, Tailwind config, React components). This is the raw material for all rendering.

## Context Package

### Relevant existing code

- `src/agents/skills/brand-guidelines/SKILL.md` — authoritative brand spec. Color palette (bg-primary #0D1117 through text-emphasis #FFFFFF), typography (Inter + JetBrains Mono, 12–56px scale, 400–700 weight), 8px grid spacing, card style rules, 10 anti-patterns.
- `src/agents/skills/platform-formats/SKILL.md` — dimension specs. Instagram carousel 1080×1350, story 1080×1920, feed 1080×1080. Render brief TypeScript interface.
- `project/design-system/` — empty directory, mounted read-only at `/project/design-system/` in coder container.
- `project/templates/` — empty directory for layout templates.

### What Coder expects

From coder AGENTS.md: "Design system at `/project/design-system/`. Read design tokens for all color, typography, and spacing decisions." Coder scaffolds React components, applies tokens, renders via Playwright screenshot.

### Architectural constraints

- Files must work with Node.js + React + Tailwind (installed in coder-deps Docker stage)
- No build step — Coder uses these files directly in one-shot rendering scripts
- Dark theme only (brand guidelines: "Light theme" is anti-pattern AP6)
- Components must be self-contained (no external CDN, no network deps at render time)

## Implementation

### Directory structure

```
project/design-system/
  tokens.css              # CSS custom properties — single source of truth for all values
  tailwind.config.js      # Tailwind config extending defaults with brand tokens
  components/
    Card.jsx              # Base card component (dark bg, rounded corners, subtle border)
    CarouselSlide.jsx     # Full-bleed slide for Instagram carousel (1080×1350 default)
    ReportPage.jsx        # A4-ish page for PDF reports
    Typography.jsx        # Heading, Body, Caption, Code text components
    DataViz.jsx           # Chart container with branded axes/legends
    Layout.jsx            # Grid/flex layout primitives on 8px grid
  index.js                # Re-exports all components
```

### tokens.css

CSS custom properties derived directly from brand-guidelines SKILL.md:

```css
:root {
  /* Background */
  --bg-primary: #0D1117;
  --bg-secondary: #161B22;
  --bg-tertiary: #21262D;
  --bg-card: #161B22;

  /* Accent */
  --accent-blue: #58A6FF;
  --accent-green: #3FB950;
  --accent-red: #F85149;
  --accent-orange: #D29922;

  /* Text */
  --text-primary: #E6EDF3;
  --text-secondary: #8B949E;
  --text-emphasis: #FFFFFF;

  /* Typography */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --text-xs: 12px;
  --text-sm: 14px;
  --text-base: 16px;
  --text-lg: 18px;
  --text-xl: 20px;
  --text-2xl: 24px;
  --text-3xl: 30px;
  --text-4xl: 36px;
  --text-5xl: 48px;
  --text-6xl: 56px;

  /* Spacing (8px grid) */
  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-5: 40px;
  --space-6: 48px;
  --space-8: 64px;
  --space-10: 80px;

  /* Border */
  --border-default: #30363D;
  --border-radius-sm: 6px;
  --border-radius-md: 8px;
  --border-radius-lg: 12px;
}
```

### tailwind.config.js

Extends Tailwind with brand tokens. References CSS custom properties so tokens.css remains single source of truth:

```js
module.exports = {
  content: ['./**/*.{jsx,tsx,html}'],
  theme: {
    extend: {
      colors: {
        bg: { primary: '#0D1117', secondary: '#161B22', tertiary: '#21262D' },
        accent: { blue: '#58A6FF', green: '#3FB950', red: '#F85149', orange: '#D29922' },
        text: { primary: '#E6EDF3', secondary: '#8B949E', emphasis: '#FFFFFF' },
        border: { default: '#30363D' },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      spacing: { '1u': '8px', '2u': '16px', '3u': '24px', '4u': '32px', '5u': '40px', '6u': '48px' },
      borderRadius: { sm: '6px', md: '8px', lg: '12px' },
    },
  },
};
```

### Components

Each component is a plain React functional component. No TypeScript (Coder renders one-shot scripts, not compiled projects). Props documented with JSDoc.

**Card.jsx** — dark card with subtle border. Brand guidelines: "Consistent card style: bg-secondary, 1px border-default, border-radius-md, space-3 padding."

**CarouselSlide.jsx** — full-bleed container at platform dimensions. Takes `width`, `height`, `slideNumber`, `totalSlides` props. Background bg-primary, content area with padding respecting safe zones from platform-formats skill. Slide number indicator bottom-right.

**ReportPage.jsx** — page container for PDF rendering. Default A4 proportions (595×842 CSS px at 72dpi). Header area, content area, footer with page number.

**Typography.jsx** — exports Heading (h1–h4 with brand sizes), Body (text-base, text-primary), Caption (text-sm, text-secondary), Code (font-mono, bg-tertiary padding). All use Inter/JetBrains Mono.

**DataViz.jsx** — wrapper for charts. Provides branded container with title, subtitle, source citation. Does not render charts itself (Coder uses Vega-Lite or similar) — provides the chrome around them.

**Layout.jsx** — Row and Column components using flexbox on 8px grid. Gap prop in grid units (gap={2} = 16px).

### Templates

```
project/templates/
  carousel/
    five-slide-tips.jsx     # 5-slide "tips" carousel layout (title slide + 4 content + CTA)
  report/
    standard-report.jsx     # Standard report layout (cover + TOC + sections + appendix)
```

Templates compose design system components into reusable layouts. Coder reads a template and fills it with content from the render brief.

**five-slide-tips.jsx** — slide 1: title + hook, slides 2–4: numbered tip with icon area + text, slide 5: CTA/summary. Each slide uses CarouselSlide + Card + Typography.

**standard-report.jsx** — cover page with title/subtitle/date, TOC auto-generated from sections, section pages with Heading + Body + optional DataViz, appendix with source citations.

## Behavioral Contracts

GIVEN the design system at `/project/design-system/`
WHEN Coder imports tokens.css and renders a Card component
THEN the card has bg-secondary (#161B22) background, 1px border (#30363D), 8px border-radius, 24px padding

GIVEN the tailwind.config.js
WHEN Coder uses `bg-bg-primary` class
THEN the element renders with #0D1117 background

GIVEN CarouselSlide with width=1080, height=1350
WHEN rendered and screenshotted at 1x device pixel ratio
THEN output PNG is exactly 1080×1350 pixels

GIVEN Typography Heading component with level=1
WHEN rendered
THEN text uses Inter font, 48px (text-5xl), weight 700, color text-emphasis (#FFFFFF)

GIVEN the five-slide-tips template
WHEN Coder fills it with content from a render brief
THEN output is 5 PNGs at 1080×1350 each, consistent brand styling across all slides

## Edge Cases

1. Fonts not available in container — components use system font fallback stack. Inter/JetBrains Mono may not be installed in the coder container. Include Google Fonts CDN link in a base HTML template, or bundle font files in `project/design-system/fonts/`.
2. Tailwind not initialized — components should work with just tokens.css and inline styles as fallback. Tailwind is a convenience layer, not a hard dependency.
3. High-DPI rendering — Playwright can render at device scale factors > 1. Components should use px values (not rem/em) for predictable output dimensions.

## Definition of Done

- [ ] tokens.css written with all brand color, typography, spacing, and border values
- [ ] tailwind.config.js extending defaults with brand tokens
- [ ] Card.jsx renders dark card matching brand-guidelines spec
- [ ] CarouselSlide.jsx renders at exact platform dimensions
- [ ] ReportPage.jsx renders A4 page with header/footer
- [ ] Typography.jsx exports Heading, Body, Caption, Code
- [ ] DataViz.jsx provides chart container chrome
- [ ] Layout.jsx provides Row, Column on 8px grid
- [ ] index.js re-exports all components
- [ ] five-slide-tips.jsx carousel template composing design system components
- [ ] standard-report.jsx report template composing design system components
- [ ] All components use tokens.css values (no hardcoded colors/fonts)
- [ ] Font loading strategy documented (CDN link or bundled files)

## Negative Space

Out of scope: animation, interactive components, responsive design (output is fixed-dimension screenshots), accessibility features (output is images/PDFs, not interactive HTML), dark/light theme toggle (dark only per brand guidelines).

Not changing: brand-guidelines SKILL.md (source of truth stays in skills, design system is the code implementation). Platform-formats SKILL.md. Coder AGENTS.md. Dockerfile.
