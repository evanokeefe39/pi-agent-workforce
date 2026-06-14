import { describe, it, expect } from "bun:test";

// ---------------------------------------------------------------------------
// Pure functions extracted from server.ts OpenAI compat + SSE logic.
// These mirror the server implementation so we can test the logic without
// booting Fastify or requiring the Pi SDK.
// ---------------------------------------------------------------------------

/**
 * Extract task and optional system-message context from an OpenAI-style
 * messages array.  Returns null when no user message is present.
 */
function extractTaskFromMessages(
  messages: Array<{ role: string; content: unknown }>,
): { task: string; context?: string } | null {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) return null;

  const systemMsgs = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content as string);
  const context = systemMsgs.length > 0 ? systemMsgs.join("\n\n") : undefined;

  const task =
    typeof lastUserMsg.content === "string"
      ? lastUserMsg.content
      : JSON.stringify(lastUserMsg.content);

  return { task, context };
}

/** Build the model ID string the server advertises. */
function formatModelId(agentName: string): string {
  return `pi/${agentName}`;
}

/** Validate that a chunk object conforms to OpenAI streaming shape. */
function validateOpenAIChunk(chunk: Record<string, unknown>): boolean {
  return (
    chunk.object === "chat.completion.chunk" &&
    Array.isArray(chunk.choices) &&
    (chunk.choices as unknown[]).length > 0 &&
    "delta" in (chunk.choices as any[])[0] &&
    typeof chunk.id === "string" &&
    (chunk.id as string).startsWith("chatcmpl-")
  );
}

/** Format a single SSE data frame for an OpenAI streaming chunk. */
function formatSseChunk(
  completionId: string,
  created: number,
  modelId: string,
  content: string | null,
  finishReason: string | null,
): string {
  const chunk = {
    id: completionId,
    object: "chat.completion.chunk",
    created,
    model: modelId,
    choices: [
      {
        index: 0,
        delta: content !== null ? { content } : {},
        finish_reason: finishReason,
      },
    ],
  };
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/**
 * Check a Bearer-token authorization header.
 * Returns true when access should be granted.
 *
 * Rules (matching server.ts):
 *  - When requiredKey is empty, auth is disabled (always granted).
 *  - Otherwise the header must be exactly `Bearer <requiredKey>`.
 */
function checkAuth(
  requiredKey: string,
  authHeader: string | undefined,
): boolean {
  if (!requiredKey) return true; // auth disabled
  if (!authHeader) return false;
  return authHeader === `Bearer ${requiredKey}`;
}

// ===========================================================================
// Tests
// ===========================================================================

// ---------------------------------------------------------------------------
// extractTaskFromMessages
// ---------------------------------------------------------------------------

describe("extractTaskFromMessages", () => {
  it("last user message becomes task", () => {
    const result = extractTaskFromMessages([
      { role: "user", content: "Write a poem" },
    ]);
    expect(result).not.toBeNull();
    expect(result!.task).toBe("Write a poem");
    expect(result!.context).toBeUndefined();
  });

  it("system messages become context", () => {
    const result = extractTaskFromMessages([
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello" },
    ]);
    expect(result!.context).toBe("You are a helpful assistant.");
  });

  it("multiple system messages joined with double newline", () => {
    const result = extractTaskFromMessages([
      { role: "system", content: "Rule one." },
      { role: "system", content: "Rule two." },
      { role: "user", content: "Go" },
    ]);
    expect(result!.context).toBe("Rule one.\n\nRule two.");
  });

  it("returns null when no user message", () => {
    const result = extractTaskFromMessages([
      { role: "system", content: "system prompt" },
      { role: "assistant", content: "hello" },
    ]);
    expect(result).toBeNull();
  });

  it("ignores assistant messages", () => {
    const result = extractTaskFromMessages([
      { role: "user", content: "first" },
      { role: "assistant", content: "response" },
      { role: "user", content: "second" },
    ]);
    expect(result!.task).toBe("second");
  });

  it("handles multi-turn conversation (uses LAST user msg)", () => {
    const result = extractTaskFromMessages([
      { role: "user", content: "turn 1" },
      { role: "assistant", content: "ack" },
      { role: "user", content: "turn 2" },
      { role: "assistant", content: "ack" },
      { role: "user", content: "turn 3" },
    ]);
    expect(result!.task).toBe("turn 3");
  });

  it("handles content as array (multimodal)", () => {
    const multiContent = [{ type: "text", text: "describe this image" }];
    const result = extractTaskFromMessages([
      { role: "user", content: multiContent },
    ]);
    expect(result!.task).toBe(JSON.stringify(multiContent));
  });
});

// ---------------------------------------------------------------------------
// formatModelId
// ---------------------------------------------------------------------------

describe("formatModelId", () => {
  it("returns pi/agentName", () => {
    expect(formatModelId("researcher")).toBe("pi/researcher");
    expect(formatModelId("coder")).toBe("pi/coder");
    expect(formatModelId("planner")).toBe("pi/planner");
  });
});

// ---------------------------------------------------------------------------
// validateOpenAIChunk
// ---------------------------------------------------------------------------

describe("validateOpenAIChunk", () => {
  const validChunk = {
    id: "chatcmpl-abc123",
    object: "chat.completion.chunk",
    created: 1700000000,
    model: "pi/researcher",
    choices: [{ index: 0, delta: { content: "hello" }, finish_reason: null }],
  };

  it("valid chunk passes", () => {
    expect(validateOpenAIChunk(validChunk)).toBe(true);
  });

  it("missing id fails", () => {
    const { id, ...noId } = validChunk;
    expect(validateOpenAIChunk(noId)).toBe(false);
  });

  it("wrong id prefix fails", () => {
    expect(validateOpenAIChunk({ ...validChunk, id: "wrong-abc" })).toBe(false);
  });

  it("wrong object type fails", () => {
    expect(
      validateOpenAIChunk({ ...validChunk, object: "chat.completion" }),
    ).toBe(false);
  });

  it("empty choices array fails", () => {
    expect(validateOpenAIChunk({ ...validChunk, choices: [] })).toBe(false);
  });

  it("missing delta in choice fails", () => {
    expect(
      validateOpenAIChunk({
        ...validChunk,
        choices: [{ index: 0, finish_reason: null }],
      }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatSseChunk — SSE format validation
// ---------------------------------------------------------------------------

describe("formatSseChunk", () => {
  const completionId = "chatcmpl-test123";
  const created = 1700000000;
  const modelId = "pi/researcher";

  it("content chunk has delta.content", () => {
    const raw = formatSseChunk(completionId, created, modelId, "hello world", null);
    const parsed = JSON.parse(raw.replace("data: ", "").trim());
    expect(parsed.choices[0].delta.content).toBe("hello world");
    expect(parsed.choices[0].finish_reason).toBeNull();
  });

  it("finish chunk has empty delta and finish_reason=stop", () => {
    const raw = formatSseChunk(completionId, created, modelId, null, "stop");
    const parsed = JSON.parse(raw.replace("data: ", "").trim());
    expect(parsed.choices[0].delta).toEqual({});
    expect(parsed.choices[0].finish_reason).toBe("stop");
  });

  it("output ends with double newline", () => {
    const raw = formatSseChunk(completionId, created, modelId, "x", null);
    expect(raw.endsWith("\n\n")).toBe(true);
  });

  it("output starts with data: prefix", () => {
    const raw = formatSseChunk(completionId, created, modelId, "x", null);
    expect(raw.startsWith("data: ")).toBe(true);
  });

  it("chunk includes correct id, model, and object fields", () => {
    const raw = formatSseChunk(completionId, created, modelId, "test", null);
    const parsed = JSON.parse(raw.replace("data: ", "").trim());
    expect(parsed.id).toBe(completionId);
    expect(parsed.model).toBe(modelId);
    expect(parsed.object).toBe("chat.completion.chunk");
    expect(parsed.created).toBe(created);
  });
});

// ---------------------------------------------------------------------------
// SSE protocol format constants
// ---------------------------------------------------------------------------

describe("SSE protocol formats", () => {
  it("heartbeat is a valid SSE comment (colon-prefixed)", () => {
    const heartbeat = `: heartbeat\n\n`;
    // SSE spec: lines starting with ':' are comments, ignored by EventSource
    expect(heartbeat.startsWith(":")).toBe(true);
    expect(heartbeat.endsWith("\n\n")).toBe(true);
  });

  it("DONE sentinel follows OpenAI convention", () => {
    const done = `data: [DONE]\n\n`;
    expect(done).toBe("data: [DONE]\n\n");
    expect(done.startsWith("data: ")).toBe(true);
    expect(done.endsWith("\n\n")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Auth validation logic
// ---------------------------------------------------------------------------

describe("checkAuth", () => {
  it("no auth required when API key empty", () => {
    expect(checkAuth("", undefined)).toBe(true);
    expect(checkAuth("", "Bearer whatever")).toBe(true);
  });

  it("auth passes with correct Bearer token", () => {
    expect(checkAuth("sk-secret", "Bearer sk-secret")).toBe(true);
  });

  it("auth fails with wrong Bearer token", () => {
    expect(checkAuth("sk-secret", "Bearer wrong-key")).toBe(false);
  });

  it("auth fails with missing Authorization header", () => {
    expect(checkAuth("sk-secret", undefined)).toBe(false);
  });

  it("auth fails with malformed header (no Bearer prefix)", () => {
    expect(checkAuth("sk-secret", "sk-secret")).toBe(false);
  });

  it("auth fails with empty header", () => {
    expect(checkAuth("sk-secret", "")).toBe(false);
  });
});
