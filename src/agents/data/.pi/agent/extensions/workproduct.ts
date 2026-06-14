import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { createWorkproductExtension } from "./workproduct/factory.js";
import type { StyleProfiles, LocalRecord } from "./workproduct/types.js";

// ---------------------------------------------------------------------------
// Validation profiles
// ---------------------------------------------------------------------------

const KIND_PROFILES: StyleProfiles = {
  sourceRequired: { dataset_ref: [], query_result: [], metric: [], chart: [] },
  sourceEncouraged: { dataset_ref: [], query_result: [], metric: [], chart: [] },
  recordEncouraged: {
    dataset_ref: ["row_count_estimate", "caveats", "topic_tags"],
    query_result: ["duration_ms", "source_dataset_refs", "topic_tags"],
    metric: ["unit", "window", "confidence", "topic_tags"],
    chart: ["title", "dimensions", "measures", "caveats"],
  },
};

// ---------------------------------------------------------------------------
// Shared type aliases
// ---------------------------------------------------------------------------

const ArtifactRef = Type.String({ description: "ULID of an artifact stored via the artifact service" });
const ISODate = Type.String({ description: "ISO 8601 timestamp or date string" });

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  createWorkproductExtension(pi, {
    agentName: "data",
    kinds: {
      dataset_ref: {
        schema: Type.Object({
          source: Type.Union([
            Type.Literal("postgres"), Type.Literal("duckdb"), Type.Literal("parquet"),
            Type.Literal("csv"), Type.Literal("tinybird"), Type.Literal("s3"),
            Type.Literal("api"), Type.Literal("other"),
          ], { description: "Where the dataset lives" }),
          table: Type.Optional(Type.String({ description: "Required for postgres/duckdb/tinybird sources" })),
          path: Type.Optional(Type.String({ description: "Required for parquet/csv/s3 sources" })),
          filters: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: "Predicate/filter applied" })),
          columns: Type.Optional(Type.Array(Type.String(), { description: "Columns of interest" })),
          row_count_estimate: Type.Optional(Type.Integer({ description: "Approximate row count" })),
          schema_hash: Type.Optional(Type.String({ description: "Hash of the schema at time of access" })),
          as_of: ISODate,
          caveats: Type.Optional(Type.String({ description: "Caveats about freshness, completeness, etc." })),
          topic_tags: Type.Optional(Type.Array(Type.String())),
          related_artifacts: Type.Optional(Type.Array(ArtifactRef)),
        }),
        subdir: "datasets",
        label: "Record Dataset Reference",
        description:
          "Register a reference to a dataset (table, file, API, etc.) the data agent has analyzed. Returns the artifact id.",
        filename: () => "dataset_ref.json",
        validate: (p) => {
          const s = p.source as string;
          if (["postgres", "duckdb", "tinybird"].includes(s) && !p.table) {
            return { errors: [`source '${s}' requires 'table'`], warnings: [] };
          }
          if (["parquet", "csv", "s3"].includes(s) && !p.path) {
            return { errors: [`source '${s}' requires 'path'`], warnings: [] };
          }
          return null;
        },
        content: (p) => JSON.stringify({
          source: p.source, table: p.table, path: p.path,
          filters: p.filters, columns: p.columns,
          row_count_estimate: p.row_count_estimate, as_of: p.as_of,
        }),
        metadata: (p, sid) => ({
          source: p.source, table: p.table, path: p.path,
          filters: p.filters, columns: p.columns,
          row_count_estimate: p.row_count_estimate,
          schema_hash: p.schema_hash, as_of: p.as_of,
          caveats: p.caveats, topic_tags: p.topic_tags,
          related_artifacts: p.related_artifacts,
          session_id: sid,
        }),
        summary: (id) => `Dataset reference recorded.\nID: ${id}`,
      },
      query_result: {
        schema: Type.Object({
          sql: Type.String({ description: "Full SQL text (truncated to 8KB in metadata)" }),
          engine: Type.Union([
            Type.Literal("duckdb"), Type.Literal("postgres"),
            Type.Literal("tinybird"), Type.Literal("other"),
          ]),
          row_count: Type.Integer(),
          materialized_at: ISODate,
          columns: Type.Array(Type.Object({ name: Type.String(), type: Type.String() })),
          result_artifact_ref: Type.Optional(ArtifactRef),
          source_dataset_refs: Type.Optional(Type.Array(ArtifactRef)),
          duration_ms: Type.Optional(Type.Integer()),
          topic_tags: Type.Optional(Type.Array(Type.String())),
          rows_inline: Type.Optional(Type.Array(Type.Unknown(), {
            description: "Inline rows (max 100). For larger results, write to an artifact and pass result_artifact_ref instead.",
          })),
        }),
        subdir: "queries",
        label: "Record Query Result",
        description:
          "Persist the output of an analytical query, either inline (small) or by reference to an artifact (large). Returns artifact id.",
        filename: () => "query_result.json",
        validate: (p) => {
          const rows = p.rows_inline;
          if (Array.isArray(rows) && rows.length > 100) {
            return { errors: ["rows_inline exceeds 100 rows. Write the full result to an artifact via publish_artifact and pass result_artifact_ref instead."], warnings: [] };
          }
          return null;
        },
        content: (p) => {
          const body = JSON.stringify({
            sql: p.sql, columns: p.columns,
            rows_inline: p.rows_inline ?? null,
            result_artifact_ref: p.result_artifact_ref ?? null,
          });
          if (Buffer.byteLength(body, "utf8") > 1_000_000) {
            throw new Error("query_result content exceeds 1MB. Write the rows to an artifact via publish_artifact and pass result_artifact_ref instead.");
          }
          return body;
        },
        metadata: (p, sid) => ({
          sql: p.sql.length > 8192 ? p.sql.slice(0, 8192) : p.sql,
          engine: p.engine, row_count: p.row_count,
          materialized_at: p.materialized_at,
          columns: p.columns,
          result_artifact_ref: p.result_artifact_ref,
          source_dataset_refs: p.source_dataset_refs,
          duration_ms: p.duration_ms,
          topic_tags: p.topic_tags,
          inline_rows: Array.isArray(p.rows_inline) ? p.rows_inline.length : 0,
          session_id: sid,
        }),
        summary: (id, p) => `Query result recorded.\nID: ${id}\nRows: ${p.row_count}`,
      },
      metric: {
        schema: Type.Object({
          name: Type.String(),
          value: Type.Union([Type.Number(), Type.String()]),
          unit: Type.Optional(Type.String()),
          dimensions: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
          window: Type.Optional(Type.Union([
            Type.Object({ start: Type.String(), end: Type.String() }),
            Type.String(),
          ])),
          source_query_ref: ArtifactRef,
          confidence: Type.Optional(Type.Union([
            Type.Literal("high"), Type.Literal("medium"), Type.Literal("low"),
          ])),
          topic_tags: Type.Optional(Type.Array(Type.String())),
          entities: Type.Optional(Type.Array(Type.String())),
          series: Type.Optional(Type.Array(Type.Object({
            t: Type.String(),
            v: Type.Union([Type.Number(), Type.String()]),
          }))),
        }),
        subdir: "metrics",
        label: "Record Metric",
        description:
          "Record a single named metric derived from a query result. Use for KPIs, counts, ratios, etc.",
        filename: (p) => `metric_${p.name}.json`,
        content: (p) => JSON.stringify({ value: p.value, series: p.series ?? null }),
        metadata: (p, sid) => ({
          name: p.name, value: p.value, unit: p.unit,
          dimensions: p.dimensions, window: p.window,
          source_query_ref: p.source_query_ref,
          confidence: p.confidence,
          topic_tags: p.topic_tags, entities: p.entities,
          session_id: sid,
        }),
        summary: (id, p) =>
          `Metric recorded.\nID: ${id}\nName: ${p.name}\nValue: ${p.value}${p.unit ? " " + p.unit : ""}`,
      },
      chart: {
        schema: Type.Object({
          chart_type: Type.Union([
            Type.Literal("line"), Type.Literal("bar"), Type.Literal("scatter"),
            Type.Literal("area"), Type.Literal("pie"), Type.Literal("table"),
            Type.Literal("other"),
          ]),
          data_ref: ArtifactRef,
          spec: Type.Record(Type.String(), Type.Unknown(), { description: "Chart spec (vega-lite, plotly, etc.)" }),
          dimensions: Type.Optional(Type.Array(Type.String())),
          measures: Type.Optional(Type.Array(Type.String())),
          rendered_artifact_ref: Type.Optional(ArtifactRef),
          title: Type.Optional(Type.String()),
          caveats: Type.Optional(Type.String()),
          topic_tags: Type.Optional(Type.Array(Type.String())),
        }),
        subdir: "charts",
        label: "Record Chart",
        description:
          "Register a chart spec (e.g. Vega-Lite) plus a pointer to the data it visualizes. Returns artifact id.",
        filename: (p) => p.title ? `chart_${p.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.json` : "chart.json",
        content: (p) => JSON.stringify(p.spec),
        metadata: (p, sid) => ({
          chart_type: p.chart_type, data_ref: p.data_ref,
          dimensions: p.dimensions, measures: p.measures,
          rendered_artifact_ref: p.rendered_artifact_ref,
          title: p.title, caveats: p.caveats,
          topic_tags: p.topic_tags,
          session_id: sid,
        }),
        summary: (id, p) => {
          const parts = [`Chart recorded.\nID: ${id}\nType: ${p.chart_type}`];
          if (p.title) parts.push(`Title: ${p.title}`);
          return parts.join("\n");
        },
      },
    },
    profiles: KIND_PROFILES,
    queryTool: {
      name: "query_data_products",
      label: "Query Data Products",
      description:
        "Search across recorded data work products (dataset refs, query results, metrics, charts) with optional filters.",
      noMatchText: "No data products match the filters.",
      extraFilters: [
        {
          name: "topic_tag",
          schema: Type.Optional(Type.String({ description: "Substring match on topic_tags[]" })),
          filter: (rec, val) => {
            const tags = (rec.metadata?.topic_tags ?? []) as unknown;
            if (!Array.isArray(tags)) return false;
            return tags.some((t: unknown) => typeof t === "string" && t.toLowerCase().includes(val.toLowerCase()));
          },
        },
        {
          name: "entity",
          schema: Type.Optional(Type.String({ description: "Substring match on metric entities[]" })),
          filter: (rec, val) => {
            const ents = (rec.metadata?.entities ?? []) as unknown;
            if (!Array.isArray(ents)) return false;
            return ents.some((e: unknown) => typeof e === "string" && e.toLowerCase().includes(val.toLowerCase()));
          },
        },
      ],
      formatLine: (rec) => {
        const meta = (rec.metadata ?? {}) as Record<string, unknown>;
        const label =
          (meta.name as string) ||
          (meta.title as string) ||
          (meta.table as string) ||
          (meta.path as string) ||
          rec.filename;
        return `[${rec.id}] ${rec.type} | ${label} | ${rec.timestamp}`;
      },
    },
    getTool: {
      name: "get_data_product",
      label: "Get Data Product",
      description:
        "Fetch a single data work product (dataset_ref, query_result, metric, chart) by id. Returns metadata and parsed content.",
      formatResult: (rec) => {
        let parsed: unknown = rec.content;
        try { parsed = JSON.parse(rec.content); } catch {}
        return {
          text: JSON.stringify({ record: rec.metadata, content: parsed }, null, 2),
          details: { id: rec.id },
        };
      },
    },
  });
}
