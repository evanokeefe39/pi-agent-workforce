/**
 * Tool classification registry.
 * Maps tool names to data flow semantics (READ/WRITE/COMPUTE)
 * for provenance tracking.
 */

export interface ToolClassification {
  type: "READ" | "WRITE" | "COMPUTE";
  uri: (input: any, result?: any) => string;
}

const CLASSIFICATIONS: Record<string, ToolClassification> = {
  // Filesystem
  read:              { type: "READ",  uri: (i) => `file://${i.file_path || i.path || "unknown"}` },
  write:             { type: "WRITE", uri: (i) => `file://${i.file_path || i.path || "unknown"}` },
  edit:              { type: "WRITE", uri: (i) => `file://${i.file_path || "unknown"}` },

  // Research tools
  web_search:        { type: "READ",  uri: (i) => `web://search?q=${encodeURIComponent(i.query || "")}` },
  deep_research:     { type: "READ",  uri: (i) => `web://research?q=${encodeURIComponent(i.query || "")}` },
  scrape_apify:      { type: "READ",  uri: (_i, r) => `apify://dataset/${r?.datasetId || r?.id || "unknown"}` },

  // Workproduct tools
  record_finding:    { type: "WRITE", uri: (i) => `workproduct://findings/${i.id || "unknown"}` },
  record_metric:     { type: "WRITE", uri: (i) => `workproduct://metrics/${i.name || "unknown"}` },
  record_query_result: { type: "WRITE", uri: (i) => `workproduct://queries/${i.name || "unknown"}` },
  record_chart:      { type: "WRITE", uri: (i) => `workproduct://charts/${i.name || "unknown"}` },
  record_dataset_ref: { type: "WRITE", uri: (i) => `workproduct://datasets/${i.name || "unknown"}` },
  write_artifact:    { type: "WRITE", uri: (i) => `artifact://${i.name || "unknown"}` },
  publish_artifact:  { type: "WRITE", uri: (i) => `artifact://${i.file_path || "unknown"}` },
  read_artifact:     { type: "READ",  uri: (i) => `artifact://${i.id || "unknown"}` },
  list_artifacts:    { type: "READ",  uri: () => `artifact://list` },

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
