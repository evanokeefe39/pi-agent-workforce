import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { createLogger } from "./logger.mjs";
import {
  createAgentSessionServices,
  createAgentSession,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import { init as initReplicator, startWatcher, waitForSession, getStatus as getReplicatorStatus } from "./replicator.js";
import { createArtifactStore } from "./artifact-store.js";
import {
  type ValidationConfig,
  type UsageRecord,
  validateRun,
  checkMidRunTools,
  checkMaxTurns,
} from "./jidoka.js";

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
const VERSION = "5.2.0";
const SESSIONS_ROOT = "/workspace/sessions";
const CWD = "/workspace/scratch";
const REPLICATION_TIMEOUT_MS = parseInt(process.env.REPLICATION_TIMEOUT_MS || "10000", 10);
const MAX_PROMPT_RETRIES = parseInt(process.env.MAX_PROMPT_RETRIES || "2", 10);
const SDK_MESSAGE_ROLE_ERROR = /Cannot continue from message role/;

const COST_REPORT_URL = process.env.COST_REPORT_URL || "";
const COST_REPORT_KEY = process.env.COST_REPORT_KEY || "";
const AGENT_ID = process.env.AGENT_ID || "";
const WORKSPACE_ID = process.env.WORKSPACE_ID || "";
const ARTIFACT_SERVICE_URL = process.env.ARTIFACT_SERVICE_URL || "";

let piProvider = "unknown";
let piModel = "unknown";
let otelApi: any = null;
let tracer: any = null;
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

async function processInvocation(body: any, requestId: string, requestStart: number, abortController: AbortController) {
  const run = runs.get(requestId);
  if (!run || run.status === "cancelled") {
    releaseSlot();
    return;
  }

  trackRun(requestId, { status: "running", sessionDir: null });

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

  // Session-scoped working directory — each invocation gets its own sandbox
  const sessionDir = `${SESSIONS_ROOT}/${requestId}`;
  try {
    mkdirSync(`${sessionDir}/workproduct`, { recursive: true });
    mkdirSync(`${sessionDir}/output`, { recursive: true });
    mkdirSync(`${sessionDir}/scratch`, { recursive: true });
  } catch { /* non-fatal */ }

  let session: any;
  try {
    const result = await createAgentSession({
      cwd: sessionDir,
      agentDir: services.agentDir,
      authStorage: services.authStorage,
      settingsManager: services.settingsManager,
      modelRegistry: services.modelRegistry,
      resourceLoader: services.resourceLoader,
      sessionManager: SessionManager.inMemory(sessionDir),
      sessionStartEvent: { type: "session_start", reason: "new" },
    });
    session = result.session;
  } catch (err: any) {
    metrics.requests_failed++;
    log("error", "session_create_failed", { error: err.message, request_id: requestId });
    trackRun(requestId, { status: "failed", completedAt: new Date().toISOString(), error: err.message });
    metrics.requests_active--;
    releaseSlot();
    return;
  }

  const sessionId = session.sessionId;
  await session.bindExtensions({});
  trackRun(requestId, { sessionDir });
  log("info", "session_created", { session_id: sessionId, session_dir: sessionDir, request_id: requestId, correlation_id: body.correlationId || null });

  const usageByTurn: Array<{ provider: string; model: string; input: number; output: number; cacheRead: number }> = [];
  const toolCalls: Record<string, number> = {};
  let output = "";
  let eventCount = 0;

  function handleSessionEvent(event: any) {
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
      trackRun(requestId, { turnCount });

      const maxCheck = checkMaxTurns(validationConfig, turnCount);
      if (!maxCheck.pass) {
        log("error", "andon_max_turns", { request_id: requestId, turns: turnCount, limit: validationConfig.maxTurns });
        abortController.abort();
      }

      const midCheck = checkMidRunTools(validationConfig, toolCalls, turnCount);
      for (const w of midCheck.warnings) {
        log("warn", "andon_missing_tools", { request_id: requestId, turns: turnCount, detail: w, toolCalls });
      }
    }
  }

  session.subscribe(handleSessionEvent);
  log("info", "prompt_sent", { prompt_length: prompt.length, request_id: requestId });

  let promptSuccess = false;

  for (let attempt = 1; attempt <= MAX_PROMPT_RETRIES; attempt++) {
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
      clearTimeout(timeoutId);
      promptSuccess = true;
      break;
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = err.message === "timeout";
      const isCancelled = err.message === "cancelled";
      const isSdkMessageBug = SDK_MESSAGE_ROLE_ERROR.test(err.message);

      if (isTimeout || isCancelled || !isSdkMessageBug) {
        metrics.requests_failed++;
        log(isCancelled ? "info" : "error", "prompt_failed", { error: err.message, request_id: requestId });
        trackRun(requestId, {
          status: isCancelled ? "cancelled" : isTimeout ? "timeout" : "failed",
          completedAt: new Date().toISOString(),
          error: err.message,
        });
        activeAborts.delete(requestId);
        metrics.requests_active--;
        releaseSlot();
        return;
      }

      log("warn", "sdk_message_role_error", {
        request_id: requestId, attempt, output_length: output.length, turns: usageByTurn.length, error: err.message,
      });

      if (output.length > 0) {
        log("info", "degraded_success", {
          request_id: requestId, output_length: output.length, turns: usageByTurn.length,
          detail: "subagents completed, planner crashed on continuation — returning captured output",
        });
        promptSuccess = true;
        break;
      }

      if (attempt < MAX_PROMPT_RETRIES) {
        log("info", "prompt_retry", { request_id: requestId, next_attempt: attempt + 1 });
        try {
          const retryResult = await createAgentSession({
            cwd: sessionDir,
            agentDir: services.agentDir,
            authStorage: services.authStorage,
            settingsManager: services.settingsManager,
            modelRegistry: services.modelRegistry,
            resourceLoader: services.resourceLoader,
            sessionManager: SessionManager.inMemory(sessionDir),
            sessionStartEvent: { type: "session_start", reason: "new" },
          });
          session = retryResult.session;
          session.subscribe(handleSessionEvent);
        } catch (sessionErr: any) {
          log("error", "retry_session_failed", { request_id: requestId, error: sessionErr.message });
          metrics.requests_failed++;
          trackRun(requestId, {
            status: "failed", completedAt: new Date().toISOString(),
            error: `retry session failed: ${sessionErr.message} (original: ${err.message})`,
          });
          activeAborts.delete(requestId);
          metrics.requests_active--;
          releaseSlot();
          return;
        }
      }
    }
  }

  if (!promptSuccess) {
    metrics.requests_failed++;
    log("error", "prompt_retries_exhausted", { request_id: requestId, attempts: MAX_PROMPT_RETRIES });
    trackRun(requestId, {
      status: "failed", completedAt: new Date().toISOString(),
      error: `SDK message role error after ${MAX_PROMPT_RETRIES} attempts`,
    });
    activeAborts.delete(requestId);
    metrics.requests_active--;
    releaseSlot();
    return;
  }
  activeAborts.delete(requestId);

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
    request_id: requestId,
    usage,
  });

  reportCostEvent(usage).catch(() => {});

  // Jidoka: post-run validation (zero output + required tools)
  const validation = validateRun(validationConfig, toolCalls, usage);
  if (!validation.pass) {
    for (const err of validation.errors) {
      log("error", "andon_validation_failed", { request_id: requestId, error: err, toolCalls, turns: usage.turns });
    }
    trackRun(requestId, {
      status: "failed", completedAt: new Date().toISOString(), output,
      usage, sessionId, error: validation.errors.join("; "),
    });
    releaseSlot();
    return;
  }

  // Agent-complete gate: wait for file replication before marking done
  const repl = await waitForSession(sessionDir, REPLICATION_TIMEOUT_MS);
  if (!repl.ok) {
    log("error", "andon_replication_incomplete", {
      request_id: requestId, outstanding: repl.outstanding, session_dir: sessionDir,
    });
    trackRun(requestId, {
      status: "failed", completedAt: new Date().toISOString(), output,
      usage, sessionId,
      error: `replication incomplete: ${repl.outstanding} files not synced to storage`,
    });
    releaseSlot();
    return;
  }

  trackRun(requestId, { status: "completed", completedAt: new Date().toISOString(), output, usage, sessionId });
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
  log("info", "run_cancelled", { request_id: runId });
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
  const requestId = req.id;
  metrics.requests_total++;
  metrics.requests_active++;
  metrics.last_request_at = new Date().toISOString();

  log("info", "request_received", { method: req.method, url: req.url, request_id: requestId });

  if (activeCount >= MAX_CONCURRENT && waitQueue.length >= QUEUE_MAX_DEPTH) {
    metrics.requests_active--;
    metrics.requests_failed++;
    return reply.code(429).send({ error: "queue_full", detail: `${waitQueue.length}/${QUEUE_MAX_DEPTH}` });
  }

  const body = req.body as any;
  const correlationId = body.correlationId || requestId;

  // Extract OTel trace context from incoming HTTP headers
  let parentCtx: any = null;
  let invokeSpan: any = null;
  if (otelApi && tracer) {
    parentCtx = otelApi.propagation.extract(otelApi.context.active(), req.headers);
    invokeSpan = tracer.startSpan(`${AGENT_NAME} invoke`, {
      kind: otelApi.SpanKind.SERVER,
      attributes: {
        "http.method": "POST",
        "http.url": "/invoke",
        "agent.name": AGENT_NAME,
        "request.id": requestId,
      },
    }, parentCtx);
  }

  const abortController = new AbortController();
  activeAborts.set(requestId, abortController);

  trackRun(requestId, {
    status: "queued",
    startedAt: new Date().toISOString(),
    startedAtMs: Date.now(),
    wakeReason: body.context?.wakeReason || "heartbeat",
    correlationId,
    output: null,
    error: null,
    usage: null,
    turnCount: 0,
  });

  log("info", "request_accepted", { request_id: requestId, correlation_id: correlationId });

  reply
    .code(202)
    .header("x-request-id", requestId)
    .send({ runId: requestId, status: "accepted" });

  const invokeCtx = invokeSpan && otelApi
    ? otelApi.trace.setSpan(parentCtx, invokeSpan)
    : null;

  const runInvocation = async () => {
    try {
      await acquireSlot();
      await processInvocation(body, requestId, requestStart, abortController);
    } catch (err) {
      log("error", "invocation_failed", { request_id: requestId, error: (err as Error).message });
      metrics.requests_active--;
      metrics.requests_failed++;
      activeAborts.delete(requestId);
      trackRun(requestId, { status: "failed", completedAt: new Date().toISOString(), error: (err as Error).message });
      releaseSlot();
      if (invokeSpan && otelApi) {
        invokeSpan.setStatus({ code: otelApi.SpanStatusCode.ERROR, message: (err as Error).message });
      }
    } finally {
      if (invokeSpan) invokeSpan.end();
    }
  };

  if (invokeCtx && otelApi) {
    otelApi.context.with(invokeCtx, runInvocation);
  } else {
    runInvocation();
  }
});

// --- Startup ---

const start = async () => {
  try {
    otelApi = await import("@opentelemetry/api");
    tracer = otelApi.trace.getTracer("agent-server");
  } catch { /* @opentelemetry/api not available — hooks will no-op */ }

  log("info", "server_start", { port: PORT, provider: piProvider, model: piModel, version: VERSION });

  try {
    await initServices();
  } catch (err: any) {
    log("error", "services_init_failed", { error: err.message });
    process.exit(1);
  }

  const extCount = services.resourceLoader.getExtensions().extensions.length;

  initReplicator(createArtifactStore(), log);
  startWatcher();

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
