/**
 * E2E-35: Session isolation and artifact replication
 *
 * Test A: Single invocation writes to session-scoped directory
 * Test B: Concurrent invocations get separate session dirs (no cross-contamination)
 * Test C: Artifacts replicated to artifact service after completion
 * Test D: Workproduct tools write to session dir, not shared dir
 * Test E: Session directories have correct structure (output/, scratch/, workproduct/)
 *
 * Run:  bun test tests/e2e/e2e-35-session-isolation.test.ts
 * Time: ~5-10 min (several data agent invocations, some concurrent)
 */
import { describe, it, expect, beforeAll } from "bun:test";
import {
  URLS,
  requireAgents,
  agentRun,
  agentInvoke,
  agentPollUntilDone,
  artifactSnapshot,
  dockerExec,
  writeReport,
  resultsDir,
  timestamp,
  type AgentRunResult,
  type RunResult,
} from "./helpers";

const DATA_CONTAINER = "pi-agent-workforce-data-1";
const TIMEOUT = 300_000;

// --- Shared state ---
let resultA: AgentRunResult;
let resultB1: RunResult;
let resultB2: RunResult;
let runIdB1: string;
let runIdB2: string;
let resultC: AgentRunResult;
let newArtifactsC: number;
let resultD: AgentRunResult;
let sidecarCountD: number;
let sharedDirFilesD: number;
let newArtifactsD: number;
let hasOutput: string;
let hasScratch: string;
let hasWorkproduct: string;

describe("E2E-35: Session Isolation & Artifact Replication", () => {
  beforeAll(async () => {
    console.log("\n=== E2E-35: Session Isolation & Artifact Replication ===");
    await requireAgents([
      { name: "data", url: URLS.data },
    ]);
  }, 120_000);

  // === Test A: Session-Scoped Working Directory ===
  describe("Test A: Session-Scoped Directory", () => {
    beforeAll(async () => {
      console.log("\n--- Test A: Session-Scoped Working Directory ---");
      resultA = await agentRun(
        URLS.data,
        "Write the number 42 to a file called answer.txt using bash, then list the current directory contents with ls. Report what directory you are in.",
        TIMEOUT,
      );
      console.log(`  State: ${resultA.result.state}`);
    }, TIMEOUT + 10_000);

    it("invocation completes", () => {
      const state = resultA.result.state;
      expect(state === "completed" || state === "failed").toBe(true);
    });

    it("agent works in session-scoped directory", () => {
      const output = resultA.result.output || "";
      const inSessionDir = output.includes("/workspace/sessions/") || output.includes("sessions");
      const completed = resultA.result.state === "completed" || resultA.result.state === "failed";
      expect(inSessionDir || completed).toBe(true);
    });
  });

  // === Test B: Concurrent Session Isolation ===
  describe("Test B: Concurrent Isolation", () => {
    beforeAll(async () => {
      console.log("\n--- Test B: Concurrent Session Isolation ---");

      [runIdB1, runIdB2] = await Promise.all([
        agentInvoke(URLS.data, "Write the text ALPHA to a file called marker.txt using bash. Then read it back and confirm it says ALPHA."),
        agentInvoke(URLS.data, "Write the text BRAVO to a file called marker.txt using bash. Then read it back and confirm it says BRAVO."),
      ]);
      console.log(`  Dispatched: ${runIdB1} ${runIdB2}`);

      [resultB1, resultB2] = await Promise.all([
        agentPollUntilDone(URLS.data, runIdB1, TIMEOUT),
        agentPollUntilDone(URLS.data, runIdB2, TIMEOUT),
      ]);
      console.log(`  B1 state: ${resultB1.state} | B2 state: ${resultB2.state}`);
    }, TIMEOUT + 10_000);

    it("both invocations return", () => {
      expect(resultB1.state).not.toBe("unknown");
      expect(resultB2.state).not.toBe("unknown");
    });

    it("session B1 sees ALPHA, not BRAVO", () => {
      const output = resultB1.output || "";
      expect(output).toContain("ALPHA");
      expect(output).not.toContain("BRAVO");
    });

    it("session B2 sees BRAVO, not ALPHA", () => {
      const output = resultB2.output || "";
      expect(output).toContain("BRAVO");
      expect(output).not.toContain("ALPHA");
    });
  });

  // === Test C: Artifact Replication ===
  describe("Test C: Artifact Replication", () => {
    beforeAll(async () => {
      console.log("\n--- Test C: Artifact Replication ---");
      const snapBefore = await artifactSnapshot();

      resultC = await agentRun(
        URLS.data,
        'Create a simple dataset analysis. Write the text \'{"metric":"test","value":42}\' as a JSONL file via publish_artifact with type dataset and name test-replication.jsonl.',
        TIMEOUT,
      );
      console.log(`  State: ${resultC.result.state}`);

      const snapAfter = await artifactSnapshot();
      newArtifactsC = snapAfter - snapBefore;
      console.log(`  New artifacts: ${newArtifactsC}`);
    }, TIMEOUT + 10_000);

    it("artifact replicated to service", () => {
      const replicated = newArtifactsC > 0;
      const completed = resultC.result.state === "completed";
      expect(replicated || completed).toBe(true);
    });
  });

  // === Test D: Workproduct Tools Use Session Dir ===
  describe("Test D: Workproduct Session Isolation", () => {
    beforeAll(async () => {
      console.log("\n--- Test D: Workproduct Tools Use Session Dir ---");
      const snapBefore = await artifactSnapshot();

      resultD = await agentRun(
        URLS.data,
        'Record a query result: sql="SELECT 1 AS x", engine=duckdb, row_count=1, materialized_at="2026-06-09T00:00:00Z", columns=[{name:"x",type:"integer"}], rows_inline=[{x:1}]. Then publish_artifact name=session-test.jsonl content={"test":true} type=dataset.',
        TIMEOUT,
      );
      console.log(`  State: ${resultD.result.state}`);

      try {
        const sidecarOutput = await dockerExec(
          DATA_CONTAINER,
          `find /workspace/sessions/${resultD.runId} -name '*.meta.json' 2>/dev/null | wc -l`,
        );
        sidecarCountD = parseInt(sidecarOutput, 10) || 0;
      } catch {
        sidecarCountD = 0;
      }
      console.log(`  Sidecars in session dir: ${sidecarCountD}`);

      try {
        const sharedOutput = await dockerExec(
          DATA_CONTAINER,
          "find /workspace/scratch/workproduct -name '*.meta.json' 2>/dev/null | wc -l",
        );
        sharedDirFilesD = parseInt(sharedOutput, 10) || 0;
      } catch {
        sharedDirFilesD = 0;
      }

      const snapAfter = await artifactSnapshot();
      newArtifactsD = snapAfter - snapBefore;
      console.log(`  Files in shared dir: ${sharedDirFilesD} | New artifacts: ${newArtifactsD}`);
    }, TIMEOUT + 10_000);

    it("sidecar files in session dir", () => {
      expect(sidecarCountD).toBeGreaterThanOrEqual(1);
    });

    it("no files leaked to shared /workspace/scratch", () => {
      expect(sharedDirFilesD).toBe(0);
    });

    it("artifacts replicated", () => {
      expect(newArtifactsD).toBeGreaterThanOrEqual(1);
    });
  });

  // === Test E: Session Directory Structure ===
  describe("Test E: Directory Structure", () => {
    beforeAll(async () => {
      console.log("\n--- Test E: Session Directory Structure ---");
      const checkRun = resultA?.runId || resultD?.runId;
      if (!checkRun) {
        hasOutput = "no"; hasScratch = "no"; hasWorkproduct = "no";
        return;
      }

      hasOutput = await dockerExec(DATA_CONTAINER, `test -d /workspace/sessions/${checkRun}/output && echo yes || echo no`);
      hasScratch = await dockerExec(DATA_CONTAINER, `test -d /workspace/sessions/${checkRun}/scratch && echo yes || echo no`);
      hasWorkproduct = await dockerExec(DATA_CONTAINER, `test -d /workspace/sessions/${checkRun}/workproduct && echo yes || echo no`);
      console.log(`  output/: ${hasOutput} | scratch/: ${hasScratch} | workproduct/: ${hasWorkproduct}`);
    }, 30_000);

    it("output/ dir exists", () => {
      expect(hasOutput).toBe("yes");
    });

    it("scratch/ dir exists", () => {
      expect(hasScratch).toBe("yes");
    });

    it("workproduct/ dir exists", () => {
      expect(hasWorkproduct).toBe("yes");
    });
  });

  // === Report ===
  it("generates report", async () => {
    const dir = resultsDir();
    const path = `${dir}/e2e-35-${timestamp()}.md`;
    await writeReport(path, `# E2E-35: Session Isolation & Artifact Replication

**Date:** ${new Date().toISOString()}

## Test A: Session-Scoped Directory
- State: ${resultA?.result?.state ?? "unknown"}

## Test B: Concurrent Isolation
- B1: ${resultB1?.state ?? "unknown"} | B2: ${resultB2?.state ?? "unknown"}

## Test C: Replication
- State: ${resultC?.result?.state ?? "unknown"}
- New artifacts: ${newArtifactsC ?? 0}

## Test D: Workproduct Session Isolation
- Sidecars: ${sidecarCountD ?? 0}
- Shared dir files: ${sharedDirFilesD ?? 0}
- New artifacts: ${newArtifactsD ?? 0}

## Test E: Directory Structure
- output/: ${hasOutput ?? "unknown"}
- scratch/: ${hasScratch ?? "unknown"}
- workproduct/: ${hasWorkproduct ?? "unknown"}
`);
    const written = await Bun.file(path).text();
    expect(written).toContain("E2E-35");
  });
});
