#!/usr/bin/env node
// Artifact lineage → interactive HTML graph report.
//
// Usage:
//   node artifact-lineage-html.mjs <planner-trace-id> [output.html]
//   node artifact-lineage-html.mjs --latest [output.html]

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

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
    try { const o = JSON.parse(line); if (o.event) entries.push(o); } catch {}
  }
  return entries;
}

function findPlannerSession(traceId) {
  const logs = parseLogLines(containerLogs("pi-agent-workforce-planner-1"));
  const session = logs.find(e => e.event === "session_created" && e.request_id === traceId);
  const complete = logs.find(e => e.event === "request_complete" && e.request_id === traceId);
  return {
    traceId, sessionId: session?.session_id || null,
    duration: complete?.duration_ms || null, turns: complete?.usage?.turns || null,
    model: complete?.usage?.model || null, status: complete ? "completed" : "unknown",
  };
}

function findLatestPlannerTrace() {
  const logs = parseLogLines(containerLogs("pi-agent-workforce-planner-1"));
  const accepts = logs.filter(e => e.event === "request_accepted");
  if (!accepts.length) throw new Error("No planner runs found");
  return accepts[accepts.length - 1].request_id;
}

function findCorrelatedRuns(plannerSessionId) {
  const containers = [
    ["pi-agent-workforce-researcher-1", "researcher"],
    ["pi-agent-workforce-data-1", "data"],
    ["pi-agent-workforce-writer-1", "writer"],
  ];
  const runs = [];
  for (const [container, agentName] of containers) {
    const logs = parseLogLines(containerLogs(container));
    for (const entry of logs) {
      if (entry.event === "request_accepted" && entry.correlation_id === plannerSessionId) {
        const tid = entry.request_id;
        const complete = logs.find(e => e.event === "request_complete" && e.request_id === tid);
        const sess = logs.find(e => e.event === "session_created" && e.request_id === tid);
        runs.push({
          agent: agentName, traceId: tid, runId: sess?.session_id || null,
          duration: complete?.duration_ms || null, turns: complete?.usage?.turns || null,
          model: complete?.usage?.model || null, status: complete ? "completed" : "unknown",
        });
      }
    }
  }
  return runs;
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
    try { const o = JSON.parse(line); if ("claim" in o) findings.push(o); } catch {}
  }
  return findings;
}

function gradeLabel(s) {
  return `${s.source_reliability || s.reliability || "?"}${s.information_credibility || s.credibility || "?"}`;
}

function gradeColor(grade) {
  const r = grade[0];
  if (r === "A") return "#22c55e";
  if (r === "B") return "#3b82f6";
  if (r === "C") return "#f59e0b";
  if (r === "D") return "#ef4444";
  return "#6b7280";
}

function corrColor(corr) {
  if (corr === "confirmed") return "#22c55e";
  if (corr === "probable") return "#3b82f6";
  if (corr === "uncorroborated") return "#f59e0b";
  return "#6b7280";
}

function esc(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// --- Collect data ---

const arg = process.argv[2];
if (!arg) { console.error("Usage: node artifact-lineage-html.mjs <trace-id> | --latest [output.html]"); process.exit(1); }

const outFile = process.argv[3] || "tests/results/lineage.html";
const traceId = arg === "--latest" ? findLatestPlannerTrace() : arg;
const planner = findPlannerSession(traceId);
const workerRuns = findCorrelatedRuns(planner.sessionId);

const graphData = { nodes: [], edges: [] };
let nodeId = 0;

const plannerId = nodeId++;
graphData.nodes.push({
  id: plannerId, type: "planner", label: "Planner",
  detail: `${planner.model || "?"} · ${planner.turns || "?"} turns · ${planner.duration ? Math.round(planner.duration / 1000) + "s" : "?"}`,
});

const allFindings = [];
const allSources = [];
const allArtifacts = [];

for (const run of workerRuns) {
  const agentId = nodeId++;
  const durStr = run.duration ? Math.round(run.duration / 1000) + "s" : "?";
  graphData.nodes.push({
    id: agentId, type: "agent", agent: run.agent, label: `${run.agent}`,
    detail: `${run.model || "?"} · ${run.turns || "?"} turns · ${durStr}`,
  });
  graphData.edges.push({ from: plannerId, to: agentId, label: "delegates" });

  const artifacts = await getArtifactsForRun(run.runId);
  for (const art of artifacts) {
    const artId = nodeId++;
    const sizeKb = art.size_bytes ? Math.round(art.size_bytes / 1024) + "KB" : "?";
    graphData.nodes.push({
      id: artId, type: "artifact", artifactType: art.artifact_type,
      label: art.filename, detail: `${art.artifact_type} · ${sizeKb}`,
    });
    graphData.edges.push({ from: agentId, to: artId, label: "produces" });
    allArtifacts.push({ ...art, nodeId: artId });

    if (art.artifact_type === "dataset" && art.filename.endsWith(".jsonl")) {
      const findings = await parseFindings(art.id);
      for (const f of findings) {
        const fId = nodeId++;
        const grades = (f.sources || []).map(s => gradeLabel(s)).join(", ");
        graphData.nodes.push({
          id: fId, type: "finding", label: f.claim.slice(0, 60) + (f.claim.length > 60 ? "..." : ""),
          detail: `[${grades}] ${f.corroboration || ""}`, claim: f.claim,
          corroboration: f.corroboration || "", grades,
        });
        graphData.edges.push({ from: artId, to: fId, label: "contains" });
        allFindings.push({ ...f, nodeId: fId });

        for (const src of (f.sources || [])) {
          const grade = gradeLabel(src);
          const srcKey = src.source_url || src.url || src.source_name || "";
          let existing = allSources.find(s => s.key === srcKey);
          if (!existing) {
            const sId = nodeId++;
            existing = { key: srcKey, nodeId: sId, name: src.source_name || src.name || "?", url: srcKey, grades: [] };
            allSources.push(existing);
            graphData.nodes.push({
              id: sId, type: "source", label: existing.name,
              detail: existing.url, url: existing.url,
            });
          }
          existing.grades.push(grade);
          graphData.edges.push({ from: fId, to: existing.nodeId, label: grade });
        }
      }
    }
  }
}

// --- Generate HTML ---

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Lineage: ${esc(traceId.slice(0, 12))}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
  #graph { width: 100%; height: 70vh; border-bottom: 1px solid #334155; }
  #detail { padding: 20px; max-height: 30vh; overflow-y: auto; }
  #detail h2 { font-size: 14px; color: #94a3b8; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
  #detail .claim { font-size: 15px; line-height: 1.5; margin-bottom: 12px; }
  #detail .meta { font-size: 13px; color: #94a3b8; }
  #detail .source-list { margin-top: 8px; }
  #detail .source-item { margin: 4px 0; font-size: 13px; }
  #detail .source-item a { color: #60a5fa; text-decoration: none; }
  #detail .source-item a:hover { text-decoration: underline; }
  .grade { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 11px; font-weight: 600; color: #fff; }
  .corr { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 11px; font-weight: 500; margin-left: 4px; }
  #header { padding: 12px 20px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; gap: 20px; align-items: center; }
  #header h1 { font-size: 16px; font-weight: 600; }
  #header .stat { font-size: 13px; color: #94a3b8; }
  .legend { display: flex; gap: 12px; margin-left: auto; font-size: 12px; }
  .legend-item { display: flex; align-items: center; gap: 4px; }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
</style>
</head>
<body>

<div id="header">
  <h1>Artifact Lineage</h1>
  <span class="stat">Planner: ${esc(planner.model || "?")} · ${planner.turns || "?"} turns · ${planner.duration ? Math.round(planner.duration / 1000) + "s" : "?"}</span>
  <span class="stat">${allFindings.length} findings · ${allSources.length} sources · ${allArtifacts.length} artifacts</span>
  <div class="legend">
    <div class="legend-item"><div class="legend-dot" style="background:#a78bfa"></div>Planner</div>
    <div class="legend-item"><div class="legend-dot" style="background:#38bdf8"></div>Agent</div>
    <div class="legend-item"><div class="legend-dot" style="background:#34d399"></div>Artifact</div>
    <div class="legend-item"><div class="legend-dot" style="background:#fbbf24"></div>Finding</div>
    <div class="legend-item"><div class="legend-dot" style="background:#f87171"></div>Source</div>
  </div>
</div>

<div id="graph"></div>
<div id="detail">
  <h2>Click a node to inspect</h2>
</div>

<script src="https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js"></script>
<script>
const graphData = ${JSON.stringify(graphData)};

const colorMap = {
  planner: { bg: "#7c3aed", border: "#a78bfa", font: "#fff" },
  agent: { bg: "#0284c7", border: "#38bdf8", font: "#fff" },
  artifact: { bg: "#059669", border: "#34d399", font: "#fff" },
  finding: { bg: "#d97706", border: "#fbbf24", font: "#fff" },
  source: { bg: "#dc2626", border: "#f87171", font: "#fff" },
};

const shapeMap = {
  planner: "diamond",
  agent: "box",
  artifact: "box",
  finding: "dot",
  source: "triangle",
};

const nodes = new vis.DataSet(graphData.nodes.map(n => {
  const c = colorMap[n.type] || colorMap.artifact;
  return {
    id: n.id,
    label: n.label,
    title: n.detail || "",
    shape: shapeMap[n.type] || "dot",
    color: { background: c.bg, border: c.border, highlight: { background: c.border, border: "#fff" } },
    font: { color: c.font, size: n.type === "finding" ? 10 : n.type === "source" ? 10 : 13 },
    size: n.type === "planner" ? 30 : n.type === "agent" ? 25 : n.type === "artifact" ? 20 : n.type === "finding" ? 12 : 10,
    _data: n,
  };
}));

const edges = new vis.DataSet(graphData.edges.map((e, i) => ({
  id: i,
  from: e.from,
  to: e.to,
  label: e.label || "",
  font: { size: 9, color: "#64748b", strokeWidth: 0 },
  arrows: "to",
  color: { color: "#475569", highlight: "#94a3b8" },
  smooth: { type: "cubicBezier", roundness: 0.3 },
})));

const container = document.getElementById("graph");
const network = new vis.Network(container, { nodes, edges }, {
  layout: {
    hierarchical: {
      direction: "LR",
      sortMethod: "directed",
      levelSeparation: 200,
      nodeSpacing: 80,
      treeSpacing: 100,
    },
  },
  physics: false,
  interaction: { hover: true, tooltipDelay: 100 },
  edges: { width: 1.5 },
});

const detailEl = document.getElementById("detail");

function gradeHtml(grade) {
  const r = grade[0];
  const colors = { A: "#22c55e", B: "#3b82f6", C: "#f59e0b", D: "#ef4444", E: "#6b7280", F: "#6b7280" };
  return '<span class="grade" style="background:' + (colors[r] || "#6b7280") + '">' + grade + '</span>';
}

function corrHtml(corr) {
  const colors = { confirmed: "#22c55e", probable: "#3b82f6", uncorroborated: "#f59e0b" };
  return '<span class="corr" style="background:' + (colors[corr] || "#6b7280") + '">' + corr + '</span>';
}

network.on("click", function(params) {
  if (!params.nodes.length) return;
  const node = nodes.get(params.nodes[0]);
  const d = node._data;

  if (d.type === "finding") {
    const finding = ${JSON.stringify(allFindings)}.find(f => f.nodeId === d.id);
    if (!finding) return;
    let srcHtml = '<div class="source-list">';
    for (const s of (finding.sources || [])) {
      const g = (s.source_reliability || s.reliability || "?") + (s.information_credibility || s.credibility || "?");
      const url = s.source_url || s.url || "";
      const name = s.source_name || s.name || "?";
      srcHtml += '<div class="source-item">' + gradeHtml(g) + ' ' + name + (url ? ' — <a href="' + url + '" target="_blank">' + url + '</a>' : '') + '</div>';
    }
    srcHtml += '</div>';
    detailEl.innerHTML = '<h2>Finding</h2><div class="claim">' + d.claim + '</div><div class="meta">' + corrHtml(d.corroboration) + ' ' + d.grades + '</div>' + srcHtml;
  } else if (d.type === "source") {
    detailEl.innerHTML = '<h2>Source</h2><div class="claim">' + d.label + '</div><div class="meta"><a href="' + (d.url || "") + '" target="_blank" style="color:#60a5fa">' + (d.url || "") + '</a></div>';
  } else {
    detailEl.innerHTML = '<h2>' + d.type + '</h2><div class="claim">' + d.label + '</div><div class="meta">' + (d.detail || "") + '</div>';
  }
});
</script>
</body>
</html>`;

writeFileSync(outFile, html);
console.log(`Lineage report: ${outFile}`);
console.log(`Nodes: ${graphData.nodes.length}  Edges: ${graphData.edges.length}`);
console.log(`Findings: ${allFindings.length}  Sources: ${allSources.length}  Artifacts: ${allArtifacts.length}`);
