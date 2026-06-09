# Design System Foundation — Subagent Execution Plan

Spec: `tasks/specs/design-system-foundation.md`

## Key findings from exploration

- Brand guidelines SKILL.md is source of truth. Key corrections from spec draft:
  - text-primary: `#C9D1D9` (not #E6EDF3)
  - text-emphasis: `#F0F6FC` (not #FFFFFF)
  - Sizes: text-lg 20px, text-xl 24px, text-2xl 32px, text-3xl 40px, text-4xl 56px (no 5xl/6xl)
  - Card bg: bg-primary #0D1117 (not bg-secondary)
  - Card border: bg-tertiary #21262D (not #30363D), border-radius 12px (not 8px)
  - Card padding: 32px (4 grid units)
- `project/design-system/` exists with only .gitkeep. Need `mkdir components/`.
- `project/templates/carousel/` and `project/templates/report/` exist with .gitkeep.
- .gitignore blocks `project/**/*.psd`, `project/**/*.ai`, `project/**/*.sketch` only — .jsx/.css/.js fine.
- Coder container has: React, react-dom, playwright-core, tailwindcss, @tailwindcss/cli, chromium.
- Components use CSS custom properties via `var()` in inline styles — no build-time import of tokens.css needed.

## Wave 1 — 2 parallel subagents

### W1-A: Design tokens + Tailwind config
- **Files:** `project/design-system/tokens.css`, `project/design-system/tailwind.config.js`
- **Depends on:** none
- **Changes:** Create CSS custom properties file with all brand tokens. Create Tailwind config extending defaults with brand values.

### W1-B: All 6 components + barrel export
- **Files:** `project/design-system/components/Card.jsx`, `project/design-system/components/CarouselSlide.jsx`, `project/design-system/components/ReportPage.jsx`, `project/design-system/components/Typography.jsx`, `project/design-system/components/DataViz.jsx`, `project/design-system/components/Layout.jsx`, `project/design-system/index.js`
- **Depends on:** none (components reference CSS vars, don't import tokens.css)
- **Changes:** Create all component files as React functional components with inline styles using CSS custom properties. Create barrel export.

## Wave 2 — 1 subagent

### W2-A: Templates
- **Files:** `project/templates/carousel/five-slide-tips.jsx`, `project/templates/report/standard-report.jsx`
- **Depends on:** W1-B (templates import from design system components)
- **Changes:** Create carousel and report templates that compose design system components.

## Verification

```bash
# All files exist
test -f project/design-system/tokens.css
test -f project/design-system/tailwind.config.js
test -f project/design-system/components/Card.jsx
test -f project/design-system/components/CarouselSlide.jsx
test -f project/design-system/components/ReportPage.jsx
test -f project/design-system/components/Typography.jsx
test -f project/design-system/components/DataViz.jsx
test -f project/design-system/components/Layout.jsx
test -f project/design-system/index.js
test -f project/templates/carousel/five-slide-tips.jsx
test -f project/templates/report/standard-report.jsx

# tokens.css has all brand colors
grep -q "#0D1117" project/design-system/tokens.css
grep -q "#C9D1D9" project/design-system/tokens.css
grep -q "#58A6FF" project/design-system/tokens.css

# Components use CSS vars not hardcoded colors
grep -q "var(--" project/design-system/components/Card.jsx

# index.js exports all components
grep -q "Card" project/design-system/index.js
grep -q "CarouselSlide" project/design-system/index.js
grep -q "Typography" project/design-system/index.js
```

## Subagent count: 3 (2 + 1)

## Review — completed 2026-06-09

All 11 files created. Verification passed. Additional work discovered during implementation:
- **Binary artifact bug:** write_artifact extension only accepted string content, making PNGs impossible to publish. Added `file_path` parameter. Fix committed.
- **Postgres constraint:** artifact_type 'image' not in allowed list. Added image/render/document/package. Fix committed.
- **E2E-51:** 13/13 passing — toolchain, design system mount, live render, binary replication.
- **Coder renders correctly:** 1080×1350 PNG, dark theme, brand colors, ~50s completion time.
