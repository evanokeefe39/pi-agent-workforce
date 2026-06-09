import React from 'react';

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {number} [props.width=1080]
 * @param {number} [props.height=1350]
 * @param {number} [props.slideNumber]
 * @param {number} [props.totalSlides]
 * @param {object} [props.style]
 */
export function CarouselSlide({ children, width = 1080, height = 1350, slideNumber, totalSlides, style }) {
  return (
    <div
      style={{
        width,
        height,
        background: 'var(--bg-primary)',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div style={{ padding: '64px 48px' }}>
        {children}
      </div>
      {slideNumber != null && (
        <span
          style={{
            position: 'absolute',
            bottom: 24,
            right: 32,
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
          }}
        >
          {slideNumber}/{totalSlides}
        </span>
      )}
    </div>
  );
}
