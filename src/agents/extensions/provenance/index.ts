import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { classify } from "./classifications.js";
import { buildRunEvent, emitEvent } from "./openlineage.js";
import { readFileSync, existsSync } from "node:fs";
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
  let ctx: ProvenanceContext | null = null;
  let initialized = false;
  let startEmitted = false;

  const inputs = new Set<string>();
  const outputs: Array<{ uri: string; facets?: Record<string, any> }> = [];
  let toolCallCount = 0;

  function ensureContext(): ProvenanceContext | null {
    if (initialized) return ctx;
    initialized = true;

    const sessionDir = process.env.PI_SESSION_DIR || process.cwd();
    const ctxPath = join(sessionDir, ".provenance-context.json");
    try {
      if (!existsSync(ctxPath)) return null;
      const raw = readFileSync(ctxPath, "utf-8");
      ctx = JSON.parse(raw);
      return ctx;
    } catch {
      return null;
    }
  }

  function ensureStart() {
    const c = ensureContext();
    if (!c?.marquezUrl || startEmitted) return c;
    startEmitted = true;

    const startEvent = buildRunEvent({
      eventType: "START",
      runId: c.runId,
      agentName: c.agentName,
      correlationId: c.correlationId,
      causationId: c.causationId,
      inputs: [],
      outputs: [],
    });
    emitEvent(c.marquezUrl, startEvent);
    return c;
  }

  pi.on("tool_call", (event: any) => {
    const c = ensureStart();
    if (!c?.marquezUrl) return;

    const classification = classify(event.toolName);
    if (classification.type === "READ") {
      try {
        const uri = classification.uri(event.input);
        inputs.add(uri);
      } catch {}
    }
  });

  pi.on("tool_result", (event: any) => {
    const c = ensureStart();
    if (!c?.marquezUrl) return;

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
        runId: c.runId,
        agentName: c.agentName,
        correlationId: c.correlationId,
        causationId: c.causationId,
        inputs: [...inputs],
        outputs,
      });
      emitEvent(c.marquezUrl, runningEvent);
    }
  });

  pi.on("session_shutdown", () => {
    const c = ensureContext();
    if (!c?.marquezUrl) return;

    const completeEvent = buildRunEvent({
      eventType: "COMPLETE",
      runId: c.runId,
      agentName: c.agentName,
      correlationId: c.correlationId,
      causationId: c.causationId,
      inputs: [...inputs],
      outputs,
    });
    emitEvent(c.marquezUrl, completeEvent);
  });
}
