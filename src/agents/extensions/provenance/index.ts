import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { classify } from "./classifications.js";
import { buildRunEvent, emitEvent } from "./openlineage.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface ProvenanceContext {
  correlationId: string | null;
  causationId: string | null;
  agentName: string;
  runId: string;
  marquezUrl: string | null;
}

const RUNNING_INTERVAL = 10;

export default function provenanceExtension(pi: ExtensionAPI) {
  let ctx: ProvenanceContext;
  try {
    const raw = readFileSync(join(process.cwd(), ".provenance-context.json"), "utf-8");
    ctx = JSON.parse(raw);
  } catch {
    return;
  }

  const inputs = new Set<string>();
  const outputs: Array<{ uri: string; facets?: Record<string, any> }> = [];
  let toolCallCount = 0;

  // Emit START event
  if (ctx.marquezUrl) {
    const startEvent = buildRunEvent({
      eventType: "START",
      runId: ctx.runId,
      agentName: ctx.agentName,
      correlationId: ctx.correlationId,
      causationId: ctx.causationId,
      inputs: [],
      outputs: [],
    });
    emitEvent(ctx.marquezUrl, startEvent);
  }

  // Hook: tool_call — read tracking for provenance
  pi.on("tool_call", (event: any) => {
    if (ctx.marquezUrl) {
      const classification = classify(event.toolName);
      if (classification.type === "READ") {
        try {
          const uri = classification.uri(event.input);
          inputs.add(uri);
        } catch {}
      }
    }
  });

  // Hook: tool_result — write tracking + periodic RUNNING
  pi.on("tool_result", (event: any) => {
    if (ctx.marquezUrl) {
      const classification = classify(event.toolName);
      if (classification.type === "WRITE") {
        try {
          const uri = classification.uri(event.input, event.result);
          outputs.push({ uri });
        } catch {}
      }

      toolCallCount++;
      if (toolCallCount % RUNNING_INTERVAL === 0) {
        const runningEvent = buildRunEvent({
          eventType: "RUNNING",
          runId: ctx.runId,
          agentName: ctx.agentName,
          correlationId: ctx.correlationId,
          causationId: ctx.causationId,
          inputs: [...inputs],
          outputs,
        });
        emitEvent(ctx.marquezUrl, runningEvent);
      }
    }
  });

  // Hook: session end — emit COMPLETE
  pi.on("session_shutdown", () => {
    if (ctx.marquezUrl) {
      const completeEvent = buildRunEvent({
        eventType: "COMPLETE",
        runId: ctx.runId,
        agentName: ctx.agentName,
        correlationId: ctx.correlationId,
        causationId: ctx.causationId,
        inputs: [...inputs],
        outputs,
      });
      emitEvent(ctx.marquezUrl, completeEvent);
    }
  });
}
