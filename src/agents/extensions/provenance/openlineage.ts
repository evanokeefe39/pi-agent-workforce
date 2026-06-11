/**
 * OpenLineage event builder and HTTP emitter.
 * Builds RunEvent JSON per the OpenLineage 2.0.2 spec and POSTs to Marquez.
 * Fire-and-forget: errors are logged to stderr, never thrown.
 */

interface InputDataset {
  namespace: string;
  name: string;
}

interface OutputDataset {
  namespace: string;
  name: string;
  facets?: Record<string, any>;
}

interface RunEvent {
  eventType: "START" | "RUNNING" | "COMPLETE" | "FAIL" | "ABORT";
  eventTime: string;
  producer: string;
  schemaURL: string;
  run: {
    runId: string;
    facets?: Record<string, any>;
  };
  job: {
    namespace: string;
    name: string;
  };
  inputs: InputDataset[];
  outputs: OutputDataset[];
}

interface BuildRunEventOpts {
  eventType: RunEvent["eventType"];
  runId: string;
  agentName: string;
  correlationId?: string | null;
  causationId?: string | null;
  inputs: string[];
  outputs: Array<{ uri: string; facets?: Record<string, any> }>;
}

const PRODUCER = "https://github.com/user/pi-agent-workforce";
const SCHEMA_URL = "https://openlineage.io/spec/2-0-2/OpenLineage.json#/definitions/RunEvent";
const JOB_NAMESPACE = "pi-workforce";

/**
 * Split a URI on "://" into namespace and name.
 *
 * Precondition: uri contains "://".
 * Postcondition: returns { namespace, name } where namespace is the scheme
 *   and name is everything after "://".
 *
 * Examples:
 *   "web://search?q=test"       -> { namespace: "web",      name: "search?q=test" }
 *   "artifact://findings.jsonl" -> { namespace: "artifact",  name: "findings.jsonl" }
 *   "no-scheme"                 -> { namespace: "unknown",   name: "no-scheme" }
 */
export function parseDatasetUri(uri: string): { namespace: string; name: string } {
  const idx = uri.indexOf("://");
  if (idx === -1) return { namespace: "unknown", name: uri };
  return { namespace: uri.slice(0, idx), name: uri.slice(idx + 3) };
}

/**
 * Build a full OpenLineage RunEvent.
 *
 * Precondition: opts.runId and opts.agentName are non-empty strings.
 * Postcondition: returns a valid RunEvent conforming to OpenLineage 2.0.2 schema.
 */
export function buildRunEvent(opts: BuildRunEventOpts): RunEvent {
  const runFacets: Record<string, any> = {};

  // Include correlation facet only when correlationId is present
  if (opts.correlationId) {
    runFacets.piAgent_correlation = {
      correlationId: opts.correlationId,
      causationId: opts.causationId || null,
      agentName: opts.agentName,
    };
  }

  const inputs: InputDataset[] = opts.inputs.map((uri) => parseDatasetUri(uri));

  const outputs: OutputDataset[] = opts.outputs.map(({ uri, facets }) => {
    const parsed = parseDatasetUri(uri);
    return facets ? { ...parsed, facets } : parsed;
  });

  return {
    eventType: opts.eventType,
    eventTime: new Date().toISOString(),
    producer: PRODUCER,
    schemaURL: SCHEMA_URL,
    run: {
      runId: opts.runId,
      facets: Object.keys(runFacets).length > 0 ? runFacets : undefined,
    },
    job: {
      namespace: JOB_NAMESPACE,
      name: opts.agentName,
    },
    inputs,
    outputs,
  };
}

/**
 * POST an OpenLineage event to Marquez.
 *
 * Precondition: marquezUrl is a valid HTTP(S) URL or falsy.
 * Postcondition: event is sent fire-and-forget. Errors logged to stderr, never thrown.
 */
export async function emitEvent(marquezUrl: string | null, event: RunEvent): Promise<void> {
  if (!marquezUrl) return;

  try {
    await fetch(`${marquezUrl}/api/v1/lineage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[provenance] emit failed:", msg);
  }
}
