/**
 * E2E-56: QA Agent Pipeline Test
 *
 * Verifies the QA agent evaluates content and produces structured
 * violation/commendation JSONL workproduct when invoked via planner.
 *
 * Requires: all agents running (planner, writer, qa, artifact-service)
 * Duration: ~5-8 minutes
 */
import { describe, it, expect, beforeAll } from "bun:test";
import {
  URLS,
  requireAgents,
  plannerRun,
  artifactList,
  artifactContent,
  artifactsSince_time,
  waitForHealth,
} from "./helpers";

const TIMEOUT_MS = 600_000; // 10 min max

let runStart: string;
let plannerOutput: string;

describe("E2E-56: QA Agent Pipeline", () => {
  beforeAll(async () => {
    await requireAgents([
      { name: "planner", url: URLS.planner },
      { name: "writer",  url: URLS.writer },
      { name: "qa",      url: URLS.qa },
    ]);
  }, 120_000);

  it("QA agent is healthy", async () => {
    const health = await waitForHealth(URLS.qa);
    expect(health.status).toBe("ok");
  });

  it("QA agent describes itself with evaluation capabilities", async () => {
    const res = await fetch(`${URLS.qa}/describe`);
    expect(res.ok).toBe(true);
    const desc = await res.json() as { capabilities?: string };
    expect(desc.capabilities).toContain("quality evaluation");
  });

  it("planner delegates to QA for content evaluation", async () => {
    runStart = new Date().toISOString();

    const { result } = await plannerRun(
      "Write a short TikTok caption about the top 3 AI coding tools for beginners. " +
      "After the writer produces the caption, have the QA agent evaluate it against " +
      "content quality and platform compliance standards. " +
      "Return the QA verdict.",
      TIMEOUT_MS,
    );

    expect(result.state).toBe("completed");
    expect(result.output).toBeTruthy();
    plannerOutput = result.output;

    const outputLower = result.output.toLowerCase();
    expect(
      outputLower.includes("qa") || outputLower.includes("quality") || outputLower.includes("verdict"),
    ).toBe(true);
  }, TIMEOUT_MS);

  it("QA produced a dataset artifact (JSONL violations/commendations)", async () => {
    const allArtifacts = await artifactsSince_time(runStart);
    const qaDatasets = allArtifacts.filter(
      (a) => a.agent_name === "qa" && a.artifact_type === "dataset",
    );
    expect(qaDatasets.length).toBeGreaterThanOrEqual(1);

    const latest = qaDatasets[0];
    const content = await artifactContent(latest.id);
    expect(content).toBeTruthy();

    const lines = content.trim().split("\n").filter((l: string) => l.trim() && !l.trim().startsWith("#"));
    expect(lines.length).toBeGreaterThanOrEqual(1);

    let hasViolation = false;
    let hasCommendation = false;

    for (const line of lines) {
      let parsed: any;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue; // skip non-JSON lines
      }
      expect(parsed.type).toBeDefined();
      expect(["violation", "commendation"]).toContain(parsed.type);

      if (parsed.type === "violation") {
        hasViolation = true;
        expect(parsed.rule_id).toBeDefined();
        expect(parsed.severity).toBeDefined();
        expect(parsed.domain).toBeDefined();
        expect(parsed.evidence).toBeDefined();
        expect(parsed.recommendation).toBeDefined();
      }
      if (parsed.type === "commendation") {
        hasCommendation = true;
        expect(parsed.rule_id).toBeDefined();
        expect(parsed.domain).toBeDefined();
        expect(parsed.evidence).toBeDefined();
        expect(parsed.impact).toBeDefined();
      }
    }

    expect(hasViolation || hasCommendation).toBe(true);
  });

  it("QA verdict is a valid level", async () => {
    const allArtifacts = await artifactsSince_time(runStart);
    const qaReports = allArtifacts.filter(
      (a) => a.agent_name === "qa" && a.artifact_type === "report",
    );

    if (qaReports.length > 0) {
      const content = await artifactContent(qaReports[0].id);
      const contentLower = content.toLowerCase();
      const validVerdicts = ["exemplary", "good", "acceptable", "needs_revision", "needs_rework", "catastrophic"];
      const hasVerdict = validVerdicts.some(v => contentLower.includes(v));
      expect(hasVerdict).toBe(true);
    }
    // If no report artifact, the test passes — verdict may be in planner output
    if (qaReports.length === 0 && plannerOutput) {
      const outputLower = plannerOutput.toLowerCase();
      const validVerdicts = ["exemplary", "good", "acceptable", "needs_revision", "needs_rework", "catastrophic"];
      const hasVerdict = validVerdicts.some(v => outputLower.includes(v));
      expect(hasVerdict).toBe(true);
    }
  });

  it("QA artifacts have required metadata", async () => {
    const allArtifacts = await artifactsSince_time(runStart);
    const qaArtifacts = allArtifacts.filter((a) => a.agent_name === "qa");

    for (const artifact of qaArtifacts) {
      expect(artifact.agent_name).toBe("qa");
      expect(artifact.id).toBeDefined();
      expect(artifact.artifact_type).toBeDefined();
    }
  });
});
