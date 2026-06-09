import type { GraphData, TraceResponse, ArtifactNode } from "./types";

const BASE = "";

export async function fetchGraph(runId: string): Promise<GraphData> {
  const res = await fetch(`${BASE}/lineage/graph?run_id=${encodeURIComponent(runId)}`);
  if (!res.ok) throw new Error(`Failed to fetch graph: ${res.status}`);
  return res.json();
}

export async function fetchTrace(id: string, direction: string): Promise<TraceResponse> {
  const res = await fetch(`${BASE}/lineage/trace/${id}?direction=${direction}`);
  if (!res.ok) throw new Error(`Failed to fetch trace: ${res.status}`);
  return res.json();
}

export async function fetchRuns(): Promise<string[]> {
  const res = await fetch(`${BASE}/artifacts`);
  if (!res.ok) throw new Error(`Failed to fetch artifacts: ${res.status}`);
  const artifacts: ArtifactNode[] = await res.json();
  const runs = new Set<string>();
  for (const a of artifacts) {
    if (a.run_id) runs.add(a.run_id);
  }
  return Array.from(runs).sort().reverse();
}
