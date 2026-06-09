import React from 'react';
import {
  ReportPage, Column, Row, Heading, Body, Caption, Stat,
} from '../../design-system/index.js';

const rule = {
  width: '100%',
  height: 2,
  background: 'var(--accent-blue)',
  borderRadius: 1,
};

/**
 * @param {{ title: string, subtitle: string, date: string, sections: Array<{ heading: string, content: string, stats?: Array<{ value: string, label: string }> }>, sources: string[] }} props
 */
export function StandardReport(props) {
  const { title, subtitle, date, sections, sources } = props;
  const totalPages = sections.length + 2;
  const pages = [];

  pages.push(
    <ReportPage key="cover" pageNumber={1} totalPages={totalPages}>
      <Column gap={3} justify="center" style={{ height: '100%' }}>
        <Heading level={1}>{title}</Heading>
        <Caption>{subtitle}</Caption>
        <Caption>{date}</Caption>
        <div style={rule} />
      </Column>
    </ReportPage>
  );

  sections.forEach((section, i) =>
    pages.push(
      <ReportPage
        key={`section-${i}`}
        pageNumber={i + 2}
        totalPages={totalPages}
        title={section.heading}
      >
        <Column gap={3} align="flex-start">
          <Heading level={2}>{section.heading}</Heading>
          <Body>{section.content}</Body>
          {section.stats && (
            <Row gap={4} justify="space-around" style={{ width: '100%', marginTop: 'var(--space-3)' }}>
              {section.stats.map((s, j) => (
                <Stat key={j} value={s.value} label={s.label} />
              ))}
            </Row>
          )}
        </Column>
      </ReportPage>
    )
  );

  pages.push(
    <ReportPage key="sources" pageNumber={totalPages} totalPages={totalPages}>
      <Column gap={2} align="flex-start">
        <Heading level={3}>Sources</Heading>
        {sources.map((src, i) => (
          <Caption key={i}>{i + 1}. {src}</Caption>
        ))}
      </Column>
    </ReportPage>
  );

  return <>{pages}</>;
}
