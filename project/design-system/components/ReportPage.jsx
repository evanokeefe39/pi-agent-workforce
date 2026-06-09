import React from 'react';

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {number} [props.pageNumber]
 * @param {number} [props.totalPages]
 * @param {string} [props.title]
 * @param {object} [props.style]
 */
export function ReportPage({ children, pageNumber, totalPages, title, style }) {
  return (
    <div
      style={{
        width: 595,
        height: 842,
        background: 'var(--bg-primary)',
        position: 'relative',
        pageBreakAfter: 'always',
        ...style,
      }}
    >
      {title && (
        <div style={{ padding: '64px 48px 0' }}>
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              color: 'var(--text-emphasis)',
              paddingBottom: 12,
              borderBottom: '1px solid var(--border-default)',
            }}
          >
            {title}
          </div>
        </div>
      )}
      <div style={{ padding: title ? '24px 48px 64px' : '64px 48px' }}>
        {children}
      </div>
      {pageNumber != null && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
          }}
        >
          {pageNumber}{totalPages ? ` / ${totalPages}` : ''}
        </div>
      )}
    </div>
  );
}
