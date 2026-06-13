/**
 * E2E-32: Model selection + structured output + concurrency validation
 *
 * Test A: Model used is not deepseek-chat or minimax (legacy bad defaults)
 * Test B: 3 concurrent requests produce distinct artifacts with unique run_ids
 * Test C: Researcher produces JSONL dataset under abstract brief (no tool names in prompt)
 *
 * Run:  bun test tests/e2e/e2e-32-model-and-output-validation.test.ts
 * Time: ~5-10 min (3 concurrent + 1 sequential researcher invocations)
 */
import { describe, it, expect, beforeAll } from "bun:test";
import {
  URLS,
  requireAgents,
  agentRun,
  agentInvoke,
  agentPollUntilDone,
  artifactSnapshot,
  artifactList,
  artifactContent,
  writeReport,
  resultsDir,
  timestamp,
  type RunResult,
  type AgentRunResult,
} from "./helpers";

const TIMEOUT = 600_000;

// --- Test A state ---
let resultA: AgentRunResult;

// --- Test B state ---
let runsActiveAfterDispatch: number;
let newArtifactsB: number;
let uniqueRunIds: number;
let unknownRunIds: number;

// --- Test C state ---
let resultC: AgentRunResult;
let datasetCountC: number;
let jsonlCountC: number;
let findingCountC: number;
let sourceCountC: number;

describe("E2E-32: Model + Output + Concurrency", () => {
  beforeAll(async () => {
    console.log("\n=== E2E-32: Model + Output + Concurrency Validation ===");
    await requireAgents([
      { name: "researcher", url: URLS.researcher },
    ]);
  }, 120_000);

  // === Test A: Model Selection ===
  describe("Test A: Model Selection", () => {
    beforeAll(async () => {
      console.log("\n--- Test A: Model Selection ---");
      resultA = await agentRun(
        URLS.researcher,
        "List 2 popular AI tools and their pricing. Record each as a finding and publish as JSONL.",
        TIMEOUT,
      );
      console.log(`  State: ${resultA.result.state} | Model: ${resultA.result.model}`);
    }, TIMEOUT + 10_000);

    it("completes successfully", () => {
      expect(resultA.result.state).toBe("completed");
    });

    it("does not use deepseek-chat", () => {
      expect(resultA.result.model).not.toBe("deepseek-chat");
    });

    it("does not use minimax", () => {
      expect(resultA.result.model.toLowerCase()).not.toContain("minimax");
    });
  });

  // === Test B: Concurrency ===
  describe("Test B: Concurrency", () => {
    beforeAll(async () => {
      console.log("\n--- Test B: Concurrency ---");
      const snapBefore = await artifactSnapshot();

      const runIds = await Promise.all([
        agentInvoke(URLS.researcher, "Find 1 popular Python library for web scraping. Record as finding, publish as JSONL."),
        agentInvoke(URLS.researcher, "Find 1 popular JavaScript framework for frontend. Record as finding, publish as JSONL."),
        agentInvoke(URLS.researcher, "Find 1 popular database for analytics. Record as finding, publish as JSONL."),
      ]);
      console.log(`  Dispatched: ${runIds.join(", ")}`);

      await Bun.sleep(2_000);
      const healthResp = await fetch(`${URLS.researcher}/health`);
      const health = (await healthResp.json()) as { runs_active: number };
      runsActiveAfterDispatch = health.runs_active;
      console.log(`  runs_active after dispatch: ${runsActiveAfterDispatch}`);

      await Promise.all(
        runIds.map(id => agentPollUntilDone(URLS.researcher, id, TIMEOUT)),
      );

      const snapAfter = await artifactSnapshot();
      newArtifactsB = snapAfter - snapBefore;

      const allArtifacts = await artifactList(`limit=${newArtifactsB + 10}`);
      const runIdSet = new Set(allArtifacts.map(a => a.run_id));
      uniqueRunIds = runIdSet.size;
      unknownRunIds = allArtifacts.filter(a => a.run_id === "unknown").length;

      console.log(`  New artifacts: ${newArtifactsB} | Unique run_ids: ${uniqueRunIds} | Unknown: ${unknownRunIds}`);
    }, TIMEOUT + 30_000);

    it("multiple runs active concurrently", () => {
      expect(runsActiveAfterDispatch).toBeGreaterThanOrEqual(2);
    });

    it(">= 3 new artifacts produced", () => {
      expect(newArtifactsB).toBeGreaterThanOrEqual(3);
    });

    it(">= 3 unique run_ids", () => {
      expect(uniqueRunIds).toBeGreaterThanOrEqual(3);
    });

    it("no unknown run_ids", () => {
      expect(unknownRunIds).toBe(0);
    });
  });

  // === Test C: Structured Output (Abstract Brief) ===
  describe("Test C: Structured Output (Abstract Brief)", () => {
    beforeAll(async () => {
      console.log("\n--- Test C: Structured Output (Abstract Brief) ---");
      const snapBefore = await artifactSnapshot();

      resultC = await agentRun(
        URLS.researcher,
        "Research the current state of faceless Instagram accounts in the tech niche. Find 3 accounts, their follower counts, content formats, and engagement patterns. I need verified data with source citations.",
        TIMEOUT,
      );

      console.log(`  State: ${resultC.result.state} | Model: ${resultC.result.model} | Turns: ${resultC.result.usage.turns}`);

      const snapAfter = await artifactSnapshot();
      const newCount = snapAfter - snapBefore;
      const allArtifacts = await artifactList(`limit=${newCount + 10}`);

      datasetCountC = allArtifacts.filter(a => a.artifact_type === "dataset").length;
      jsonlCountC = allArtifacts.filter(a => a.filename.endsWith(".jsonl")).length;

      console.log(`  New artifacts: ${newCount} | Datasets: ${datasetCountC} | JSONL: ${jsonlCountC}`);

      findingCountC = 0;
      sourceCountC = 0;

      const jsonlArtifact = allArtifacts.find(a => a.filename.endsWith(".jsonl"));
      if (jsonlArtifact) {
        const content = await artifactContent(jsonlArtifact.id);
        for (const line of content.split("\n")) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            if ("claim" in obj || "fact" in obj || "finding" in obj || "dimension" in obj || "evidence" in obj) findingCountC++;
            if ("sources" in obj) sourceCountC++;
          } catch { /* skip */ }
        }
        console.log(`  Findings: ${findingCountC} | With sources: ${sourceCountC}`);
      }
    }, TIMEOUT + 10_000);

    it("completes successfully", () => {
      expect(resultC.result.state).toBe("completed");
    });

    it("produced dataset artifact", () => {
      expect(datasetCountC).toBeGreaterThanOrEqual(1);
    });

    it("produced JSONL file", () => {
      expect(jsonlCountC).toBeGreaterThanOrEqual(1);
    });

    it("JSONL has structured findings", () => {
      expect(findingCountC).toBeGreaterThanOrEqual(1);
    });

    it("findings have sources", () => {
      expect(sourceCountC).toBeGreaterThanOrEqual(1);
    });
  });

  // === Report ===
  it("generates report", async () => {
    const dir = resultsDir();
    const path = `${dir}/e2e-32-${timestamp()}.md`;
    await writeReport(path, `# E2E-32: Model + Output + Concurrency Validation

**Date:** ${new Date().toISOString()}

## Test A: Model Selection
- Model: ${resultA?.result?.model ?? "unknown"}

## Test B: Concurrency
- Runs active: ${runsActiveAfterDispatch ?? 0}
- New artifacts: ${newArtifactsB ?? 0}
- Unique run_ids: ${uniqueRunIds ?? 0}
- Unknown run_ids: ${unknownRunIds ?? 0}

## Test C: Structured Output
- Model: ${resultC?.result?.model ?? "unknown"}
- Turns: ${resultC?.result?.usage?.turns ?? 0}
- Datasets: ${datasetCountC ?? 0}
- JSONL: ${jsonlCountC ?? 0}
- Findings: ${findingCountC ?? 0}
`);
    const written = await Bun.file(path).text();
    expect(written).toContain("E2E-32");
  });
});
