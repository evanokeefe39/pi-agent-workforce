/** @type {import('tailwindcss').Config} */

/*
 * Tailwind Config — AI/Tech Niche Brand
 * Values duplicated from tokens.css for Tailwind utility convenience.
 * tokens.css remains the canonical source of truth.
 * Source: src/agents/skills/brand-guidelines/SKILL.md
 */

module.exports = {
  content: ['./**/*.{jsx,tsx,html}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',

      /* Backgrounds */
      'bg-primary': '#0D1117',
      'bg-secondary': '#161B22',
      'bg-tertiary': '#21262D',

      /* Accents */
      'accent-blue': '#58A6FF',
      'accent-green': '#3FB950',
      'accent-red': '#F85149',
      'accent-orange': '#D29922',

      /* Text */
      'text-primary': '#C9D1D9',
      'text-secondary': '#8B949E',
      'text-emphasis': '#F0F6FC',

      /* Borders */
      'border-default': '#21262D',
    },
    fontFamily: {
      sans: ["'Inter'", 'system-ui', '-apple-system', 'sans-serif'],
      mono: ["'JetBrains Mono'", "'Fira Code'", "'Cascadia Code'", 'monospace'],
    },
    fontSize: {
      xs: ['12px', { lineHeight: '1.5' }],
      sm: ['14px', { lineHeight: '1.5' }],
      base: ['16px', { lineHeight: '1.6' }],
      lg: ['20px', { lineHeight: '1.4' }],
      xl: ['24px', { lineHeight: '1.3' }],
      '2xl': ['32px', { lineHeight: '1.2' }],
      '3xl': ['40px', { lineHeight: '1.1' }],
      '4xl': ['56px', { lineHeight: '1.0' }],
    },
    fontWeight: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    borderRadius: {
      none: '0',
      sm: '6px',
      DEFAULT: '8px',
      md: '8px',
      lg: '12px',
      full: '9999px',
    },
    extend: {
      spacing: {
        '1u': '8px',
        '2u': '16px',
        '3u': '24px',
        '4u': '32px',
        '6u': '48px',
        '8u': '64px',
      },
    },
  },
  plugins: [],
};
