import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { createLogger } from "./logger.mjs";
import {
  createAgentSessionServices,
  createAgentSessionFromServices,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

// --- Configuration ---

const AGENT_NAME = process.env.AGENT_NAME || "";
if (!AGENT_NAME) {
  console.error("FATAL: AGENT_NAME env var required");
  process.exit(1);
}

const PORT = parseInt(process.env.BRIDGE_PORT || "8080", 10);
const BRIDGE_TIMEOUT_MS = parseInt(process.env.BRIDGE_TIMEOUT_MS || "120000", 10);
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_SESSIONS || "3", 10);
const QUEUE_MAX_DEPTH = parseInt(process.env.QUEUE_MAX_DEPTH || "8", 10);
const MAX_BODY_BYTES = parseInt(process.env.MAX_BODY_BYTES || "1048576", 10);
const VERSION = "5.0.0";
const CWD = "/workspace/scratch";

const COST_REPORT_URL = process.env.COST_REPORT_URL || "";
const COST_REPORT_KEY = process.env.COST_REPORT_KEY || "";
const AGENT_ID = process.env.AGENT_ID || "";
const WORKSPACE_ID = process.env.WORKSPACE_ID || "";
const ARTIFACT_SERVICE_URL = process.env.ARTIFACT_SERVICE_URL || "";

let piProvider = "unknown";
let piModel = "unknown";
try {
  const settings = JSON.parse(readFileSync("/root/.pi/agent/settings.json", "utf-8"));
  piProvider = settings.defaultProvider || "unknown";
  piModel = settings.defaultModel || "unknown";
} catch { /* settings.json not found */ }
if (process.env.PI_PROVIDER) piProvider = process.env.PI_PROVIDER;
if (process.env.PI_MODEL) piModel = process.env.PI_MODEL;

const SERVICE_NAME = `${AGENT_NAME}-server`;
const logger = createLogger({ service: SERVICE_NAME });

// --- Agent metadata ---

interface ValidationConfig {
  maxTurns: number;
  requiredTools: string[];
  requiredArtifactType: string;
}

let agentMeta = { name: AGENT_NAME, description: "", role: "", capabilities: "" };
let validationConfig: ValidationConfig = { maxTurns: 0, requiredTools: [], requiredArtifactType: "" };
try {
  const raw = readFileSync(`/app/${AGENT_NAME}/agent.json`, "utf-8");
  const parsed = JSON.parse(raw);
  agentMeta = {
    name: parsed.name || AGENT_NAME,
    description: parsed.title || "",
    role: parsed.role || "",
    capabilities: parsed.capabilities || "",
  };
  const v = parsed.runtimeConfig?.validation || {};
  validationConfig = {
    maxTurns: v.maxTurns || 0,
    requiredTools: v.requiredTools || [],
    requiredArtifactType: v.requiredArtifactType || "",
  };
} catch { /* agent.json not found */ }

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  (logger as any)[level]({ event, ...data }, event);
}

// --- Cost reporting ---

interface UsageRecord {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  provider: string;
  model: string;
  turns: number;
}

async function reportCostEvent(usage: UsageRecord) {
  if (!COST_REPORT_URL || !COST_REPORT_KEY || !WORKSPACE_ID || !AGENT_ID) return;
  if ((usage.inputTokens + usage.outputTokens) === 0) return;
  try {
    await fetch(`${COST_REPORT_URL}/api/companies/${WORKSPACE_ID}/cost-events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${COST_REPORT_KEY}`,
      },
      body: JSON.stringify({
        agentId: AGENT_ID,
        provider: usage.provider,
        model: usage.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cachedInputTokens: usage.cachedInputTokens,
      }),
    });
    log("debug", "cost_reported", { input: usage.inputTokens, output: usage.outputTokens });
  } catch (err: any) {
    log("warn", "cost_report_failed", { error: err.message });
  }
}

// --- Metrics ---

const MAX_DURATION_SAMPLES = 100;
const bootTime = Date.now();
const metrics = {
  requests_total: 0,
  requests_active: 0,
  requests_failed: 0,
  durations: [] as number[],
  last_request_at: null as string | null,
  cold_start_ms: null as number | null,
};

function recordDuration(ms: number) {
  metrics.durations.push(ms);
  if (metrics.durations.length > MAX_DURATION_SAMPLES) metrics.durations.shift();
}

// --- Run tracking ---

const MAX_RUN_HISTORY = 100;
const runs = new Map<string, Record<string, any>>();
const activeAborts = new Map<string, AbortController>();

function trackRun(runId: string, data: Record<string, any>) {
  runs.set(runId, { ...runs.get(runId), ...data });
  while (runs.size > MAX_RUN_HISTORY) {
    const oldest = runs.keys().next().value;
    if (oldest) runs.delete(oldest);
  }
}

// --- Concurrency limiter ---

let activeCount = 0;
const waitQueue: Array<() => void> = [];

async function acquireSlot() {
  if (activeCount < MAX_CONCURRENT) { activeCount++; return; }
  await new Promise<void>(resolve => waitQueue.push(resolve));
  activeCount++;
}

function releaseSlot() {
  activeCount--;
  const next = waitQueue.shift();
  if (next) next();
}

// --- Shared services ---

let services: any = null;

async function initServices() {
  mkdirSync(CWD, { recursive: true });
  const t0 = Date.now();
  services = await createAgentSessionServices({ cwd: CWD });
  log("info", "services_init", {
    duration_ms: Date.now() - t0,
    extensions: services.resourceLoader.getExtensions().extensions.length,
  });
}

// --- Prompt extraction ---

function extractPrompt(body: any): string {
  if (body.task) {
    return typeof body.context === "string" && body.context
      ? `${body.task}\n\nContext:\n${body.context}`
      : body.task;
  }
  if (body.prompt || body.renderedPrompt) return body.prompt || body.renderedPrompt;
  return "No task provided.";
}

// --- Process a single invocation ---

async function processInvocation(body: any, traceId: string, requestStart: number, abortController: AbortController) {
  const run = runs.get(traceId);
  if (!run || run.status === "cancelled") {
    releaseSlot();
    return;
  }

  trackRun(traceId, { status: "running" });

  const ctx = body.context || {};
  const runId = body.runId || null;

  log("info", "wake_context", {
    reason: ctx.wakeReason || "heartbeat",
    source: ctx.wakeSource || null,
    taskId: ctx.taskId || ctx.issueId || null,
    commentId: ctx.wakeCommentId || null,
    issueId: ctx.issueId || null,
    interactionId: ctx.interactionId || null,
    interactionKind: ctx.interactionKind || null,
    runId,
  });

  const prompt = extractPrompt(body);

  const rawScope = ctx.issueId || runId || "scratch";
  const issueScope = rawScope.replace(/[^a-zA-Z0-9_-]/g, "-");
  const workDir = body.workspace || `/workspace/${issueScope}`;
  try { mkdirSync(workDir, { recursive: true }); } catch { /* non-fatal */ }

  let session: any;
  try {
    const result = await createAgentSessionFromServices({
      services,
      sessionManager: SessionManager.inMemory(),
    });
    session = result.session;
  } catch (err: any) {
    metrics.requests_failed++;
    log("error", "session_create_failed", { error: err.message, trace_id: traceId });
    trackRun(traceId, { status: "failed", completedAt: new Date().toISOString(), error: err.message });
    metrics.requests_active--;
    releaseSlot();
    return;
  }

  const sessionId = session.sessionId;
  log("info", "session_created", { session_id: sessionId, trace_id: traceId, correlation_id: body.correlationId || null });

  const usageByTurn: Array<{ provider: string; model: string; input: number; output: number; cacheRead: number }> = [];
  const toolCalls: Record<string, number> = {};
  let output = "";
  let eventCount = 0;

  session.subscribe((event: any) => {
    eventCount++;

    if (event.type === "message_update") {
      const delta = event.assistantMessageEvent;
      if (delta?.type === "text_delta") output += delta.delta;
    }

    if (event.type === "tool_execution_end" && event.toolName) {
      toolCalls[event.toolName] = (toolCalls[event.toolName] || 0) + 1;
    }

    if (event.type === "turn_end" && event.message?.usage) {
      usageByTurn.push({
        provider: event.message.provider || piProvider,
        model: event.message.model || piModel,
        input: event.message.usage.input || 0,
        output: event.message.usage.output || 0,
        cacheRead: event.message.usage.cacheRead || 0,
      });
      const turnCount = usageByTurn.length;
      trackRun(traceId, { turnCount });

      if (validationConfig.maxTurns > 0 && turnCount >= validationConfig.maxTurns) {
        log("error", "andon_max_turns", {
          trace_id: traceId, turns: turnCount, limit: validationConfig.maxTurns,
        });
        abortController.abort();
      }

      if (validationConfig.requiredTools.length > 0 && turnCount > 0 && turnCount % 10 === 0) {
        const missing = validationConfig.requiredTools.filter(t => !toolCalls[t]);
        if (missing.length > 0) {
          log("warn", "andon_missing_tools", {
            trace_id: traceId, turns: turnCount, missing, toolCalls,
          });
        }
      }
    }
  });

  log("info", "prompt_sent", { prompt_length: prompt.length, trace_id: traceId });

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("timeout")), BRIDGE_TIMEOUT_MS);
    });
    const cancelPromise = new Promise<never>((_, reject) => {
      if (abortController.signal.aborted) return reject(new Error("cancelled"));
      abortController.signal.addEventListener("abort", () =>
        reject(new Error("cancelled")), { once: true }
      );
    });

    await Promise.race([session.prompt(prompt), timeoutPromise, cancelPromise]);
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err.message === "timeout";
    const isCancelled = err.message === "cancelled";
    metrics.requests_failed++;
    log(isCancelled ? "info" : "error", "prompt_failed", { error: err.message, trace_id: traceId });
    trackRun(traceId, {
      status: isCancelled ? "cancelled" : isTimeout ? "timeout" : "failed",
      completedAt: new Date().toISOString(),
      error: err.message,
    });
    activeAborts.delete(traceId);
    metrics.requests_active--;
    releaseSlot();
    return;
  }

  clearTimeout(timeoutId);
  activeAborts.delete(traceId);

  const totalDuration = Date.now() - requestStart;
  recordDuration(totalDuration);
  metrics.requests_active--;
  if (metrics.cold_start_ms === null) metrics.cold_start_ms = totalDuration;

  const usage: UsageRecord = {
    inputTokens: usageByTurn.reduce((s, u) => s + u.input, 0),
    outputTokens: usageByTurn.reduce((s, u) => s + u.output, 0),
    cachedInputTokens: usageByTurn.reduce((s, u) => s + u.cacheRead, 0),
    provider: usageByTurn[0]?.provider || piProvider,
    model: usageByTurn[0]?.model || piModel,
    turns: usageByTurn.length,
  };

  log("info", "request_complete", {
    output_length: output.length,
    event_count: eventCount,
    duration_ms: totalDuration,
    trace_id: traceId,
    usage,
  });

  reportCostEvent(usage).catch(() => {});

  // Jidoka: zero-output detection
  if (usage.outputTokens === 0) {
    log("error", "andon_zero_output", {
      trace_id: traceId, model: usage.model, provider: usage.provider, turns: usage.turns,
    });
    trackRun(traceId, {
      status: "failed", completedAt: new Date().toISOString(), output,
      usage, sessionId, error: "zero output tokens — model returned empty response",
    });
    releaseSlot();
    return;
  }

  // Jidoka: required tool check (post-run)
  if (validationConfig.requiredTools.length > 0) {
    const missing = validationConfig.requiredTools.filter(t => !toolCalls[t]);
    if (missing.length > 0) {
      log("error", "andon_required_tools_missing", {
        trace_id: traceId, missing, toolCalls, turns: usage.turns,
      });
      trackRun(traceId, {
        status: "failed", completedAt: new Date().toISOString(), output,
        usage, sessionId,
        error: `required tools never called: ${missing.join(", ")}`,
      });
      releaseSlot();
      return;
    }
  }

  // Jidoka: required artifact type check (post-run)
  if (validationConfig.requiredArtifactType && ARTIFACT_SERVICE_URL) {
    try {
      const resp = await fetch(
        `${ARTIFACT_SERVICE_URL}/artifacts?run_id=${sessionId}&artifact_type=${validationConfig.requiredArtifactType}&limit=1`,
        { headers: { "x-agent-name": AGENT_NAME } }
      );
      if (resp.ok) {
        const arts = await resp.json() as any[];
        if (arts.length === 0) {
          log("error", "andon_missing_artifact", {
            trace_id: traceId, required_type: validationConfig.requiredArtifactType,
            session_id: sessionId, turns: usage.turns,
          });
          trackRun(traceId, {
            status: "failed", completedAt: new Date().toISOString(), output,
            usage, sessionId,
            error: `no ${validationConfig.requiredArtifactType} artifact produced`,
          });
          releaseSlot();
          return;
        }
      }
    } catch (err: any) {
      log("warn", "artifact_check_failed", { error: err.message, trace_id: traceId });
    }
  }

  trackRun(traceId, { status: "completed", completedAt: new Date().toISOString(), output, usage, sessionId });
  releaseSlot();
}

// --- Fastify app ---

const app = Fastify({
  logger: false,
  genReqId: () => randomUUID().replace(/-/g, ""),
  bodyLimit: MAX_BODY_BYTES,
  requestTimeout: 30_000,
});

// --- Routes ---

app.get("/health", async () => ({
  status: services ? "ok" : "starting",
  uptime_s: Math.floor((Date.now() - bootTime) / 1000),
  version: VERSION,
  config: { provider: piProvider, model: piModel, port: PORT },
  busy: activeCount >= MAX_CONCURRENT,
  queue_depth: waitQueue.length,
  queue_max: QUEUE_MAX_DEPTH,
  runs_active: [...runs.values()].filter(r => r.status === "queued" || r.status === "running").length,
}));

app.get("/metrics", async () => {
  const totalDuration = metrics.durations.reduce((s, d) => s + d, 0);
  const avgDuration = metrics.durations.length > 0
    ? Math.round(totalDuration / metrics.durations.length)
    : 0;
  return {
    requests_total: metrics.requests_total,
    requests_active: metrics.requests_active,
    requests_failed: metrics.requests_failed,
    avg_duration_ms: avgDuration,
    last_request_at: metrics.last_request_at,
    cold_start_ms: metrics.cold_start_ms,
    queue_depth: waitQueue.length,
    runs_completed: [...runs.values()].filter(r => r.status === "completed").length,
    runs_active: [...runs.values()].filter(r => r.status === "queued" || r.status === "running").length,
  };
});

app.get("/describe", async () => {
  const busy = activeCount >= MAX_CONCURRENT && waitQueue.length >= QUEUE_MAX_DEPTH;
  let tools: string[] = [];
  let extensions: string[] = [];
  if (services) {
    try {
      const ext = services.resourceLoader.getExtensions();
      extensions = ext.extensions.map((e: any) => e.name || e.path?.split("/").pop() || "unknown");
    } catch { /* non-fatal */ }
    try {
      tools = services.resourceLoader.getTools?.()?.map((t: any) => t.name) || [];
    } catch { /* non-fatal */ }
  }
  return {
    name: agentMeta.name,
    description: agentMeta.description,
    role: agentMeta.role,
    capabilities: agentMeta.capabilities,
    model: `${piProvider}/${piModel}`,
    tools,
    extensions,
    status: !services ? "starting" : busy ? "busy" : "ready",
  };
});

app.get("/status/:runId", async (req, reply) => {
  const run = runs.get(req.params.runId);
  if (!run) return reply.code(404).send({ error: "not_found" });
  const startMs = run.startedAtMs || Date.parse(run.startedAt) || Date.now();
  const durationMs = run.completedAt ? (Date.parse(run.completedAt) - startMs) : (Date.now() - startMs);
  return {
    runId: req.params.runId,
    state: run.status,
    startedAt: run.startedAt,
    durationMs,
    progress: { turnCount: run.turnCount || 0 },
  };
});

app.get("/result/:runId", async (req, reply) => {
  const run = runs.get(req.params.runId);
  if (!run) return reply.code(404).send({ error: "not_found" });
  if (run.status === "queued" || run.status === "running") {
    return reply.code(409).send({ error: "still_running", state: run.status });
  }
  const startMs = run.startedAtMs || Date.parse(run.startedAt) || Date.now();
  const durationMs = run.completedAt ? (Date.parse(run.completedAt) - startMs) : (Date.now() - startMs);
  const u = run.usage || {};
  return {
    runId: req.params.runId,
    state: run.status === "timeout" ? "failed" : run.status,
    output: run.output || "",
    error: run.error || null,
    usage: {
      input: u.inputTokens || 0,
      output: u.outputTokens || 0,
      cacheRead: u.cachedInputTokens || 0,
      cost: 0,
      turns: u.turns || 0,
    },
    durationMs,
    model: u.model || `${piProvider}/${piModel}`,
  };
});

app.post("/cancel/:runId", async (req, reply) => {
  const { runId } = req.params;
  const run = runs.get(runId);
  if (!run) return reply.code(404).send({ error: "not_found" });
  if (run.status !== "queued" && run.status !== "running") {
    return reply.code(409).send({ error: "already_finished", state: run.status });
  }
  if (run.status === "queued") {
    metrics.requests_active--;
  }
  const abort = activeAborts.get(runId);
  if (abort) abort.abort();
  activeAborts.delete(runId);
  trackRun(runId, { status: "cancelled", completedAt: new Date().toISOString(), error: "cancelled by orchestrator" });
  log("info", "run_cancelled", { trace_id: runId });
  return { runId, state: "cancelled" };
});

app.get("/runs/:runId", async (req, reply) => {
  const run = runs.get(req.params.runId);
  if (!run) return reply.code(404).send({ error: "not_found" });
  return { runId: req.params.runId, ...run };
});

app.post("/invoke", async (req, reply) => {
  if (!services) {
    return reply.code(503).send({ error: "starting", detail: "services not ready" });
  }

  const requestStart = Date.now();
  const traceId = req.id;
  metrics.requests_total++;
  metrics.requests_active++;
  metrics.last_request_at = new Date().toISOString();

  log("info", "request_received", { method: req.method, url: req.url, trace_id: traceId });

  if (activeCount >= MAX_CONCURRENT && waitQueue.length >= QUEUE_MAX_DEPTH) {
    metrics.requests_active--;
    metrics.requests_failed++;
    return reply.code(429).send({ error: "queue_full", detail: `${waitQueue.length}/${QUEUE_MAX_DEPTH}` });
  }

  const body = req.body as any;
  const correlationId = body.correlationId || traceId;
  const traceparent = body.traceparent || null;

  const abortController = new AbortController();
  activeAborts.set(traceId, abortController);

  trackRun(traceId, {
    status: "queued",
    startedAt: new Date().toISOString(),
    startedAtMs: Date.now(),
    wakeReason: body.context?.wakeReason || "heartbeat",
    correlationId,
    traceparent,
    output: null,
    error: null,
    usage: null,
    turnCount: 0,
  });

  log("info", "request_accepted", { trace_id: traceId, correlation_id: correlationId, traceparent });

  reply
    .code(202)
    .header("x-request-id", traceId)
    .send({ runId: traceId, status: "accepted" });

  acquireSlot()
    .then(() => processInvocation(body, traceId, requestStart, abortController))
    .catch((err) => {
      log("error", "invocation_failed", { trace_id: traceId, error: (err as Error).message });
      metrics.requests_active--;
      metrics.requests_failed++;
      activeAborts.delete(traceId);
      trackRun(traceId, { status: "failed", completedAt: new Date().toISOString(), error: (err as Error).message });
      releaseSlot();
    });
});

// --- Startup ---

const start = async () => {
  log("info", "server_start", { port: PORT, provider: piProvider, model: piModel, version: VERSION });

  try {
    await initServices();
  } catch (err: any) {
    log("error", "services_init_failed", { error: err.message });
    process.exit(1);
  }

  const extCount = services.resourceLoader.getExtensions().extensions.length;
  log("info", "ready", { startup_ms: Date.now() - bootTime, agent_name: AGENT_NAME, extensions: extCount });

  await app.listen({ port: PORT, host: "0.0.0.0" });
};

start();

// --- Graceful shutdown ---

let shuttingDown = false;

async function shutdown(reason: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("info", "shutdown", { reason, active: activeCount, queued: waitQueue.length });

  for (const [runId, abort] of activeAborts) {
    abort.abort();
    trackRun(runId, { status: "cancelled", completedAt: new Date().toISOString(), error: `shutdown: ${reason}` });
  }

  const GRACE_MS = Math.min(BRIDGE_TIMEOUT_MS, 30_000);
  const drainDeadline = Date.now() + GRACE_MS;

  while (activeCount > 0 && Date.now() < drainDeadline) {
    await new Promise(r => setTimeout(r, 250));
  }

  if (activeCount > 0) {
    log("warn", "shutdown_forced", { reason, still_active: activeCount });
  }

  await app.close();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
