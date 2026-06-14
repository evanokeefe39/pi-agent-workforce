import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { createWorkproductExtension } from "./workproduct/factory.js";
import type { StyleProfiles, LocalRecord, ExtraToolDef, WorkproductHandle } from "./workproduct/types.js";

// ---------------------------------------------------------------------------
// Validation profiles
// ---------------------------------------------------------------------------

const KIND_PROFILES: StyleProfiles = {
  sourceRequired: {
    artifact_review: [], plan_review: [], stage_gate: [],
    violation: [], commendation: [],
  },
  sourceEncouraged: {
    artifact_review: [], plan_review: [], stage_gate: [],
    violation: [], commendation: [],
  },
  recordEncouraged: {
    artifact_review: ["findings", "brief_ref"],
    plan_review: ["feasibility_score", "unresolved_questions"],
    stage_gate: ["blocking_issues", "prior_gate_ref"],
    violation: [],
    commendation: [],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAssessmentLine(rec: LocalRecord): string {
  const m = rec.metadata as Record<string, any>;
  const verdict = m.verdict || "—";
  let ctx = "";
  if (rec.type === "artifact_review") {
    ctx = `${m.producing_agent || "?"} → ${m.artifact_under_review || "?"}`;
  } else if (rec.type === "stage_gate") {
    ctx = `${m.from_stage || "?"} → ${m.to_stage || "?"}`;
  } else if (rec.type === "plan_review") {
    ctx = `${m.plan_under_review || "?"}`;
  }
  return `[${rec.id}] ${rec.type} | ${verdict} | ${ctx}`;
}

// ---------------------------------------------------------------------------
// Extra tools: list_evaluations, export_evaluations_jsonl
// ---------------------------------------------------------------------------

const listEvaluationsTool: ExtraToolDef = {
  name: "list_evaluations",
  label: "List Evaluations",
  description:
    "Query recorded violations and commendations with optional filters. " +
    "Returns matching evaluations sorted by timestamp descending.",
  parameters: Type.Object({
    type: Type.Optional(Type.Union(
      [Type.Literal("violation"), Type.Literal("commendation")],
      { description: "Filter by evaluation type" },
    )),
    domain: Type.Optional(Type.String({ description: "Filter by domain" })),
    severity: Type.Optional(Type.String({ description: "Filter by severity (violations only)" })),
    source_artifact: Type.Optional(Type.String({ description: "Filter by source artifact" })),
    since: Type.Optional(Type.String({ description: "ISO 8601 — only evaluations after this timestamp" })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500, description: "Max results, default 100" })),
  }),
  async execute(handle: WorkproductHandle, _toolCallId, params) {
    const types = params.type ? [params.type] : ["violation", "commendation"];
    let records: LocalRecord[] = types.flatMap((t: string) =>
      handle.list({ type: t, since: params.since }),
    );

    if (params.domain) {
      records = records.filter(r => (r.metadata as any).domain === params.domain);
    }
    if (params.severity) {
      records = records.filter(r =>
        r.type === "violation" && (r.metadata as any).severity === params.severity,
      );
    }
    if (params.source_artifact) {
      records = records.filter(r => (r.metadata as any).source_artifact === params.source_artifact);
    }

    records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    records = records.slice(0, params.limit || 100);

    if (records.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No evaluations match the filters." }],
        details: { count: 0 },
      };
    }

    const lines: string[] = [`Found ${records.length} evaluation(s):\n`];
    for (const rec of records) {
      const m = rec.metadata as Record<string, any>;
      const sev = m.severity ? ` [${m.severity}]` : "";
      const imp = m.impact ? ` [${m.impact}]` : "";
      lines.push(`[${rec.id}] ${rec.type}${sev}${imp} | ${m.rule_id} | ${m.domain}`);
    }

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
      details: { count: records.length },
    };
  },
};

const exportEvaluationsJsonlTool: ExtraToolDef = {
  name: "export_evaluations_jsonl",
  label: "Export Evaluations as JSONL",
  description:
    "Export all recorded violations and commendations as a JSONL string. " +
    "Each line is a JSON object with type, rule_id, severity/impact, domain, " +
    "evidence, recommendation/standard_ref, and source_artifact. " +
    "Use the output with publish_artifact to publish the evaluation dataset.",
  parameters: Type.Object({
    source_artifact: Type.Optional(Type.String({
      description: "Filter to evaluations for a specific source artifact",
    })),
    since: Type.Optional(Type.String({
      description: "ISO 8601 — only evaluations after this timestamp",
    })),
  }),
  async execute(handle: WorkproductHandle, _toolCallId, params) {
    const allRecords: LocalRecord[] = ["violation", "commendation"].flatMap((t: string) =>
      handle.list({ type: t, since: params.since }),
    );

    let records = allRecords;
    if (params.source_artifact) {
      records = records.filter(r => (r.metadata as any).source_artifact === params.source_artifact);
    }
    records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    if (records.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No evaluations to export." }],
        details: { count: 0 },
      };
    }

    const lines: string[] = [];
    let criticalCount = 0, majorCount = 0, minorCount = 0, commendationCount = 0;

    for (const rec of records) {
      const m = rec.metadata as Record<string, any>;
      if (rec.type === "violation") {
        const sev = m.severity || "minor";
        if (sev === "critical") criticalCount++;
        else if (sev === "major") majorCount++;
        else minorCount++;
        lines.push(JSON.stringify({
          type: "violation", rule_id: m.rule_id, severity: sev,
          domain: m.domain, evidence: m.evidence,
          recommendation: m.recommendation, standard_ref: m.standard_ref,
          source_artifact: m.source_artifact,
        }));
      } else {
        commendationCount++;
        lines.push(JSON.stringify({
          type: "commendation", rule_id: m.rule_id,
          domain: m.domain, evidence: m.evidence,
          standard_ref: m.standard_ref, impact: m.impact,
          source_artifact: m.source_artifact,
        }));
      }
    }

    const summary = `Exported ${records.length} evaluations:\n  Violations: ${criticalCount} critical, ${majorCount} major, ${minorCount} minor\n  Commendations: ${commendationCount}`;

    return {
      content: [{ type: "text" as const, text: `${summary}\n\n${lines.join("\n")}` }],
      details: {
        count: records.length,
        violations: { critical: criticalCount, major: majorCount, minor: minorCount },
        commendations: commendationCount,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  createWorkproductExtension(pi, {
    agentName: "qa",
    kinds: {
      artifact_review: {
        schema: Type.Object({
          verdict: Type.Union(
            [Type.Literal("pass"), Type.Literal("fail"), Type.Literal("escalate")],
            { description: "Overall verdict for the reviewed artifact" },
          ),
          artifact_under_review: Type.String({ description: "ID of the artifact being reviewed" }),
          producing_agent: Type.String({ description: "Name of the agent that produced the artifact" }),
          source_issue: Type.String({ description: "Task ID the artifact was produced for" }),
          output_template: Type.String({ description: "Output template name applied to the artifact (e.g. 'research-output')" }),
          standards_applied: Type.Array(Type.String(), {
            minItems: 1, description: "Standards / rubrics used to evaluate the artifact",
          }),
          checklist: Type.Record(Type.String(), Type.Boolean(), {
            description: "Map of named checks to pass/fail booleans",
          }),
          metrics: Type.Object({
            critical: Type.Integer({ minimum: 0 }),
            major: Type.Integer({ minimum: 0 }),
            minor: Type.Integer({ minimum: 0 }),
            total: Type.Integer({ minimum: 0 }),
          }, { description: "Count of issues at each severity, plus a total" }),
          verdict_text: Type.String({ description: "Narrative explanation of the verdict" }),
          findings: Type.Optional(Type.Array(Type.Object({
            severity: Type.Union([Type.Literal("critical"), Type.Literal("major"), Type.Literal("minor")]),
            location: Type.String(),
            standard: Type.String(),
            detail: Type.String(),
            expected: Type.String(),
          }))),
          brief_ref: Type.Optional(Type.String({
            description: "Optional reference to the originating brief artifact ID",
          })),
        }),
        subdir: "assessments",
        label: "Record Artifact Review",
        description:
          "Record a QA verdict on a producing-agent output artifact. " +
          "Captures verdict (pass|fail|escalate), the standards applied, " +
          "a named-check boolean checklist, severity metrics, a narrative " +
          "verdict, and optional structured findings list.",
        filename: () => "artifact_review.json",
        content: (p) => {
          const findings = p.findings ?? [];
          return `${p.verdict_text}\n\n## Findings\n${JSON.stringify(findings, null, 2)}`;
        },
        metadata: (p, sid) => ({
          verdict: p.verdict,
          artifact_under_review: p.artifact_under_review,
          producing_agent: p.producing_agent,
          source_issue: p.source_issue,
          output_template: p.output_template,
          standards_applied: p.standards_applied,
          checklist: p.checklist,
          metrics: p.metrics,
          findings: p.findings ?? [],
          brief_ref: p.brief_ref || undefined,
          session_id: sid,
        }),
        summary: (id, p) =>
          `Artifact review recorded: ${id}\nVerdict: ${p.verdict}\nProducing agent: ${p.producing_agent}\nArtifact under review: ${p.artifact_under_review}\nMetrics: ${p.metrics.critical}c / ${p.metrics.major}M / ${p.metrics.minor}m (total ${p.metrics.total})`,
        details: (id, p) => ({
          id, verdict: p.verdict, metrics: p.metrics,
        }),
      },
      plan_review: {
        schema: Type.Object({
          verdict: Type.Union(
            [Type.Literal("go"), Type.Literal("no_go"), Type.Literal("conditional")],
            { description: "Overall verdict for the proposed plan" },
          ),
          plan_under_review: Type.String({ description: "Artifact ID or path of the plan being reviewed" }),
          gate_checklist: Type.Record(Type.String(), Type.Boolean(), {
            description: "Spec-gate items, each marked pass/fail",
          }),
          risk_inventory: Type.Array(Type.Object({
            risk: Type.String(),
            likelihood: Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]),
            impact: Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]),
            mitigation: Type.String(),
          }), { minItems: 0, description: "Inventory of identified risks with likelihood, impact, and mitigation" }),
          feasibility_score: Type.Optional(Type.Union([
            Type.Literal("high"), Type.Literal("medium"), Type.Literal("low"),
          ])),
          unresolved_questions: Type.Optional(Type.Array(Type.String())),
          conditions: Type.Optional(Type.Array(Type.String(), {
            description: "Conditions that must be met for a 'conditional' verdict to convert to 'go'",
          })),
          source_issue: Type.Optional(Type.String({ description: "Task ID the plan was produced for" })),
          review_text: Type.String({ description: "Narrative explanation of the verdict" }),
        }),
        subdir: "assessments",
        label: "Record Plan Review",
        description:
          "Record a QA verdict on a proposed plan or specification. " +
          "Captures the spec-gate checklist, a risk inventory with mitigations, " +
          "optional feasibility score, unresolved questions, and conditional gating.",
        filename: () => "plan_review.json",
        content: (p) =>
          `${p.review_text}\n\n## Risks\n${JSON.stringify(p.risk_inventory, null, 2)}`,
        metadata: (p, sid) => ({
          verdict: p.verdict,
          plan_under_review: p.plan_under_review,
          gate_checklist: p.gate_checklist,
          risk_inventory: p.risk_inventory,
          feasibility_score: p.feasibility_score || undefined,
          unresolved_questions: p.unresolved_questions || [],
          conditions: p.conditions || [],
          source_issue: p.source_issue || undefined,
          session_id: sid,
        }),
        summary: (id, p) =>
          `Plan review recorded: ${id}\nVerdict: ${p.verdict}\nPlan under review: ${p.plan_under_review}\nRisks: ${p.risk_inventory.length}`,
        details: (id, p) => ({
          id, verdict: p.verdict, risk_count: p.risk_inventory.length,
        }),
      },
      stage_gate: {
        schema: Type.Object({
          verdict: Type.Union(
            [Type.Literal("pass"), Type.Literal("block"), Type.Literal("conditional_pass")],
            { description: "Overall verdict for the stage transition" },
          ),
          from_stage: Type.String({ description: "Stage the work is leaving" }),
          to_stage: Type.String({ description: "Stage the work is entering" }),
          inputs: Type.Array(Type.String(), {
            minItems: 1, description: "Artifact IDs entering the gate",
          }),
          gate_criteria: Type.Record(Type.String(), Type.Boolean(), {
            description: "Map of named gate criteria to pass/fail booleans",
          }),
          blocking_issues: Type.Optional(Type.Array(Type.Object({
            issue: Type.String(),
            severity: Type.Union([Type.Literal("critical"), Type.Literal("major"), Type.Literal("minor")]),
            owner_agent: Type.String(),
          }))),
          conditions: Type.Optional(Type.Array(Type.String(), {
            description: "Conditions required for a 'conditional_pass' verdict",
          })),
          source_issue: Type.Optional(Type.String({ description: "Task ID for the stage transition" })),
          prior_gate_ref: Type.Optional(Type.String({
            description: "Artifact ID of a prior gate this one supersedes",
          })),
          gate_text: Type.String({ description: "Narrative explanation of the gate verdict" }),
        }),
        subdir: "assessments",
        label: "Record Stage Gate",
        description:
          "Record a QA verdict on a stage-to-stage handoff. " +
          "Lists input artifacts crossing the gate, named gate criteria as pass/fail, " +
          "and any blocking issues that must be resolved before the gate can pass.",
        filename: () => "stage_gate.json",
        content: (p) => {
          const blocking = p.blocking_issues ?? [];
          return `${p.gate_text}\n\n## Blocking issues\n${JSON.stringify(blocking, null, 2)}`;
        },
        metadata: (p, sid) => ({
          verdict: p.verdict,
          from_stage: p.from_stage, to_stage: p.to_stage,
          inputs: p.inputs,
          gate_criteria: p.gate_criteria,
          blocking_issues: p.blocking_issues ?? [],
          conditions: p.conditions || [],
          source_issue: p.source_issue || undefined,
          prior_gate_ref: p.prior_gate_ref || undefined,
          session_id: sid,
        }),
        summary: (id, p) => {
          const blocking = p.blocking_issues ?? [];
          return `Stage gate recorded: ${id}\nVerdict: ${p.verdict}\nTransition: ${p.from_stage} → ${p.to_stage}\nInputs: ${p.inputs.length}\nBlocking issues: ${blocking.length}`;
        },
        details: (id, p) => ({
          id, verdict: p.verdict,
          input_count: p.inputs.length,
          blocking_count: (p.blocking_issues ?? []).length,
        }),
      },
      violation: {
        schema: Type.Object({
          rule_id: Type.String({ description: "Unique rule identifier (e.g. WRITE-AP1-GENERIC-HYPE, PLATFORM-TIKTOK-HOOK-80CHAR)" }),
          severity: Type.Union(
            [Type.Literal("critical"), Type.Literal("major"), Type.Literal("minor")],
            { description: "Violation severity" },
          ),
          domain: Type.Union(
            [
              Type.Literal("content-quality"), Type.Literal("platform-compliance"),
              Type.Literal("brand-compliance"), Type.Literal("research-quality"),
              Type.Literal("publish-readiness"),
            ],
            { description: "Evaluation domain" },
          ),
          evidence: Type.String({ description: "Exact text, element, or condition that constitutes the violation" }),
          recommendation: Type.String({ description: "Specific fix recommendation" }),
          standard_ref: Type.String({ description: "Path to the skill or standard that defines this rule" }),
          source_artifact: Type.String({ description: "Artifact URI or ID of the content under review" }),
        }),
        subdir: "evaluations",
        label: "Record Violation",
        description:
          "Record a quality violation found during content evaluation. " +
          "Captures the rule violated, severity, domain, exact evidence, " +
          "fix recommendation, standard reference, and source artifact.",
        filename: (p) => `${p.rule_id}.json`,
        content: (p) => p.evidence,
        metadata: (p, sid) => ({
          rule_id: p.rule_id, severity: p.severity,
          domain: p.domain, evidence: p.evidence,
          recommendation: p.recommendation,
          standard_ref: p.standard_ref,
          source_artifact: p.source_artifact,
          session_id: sid,
        }),
        summary: (id, p) =>
          `Violation recorded: ${id}\n  Rule: ${p.rule_id}\n  Severity: ${p.severity}\n  Domain: ${p.domain}`,
        details: (id, p) => ({
          id, rule_id: p.rule_id, severity: p.severity,
        }),
      },
      commendation: {
        schema: Type.Object({
          rule_id: Type.String({ description: "Unique rule identifier (e.g. CONTENT-SPECIFICITY, BRAND-DARK-THEME)" }),
          domain: Type.Union(
            [
              Type.Literal("content-quality"), Type.Literal("platform-compliance"),
              Type.Literal("brand-compliance"), Type.Literal("research-quality"),
              Type.Literal("publish-readiness"),
            ],
            { description: "Evaluation domain" },
          ),
          evidence: Type.String({ description: "Exact text, element, or condition demonstrating compliance or excellence" }),
          standard_ref: Type.String({ description: "Path to the skill or standard that defines this rule" }),
          impact: Type.Union(
            [Type.Literal("high"), Type.Literal("medium"), Type.Literal("low")],
            { description: "Impact level of this commendation" },
          ),
          source_artifact: Type.String({ description: "Artifact URI or ID of the content under review" }),
        }),
        subdir: "evaluations",
        label: "Record Commendation",
        description:
          "Record a positive quality finding — a best practice followed or standard exceeded. " +
          "Captures the rule met, domain, exact evidence, standard reference, impact level, " +
          "and source artifact.",
        filename: (p) => `${p.rule_id}.json`,
        content: (p) => p.evidence,
        metadata: (p, sid) => ({
          rule_id: p.rule_id, domain: p.domain,
          evidence: p.evidence, standard_ref: p.standard_ref,
          impact: p.impact, source_artifact: p.source_artifact,
          session_id: sid,
        }),
        summary: (id, p) =>
          `Commendation recorded: ${id}\n  Rule: ${p.rule_id}\n  Domain: ${p.domain}\n  Impact: ${p.impact}`,
        details: (id, p) => ({
          id, rule_id: p.rule_id, impact: p.impact,
        }),
      },
    },
    profiles: KIND_PROFILES,
    queryTool: {
      name: "query_assessments",
      label: "Query Assessments",
      description:
        "Search recorded QA assessments (artifact_review, plan_review, stage_gate) with optional filters. " +
        "Returns matching assessments sorted by created_at descending.",
      kinds: ["artifact_review", "plan_review", "stage_gate"],
      noMatchText: "No assessments match the filters.",
      extraFilters: [
        {
          name: "verdict",
          schema: Type.Optional(Type.String({ description: "Filter by verdict value. Valid values depend on kind." })),
          filter: (rec, val) => (rec.metadata as any).verdict === val,
        },
        {
          name: "producing_agent",
          schema: Type.Optional(Type.String({ description: "For artifact_review: filter by the agent that produced the reviewed artifact" })),
          filter: (rec, val) =>
            rec.type === "artifact_review" && (rec.metadata as any).producing_agent === val,
        },
        {
          name: "from_stage",
          schema: Type.Optional(Type.String({ description: "For stage_gate: filter by from_stage" })),
          filter: (rec, val) =>
            rec.type === "stage_gate" && (rec.metadata as any).from_stage === val,
        },
        {
          name: "to_stage",
          schema: Type.Optional(Type.String({ description: "For stage_gate: filter by to_stage" })),
          filter: (rec, val) =>
            rec.type === "stage_gate" && (rec.metadata as any).to_stage === val,
        },
        {
          name: "source_issue",
          schema: Type.Optional(Type.String({ description: "Filter by source Task ID" })),
          filter: (rec, val) => (rec.metadata as any).source_issue === val,
        },
      ],
      formatLine: formatAssessmentLine,
    },
    getTool: {
      name: "get_assessment",
      label: "Get Assessment",
      description:
        "Retrieve a specific QA assessment by its artifact ID. " +
        "Only returns artifacts of type artifact_review, plan_review, or stage_gate.",
      kinds: ["artifact_review", "plan_review", "stage_gate"],
    },
    extraTools: [listEvaluationsTool, exportEvaluationsJsonlTool],
  });
}
