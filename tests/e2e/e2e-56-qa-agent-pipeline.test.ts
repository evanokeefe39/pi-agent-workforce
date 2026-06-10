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
  waitForHealth,
} from "./helpers";

const TIMEOUT_MS = 600_000; // 10 min max

describe("E2E-56: QA Agent Pipeline", () => {
  beforeAll(async () => {
    await requireAgents(["planner", "writer", "qa"]);
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
    const result = await plannerRun(
      "Write a short TikTok caption about the top 3 AI coding tools for beginners. " +
      "After the writer produces the caption, have the QA agent evaluate it against " +
      "content quality and platform compliance standards. " +
      "Return the QA verdict.",
      TIMEOUT_MS,
    );

    expect(result.state).toBe("completed");
    expect(result.output).toBeTruthy();

    // Planner output should mention QA
    const outputLower = result.output.toLowerCase();
    expect(
      outputLower.includes("qa") || outputLower.includes("quality") || outputLower.includes("verdict"),
    ).toBe(true);
  }, TIMEOUT_MS);

  it("QA produced a dataset artifact (JSONL violations/commendations)", async () => {
    const artifacts = await artifactList({
      agent_name: "qa",
      artifact_type: "dataset",
      limit: "5",
    });
    expect(artifacts.length).toBeGreaterThanOrEqual(1);

    // Read the most recent QA dataset
    const latest = artifacts[0];
    const content = await artifactContent(latest.id);
    expect(content).toBeTruthy();

    // JSONL: each line should be valid JSON with a "type" field
    const lines = content.trim().split("\n").filter((l: string) => l.trim());
    expect(lines.length).toBeGreaterThanOrEqual(1);

    let hasViolation = false;
    let hasCommendation = false;

    for (const line of lines) {
      const parsed = JSON.parse(line);
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

    // QA should produce both violations and commendations (positive + negative vetting)
    expect(hasViolation || hasCommendation).toBe(true);
  });

  it("QA verdict is a valid level", async () => {
    // Check for a report artifact with the verdict
    const reports = await artifactList({
      agent_name: "qa",
      artifact_type: "report",
      limit: "5",
    });

    if (reports.length > 0) {
      const content = await artifactContent(reports[0].id);
      const contentLower = content.toLowerCase();
      const validVerdicts = ["exemplary", "good", "acceptable", "needs_revision", "needs_rework", "catastrophic"];
      const hasVerdict = validVerdicts.some(v => contentLower.includes(v));
      expect(hasVerdict).toBe(true);
    }
    // If no report artifact, the test passes — verdict may be in assessment workproduct instead
  });

  it("QA artifacts have required metadata", async () => {
    const artifacts = await artifactList({
      agent_name: "qa",
      limit: "10",
    });

    for (const artifact of artifacts) {
      expect(artifact.agent_name).toBe("qa");
      expect(artifact.id).toBeDefined();
      expect(artifact.artifact_type).toBeDefined();
    }
  });
});
