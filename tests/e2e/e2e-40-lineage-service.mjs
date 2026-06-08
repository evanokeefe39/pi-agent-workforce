#!/usr/bin/env node
// E2E-40: Artifact lineage service validation
//
// Tests lineage capture, query API, and graph endpoints.
// Requires: artifact service running on :8090 with lineage tables.
//
// Usage:
//   node tests/e2e/e2e-40-lineage-service.mjs
//   node tests/e2e/e2e-40-lineage-service.mjs --latest   (use latest run_id)

const BASE = process.env.ARTIFACT_URL || "http://localhost:8090";
const AGENT = "e2e-test";
const RUN_ID = `e2e-lineage-${Date.now()}`;

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.log(`  FAIL  ${label}`);
    failed++;
  }
}

async function post(path, body) {
  const resp = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "x-agent-name": AGENT, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: resp.status, data: await resp.json() };
}

async function get(path) {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { "x-agent-name": AGENT },
  });
  return { status: resp.status, data: await resp.json() };
}

function b64(str) {
  return Buffer.from(str).toString("base64");
}

async function main() {
  console.log(`\n=== E2E-40: Lineage Service ===`);
  console.log(`  artifact service: ${BASE}`);
  console.log(`  run_id: ${RUN_ID}\n`);

  // Check health first
  const health = await get("/health");
  assert(health.status === 200 && health.data.status === "ok", "health check");

  // --- Phase 1: Write artifacts with lineage ---

  console.log("\n--- 1. Write source artifact (no inputs) ---");
  const src = await post("/artifacts", {
    filename: "raw-data.json",
    content: b64(JSON.stringify({ source: "test", items: [1, 2, 3], run: RUN_ID })),
    type: "dataset",
    run_id: RUN_ID,
    metadata: { lineage: { inputs: [], method: "collection" } },
  });
  assert(src.status === 201 || (src.status === 200 && src.data.id), "source artifact created");
  const srcId = src.data.id;
  console.log(`  source id: ${srcId}${src.data.deduplicated ? " (dedup)" : ""}`);

  console.log("\n--- 2. Write findings artifact (derived from source) ---");
  const findings = await post("/artifacts", {
    filename: "findings.jsonl",
    content: b64(JSON.stringify({ finding: "test result", grade: "B2", run: RUN_ID }) + "\n"),
    type: "research",
    run_id: RUN_ID,
    metadata: { lineage: { inputs: [srcId], method: "collection" } },
  });
  assert(findings.status === 201 || (findings.status === 200 && findings.data.id), "findings artifact created");
  const findingsId = findings.data.id;
  console.log(`  findings id: ${findingsId}${findings.data.deduplicated ? " (dedup)" : ""}`);

  console.log("\n--- 3. Write report artifact (derived from source + findings) ---");
  const report = await post("/artifacts", {
    filename: "report.md",
    content: b64(`# Test Report\n\nBased on findings.\nRun: ${RUN_ID}\n`),
    type: "report",
    run_id: RUN_ID,
    metadata: { lineage: { inputs: [srcId, findingsId], method: "synthesis" } },
  });
  assert(report.status === 201 || (report.status === 200 && report.data.id), "report artifact created");
  const reportId = report.data.id;
  console.log(`  report id: ${reportId}${report.data.deduplicated ? " (dedup)" : ""}`);

  // --- Phase 2: Query lineage ---

  console.log("\n--- 4. GET /lineage/:id (ancestors of report) ---");
  const lineage = await get(`/lineage/${reportId}?depth=5&direction=ancestors`);
  assert(lineage.status === 200, "lineage query succeeds");
  assert(lineage.data.root === reportId, "root is report");
  const ancestorIds = lineage.data.ancestors.map(a => a.id);
  assert(ancestorIds.includes(srcId), "source is ancestor of report");
  assert(ancestorIds.includes(findingsId), "findings is ancestor of report");
  console.log(`  ancestors: ${lineage.data.ancestors.length}`);

  console.log("\n--- 5. GET /lineage/:id (descendants of source) ---");
  const desc = await get(`/lineage/${srcId}?depth=5&direction=descendants`);
  assert(desc.status === 200, "descendant query succeeds");
  const descIds = desc.data.descendants.map(d => d.id);
  assert(descIds.includes(findingsId), "findings is descendant of source");
  assert(descIds.includes(reportId), "report is descendant of source");

  console.log("\n--- 6. GET /lineage/graph?run_id ---");
  const graph = await get(`/lineage/graph?run_id=${RUN_ID}`);
  assert(graph.status === 200, "graph query succeeds");
  assert(graph.data.nodes.length === 3, `graph has 3 nodes (got ${graph.data.nodes.length})`);
  assert(graph.data.edges.length >= 3, `graph has >= 3 edges (got ${graph.data.edges.length})`);

  // Check edge types
  const edgeTypes = graph.data.edges.map(e => e.type);
  console.log(`  edge types: ${[...new Set(edgeTypes)].join(", ")}`);
  assert(edgeTypes.includes("derived_from") || edgeTypes.includes("informed_by"), "edges have lineage types");

  console.log("\n--- 7. GET /lineage/graph?format=prov-json ---");
  const prov = await get(`/lineage/graph?run_id=${RUN_ID}&format=prov-json`);
  assert(prov.status === 200, "PROV-JSON query succeeds");
  assert(prov.data.entity !== undefined, "PROV-JSON has entities");
  assert(prov.data.agent !== undefined, "PROV-JSON has agents");
  assert(prov.data.wasDerivedFrom !== undefined || prov.data.wasInformedBy !== undefined, "PROV-JSON has derivation relations");
  console.log(`  entities: ${Object.keys(prov.data.entity).length}`);

  console.log("\n--- 8. GET /lineage/trace/:id ---");
  const trace = await get(`/lineage/trace/${reportId}?direction=sources`);
  assert(trace.status === 200, "trace query succeeds");
  assert(trace.data.root === reportId, "trace root is report");
  const tracedIds = trace.data.traced.map(t => t.id);
  assert(tracedIds.includes(srcId), "source in trace");
  assert(tracedIds.includes(findingsId), "findings in trace");
  console.log(`  traced ${trace.data.traced.length} sources`);

  console.log("\n--- 9. Edge type inference ---");
  // report derived_from dataset = derived_from
  const reportEdges = graph.data.edges.filter(e => e.target === reportId && e.source === srcId);
  if (reportEdges.length > 0) {
    assert(reportEdges[0].type === "derived_from", `report←dataset edge is derived_from (got ${reportEdges[0].type})`);
  } else {
    assert(false, "report←dataset edge exists");
  }

  // --- Use --latest to test with real pipeline data ---
  if (process.argv.includes("--latest")) {
    console.log("\n--- 10. Latest run lineage ---");
    const allArtifacts = await get("/artifacts");
    const runs = [...new Set(allArtifacts.data.filter(a => a.run_id).map(a => a.run_id))];
    if (runs.length > 0) {
      const latestRun = runs[0];
      console.log(`  latest run: ${latestRun}`);
      const latestGraph = await get(`/lineage/graph?run_id=${latestRun}`);
      console.log(`  nodes: ${latestGraph.data.nodes.length}, edges: ${latestGraph.data.edges.length}`);
      assert(latestGraph.status === 200, "latest run graph loads");
    } else {
      console.log("  no runs with artifacts found");
    }
  }

  // --- Summary ---
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("E2E-40 failed:", err.message);
  process.exit(1);
});
