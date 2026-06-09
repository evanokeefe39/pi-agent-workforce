import React from 'react';

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {number} [props.gap=2]
 * @param {string} [props.align='center']
 * @param {string} [props.justify='flex-start']
 * @param {object} [props.style]
 */
export function Row({ children, gap = 2, align = 'center', justify = 'flex-start', style }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: gap * 8,
        alignItems: align,
        justifyContent: justify,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {number} [props.gap=2]
 * @param {string} [props.align='center']
 * @param {string} [props.justify='flex-start']
 * @param {object} [props.style]
 */
export function Column({ children, gap = 2, align = 'center', justify = 'flex-start', style }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: gap * 8,
        alignItems: align,
        justifyContent: justify,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
