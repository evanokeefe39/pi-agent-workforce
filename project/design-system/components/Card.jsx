import React from 'react';

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {number} [props.padding=32]
 * @param {object} [props.style]
 */
export function Card({ children, padding = 32, style }) {
  return (
    <div
      style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--border-radius-lg)',
        padding,
        maxWidth: '100%',
        ...style,
      }}
    >
      <div style={{ maxWidth: '85%' }}>
        {children}
      </div>
    </div>
  );
}
