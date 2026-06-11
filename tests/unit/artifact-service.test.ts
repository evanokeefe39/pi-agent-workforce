/**
 * Unit tests for artifact-service pure functions that survive R1 refactor.
 *
 * Tests normalizeArtifactType (type validation/aliasing) and
 * errorResponse format. These are extracted from routes.ts.
 * Route handlers that depend on Postgres/MinIO are tested via E2E.
 */
import { describe, it, expect } from "bun:test";

// ---------------------------------------------------------------------------
// Extracted from routes.ts — these are the pure functions we're keeping
// ---------------------------------------------------------------------------

const VALID_ARTIFACT_TYPES = new Set([
  "research", "finding", "log", "dataset", "code", "brief",
  "report", "state", "session", "image", "render", "document",
  "package", "manifest",
]);

const TYPE_ALIASES: Record<string, string> = {
  dataset_ref: "dataset",
  query_result: "dataset",
};

function normalizeArtifactType(raw: string): string {
  if (TYPE_ALIASES[raw]) return TYPE_ALIASES[raw];
  if (VALID_ARTIFACT_TYPES.has(raw)) return raw;
  return "document";
}

function errorResponse(error: string, status: number): Response {
  return Response.json({ error, status }, { status });
}

// ---------------------------------------------------------------------------
// normalizeArtifactType
// ---------------------------------------------------------------------------

describe("normalizeArtifactType", () => {
  it("passes through valid types unchanged", () => {
    for (const type of VALID_ARTIFACT_TYPES) {
      expect(normalizeArtifactType(type)).toBe(type);
    }
  });

  it("aliases dataset_ref to dataset", () => {
    expect(normalizeArtifactType("dataset_ref")).toBe("dataset");
  });

  it("aliases query_result to dataset", () => {
    expect(normalizeArtifactType("query_result")).toBe("dataset");
  });

  it("falls back to document for unknown types", () => {
    expect(normalizeArtifactType("unknown_thing")).toBe("document");
  });

  it("falls back to document for empty string", () => {
    expect(normalizeArtifactType("")).toBe("document");
  });

  it("is case-sensitive — Report is not report", () => {
    expect(normalizeArtifactType("Report")).toBe("document");
  });

  it("handles all 14 valid types", () => {
    expect(VALID_ARTIFACT_TYPES.size).toBe(14);
  });
});

// ---------------------------------------------------------------------------
// errorResponse
// ---------------------------------------------------------------------------

describe("errorResponse", () => {
  it("returns correct status code", async () => {
    const resp = errorResponse("not found", 404);
    expect(resp.status).toBe(404);
  });

  it("returns JSON with error and status fields", async () => {
    const resp = errorResponse("bad request", 400);
    const body = await resp.json() as { error: string; status: number };
    expect(body.error).toBe("bad request");
    expect(body.status).toBe(400);
  });

  it("handles 500 errors", async () => {
    const resp = errorResponse("internal failure", 500);
    expect(resp.status).toBe(500);
    const body = await resp.json() as { error: string };
    expect(body.error).toBe("internal failure");
  });

  it("handles 403 RBAC denial", async () => {
    const resp = errorResponse("write denied by RBAC policy", 403);
    expect(resp.status).toBe(403);
  });

  it("handles 409 integrity check", async () => {
    const resp = errorResponse("integrity check failed: hash mismatch", 409);
    expect(resp.status).toBe(409);
    const body = await resp.json() as { error: string };
    expect(body.error).toContain("integrity");
  });
});

// ---------------------------------------------------------------------------
// S3 key construction (extracted logic)
// ---------------------------------------------------------------------------

describe("S3 key construction", () => {
  function buildS3Key(
    workspace: string,
    runId: string | null,
    agentName: string,
    artifactType: string,
    id: string,
    filename: string,
  ): string {
    const runSegment = runId ?? "no-run";
    return `${workspace}/${runSegment}/${agentName}/${artifactType}/${id}_${filename}`;
  }

  it("builds correct key with all fields", () => {
    const key = buildS3Key("default", "run123", "researcher", "dataset", "01ABC", "findings.jsonl");
    expect(key).toBe("default/run123/researcher/dataset/01ABC_findings.jsonl");
  });

  it("uses no-run when runId is null", () => {
    const key = buildS3Key("default", null, "writer", "report", "01DEF", "doc.md");
    expect(key).toBe("default/no-run/writer/report/01DEF_doc.md");
  });

  it("key structure matches RBAC patterns", () => {
    const key = buildS3Key("default", "run1", "researcher", "dataset", "01ABC", "f.json");
    // RBAC pattern: */*/researcher/**
    expect(key).toMatch(/^[^/]+\/[^/]+\/researcher\/.+/);
  });

  it("different workspaces produce different keys", () => {
    const k1 = buildS3Key("project-a", "run1", "writer", "report", "01", "f.md");
    const k2 = buildS3Key("project-b", "run1", "writer", "report", "01", "f.md");
    expect(k1).not.toBe(k2);
  });
});

// ---------------------------------------------------------------------------
// Write request validation (extracted logic)
// ---------------------------------------------------------------------------

describe("write request validation", () => {
  interface WriteFields {
    filename?: string;
    content?: string;
    type?: string;
  }

  function validateWriteRequest(body: WriteFields): string | null {
    if (!body.filename || !body.content || !body.type) {
      return "missing required fields: filename, content, type";
    }
    return null;
  }

  it("passes with all required fields", () => {
    expect(validateWriteRequest({
      filename: "test.json",
      content: btoa("hello"),
      type: "dataset",
    })).toBeNull();
  });

  it("fails with missing filename", () => {
    expect(validateWriteRequest({
      content: btoa("hello"),
      type: "dataset",
    })).toContain("missing required fields");
  });

  it("fails with missing content", () => {
    expect(validateWriteRequest({
      filename: "test.json",
      type: "dataset",
    })).toContain("missing required fields");
  });

  it("fails with missing type", () => {
    expect(validateWriteRequest({
      filename: "test.json",
      content: btoa("hello"),
    })).toContain("missing required fields");
  });

  it("fails with empty object", () => {
    expect(validateWriteRequest({})).toContain("missing required fields");
  });
});
