/**
 * Tool classification registry.
 * Maps tool names to data flow semantics (READ/WRITE/COMPUTE)
 * for provenance tracking.
 */

export interface ToolClassification {
  type: "READ" | "WRITE" | "COMPUTE";
  uri: (input: any, result?: any) => string;
}

function basename(p: string): string {
  const last = p.replace(/\\/g, "/").split("/").pop();
  return last || p;
}

function extractArtifactRef(_i: any, r: any): string {
  // tool_result event may pass result as string, { text }, { content: [{ text }] }, or other shapes
  const text = typeof r === "string" ? r
    : r?.text || r?.content?.[0]?.text || r?.output || JSON.stringify(r || "");
  const match = text.match(/Ref:\s*(artifact:\/\/\S+)/);
  return match ? match[1] : `artifact://${basename(_i.file_path || "unknown")}`;
}

const CLASSIFICATIONS: Record<string, ToolClassification> = {
  // Filesystem — basename only to avoid session-path noise in lineage
  read:              { type: "READ",  uri: (i) => `file://${basename(i.file_path || i.path || "unknown")}` },
  write:             { type: "WRITE", uri: (i) => `file://${basename(i.file_path || i.path || "unknown")}` },
  edit:              { type: "WRITE", uri: (i) => `file://${basename(i.file_path || "unknown")}` },

  // Research tools
  web_search:        { type: "READ",  uri: (i) => `web://search?q=${encodeURIComponent(i.query || "")}` },
  deep_research:     { type: "READ",  uri: (i) => `web://research?q=${encodeURIComponent(i.query || "")}` },
  scrape_apify:      { type: "READ",  uri: (_i, r) => `apify://dataset/${r?.datasetId || r?.id || "unknown"}` },

  // Workproduct tools
  record_finding:    { type: "WRITE", uri: (i) => `workproduct://findings/${i.id || "unknown"}` },
  record_report:     { type: "WRITE", uri: (i) => `workproduct://reports/${i.title || i.name || "unknown"}` },
  record_metric:     { type: "WRITE", uri: (i) => `workproduct://metrics/${i.name || "unknown"}` },
  record_query_result: { type: "WRITE", uri: (i) => `workproduct://queries/${i.name || "unknown"}` },
  record_chart:      { type: "WRITE", uri: (i) => `workproduct://charts/${i.name || "unknown"}` },
  record_dataset_ref: { type: "WRITE", uri: (i) => `workproduct://datasets/${i.name || "unknown"}` },
  write_artifact:    { type: "WRITE", uri: (i) => `artifact://${i.name || "unknown"}` },
  publish_artifact:  { type: "WRITE", uri: (i, r) => extractArtifactRef(i, r) },
  read_artifact:     { type: "READ",  uri: (i) => `artifact://${basename(i.id || "unknown")}` },
  list_artifacts:    { type: "COMPUTE", uri: () => `tool://list_artifacts` },

  // Subagent delegation
  subagent:          { type: "COMPUTE", uri: (i) => `agent://${i.agent || "unknown"}` },
};

/** Glob-pattern classifications for MCP and namespaced tools. */
const GLOB_PATTERNS: Array<{ prefix: string; classification: ToolClassification }> = [
  { prefix: "mcp__Notion__", classification: { type: "WRITE", uri: (_i, r) => `notion://page/${r?.id || _i?.page_id || "unknown"}` } },
  { prefix: "mcp__Linear__", classification: { type: "READ", uri: (i) => `linear://issue/${i?.id || i?.issueId || "unknown"}` } },
  { prefix: "mcp__Github__", classification: { type: "WRITE", uri: (i, r) => `github://repo/${i?.repo || r?.repository || "unknown"}` } },
];

/**
 * Classify a tool by name into READ/WRITE/COMPUTE with a URI builder.
 *
 * Precondition: toolName is a non-empty string.
 * Postcondition: always returns a valid ToolClassification (never throws).
 *
 * Resolution order:
 *   1. Exact match in CLASSIFICATIONS
 *   2. Prefix match against GLOB_PATTERNS
 *   3. Default: COMPUTE with tool:// URI
 */
export function classify(toolName: string): ToolClassification {
  // Exact match
  const exact = CLASSIFICATIONS[toolName];
  if (exact) return exact;

  // Prefix/glob match
  for (const { prefix, classification } of GLOB_PATTERNS) {
    if (toolName.startsWith(prefix)) return classification;
  }

  // Default — unknown tool treated as COMPUTE
  return { type: "COMPUTE", uri: () => `tool://${toolName}` };
}
