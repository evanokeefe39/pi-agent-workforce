import React from 'react';

const HEADING_STYLES = {
  1: { fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--text-emphasis)' },
  2: { fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-emphasis)' },
  3: { fontSize: 'var(--text-lg)', fontWeight: 500, color: 'var(--text-emphasis)' },
  4: { fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--text-primary)' },
};

/**
 * @param {object} props
 * @param {1|2|3|4} [props.level=1]
 * @param {React.ReactNode} props.children
 * @param {object} [props.style]
 */
export function Heading({ level = 1, children, style }) {
  return (
    <div style={{ fontFamily: 'var(--font-sans)', ...HEADING_STYLES[level], ...style }}>
      {children}
    </div>
  );
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {object} [props.style]
 */
export function Body({ children, style }) {
  return (
    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1.6, textAlign: 'left', ...style }}>
      {children}
    </div>
  );
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {object} [props.style]
 */
export function Caption({ children, style }) {
  return (
    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 400, color: 'var(--text-secondary)', lineHeight: 1.5, ...style }}>
      {children}
    </div>
  );
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {object} [props.style]
 */
export function Code({ children, style }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-primary)', ...style }}>
      {children}
    </span>
  );
}

/**
 * @param {object} props
 * @param {string|number} props.value
 * @param {string} props.label
 * @param {string} [props.color='var(--accent-blue)']
 * @param {object} [props.style]
 */
export function Stat({ value, label, color = 'var(--accent-blue)', style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', ...style }}>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-3xl)', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}
