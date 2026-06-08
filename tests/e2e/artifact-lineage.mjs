#!/usr/bin/env node
// Artifact lineage report — derives the full chain for a planner pipeline run.
//
// Usage:
//   node artifact-lineage.mjs <planner-trace-id>
//   node artifact-lineage.mjs --latest
//
// Derives correlation from container logs (correlation_id links worker runs
// to planner session). Fetches artifact content to show findings + grades.

import { execSync } from "node:child_process";

const BASE = process.env.ARTIFACT_URL || "http://localhost:8090";
const AGENT = "qa";

async function fetchJson(url) {
  const resp = await fetch(url, { headers: { "x-agent-name": AGENT } });
  if (!resp.ok) throw new Error(`${url}: ${resp.status}`);
  return resp.json();
}

async function fetchText(url) {
  const resp = await fetch(url, { headers: { "x-agent-name": AGENT } });
  if (!resp.ok) return "";
  return resp.text();
}

function containerLogs(container) {
  try {
    return execSync(`docker logs ${container} 2>&1`, { encoding: "utf-8", maxBuffer: 10_000_000 });
  } catch { return ""; }
}

function parseLogLines(logs) {
  const entries = [];
  for (const line of logs.split("\n")) {
    try {
      const obj = JSON.parse(line);
      if (obj.event) entries.push(obj);
    } catch {}
  }
  return entries;
}

function findCorrelatedRuns(plannerSessionId) {
  const containers = [
    "pi-agent-workforce-researcher-1",
    "pi-agent-workforce-data-1",
    "pi-agent-workforce-writer-1",
  ];

  const runs = [];
  for (const container of containers) {
    const logs = parseLogLines(containerLogs(container));
    const agentName = container.replace("pi-agent-workforce-", "").replace("-1", "");

    for (const entry of logs) {
      if (entry.event === "request_accepted" && entry.correlation_id === plannerSessionId) {
        const traceId = entry.trace_id;
        const complete = logs.find(e => e.event === "request_complete" && e.trace_id === traceId);
        const sessionEntry = logs.find(e => e.event === "session_created" && e.trace_id === traceId);
        runs.push({
          agent: agentName,
          traceId,
          sessionId: sessionEntry?.session_id || null,
          runId: sessionEntry?.session_id || null,
          duration: complete?.duration_ms || null,
          turns: complete?.usage?.turns || null,
          model: complete?.usage?.model || null,
          status: complete ? "completed" : "running/failed",
        });
      }
    }
  }
  return runs;
}

function findPlannerSession(traceId) {
  const logs = parseLogLines(containerLogs("pi-agent-workforce-planner-1"));
  const session = logs.find(e => e.event === "session_created" && e.trace_id === traceId);
  const complete = logs.find(e => e.event === "request_complete" && e.trace_id === traceId);
  return {
    traceId,
    sessionId: session?.session_id || null,
    duration: complete?.duration_ms || null,
    turns: complete?.usage?.turns || null,
    model: complete?.usage?.model || null,
    status: complete ? "completed" : "running/failed",
  };
}

function findLatestPlannerTrace() {
  const logs = parseLogLines(containerLogs("pi-agent-workforce-planner-1"));
  const accepts = logs.filter(e => e.event === "request_accepted");
  if (accepts.length === 0) throw new Error("No planner runs found in logs");
  return accepts[accepts.length - 1].trace_id;
}

async function getArtifactsForRun(runId) {
  const all = await fetchJson(`${BASE}/artifacts?limit=200`);
  return all.filter(a => a.run_id === runId);
}

async function parseFindings(artifactId) {
  const content = await fetchText(`${BASE}/artifacts/${artifactId}`);
  const findings = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if ("claim" in obj) findings.push(obj);
    } catch {}
  }
  return findings;
}

function gradeLabel(source) {
  const r = source.source_reliability || source.reliability || "?";
  const c = source.information_credibility || source.credibility || "?";
  return `${r}${c}`;
}

function truncate(s, len = 80) {
  return s.length > len ? s.slice(0, len - 3) + "..." : s;
}

// --- Main ---

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: node artifact-lineage.mjs <planner-trace-id> | --latest");
  process.exit(1);
}

const traceId = arg === "--latest" ? findLatestPlannerTrace() : arg;
const planner = findPlannerSession(traceId);

console.log("╔══════════════════════════════════════════════════════════════════╗");
console.log("║  ARTIFACT LINEAGE REPORT                                       ║");
console.log("╚══════════════════════════════════════════════════════════════════╝");
console.log();
console.log(`Planner [${planner.model || "unknown"}] trace=${traceId}`);
console.log(`  status: ${planner.status}  turns: ${planner.turns}  duration: ${planner.duration ? Math.round(planner.duration / 1000) + "s" : "?"}`)
console.log();

const workerRuns = findCorrelatedRuns(planner.sessionId);

if (workerRuns.length === 0) {
  console.log("  (no correlated worker runs found in container logs)");
  process.exit(0);
}

for (const run of workerRuns) {
  const prefix = run.agent === "writer" ? "  └── " : "  ├── ";
  const durStr = run.duration ? Math.round(run.duration / 1000) + "s" : "?";
  console.log(`${prefix}${run.agent} [${run.model || "unknown"}] turns=${run.turns} duration=${durStr} ${run.status}`);

  const artifacts = await getArtifactsForRun(run.runId);
  if (artifacts.length === 0) {
    console.log(`  │     (no artifacts)`);
    continue;
  }

  for (let i = 0; i < artifacts.length; i++) {
    const art = artifacts[i];
    const isLast = i === artifacts.length - 1;
    const artPrefix = run.agent === "writer" ? "        " : "  │     ";
    const bullet = isLast ? "└── " : "├── ";

    if (art.artifact_type === "dataset" && art.filename.endsWith(".jsonl")) {
      const findings = await parseFindings(art.id);
      console.log(`${artPrefix}${bullet}📊 ${art.filename} (${findings.length} findings)`);

      for (let f = 0; f < findings.length; f++) {
        const finding = findings[f];
        const fIsLast = f === findings.length - 1;
        const fBullet = fIsLast ? "└─ " : "├─ ";
        const fPrefix = artPrefix + (isLast ? "    " : "│   ");
        const grades = (finding.sources || []).map(s => gradeLabel(s)).join(", ");
        const corr = finding.corroboration || "";
        console.log(`${fPrefix}${fBullet}${truncate(finding.claim, 70)} [${grades}] ${corr}`);

        for (let s = 0; s < (finding.sources || []).length; s++) {
          const src = finding.sources[s];
          const sIsLast = s === (finding.sources.length - 1);
          const sBullet = sIsLast ? "└─ " : "├─ ";
          const sPrefix = fPrefix + (fIsLast ? "    " : "│   ");
          const grade = gradeLabel(src);
          const url = src.source_url || src.url || "";
          const name = src.source_name || src.name || "unknown";
          console.log(`${sPrefix}${sBullet}${grade} ${name}: ${url}`);
        }
      }
    } else {
      const sizeKb = art.size_bytes ? Math.round(art.size_bytes / 1024) + "KB" : "?";
      const icon = art.artifact_type === "report" ? "📄" : art.artifact_type === "research" ? "🔍" : "📎";
      console.log(`${artPrefix}${bullet}${icon} ${art.filename} (${art.artifact_type}, ${sizeKb})`);
    }
  }
  console.log();
}
