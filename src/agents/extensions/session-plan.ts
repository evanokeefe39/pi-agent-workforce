/**
 * Session Plan Extension
 *
 * Lightweight session-scoped planning tool for agents to create, track, and
 * update their own execution plans. State stored as JSON in the workspace
 * directory, keyed by RUN_ID.
 *
 * Actions:
 *   create  — create a plan with phases and items
 *   update  — mark items complete, add notes, record tradeoffs
 *   get     — read current plan state
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

interface PlanItem {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "done" | "skipped";
  notes?: string;
}

interface Phase {
  name: string;
  parallel: boolean;
  items: PlanItem[];
}

interface SessionPlan {
  run_id: string;
  agent: string;
  created_at: string;
  updated_at: string;
  goal: string;
  phases: Phase[];
  tradeoffs: string[];
}

function planPath(sessionId?: string): string {
  const runId = sessionId || "unknown";
  const workspace = process.env.WORKSPACE_DIR || "/workspace";
  const safeRunId = runId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const dir = join(workspace, safeRunId);
  mkdirSync(dir, { recursive: true });
  return join(dir, "plan.json");
}

function loadPlan(sessionId?: string): SessionPlan | null {
  try {
    return JSON.parse(readFileSync(planPath(sessionId), "utf-8"));
  } catch {
    return null;
  }
}

function savePlan(plan: SessionPlan, sessionId?: string): void {
  plan.updated_at = new Date().toISOString();
  writeFileSync(planPath(sessionId), JSON.stringify(plan, null, 2));
}

function formatPlan(plan: SessionPlan): string {
  const lines: string[] = [];
  lines.push(`Plan: ${plan.goal}`);
  lines.push(`Run: ${plan.run_id} | Agent: ${plan.agent}`);
  lines.push("");

  for (const phase of plan.phases) {
    const mode = phase.parallel ? "parallel" : "sequential";
    const done = phase.items.filter(i => i.status === "done").length;
    lines.push(`## ${phase.name} (${mode}) — ${done}/${phase.items.length}`);
    for (const item of phase.items) {
      const mark = item.status === "done" ? "x" :
                   item.status === "in_progress" ? ">" :
                   item.status === "skipped" ? "-" : " ";
      lines.push(`  [${mark}] ${item.id}: ${item.description}${item.notes ? ` — ${item.notes}` : ""}`);
    }
    lines.push("");
  }

  if (plan.tradeoffs.length > 0) {
    lines.push("## Tradeoffs");
    for (const t of plan.tradeoffs) {
      lines.push(`  • ${t}`);
    }
  }

  return lines.join("\n");
}

export default function registerSessionPlan(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "plan",
    label: "Session Plan",
    description: "Create and track your execution plan for this task. Use 'create' at the start to lay out phases and items. Use 'update' to mark progress. Use 'get' to review current state. Plans are session-scoped and do not persist across invocations.",
    promptSnippet: "Track your plan: plan({ action: 'create', ... }) then plan({ action: 'update', item_id: '...', status: 'done' })",
    parameters: {
      type: "object" as const,
      properties: {
        action: {
          type: "string" as const,
          enum: ["create", "update", "get"],
          description: "create: new plan. update: change item status or add tradeoff. get: read current plan.",
        },
        goal: {
          type: "string" as const,
          description: "One-line goal statement (create only)",
        },
        phases: {
          type: "array" as const,
          description: "Phases of work (create only)",
          items: {
            type: "object" as const,
            properties: {
              name: { type: "string" as const },
              parallel: { type: "boolean" as const, description: "true if items in this phase can run concurrently" },
              items: {
                type: "array" as const,
                items: {
                  type: "object" as const,
                  properties: {
                    id: { type: "string" as const, description: "Short kebab-case ID" },
                    description: { type: "string" as const },
                  },
                },
              },
            },
          },
        },
        item_id: {
          type: "string" as const,
          description: "Item ID to update (update only)",
        },
        status: {
          type: "string" as const,
          enum: ["pending", "in_progress", "done", "skipped"],
          description: "New status (update only)",
        },
        notes: {
          type: "string" as const,
          description: "Notes to attach to item or tradeoff to record (update only)",
        },
        tradeoff: {
          type: "string" as const,
          description: "Record a tradeoff decision (update only, no item_id needed)",
        },
      },
      required: ["action"],
    },

    async execute(_toolCallId: string, params: Record<string, unknown>, _signal: unknown, _onUpdate: unknown, ctx: any) {
      const action = params.action as string;
      const sessionId = ctx?.sessionManager?.getSessionId?.() || "unknown";

      if (action === "create") {
        const goal = (params.goal as string) || "No goal specified";
        const rawPhases = (params.phases as Array<Record<string, unknown>>) || [];

        const phases: Phase[] = rawPhases.map(p => ({
          name: (p.name as string) || "Unnamed phase",
          parallel: (p.parallel as boolean) || false,
          items: ((p.items as Array<Record<string, unknown>>) || []).map(i => ({
            id: (i.id as string) || "item",
            description: (i.description as string) || "",
            status: "pending" as const,
          })),
        }));

        const plan: SessionPlan = {
          run_id: sessionId,
          agent: process.env.AGENT_NAME || "unknown",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          goal,
          phases,
          tradeoffs: [],
        };

        savePlan(plan, sessionId);
        return { content: [{ type: "text" as const, text: `Plan created.\n\n${formatPlan(plan)}` }] };
      }

      if (action === "update") {
        const plan = loadPlan(sessionId);
        if (!plan) {
          return { content: [{ type: "text" as const, text: "No plan exists. Create one first." }] };
        }

        if (params.tradeoff) {
          plan.tradeoffs.push(params.tradeoff as string);
          savePlan(plan, sessionId);
          return { content: [{ type: "text" as const, text: `Tradeoff recorded: ${params.tradeoff}\n\n${formatPlan(plan)}` }] };
        }

        const itemId = params.item_id as string;
        if (!itemId) {
          return { content: [{ type: "text" as const, text: "item_id required for status update." }] };
        }

        let found = false;
        for (const phase of plan.phases) {
          for (const item of phase.items) {
            if (item.id === itemId) {
              if (params.status) item.status = params.status as PlanItem["status"];
              if (params.notes) item.notes = params.notes as string;
              found = true;
              break;
            }
          }
          if (found) break;
        }

        if (!found) {
          return { content: [{ type: "text" as const, text: `Item '${itemId}' not found in plan.` }] };
        }

        savePlan(plan, sessionId);
        return { content: [{ type: "text" as const, text: `Updated ${itemId}.\n\n${formatPlan(plan)}` }] };
      }

      if (action === "get") {
        const plan = loadPlan(sessionId);
        if (!plan) {
          return { content: [{ type: "text" as const, text: "No plan exists for this session." }] };
        }
        return { content: [{ type: "text" as const, text: formatPlan(plan) }] };
      }

      return { content: [{ type: "text" as const, text: `Unknown action: ${action}` }] };
    },
  });
}
