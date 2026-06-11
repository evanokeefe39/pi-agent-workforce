/**
 * Provenance extension for Pi SDK agents.
 *
 * Hooks tool_call and tool_result events to capture data lineage,
 * then emits OpenLineage RunEvents (START/RUNNING/COMPLETE) to Marquez.
 *
 * Graceful degradation:
 *   - No .provenance-context.json -> extension disabled
 *   - No marquezUrl in context    -> extension disabled
 *   - Emit failure                -> logged to stderr, never thrown
 *
 * Runs parallel to the existing artifact system with no breaking changes.
 */
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

/** Emit a RUNNING event every N tool completions. */
const RUNNING_INTERVAL = 30;

export default function provenanceExtension(pi: ExtensionAPI) {
  // Read context written by server.ts before extension init
  let ctx: ProvenanceContext;
  try {
    const raw = readFileSync(join(process.cwd(), ".provenance-context.json"), "utf-8");
    ctx = JSON.parse(raw);
  } catch {
    // No context file — extension disabled (e.g., running outside server)
    return;
  }

  if (!ctx.marquezUrl) return;

  // Accumulated input URIs (deduplicated via Set)
  const inputs = new Set<string>();
  // Accumulated output entries
  const outputs: Array<{ uri: string; facets?: Record<string, any> }> = [];
  let toolCallCount = 0;

  // --- Emit START event ---
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

  // --- Hook: tool_call — classify and track reads ---
  pi.on("tool_call", (event: any) => {
    const classification = classify(event.toolName);
    if (classification.type === "READ") {
      try {
        const uri = classification.uri(event.input);
        inputs.add(uri);
      } catch {
        // URI builder failed on unexpected input shape — skip silently
      }
    }
  });

  // --- Hook: tool_result — track writes and emit periodic RUNNING ---
  pi.on("tool_result", (event: any) => {
    const classification = classify(event.toolName);
    if (classification.type === "WRITE") {
      try {
        const uri = classification.uri(event.input, event.result);
        outputs.push({ uri });
      } catch {
        // URI builder failed on unexpected input/result shape — skip silently
      }
    }

    // Periodic RUNNING event for long-running agent sessions
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
  });

  // --- Hook: session end — emit COMPLETE ---
  pi.on("session_shutdown", () => {
    const completeEvent = buildRunEvent({
      eventType: "COMPLETE",
      runId: ctx.runId,
      agentName: ctx.agentName,
      correlationId: ctx.correlationId,
      causationId: ctx.causationId,
      inputs: [...inputs],
      outputs,
    });
    // Fire-and-forget: emitEvent catches its own errors
    emitEvent(ctx.marquezUrl, completeEvent);
  });
}
