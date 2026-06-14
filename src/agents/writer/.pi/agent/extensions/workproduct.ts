import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { createWorkproductExtension } from "./workproduct/factory.js";
import type { StyleProfiles, LocalRecord } from "./workproduct/types.js";

// ---------------------------------------------------------------------------
// Writer content kinds
// ---------------------------------------------------------------------------

const ContentKind = Type.Union([
  Type.Literal("report"),
  Type.Literal("guide"),
  Type.Literal("article"),
  Type.Literal("marketing_copy"),
  Type.Literal("newsletter"),
], { description: "Type of written content." });

const KIND_PROFILES: StyleProfiles = {
  sourceRequired: {
    report: [], guide: [], article: [], marketing_copy: [], newsletter: [],
  },
  sourceEncouraged: {
    report: [], guide: [], article: [], marketing_copy: [], newsletter: [],
  },
  recordEncouraged: {
    report: ["recommendations", "confidence", "topic_tags"],
    guide: ["prerequisites", "difficulty", "topic_tags"],
    article: ["tone", "seo_keywords", "topic_tags"],
    marketing_copy: ["format_constraints", "variants", "topic_tags"],
    newsletter: ["issue_number", "topic_tags"],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function previewTitle(title: string): string {
  return title.length > 120 ? title.slice(0, 120) : title;
}

// ---------------------------------------------------------------------------
// Shared metadata builder for content kinds
// ---------------------------------------------------------------------------

function baseContentMeta(p: Record<string, any>, sid: string): Record<string, unknown> {
  return {
    title: p.title,
    title_preview: previewTitle(p.title),
    audience: p.audience,
    source_refs: p.source_refs || [],
    format_version: p.format_version,
    topic_tags: p.topic_tags || [],
    prior_content_refs: p.prior_content_refs || [],
    word_count: countWords(p.content),
    session_id: sid,
  };
}

function contentDetails(id: string, p: Record<string, any>): Record<string, unknown> {
  return { id, word_count: countWords(p.content) };
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  createWorkproductExtension(pi, {
    agentName: "writer",
    kinds: {
      report: {
        schema: Type.Object({
          title: Type.String({ description: "Report title" }),
          audience: Type.String({ description: "Intended audience (e.g. 'CEO', 'engineering leads', 'public')" }),
          source_refs: Type.Array(Type.String(), {
            minItems: 1,
            description: "Artifact IDs of source findings, datasets, or briefs",
          }),
          content: Type.String({ description: "Full report body in markdown" }),
          sections: Type.Array(Type.String(), { description: "Ordered list of section headings" }),
          executive_summary: Type.String({ description: "1-3 paragraph summary at the top of the report" }),
          recommendations: Type.Optional(Type.Array(Type.String(), {
            description: "Actionable recommendations the report concludes with",
          })),
          confidence: Type.Optional(Type.Union([
            Type.Literal("high"), Type.Literal("medium"), Type.Literal("low"),
          ], { description: "Confidence in the report's conclusions" })),
          format_version: Type.Optional(Type.String()),
          topic_tags: Type.Optional(Type.Array(Type.String())),
          prior_content_refs: Type.Optional(Type.Array(Type.String(), {
            description: "Artifact IDs of related earlier content this report builds on",
          })),
        }),
        subdir: "content",
        label: "Record Report",
        description:
          "Record a long-form report with executive summary, sections, and optional recommendations. " +
          "Stores content as a markdown artifact with structured metadata for discovery.",
        filename: () => "report.json",
        content: (p) => p.content,
        metadata: (p, sid) => ({
          ...baseContentMeta(p, sid),
          sections: p.sections,
          executive_summary: p.executive_summary,
          recommendations: p.recommendations || [],
          confidence: p.confidence,
        }),
        summary: (id, p) =>
          `Report recorded: ${id}\nTitle: ${p.title}\nWords: ${countWords(p.content)}\nAudience: ${p.audience}`,
        details: contentDetails,
      },
      guide: {
        schema: Type.Object({
          title: Type.String({ description: "Guide title" }),
          audience: Type.String({ description: "Intended audience and skill level" }),
          source_refs: Type.Array(Type.String(), {
            minItems: 1, description: "Artifact IDs of source material",
          }),
          content: Type.String({ description: "Full guide body in markdown" }),
          prerequisites: Type.Optional(Type.Array(Type.String(), {
            description: "What the reader needs before starting",
          })),
          steps_count: Type.Integer({ minimum: 1, description: "Number of discrete steps in the guide" }),
          outcome: Type.String({ description: "What the reader will be able to do after completing the guide" }),
          difficulty: Type.Optional(Type.Union([
            Type.Literal("beginner"), Type.Literal("intermediate"), Type.Literal("advanced"),
          ])),
          format_version: Type.Optional(Type.String()),
          topic_tags: Type.Optional(Type.Array(Type.String())),
          prior_content_refs: Type.Optional(Type.Array(Type.String())),
        }),
        subdir: "content",
        label: "Record Guide",
        description:
          "Record a how-to guide or tutorial with steps, prerequisites, and outcome. " +
          "Stores content as a markdown artifact with structured metadata.",
        filename: () => "guide.json",
        content: (p) => p.content,
        metadata: (p, sid) => ({
          ...baseContentMeta(p, sid),
          prerequisites: p.prerequisites || [],
          steps_count: p.steps_count,
          outcome: p.outcome,
          difficulty: p.difficulty,
        }),
        summary: (id, p) =>
          `Guide recorded: ${id}\nTitle: ${p.title}\nSteps: ${p.steps_count}\nWords: ${countWords(p.content)}`,
        details: contentDetails,
      },
      article: {
        schema: Type.Object({
          title: Type.String({ description: "Article title or headline" }),
          audience: Type.String({ description: "Intended readership" }),
          source_refs: Type.Array(Type.String(), {
            minItems: 1, description: "Artifact IDs of source findings, interviews, or research",
          }),
          content: Type.String({ description: "Full article body in markdown" }),
          angle: Type.String({ description: "Editorial angle or thesis the article advances" }),
          platform: Type.String({ description: "Publishing platform (e.g. 'company blog', 'Substack', 'Medium')" }),
          tone: Type.Optional(Type.String({ description: "Voice/tone descriptor (e.g. 'analytical', 'conversational')" })),
          seo_keywords: Type.Optional(Type.Array(Type.String(), { description: "Target SEO keywords" })),
          format_version: Type.Optional(Type.String()),
          topic_tags: Type.Optional(Type.Array(Type.String())),
          prior_content_refs: Type.Optional(Type.Array(Type.String())),
        }),
        subdir: "content",
        label: "Record Article",
        description:
          "Record an editorial article with angle, target platform, and optional SEO metadata.",
        filename: () => "article.json",
        content: (p) => p.content,
        metadata: (p, sid) => ({
          ...baseContentMeta(p, sid),
          angle: p.angle,
          platform: p.platform,
          tone: p.tone,
          seo_keywords: p.seo_keywords || [],
        }),
        summary: (id, p) =>
          `Article recorded: ${id}\nTitle: ${p.title}\nPlatform: ${p.platform}\nWords: ${countWords(p.content)}`,
        details: contentDetails,
      },
      marketing_copy: {
        schema: Type.Object({
          title: Type.String({ description: "Internal name for this copy (e.g. 'Q3 launch tweet thread')" }),
          audience: Type.String({ description: "Target audience segment" }),
          source_refs: Type.Optional(Type.Array(Type.String(), {
            description: "Optional artifact IDs of brand/product material",
          })),
          content: Type.String({ description: "The marketing copy itself" }),
          platform: Type.String({ description: "Distribution channel (e.g. 'Twitter', 'LinkedIn ad', 'landing page hero')" }),
          call_to_action: Type.String({ description: "Primary CTA the copy drives toward" }),
          format_constraints: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
            description: "Platform constraints (max chars, image requirements, etc.)",
          })),
          variants: Type.Optional(Type.Array(Type.String(), {
            description: "Alternate phrasings or A/B test variants",
          })),
          format_version: Type.Optional(Type.String()),
          topic_tags: Type.Optional(Type.Array(Type.String())),
          prior_content_refs: Type.Optional(Type.Array(Type.String())),
        }),
        subdir: "content",
        label: "Record Marketing Copy",
        description:
          "Record marketing/promotional copy for a specific platform with a call-to-action and optional variants. " +
          "Source refs are optional for marketing copy.",
        filename: () => "marketing_copy.json",
        content: (p) => p.content,
        metadata: (p, sid) => ({
          ...baseContentMeta(p, sid),
          platform: p.platform,
          call_to_action: p.call_to_action,
          format_constraints: p.format_constraints,
          variants: p.variants || [],
        }),
        summary: (id, p) =>
          `Marketing copy recorded: ${id}\nPlatform: ${p.platform}\nCTA: ${p.call_to_action}\nWords: ${countWords(p.content)}`,
        details: contentDetails,
      },
      newsletter: {
        schema: Type.Object({
          title: Type.String({ description: "Newsletter issue title" }),
          audience: Type.String({ description: "Subscriber audience" }),
          source_refs: Type.Array(Type.String(), {
            minItems: 1, description: "Artifact IDs of source content",
          }),
          content: Type.String({ description: "Full newsletter body in markdown" }),
          issue_number: Type.Optional(Type.Integer({ minimum: 1, description: "Sequential issue number" })),
          cadence: Type.Union([
            Type.Literal("daily"), Type.Literal("weekly"), Type.Literal("biweekly"),
            Type.Literal("monthly"), Type.Literal("ad_hoc"),
          ], { description: "Publishing cadence" }),
          sections: Type.Array(Type.String(), { description: "Ordered list of section headings" }),
          featured_items: Type.Array(Type.String(), {
            description: "Artifact IDs of featured content items in this issue",
          }),
          format_version: Type.Optional(Type.String()),
          topic_tags: Type.Optional(Type.Array(Type.String())),
          prior_content_refs: Type.Optional(Type.Array(Type.String())),
        }),
        subdir: "content",
        label: "Record Newsletter",
        description:
          "Record a newsletter issue with cadence, sections, and featured content references.",
        filename: () => "newsletter.json",
        content: (p) => p.content,
        metadata: (p, sid) => ({
          ...baseContentMeta(p, sid),
          issue_number: p.issue_number,
          cadence: p.cadence,
          sections: p.sections,
          featured_items: p.featured_items,
        }),
        summary: (id, p) =>
          `Newsletter recorded: ${id}\nTitle: ${p.title}\nCadence: ${p.cadence}\nFeatured items: ${p.featured_items.length}\nWords: ${countWords(p.content)}`,
        details: contentDetails,
      },
    },
    profiles: KIND_PROFILES,
    queryTool: {
      name: "query_content",
      label: "Query Content",
      description:
        "Search recorded writer content (reports, guides, articles, marketing copy, newsletters) with optional filters. " +
        "Returns matching items sorted by created_at descending.",
      noMatchText: "No content matches the filters.",
      extraFilters: [
        {
          name: "topic_tag",
          schema: Type.Optional(Type.String({ description: "Filter by topic tag (substring match)" })),
          filter: (rec, val) => {
            const tags: string[] = (rec.metadata as any).topic_tags || [];
            return tags.some((t: string) => t.toLowerCase().includes(val.toLowerCase()));
          },
        },
        {
          name: "audience",
          schema: Type.Optional(Type.String({ description: "Filter by audience (substring match)" })),
          filter: (rec, val) => {
            const a: string = (rec.metadata as any).audience || "";
            return a.toLowerCase().includes(val.toLowerCase());
          },
        },
      ],
      formatLine: (rec) => {
        const m = rec.metadata as Record<string, any>;
        const title = m.title_preview || m.title || "(untitled)";
        const audience = m.audience || "—";
        const words = m.word_count ?? 0;
        return `[${rec.id}] ${rec.type} | ${title} | ${audience} | words=${words}`;
      },
    },
    getTool: {
      name: "get_content",
      label: "Get Content",
      description: "Retrieve a specific piece of writer content by ULID. Returns metadata and full content.",
    },
  });
}
