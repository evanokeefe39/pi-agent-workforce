/**
 * Shared E2E test utilities for pi-agent-workforce.
 * Replaces jsonl-helpers.sh — native fetch, run-scoped queries, typed responses.
 *
 * Usage:
 *   import { requireAgents, plannerRun, artifactList } from "./helpers";
 */

// --- Agent URLs ---

export const URLS = {
  planner:    process.env.PLANNER_URL    || "http://localhost:8081",
  researcher: process.env.RESEARCHER_URL || "http://localhost:8082",
  data:       process.env.DATA_URL       || "http://localhost:8083",
  writer:     process.env.WRITER_URL     || "http://localhost:8084",
  publisher:  process.env.PUBLISHER_URL  || "http://localhost:8085",
  coder:      process.env.CODER_URL      || "http://localhost:8086",
  qa:         process.env.QA_URL         || "http://localhost:8087",
  artifacts:  process.env.ARTIFACT_URL   || "http://localhost:8090",
} as const;

// --- Response types ---

export interface InvokeResponse {
  runId: string;
  status: "accepted";
}

export interface StatusResponse {
  runId: string;
  state: string;
  startedAt: string;
  durationMs: number;
  progress: { turnCount: number };
}

export interface RunResult {
  runId: string;
  state: string;
  output: string;
  error: string | null;
  usage: {
    input: number;
    output: number;
    cacheRead: number;
    cost: number;
    turns: number;
  };
  durationMs: number;
  model: string;
}

export interface HealthResponse {
  status: "ok" | "starting";
  uptime_s: number;
  version: string;
  config: { provider: string; model: string; port: number };
  busy: boolean;
  queue_depth: number;
  queue_max: number;
  runs_active: number;
}

export interface MetricsResponse {
  requests_total: number;
  requests_active: number;
  requests_failed: number;
  avg_duration_ms: number;
  last_request_at: string | null;
  cold_start_ms: number | null;
  queue_depth: number;
  runs_completed: number;
  runs_active: number;
}

export interface Artifact {
  id: string;
  filename: string;
  artifact_type: string;
  agent_name: string;
  run_id: string;
  session_id?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

// --- Health checks ---

export async function waitForHealth(
  url: string,
  timeoutMs = 90_000,
  intervalMs = 3_000,
): Promise<HealthResponse> {
  const deadline = Date.now() + timeoutMs;
  let last: HealthResponse | null = null;

  while (Date.now() < deadline) {
    try {
      const resp = await fetch(`${url}/health`);
      if (resp.ok) {
        last = (await resp.json()) as HealthResponse;
        if (last.status === "ok") return last;
      }
    } catch {
      // not up yet
    }
    await Bun.sleep(intervalMs);
  }

  throw new Error(
    `Agent at ${url} not healthy after ${timeoutMs}ms (last status: ${last?.status ?? "unreachable"})`,
  );
}

export async function requireAgents(
  agents: Array<{ name: string; url: string }> = [
    { name: "researcher", url: URLS.researcher },
    { name: "data",       url: URLS.data },
    { name: "writer",     url: URLS.writer },
  ],
  timeoutMs = 90_000,
): Promise<void> {
  console.log("Checking agent health...");
  await Promise.all(
    agents.map(async ({ name, url }) => {
      await waitForHealth(url, timeoutMs);
      console.log(`  ${name} healthy`);
    }),
  );
  console.log("  All agents healthy.");
}

// --- Planner invoke + poll ---

export interface PlannerRunResult {
  runId: string;
  result: RunResult;
  durationSec: number;
}

export async function plannerRun(
  goal: string,
  timeoutMs = 1_800_000,
  plannerUrl = URLS.planner,
): Promise<PlannerRunResult> {
  const start = Date.now();

  // POST /invoke
  const invokeResp = await fetch(`${plannerUrl}/invoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: goal }),
  });

  if (!invokeResp.ok) {
    throw new Error(`Planner invoke failed: ${invokeResp.status} ${await invokeResp.text()}`);
  }

  const { runId } = (await invokeResp.json()) as InvokeResponse;
  console.log(`  Planner runId: ${runId}`);

  // Poll /status
  const deadline = Date.now() + timeoutMs;
  let pollInterval = 5_000;

  while (Date.now() < deadline) {
    await Bun.sleep(pollInterval);

    try {
      const statusResp = await fetch(`${plannerUrl}/status/${runId}`);
      if (statusResp.ok) {
        const status = (await statusResp.json()) as StatusResponse;
        const elapsed = Math.round((Date.now() - start) / 1000);
        console.log(`  [${elapsed}s] state=${status.state} turns=${status.progress.turnCount}`);

        if (status.state !== "running" && status.state !== "queued") break;
      }
    } catch {
      // transient fetch error, keep polling
    }

    // Adaptive backoff
    const elapsed = Date.now() - start;
    if (elapsed > 300_000) pollInterval = 20_000;
    else if (elapsed > 120_000) pollInterval = 10_000;
  }

  // Fetch result
  const resultResp = await fetch(`${plannerUrl}/result/${runId}`);
  if (!resultResp.ok) {
    throw new Error(`Planner result fetch failed: ${resultResp.status}`);
  }

  const result = (await resultResp.json()) as RunResult;
  const durationSec = Math.round((Date.now() - start) / 1000);

  return { runId, result, durationSec };
}

// --- Artifact service ---

export async function artifactList(
  query = "limit=200",
  baseUrl = URLS.artifacts,
): Promise<Artifact[]> {
  const resp = await fetch(`${baseUrl}/artifacts?${query}`, {
    headers: { "x-agent-name": "qa" },
  });
  if (!resp.ok) return [];
  return (await resp.json()) as Artifact[];
}

export async function artifactContent(
  id: string,
  baseUrl = URLS.artifacts,
): Promise<string> {
  const resp = await fetch(`${baseUrl}/artifacts/${id}`, {
    headers: { "x-agent-name": "qa" },
  });
  if (!resp.ok) return "";
  return resp.text();
}

export async function artifactsByRun(
  runId: string,
  baseUrl = URLS.artifacts,
): Promise<Artifact[]> {
  return artifactList(`run_id=${runId}&limit=200`, baseUrl);
}

export async function artifactsSince_time(
  since: string,
  baseUrl = URLS.artifacts,
): Promise<Artifact[]> {
  return artifactList(`since=${encodeURIComponent(since)}&limit=200`, baseUrl);
}

export async function artifactFindingsCount(
  artifacts: Artifact[],
  baseUrl = URLS.artifacts,
): Promise<number> {
  let total = 0;
  const datasets = artifacts.filter((a) => a.artifact_type === "dataset");

  for (const art of datasets) {
    const content = await artifactContent(art.id, baseUrl);
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if ("claim" in obj || "fact" in obj || "finding" in obj || "dimension" in obj || "rule_id" in obj || "evidence" in obj) total++;
      } catch {
        // not valid JSON line
      }
    }
  }
  return total;
}

export async function artifactSnapshot(
  baseUrl = URLS.artifacts,
): Promise<number> {
  const all = await artifactList("limit=1000", baseUrl);
  return all.length;
}

export function artifactsSince(
  beforeCount: number,
  currentCount: number,
): number {
  return currentCount - beforeCount;
}

// --- Agent metrics ---

export async function agentMetrics(
  url: string,
): Promise<MetricsResponse> {
  const resp = await fetch(`${url}/metrics`);
  if (!resp.ok) throw new Error(`Metrics fetch failed: ${resp.status}`);
  return (await resp.json()) as MetricsResponse;
}

// --- Docker logs ---

export async function dockerLogs(container: string): Promise<string> {
  const proc = Bun.spawn(["docker", "logs", container], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  // docker logs writes to stderr by default
  return stdout + stderr;
}

export function countInLogs(logs: string, pattern: string | RegExp): number {
  const re = typeof pattern === "string" ? new RegExp(pattern, "g") : pattern;
  return (logs.match(re) || []).length;
}

// --- Report generation ---

export async function writeReport(
  path: string,
  content: string,
): Promise<void> {
  await Bun.write(path, content);
  console.log(`Report: ${path}`);
}

// --- Results directory ---

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

let _resultsDir: string | null = null;

export function resultsDir(): string {
  if (_resultsDir) return _resultsDir;
  const dir =
    process.env.RESULTS_DIR ||
    resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "tests", "results");
  mkdirSync(dir, { recursive: true });
  _resultsDir = dir;
  return dir;
}

export function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}
