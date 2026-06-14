import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "typebox";
import { createWorkproductExtension } from "./workproduct/factory.js";
import { validateByStyle, type StyleProfiles } from "./workproduct/validate.js";
import type { ExtraToolDef, LocalRecord, WorkproductHandle } from "./workproduct/types.js";

// ---------------------------------------------------------------------------
// ADMIRALTY grading types
// ---------------------------------------------------------------------------

const SourceReliability = Type.Union([
  Type.Literal("A"), Type.Literal("B"), Type.Literal("C"),
  Type.Literal("D"), Type.Literal("E"), Type.Literal("F"),
], { description: "NATO ADMIRALTY source reliability: A=completely reliable, B=usually reliable, C=fairly reliable, D=not usually reliable, E=unreliable, F=cannot be judged" });

const InformationCredibility = Type.Union([
  Type.Literal(1), Type.Literal(2), Type.Literal(3),
  Type.Literal(4), Type.Literal(5), Type.Literal(6),
], { description: "NATO ADMIRALTY information credibility: 1=confirmed, 2=probably true, 3=possibly true, 4=doubtful, 5=improbable, 6=cannot be judged" });

const SourceType = Type.Union([
  Type.Literal("primary_official"),
  Type.Literal("structured_aggregator"),
  Type.Literal("news_editorial"),
  Type.Literal("press_release"),
  Type.Literal("academic_paper"),
  Type.Literal("industry_report"),
  Type.Literal("social_media"),
  Type.Literal("community_forum"),
  Type.Literal("blog_personal"),
  Type.Literal("api_data"),
  Type.Literal("dataset"),
  Type.Literal("other"),
], { description: "Structural classification of the source" });

const CollectionMethod = Type.Union([
  Type.Literal("web_search"),
  Type.Literal("web_fetch"),
  Type.Literal("api_query"),
  Type.Literal("web_scrape"),
  Type.Literal("deep_research"),
  Type.Literal("direct_reference"),
  Type.Literal("human_provided"),
  Type.Literal("database_query"),
], { description: "How this source was obtained" });

const Corroboration = Type.Union([
  Type.Literal("confirmed"),
  Type.Literal("probable"),
  Type.Literal("uncorroborated"),
  Type.Literal("conflicting"),
], { description: "Corroboration status across sources. Auto-inferred from source count if omitted." });

const SourceSchema = Type.Object({
  source_name: Type.String({ description: "Human name: 'Crunchbase', 'TechCrunch', 'SEC EDGAR'" }),
  source_url: Type.String({ description: "URL of specific page or document" }),
  source_type: SourceType,
  source_reliability: Type.Optional(SourceReliability),
  information_credibility: Type.Optional(InformationCredibility),
  authors: Type.Optional(Type.Array(Type.String(), { description: "Named authors if known" })),
  publisher: Type.Optional(Type.String({ description: "Publishing organization" })),
  date_published: Type.Optional(Type.String({ description: "When source material was published (ISO 8601)" })),
  date_accessed: Type.Optional(Type.String({ description: "When retrieved — auto-set to now if omitted" })),
  collection_method: Type.Optional(CollectionMethod),
  doi: Type.Optional(Type.String({ description: "Digital Object Identifier if available" })),
  verbatim_quote: Type.Optional(Type.String({ description: "Exact quote from this specific source" })),
  source_data: Type.Optional(Type.Unknown({ description: "Raw data from this source (API response, scrape result, etc.). Inlined for self-contained findings — no re-fetch needed downstream." })),
});

type SourceInput = Static<typeof SourceSchema>;

const FindingStyle = Type.Union([
  Type.Literal("intelligence"),
  Type.Literal("academic"),
  Type.Literal("journalism"),
  Type.Literal("data"),
  Type.Literal("general"),
], { description: "Citation/grading standard to apply. Determines which fields are required." });

// ---------------------------------------------------------------------------
// Style validation profiles
// ---------------------------------------------------------------------------

const FINDING_PROFILES: StyleProfiles = {
  sourceRequired: {
    intelligence: ["source_reliability", "information_credibility", "date_accessed", "collection_method"],
    academic: ["authors", "date_published", "date_accessed"],
    journalism: ["authors", "date_published", "date_accessed"],
    data: ["date_accessed", "collection_method", "source_reliability", "information_credibility"],
    general: ["date_accessed"],
  },
  sourceEncouraged: {
    intelligence: ["verbatim_quote"],
    academic: ["publisher", "doi", "verbatim_quote"],
    journalism: ["publisher", "verbatim_quote", "source_reliability", "information_credibility"],
    data: [],
    general: [],
  },
  recordEncouraged: {
    intelligence: ["corroboration", "date_information"],
    academic: [],
    journalism: [],
    data: ["date_information", "corroboration"],
    general: [],
  },
};

// ---------------------------------------------------------------------------
// Domain logic
// ---------------------------------------------------------------------------

function inferCorroboration(sources: SourceInput[], explicit?: string): string {
  if (explicit) return explicit;
  const uniqueNames = new Set(sources.map(s => s.source_name.toLowerCase()));
  if (uniqueNames.size >= 3) return "confirmed";
  if (uniqueNames.size === 2) return "probable";
  return "uncorroborated";
}

function admiraltyGrade(sources: SourceInput[], primaryIndex: number): string | null {
  const primary = sources[primaryIndex];
  if (!primary) return null;
  if (primary.source_reliability && primary.information_credibility) {
    return `${primary.source_reliability}${primary.information_credibility}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// get_finding reconstruction
// ---------------------------------------------------------------------------

interface StoredFinding {
  id: string;
  session_id: string;
  agent: string;
  timestamp: string;
  claim_preview: string;
  style: string;
  claim: string;
  sources: SourceInput[];
  primary_source_index: number;
  corroboration: string;
  date_information?: string;
  topic_tags: string[];
  entities: string[];
  related_findings: string[];
  contradicts: string[];
}

function recordToFinding(rec: LocalRecord, content: string): StoredFinding {
  const m = rec.metadata as Record<string, any>;
  return {
    id: rec.id,
    session_id: m.session_id || "",
    agent: rec.agent,
    timestamp: rec.timestamp,
    claim_preview: m.claim_preview || "",
    style: m.style || "general",
    claim: content,
    sources: m.sources || [],
    primary_source_index: m.primary_source_index ?? 0,
    corroboration: m.corroboration || "uncorroborated",
    date_information: m.date_information,
    topic_tags: m.topic_tags || [],
    entities: m.entities || [],
    related_findings: m.related_findings || [],
    contradicts: m.contradicts || [],
  };
}

// ---------------------------------------------------------------------------
// Prompt snippets
// ---------------------------------------------------------------------------

const INTELLIGENCE_SNIPPET = `Record every discrete factual claim using record_finding with style "intelligence".

ADMIRALTY grading (required for each source):
  Source Reliability: A=completely reliable, B=usually reliable, C=fairly reliable, D=not usually reliable, E=unreliable, F=cannot be judged
  Information Credibility: 1=confirmed, 2=probably true, 3=possibly true, 4=doubtful, 5=improbable, 6=cannot be judged

Multiple sources on one finding strengthen corroboration. Use add_source to append corroborating sources to existing findings.
Use query_findings to search recorded findings. Use get_finding to retrieve a specific finding by ID.`;

const DATA_SNIPPET = `Record every discrete data point using record_finding with style "data".

ADMIRALTY grading (required for each source):
  Source Reliability: A=completely reliable (official API), B=usually reliable (established aggregator), C=fairly reliable, D-F=increasing doubt
  Information Credibility: 1=confirmed by multiple sources, 2=probably true, 3=possibly true, 4=doubtful, 5=improbable, 6=cannot judge

Use add_source to attach corroborating sources to existing findings.
Use query_findings to search recorded findings. Use get_finding to retrieve by ID.`;

const GENERAL_SNIPPET = `Record findings using record_finding. Choose a style: intelligence (ADMIRALTY grading), academic (author/publisher focus), journalism (byline/quote focus), data (API/dataset focus), or general (minimal requirements).
Use add_source to attach additional sources to existing findings.
Use query_findings to search. Use get_finding to retrieve by ID.`;

function getPromptSnippet(): string {
  const defaultStyle = process.env.FINDING_STYLE || "";
  if (defaultStyle === "intelligence") return INTELLIGENCE_SNIPPET;
  if (defaultStyle === "data") return DATA_SNIPPET;
  return GENERAL_SNIPPET;
}

// ---------------------------------------------------------------------------
// Extra tool: add_source
// ---------------------------------------------------------------------------

const addSourceTool: ExtraToolDef = {
  name: "add_source",
  label: "Add Source to Finding",
  description:
    "Append an additional source to an existing finding. Recalculates corroboration if it was auto-inferred. " +
    "Use this when you discover a corroborating source for an already-recorded finding.",
  parameters: Type.Object({
    finding_id: Type.String({ description: "ULID of the existing finding" }),
    source: SourceSchema,
  }),
  async execute(handle: WorkproductHandle, _toolCallId, params, _signal, _onUpdate, ctx) {
    const rec = handle.read(params.finding_id, ctx);
    if (!rec) {
      return { content: [{ type: "text" as const, text: `Error: finding ${params.finding_id} not found` }] };
    }
    if (rec.type !== "finding") {
      return { content: [{ type: "text" as const, text: `Error: artifact ${params.finding_id} is not a finding` }] };
    }

    const m = rec.metadata as Record<string, any>;
    const existingSources: SourceInput[] = m.sources || [];
    const style: string = m.style || "general";

    const src: SourceInput = params.source;
    if (!src.date_accessed) src.date_accessed = new Date().toISOString();

    const { errors, warnings } = validateByStyle(
      FINDING_PROFILES, style, [src] as Record<string, unknown>[], {},
    );
    if (errors.length > 0) {
      return {
        content: [{ type: "text" as const, text: `Validation failed for new source:\n${errors.join("\n")}` }],
      };
    }

    const updatedSources = [...existingSources, src];
    const corroboration = inferCorroboration(updatedSources);
    const primaryIdx: number = m.primary_source_index ?? 0;

    handle.updateMetadata(params.finding_id, {
      ...m,
      sources: updatedSources,
      corroboration,
    }, ctx);

    const grade = admiraltyGrade(updatedSources, primaryIdx);
    const parts = [
      `Source added to finding ${params.finding_id}`,
      `Sources: ${updatedSources.length}`,
      `Corroboration: ${corroboration}`,
    ];
    if (grade) parts.push(`Primary ADMIRALTY grade: ${grade}`);
    if (warnings.length > 0) parts.push(`\nWarnings:\n${warnings.join("\n")}`);

    return {
      content: [{ type: "text" as const, text: parts.join("\n") }],
      details: { finding_id: params.finding_id, source_count: updatedSources.length, corroboration },
    };
  },
};

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  createWorkproductExtension(pi, {
    agentName: "researcher",
    kinds: {
      finding: {
        schema: Type.Object({
          style: FindingStyle,
          claim: Type.String({ description: "The specific factual assertion" }),
          sources: Type.Array(SourceSchema, {
            minItems: 1,
            description: "One or more sources supporting this finding",
          }),
          primary_source_index: Type.Optional(Type.Integer({
            minimum: 0,
            description: "Index into sources[] for the strongest source. Defaults to 0.",
          })),
          corroboration: Type.Optional(Corroboration),
          date_information: Type.Optional(Type.String({
            description: "When the information is FROM if different from access/publish dates",
          })),
          topic_tags: Type.Optional(Type.Array(Type.String())),
          entities: Type.Optional(Type.Array(Type.String(), {
            description: "Named entities: companies, people, products",
          })),
          related_findings: Type.Optional(Type.Array(Type.String())),
          contradicts: Type.Optional(Type.Array(Type.String())),
        }),
        subdir: "findings",
        label: "Record Finding",
        description:
          "Record a structured finding with one or more sources, ADMIRALTY grading, and provenance metadata. " +
          "Style determines which fields are required: intelligence (ADMIRALTY + collection_method), academic (authors + dates), " +
          "journalism (byline + quotes), data (ADMIRALTY + collection_method), general (minimal).",
        promptSnippet: getPromptSnippet(),
        filename: () => "finding.json",
        content: (p) => JSON.stringify(p.claim),
        sources: (p) => (p.sources || []) as Record<string, unknown>[],
        validate: (p) => {
          // Fill in date_accessed defaults before style validation checks it
          const now = new Date().toISOString();
          for (const src of (p.sources || []) as SourceInput[]) {
            if (!src.date_accessed) src.date_accessed = now;
          }
          const primaryIdx = p.primary_source_index ?? 0;
          if (primaryIdx >= (p.sources?.length || 0)) {
            return { errors: [`primary_source_index ${primaryIdx} exceeds sources length ${p.sources?.length}`], warnings: [] };
          }
          return null;
        },
        metadata: (p, sid) => {
          const primaryIdx = p.primary_source_index ?? 0;
          return {
            style: p.style,
            sources: p.sources,
            primary_source_index: primaryIdx,
            corroboration: inferCorroboration(p.sources, p.corroboration),
            admiralty_grade: admiraltyGrade(p.sources, primaryIdx),
            date_information: p.date_information || undefined,
            topic_tags: p.topic_tags || [],
            entities: p.entities || [],
            related_findings: p.related_findings || [],
            contradicts: p.contradicts || [],
            claim_preview: p.claim.slice(0, 120),
            session_id: sid,
          };
        },
        summary: (id, p) => {
          const primaryIdx = p.primary_source_index ?? 0;
          const corroboration = inferCorroboration(p.sources, p.corroboration);
          const grade = admiraltyGrade(p.sources, primaryIdx);
          const parts = [`Finding recorded: ${id}`];
          if (grade) parts.push(`ADMIRALTY grade: ${grade}`);
          parts.push(`Corroboration: ${corroboration}`);
          parts.push(`Sources: ${p.sources.length}`);
          return parts.join("\n");
        },
        details: (id, p) => {
          const primaryIdx = p.primary_source_index ?? 0;
          return {
            id,
            admiralty_grade: admiraltyGrade(p.sources, primaryIdx),
            corroboration: inferCorroboration(p.sources, p.corroboration),
            source_count: p.sources.length,
          };
        },
      },
    },
    profiles: FINDING_PROFILES,
    queryTool: {
      name: "query_findings",
      label: "Query Findings",
      description:
        "Search recorded findings with optional filters. Returns matching findings sorted by timestamp descending.",
      noMatchText: "No findings match the filters.",
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
          name: "entity",
          schema: Type.Optional(Type.String({ description: "Filter by named entity (substring match)" })),
          filter: (rec, val) => {
            const entities: string[] = (rec.metadata as any).entities || [];
            return entities.some((e: string) => e.toLowerCase().includes(val.toLowerCase()));
          },
        },
        {
          name: "min_reliability",
          schema: Type.Optional(SourceReliability),
          filter: (rec, val) => {
            const m = rec.metadata as any;
            const sources: SourceInput[] = m.sources || [];
            const primary = sources[m.primary_source_index ?? 0];
            if (!primary?.source_reliability) return false;
            return "ABCDEF".indexOf(primary.source_reliability) <= "ABCDEF".indexOf(val);
          },
        },
        {
          name: "max_credibility",
          schema: Type.Optional(InformationCredibility),
          filter: (rec, val) => {
            const m = rec.metadata as any;
            const sources: SourceInput[] = m.sources || [];
            const primary = sources[m.primary_source_index ?? 0];
            if (!primary?.information_credibility) return false;
            return primary.information_credibility <= val;
          },
        },
        {
          name: "style",
          schema: Type.Optional(FindingStyle),
          filter: (rec, val) => (rec.metadata as any).style === val,
        },
      ],
      formatLine: (rec) => {
        const m = rec.metadata as Record<string, any>;
        const sources: SourceInput[] = m.sources || [];
        const primary = sources[m.primary_source_index ?? 0];
        const grade = primary?.source_reliability && primary?.information_credibility
          ? `${primary.source_reliability}${primary.information_credibility}`
          : "—";
        return `- [${rec.id}] ${grade} | ${m.corroboration || "uncorroborated"} | ${sources.length} src | ${m.claim_preview || ""}`;
      },
    },
    getTool: {
      name: "get_finding",
      label: "Get Finding",
      description: "Retrieve a specific finding by its ULID. Returns full finding with all sources and metadata.",
      formatResult: (rec) => {
        const finding = recordToFinding(rec, JSON.parse(rec.content));
        const grade = admiraltyGrade(finding.sources, finding.primary_source_index);
        return {
          text: JSON.stringify(finding, null, 2),
          details: { id: finding.id, admiralty_grade: grade },
        };
      },
    },
    extraTools: [addSourceTool],
  });
}
