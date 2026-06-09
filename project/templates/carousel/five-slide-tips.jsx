import React from 'react';
import {
  CarouselSlide, Card, Column, Heading, Body, Caption,
} from '../../design-system/index.js';

const TOTAL = 5;

const divider = {
  width: 64,
  height: 2,
  background: 'var(--accent-blue)',
  borderRadius: 1,
  alignSelf: 'center',
};

const badge = {
  width: 48,
  height: 48,
  borderRadius: '50%',
  background: 'var(--accent-blue)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'var(--font-sans)',
  fontWeight: 'var(--font-bold)',
  fontSize: 'var(--text-xl)',
  color: 'var(--text-emphasis)',
  flexShrink: 0,
};

const arrow = {
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-2xl)',
  color: 'var(--accent-blue)',
};

/**
 * @param {{ title: string, subtitle: string, tips: Array<{ number: number, title: string, description: string }>, cta: { text: string, handle: string }, hashtags: string }} props
 */
export function FiveSlideTips(props) {
  const { title, subtitle, tips, cta } = props;
  const slides = [];

  slides.push(
    <CarouselSlide key="title" slideNumber={1} totalSlides={TOTAL}>
      <Column gap={3} justify="center" style={{ height: '100%' }}>
        <Heading level={1}>{title}</Heading>
        <div style={divider} />
        <Caption>{subtitle}</Caption>
      </Column>
    </CarouselSlide>
  );

  tips.slice(0, 3).forEach((tip, i) =>
    slides.push(
      <CarouselSlide key={`tip-${tip.number}`} slideNumber={i + 2} totalSlides={TOTAL}>
        <Card>
          <Column gap={3} align="flex-start">
            <div style={badge}>{tip.number}</div>
            <Heading level={2}>{tip.title}</Heading>
            <Body>{tip.description}</Body>
          </Column>
        </Card>
      </CarouselSlide>
    )
  );

  slides.push(
    <CarouselSlide key="cta" slideNumber={TOTAL} totalSlides={TOTAL}>
      <Column gap={3} justify="center" style={{ height: '100%' }}>
        <Heading level={2}>{cta.text}</Heading>
        <Caption>{cta.handle}</Caption>
        <span style={arrow}>{'→'}</span>
      </Column>
    </CarouselSlide>
  );

  return <>{slides}</>;
}
