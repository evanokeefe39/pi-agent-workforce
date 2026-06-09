import React from 'react';
import { Heading } from './Typography.jsx';
import { Caption } from './Typography.jsx';

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.title]
 * @param {string} [props.subtitle]
 * @param {string} [props.source]
 * @param {object} [props.style]
 */
export function DataViz({ children, title, subtitle, source, style }) {
  return (
    <div
      style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--border-radius-lg)',
        padding: 32,
        ...style,
      }}
    >
      {title && <Heading level={3}>{title}</Heading>}
      {subtitle && <Caption style={{ marginTop: 4 }}>{subtitle}</Caption>}
      <div style={{ marginTop: title || subtitle ? 24 : 0 }}>
        {children}
      </div>
      {source && (
        <div
          style={{
            marginTop: 16,
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
          }}
        >
          Source: {source}
        </div>
      )}
    </div>
  );
}
