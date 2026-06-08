#!/usr/bin/env node
// Artifact service query helper for E2E tests.
// Uses same patterns as src/agents/extensions/artifacts/client.ts
//
// Usage:
//   node artifact-query.mjs findings_count [artifact_type=dataset]
//   node artifact-query.mjs findings_count_by_run <run_id>
//   node artifact-query.mjs report_content <run_id>

const BASE = process.env.ARTIFACT_URL || "http://localhost:8090";
const AGENT = "qa";

async function list(query = "limit=200") {
  const resp = await fetch(`${BASE}/artifacts?${query}`, {
    headers: { "x-agent-name": AGENT },
  });
  if (!resp.ok) throw new Error(`list failed: ${resp.status}`);
  return resp.json();
}

async function readContent(id) {
  const resp = await fetch(`${BASE}/artifacts/${id}`, {
    headers: { "x-agent-name": AGENT },
  });
  if (!resp.ok) return "";
  return resp.text();
}

async function countFindings(artifacts) {
  let total = 0;
  for (const art of artifacts) {
    if (art.artifact_type !== "dataset") continue;
    const content = await readContent(art.id);
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if ("claim" in obj) total++;
      } catch {}
    }
  }
  return total;
}

const [cmd, ...args] = process.argv.slice(2);

if (cmd === "findings_count") {
  const query = args[0] || "artifact_type=dataset&limit=200";
  const arts = await list(query);
  console.log(await countFindings(arts));
} else if (cmd === "findings_count_by_run") {
  const runId = args[0];
  if (!runId) { console.error("run_id required"); process.exit(1); }
  const arts = await list("limit=200");
  console.log(await countFindings(arts.filter(a => a.run_id === runId)));
} else if (cmd === "report_content") {
  const runId = args[0];
  if (!runId) { console.error("run_id required"); process.exit(1); }
  const arts = await list("limit=200");
  const report = arts.find(a => a.run_id === runId && a.artifact_type === "report")
    || arts.find(a => a.run_id === runId);
  if (report) console.log(await readContent(report.id));
} else {
  console.error("Commands: findings_count, findings_count_by_run, report_content");
  process.exit(1);
}
