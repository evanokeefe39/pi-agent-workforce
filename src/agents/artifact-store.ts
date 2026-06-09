/**
 * Artifact store abstraction.
 *
 * Interface for uploading, querying, and reading artifacts.
 * Replicator depends on this interface, not on HTTP directly.
 * HTTP implementation calls the artifact service REST API.
 */

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface UploadRequest {
  filename: string;
  content: Buffer;
  artifact_type: string;
  agent_name: string;
  run_id: string;
  workspace?: string;
  mime?: string;
  metadata?: Record<string, unknown>;
}

export interface UploadResult {
  id: string;
  ref?: string;
  hash: string;
  size: number;
  deduplicated: boolean;
}

export interface QueryFilters {
  agent?: string;
  type?: string;
  run_id?: string;
  since?: string;
  limit?: number;
}

export interface ArtifactRecord {
  id: string;
  filename: string;
  artifact_type: string;
  agent_name: string;
  run_id: string;
  size_bytes: number;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface ReadResult {
  content: Buffer;
  metadata: ArtifactRecord;
}

export interface ArtifactStore {
  upload(req: UploadRequest): Promise<UploadResult>;
  query(filters: QueryFilters): Promise<ArtifactRecord[]>;
  read(id: string): Promise<ReadResult>;
  healthy(): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// HTTP implementation — calls artifact service REST API
// ---------------------------------------------------------------------------

export class HttpArtifactStore implements ArtifactStore {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async upload(req: UploadRequest): Promise<UploadResult> {
    const resp = await fetch(`${this.baseUrl}/artifacts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-agent-name": req.agent_name,
      },
      body: JSON.stringify({
        filename: req.filename,
        content: req.content.toString("base64"),
        type: req.artifact_type,
        mime: req.mime || "application/octet-stream",
        run_id: req.run_id,
        workspace: req.workspace || "default",
        metadata: req.metadata || {},
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`upload failed: ${resp.status} ${body}`);
    }

    const data = await resp.json() as Record<string, unknown>;
    return {
      id: data.id as string,
      ref: data.ref as string | undefined,
      hash: data.hash as string,
      size: data.size as number,
      deduplicated: (data.deduplicated as boolean) || false,
    };
  }

  async query(filters: QueryFilters): Promise<ArtifactRecord[]> {
    const params = new URLSearchParams();
    if (filters.agent) params.set("agent", filters.agent);
    if (filters.type) params.set("artifact_type", filters.type);
    if (filters.run_id) params.set("run_id", filters.run_id);
    if (filters.since) params.set("since", filters.since);
    if (filters.limit) params.set("limit", String(filters.limit));

    const resp = await fetch(`${this.baseUrl}/artifacts?${params}`, {
      headers: { "x-agent-name": "system" },
    });

    if (!resp.ok) throw new Error(`query failed: ${resp.status}`);
    return await resp.json() as ArtifactRecord[];
  }

  async read(id: string): Promise<ReadResult> {
    const resp = await fetch(`${this.baseUrl}/artifacts/${id}`, {
      headers: { "x-agent-name": "system" },
    });

    if (!resp.ok) throw new Error(`read failed: ${resp.status}`);

    const contentType = resp.headers.get("content-type") || "application/octet-stream";
    const buf = Buffer.from(await resp.arrayBuffer());

    const metadata: ArtifactRecord = {
      id,
      filename: "",
      artifact_type: "",
      agent_name: "",
      run_id: "",
      size_bytes: buf.length,
      created_at: "",
      metadata: {},
    };

    return { content: buf, metadata };
  }

  async healthy(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/health`);
      if (!resp.ok) return false;
      const data = await resp.json() as Record<string, unknown>;
      return data.status === "ok";
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createArtifactStore(url?: string): ArtifactStore | null {
  const baseUrl = url || process.env.ARTIFACT_SERVICE_URL;
  if (!baseUrl) return null;
  return new HttpArtifactStore(baseUrl);
}
