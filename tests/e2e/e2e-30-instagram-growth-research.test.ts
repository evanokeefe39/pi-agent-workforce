/**
 * E2E-30: Instagram Growth Strategy Research (via Planner)
 *
 * Sends goal to planner, which decomposes → delegates to researcher + writer →
 * manages quality. Validates artifacts, findings, report quality.
 *
 * Run:
 *   bun test tests/e2e/e2e-30-instagram-growth-research.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  URLS,
  requireAgents,
  waitForHealth,
  plannerRun,
  artifactsSince_time,
  artifactContent,
  artifactFindingsCount,
  agentMetrics,
  dockerLogs,
  countInLogs,
  writeReport,
  resultsDir,
  timestamp,
  type Artifact,
  type RunResult,
  type PlannerRunResult,
} from "./helpers";

// --- Test-level state ---

let plannerResult: PlannerRunResult;
let runArtifacts: Artifact[];
let totalFindings: number;
let finalReportContent: string;
let reportWordCount: number;
let reportSectionCount: number;
let reportCitationCount: number;

// Researcher container log metrics
let researcherLogs: string;
let rWebSearches: number;
let rScrapes: number;
let rFindingsRecorded: number;
let rArtifactsWritten: number;
let rDeepResearch: number;

// Agent completion metrics
let rCompleted: number;
let wCompleted: number;

const GOAL = `I want to grow a new Instagram account from 0 to 10,000 followers using faceless content. My niche is tech, AI, vibe coding, social media growth, software development, creative software development, and adjacent trends (tech layoffs, data center controversies, tech sovereignty, global mobility, lifestyle, opinion, tech culture, terminally online culture).

Produce a comprehensive, actionable research report I can execute on immediately. I need to understand what works, what does not, who is succeeding, and what strategy I should follow. The report should include source citations and confidence levels so I can fact-check the findings.`;

const TWENTY_MINUTES_MS = 20 * 60 * 1000;
const THIRTY_MINUTES_MS = 30 * 60 * 1000;

describe("E2E-30: Instagram Growth Strategy Research (Planner)", () => {
  beforeAll(async () => {
    console.log("\n=== E2E-30: Instagram Growth Strategy Research (Planner) ===");

    // Health gate — planner + all workers
    await waitForHealth(URLS.planner);
    console.log("  Planner healthy.");
    await requireAgents();

    // --- Run the planner ---
    console.log("\n--- Sending goal to planner ---");
    const invokeTime = new Date().toISOString();
    plannerResult = await plannerRun(GOAL, THIRTY_MINUTES_MS);

    const { runId, result, durationSec } = plannerResult;
    console.log(`  Total duration: ${durationSec}s`);
    console.log(`  Planner state: ${result.state}`);
    console.log(`  Planner model: ${result.model}`);
    console.log(`  Planner turns: ${result.usage.turns} (${result.usage.input} in / ${result.usage.output} out)`);

    // --- Fetch time-scoped artifacts (captures planner + all subagent artifacts) ---
    console.log("\n--- Analyzing Results ---");
    runArtifacts = await artifactsSince_time(invokeTime);
    totalFindings = await artifactFindingsCount(runArtifacts);

    // --- Find and analyze report ---
    const writerReport = runArtifacts.find(
      (a) => a.agent_name === "writer" && a.artifact_type === "report",
    );
    const anyReport = writerReport || runArtifacts.find((a) => a.artifact_type === "report");

    if (anyReport) {
      finalReportContent = await artifactContent(anyReport.id);
      reportWordCount = finalReportContent.split(/\s+/).filter(Boolean).length;
      reportSectionCount = (finalReportContent.match(/^##\s/gm) || []).length;
      reportCitationCount = (finalReportContent.match(/https?:\/\/[^\s)]+/g) || []).length;
    } else {
      finalReportContent = "";
      reportWordCount = 0;
      reportSectionCount = 0;
      reportCitationCount = 0;
    }

    // --- Container logs ---
    researcherLogs = await dockerLogs("pi-agent-workforce-researcher-1");
    rWebSearches = countInLogs(researcherLogs, /web_search/g);
    rScrapes = countInLogs(researcherLogs, /scrape_apify/g);
    rFindingsRecorded = countInLogs(researcherLogs, /record_finding/g);
    rArtifactsWritten = countInLogs(researcherLogs, /publish_artifact/g);
    rDeepResearch = countInLogs(researcherLogs, /deep_research/g);

    // --- Agent metrics ---
    try {
      const rMetrics = await agentMetrics(URLS.researcher);
      rCompleted = rMetrics.runs_completed;
    } catch {
      rCompleted = 0;
    }
    try {
      const wMetrics = await agentMetrics(URLS.writer);
      wCompleted = wMetrics.runs_completed;
    } catch {
      wCompleted = 0;
    }

    // --- Print play-by-play ---
    const byType = (type: string) => runArtifacts.filter((a) => a.artifact_type === type).length;
    const byAgent = (name: string) => runArtifacts.filter((a) => a.agent_name === name).length;

    console.log("\n  === PLAY-BY-PLAY ===");
    console.log(`  Planner: ${result.usage.turns} turns, model=${result.model}, state=${result.state}`);
    console.log(`  Duration: ${durationSec}s`);
    console.log("\n  Researcher Activity (container logs):");
    console.log(`    web_search: ${rWebSearches}`);
    console.log(`    scrape_apify: ${rScrapes}`);
    console.log(`    deep_research: ${rDeepResearch}`);
    console.log(`    record_finding: ${rFindingsRecorded}`);
    console.log(`    publish_artifact: ${rArtifactsWritten}`);
    console.log(`\n  Agent completions: researcher=${rCompleted}, writer=${wCompleted}`);
    console.log(`\n  Artifacts: ${runArtifacts.length} total (run-scoped)`);
    console.log(`    Research: ${byType("research")} | Dataset: ${byType("dataset")} | Report: ${byType("report")} | Brief: ${byType("brief")}`);
    console.log(`    By researcher: ${byAgent("researcher")} | By writer: ${byAgent("writer")}`);
    console.log(`    Structured findings: ${totalFindings}`);

    if (anyReport) {
      console.log("\n  Report Stats:");
      console.log(`    Words: ${reportWordCount}`);
      console.log(`    Sections (##): ${reportSectionCount}`);
      console.log(`    URL citations: ${reportCitationCount}`);
    }

    // --- Source analysis (run-scoped datasets only) ---
    const datasets = runArtifacts.filter((a) => a.artifact_type === "dataset");
    let allFindingsContent = "";
    for (const ds of datasets) {
      allFindingsContent += await artifactContent(ds.id) + "\n";
    }
    const sourceUrls = (allFindingsContent.match(/"url"\s*:\s*"https?:\/\/[^"]+/g) || []).length;
    const uniqueDomains = new Set(
      (allFindingsContent.match(/"url"\s*:\s*"https?:\/\/[^"/]+/g) || []),
    ).size;

    if (datasets.length > 0) {
      console.log("  Source Analysis:");
      console.log(`    Source URLs in findings: ${sourceUrls}`);
      console.log(`    Unique domains: ${uniqueDomains}`);
    }
  }, THIRTY_MINUTES_MS + 120_000); // beforeAll timeout: run timeout + 2min buffer

  // --- Assertions ---

  it("completes within 20 minutes", () => {
    expect(plannerResult.durationSec).toBeLessThanOrEqual(1200);
  });

  it("planner state is completed", () => {
    expect(plannerResult.result.state).toBe("completed");
  });

  it("produces >= 1 dataset artifact", () => {
    const datasets = runArtifacts.filter((a) => a.artifact_type === "dataset");
    expect(datasets.length).toBeGreaterThanOrEqual(1);
  });

  it("produces >= 10 structured findings", () => {
    expect(totalFindings).toBeGreaterThanOrEqual(10);
  });

  it("produces >= 1 report artifact", () => {
    const reports = runArtifacts.filter((a) => a.artifact_type === "report");
    expect(reports.length).toBeGreaterThanOrEqual(1);
  });

  it("report has >= 500 words", () => {
    expect(reportWordCount).toBeGreaterThanOrEqual(500);
  });

  it("report has >= 3 sections", () => {
    expect(reportSectionCount).toBeGreaterThanOrEqual(3);
  });

  it("researcher completed >= 1 run", () => {
    expect(rCompleted).toBeGreaterThanOrEqual(1);
  });

  // --- Report generation ---

  afterAll(async () => {
    if (!plannerResult) return;

    const { runId, result, durationSec } = plannerResult;
    const byType = (type: string) => runArtifacts.filter((a) => a.artifact_type === type).length;
    const byAgent = (name: string) => runArtifacts.filter((a) => a.agent_name === name).length;

    const datasets = runArtifacts.filter((a) => a.artifact_type === "dataset");
    let findingsContent = "";
    for (const ds of datasets) {
      findingsContent += await artifactContent(ds.id) + "\n";
    }
    const sourceUrls = (findingsContent.match(/"url"\s*:\s*"https?:\/\/[^"]+/g) || []).length;
    const uniqueDomains = new Set(
      (findingsContent.match(/"url"\s*:\s*"https?:\/\/[^"/]+/g) || []),
    ).size;

    const dir = resultsDir();
    const reportPath = `${dir}/e2e-30-${timestamp()}.md`;

    const report = `# E2E-30: Instagram Growth Strategy Research (Planner)

**Date:** ${new Date().toISOString()}
**Run ID:** ${runId}
**Planner Model:** ${result.model}

## Play-by-Play

### Planner
| Metric | Value |
|--------|-------|
| State | ${result.state} |
| Model | ${result.model} |
| Turns | ${result.usage.turns} |
| Input tokens | ${result.usage.input} |
| Output tokens | ${result.usage.output} |
| Duration | ${durationSec}s |

### Researcher (container logs)
| Tool | Mentions |
|------|----------|
| web_search | ${rWebSearches} |
| scrape_apify | ${rScrapes} |
| deep_research | ${rDeepResearch} |
| record_finding | ${rFindingsRecorded} |
| publish_artifact | ${rArtifactsWritten} |

### Agent Completions
| Agent | Runs Completed |
|-------|---------------|
| Researcher | ${rCompleted} |
| Writer | ${wCompleted} |

## Artifacts Produced (run-scoped)
| Type | Count |
|------|-------|
| Research | ${byType("research")} |
| Dataset | ${byType("dataset")} |
| Report | ${byType("report")} |
| Brief | ${byType("brief")} |
| Total | ${runArtifacts.length} |

By agent: researcher=${byAgent("researcher")}, writer=${byAgent("writer")}

## Research Quality
| Metric | Value | Target |
|--------|-------|--------|
| Structured findings | ${totalFindings} | >= 10 |
| Source URLs | ${sourceUrls} | — |
| Unique domains | ${uniqueDomains} | — |

## Report Quality
| Metric | Value | Target |
|--------|-------|--------|
| Word count | ${reportWordCount} | >= 500 |
| Sections | ${reportSectionCount} | >= 3 |
| URL citations | ${reportCitationCount} | — |

## Planner Output
<details>
<summary>Click to expand planner reasoning and decisions</summary>

${result.output}

</details>

## Final Report Content
<details>
<summary>Click to expand full report</summary>

${finalReportContent}

</details>

## Raw Findings Data
<details>
<summary>Click to expand structured findings</summary>

\`\`\`jsonl
${findingsContent}
\`\`\`

</details>
`;

    try {
      await writeReport(reportPath, report);
    } catch (err) {
      console.error(`Failed to write report: ${err}`);
    }

    // Also save planner output as plain text
    try {
      await Bun.write(`${dir}/e2e-30-planner-output.txt`, result.output || "");
    } catch {
      // non-fatal
    }
  });
});
