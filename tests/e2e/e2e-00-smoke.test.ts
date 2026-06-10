/**
 * E2E-00: Smoke test — validates full pipeline + test infrastructure.
 * Sends a small-scope goal to planner, which delegates to researcher.
 * Verifies health, planner delegation, artifact scoping via `since`,
 * cross-agent artifact visibility, and report generation.
 *
 * Run:  bun test tests/e2e/e2e-00-smoke.test.ts
 * Time: ~2-5 min (planner + one researcher delegation)
 */
import { describe, it, expect, beforeAll } from "bun:test";
import {
  URLS,
  waitForHealth,
  requireAgents,
  plannerRun,
  artifactsSince_time,
  artifactContent,
  artifactFindingsCount,
  agentMetrics,
  writeReport,
  resultsDir,
  timestamp,
  type Artifact,
  type PlannerRunResult,
} from "./helpers";

let invokeTime: string;
let plannerResult: PlannerRunResult;
let artifacts: Artifact[];
let findingsCount: number;

const GOAL = "Research 3 key facts about the Eiffel Tower and produce a short summary report with source citations.";
const TIMEOUT = 600_000;

describe("E2E-00: Smoke — full pipeline wiring", () => {
  beforeAll(async () => {
    console.log("\n=== E2E-00: Smoke Test (Planner → Researcher → Writer) ===");

    await waitForHealth(URLS.planner);
    console.log("  Planner healthy.");
    await requireAgents();

    invokeTime = new Date().toISOString();
    console.log(`  invokeTime: ${invokeTime}`);
    plannerResult = await plannerRun(GOAL, TIMEOUT);

    const { result, durationSec } = plannerResult;
    console.log(`  Done: state=${result.state} turns=${result.usage.turns} duration=${durationSec}s`);

    artifacts = await artifactsSince_time(invokeTime);
    findingsCount = await artifactFindingsCount(artifacts);
    console.log(`  Artifacts since invoke: ${artifacts.length}`);
    console.log(`  Findings: ${findingsCount}`);
    artifacts.forEach(a =>
      console.log(`    ${a.agent_name.padEnd(12)} ${a.artifact_type.padEnd(10)} ${a.id.slice(0, 12)}...`),
    );
  }, TIMEOUT + 30_000);

  it("planner completes", () => {
    expect(plannerResult.result.state).toBe("completed");
  });

  it("finishes under 10 minutes", () => {
    expect(plannerResult.durationSec).toBeLessThanOrEqual(600);
  });

  it("since filter finds cross-agent artifacts", () => {
    expect(artifacts.length).toBeGreaterThanOrEqual(1);
  });

  it("at least one artifact from a subagent (not planner)", () => {
    const subagentArts = artifacts.filter(a => a.agent_name !== "planner");
    expect(subagentArts.length).toBeGreaterThanOrEqual(1);
  });

  it("findings count > 0", () => {
    expect(findingsCount).toBeGreaterThanOrEqual(1);
  });

  it("artifact content is readable", async () => {
    const ds = artifacts.find(a => a.artifact_type === "dataset");
    if (!ds) return;
    const content = await artifactContent(ds.id);
    expect(content.length).toBeGreaterThan(10);
  });

  it("metrics endpoint works", async () => {
    const m = await agentMetrics(URLS.researcher);
    expect(m.runs_completed).toBeGreaterThanOrEqual(1);
  });

  it("report generation works", async () => {
    const dir = resultsDir();
    const path = `${dir}/e2e-00-smoke-${timestamp()}.md`;
    await writeReport(path, `# Smoke Test\n\nArtifacts: ${artifacts.length}\nFindings: ${findingsCount}\nDuration: ${plannerResult.durationSec}s\n`);
    const written = await Bun.file(path).text();
    expect(written).toContain("Smoke Test");
  });
});
