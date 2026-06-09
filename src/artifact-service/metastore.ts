import postgres from "postgres";
import type { ArtifactRecord, ListQuery, EdgeRecord, EdgeInsert } from "./types";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://artifact:artifact-eval@postgres:5432/artifact_store";

const sql = postgres(DATABASE_URL);

/** Insert an artifact record into Postgres. */
export async function insertArtifact(record: ArtifactRecord): Promise<void> {
  await sql`
    INSERT INTO artifacts (
      id, filename, artifact_type, mime_type, agent_name,
      run_id, workspace, bucket, s3_key,
      content_hash, size_bytes, metadata, created_at
    ) VALUES (
      ${record.id},
      ${record.filename},
      ${record.artifact_type},
      ${record.mime_type},
      ${record.agent_name},
      ${record.run_id},
      ${record.workspace},
      ${record.bucket},
      ${record.s3_key},
      ${record.content_hash},
      ${record.size_bytes},
      ${JSON.stringify(record.metadata)}::jsonb,
      ${record.created_at}
    )
  `;
}

/** Find an existing artifact by content hash. Returns null when no match. */
export async function findByContentHash(
  hash: string,
): Promise<ArtifactRecord | null> {
  const rows = await sql`
    SELECT
      id, filename, artifact_type, mime_type, agent_name,
      run_id, workspace, bucket, s3_key,
      content_hash, size_bytes, metadata, created_at
    FROM artifacts
    WHERE content_hash = ${hash}
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  return toRecord(rows[0]);
}

/** Look up a single artifact by id. Returns null when not found. */
export async function getArtifactById(
  id: string,
): Promise<ArtifactRecord | null> {
  const rows = await sql`
    SELECT
      id, filename, artifact_type, mime_type, agent_name,
      run_id, workspace, bucket, s3_key,
      content_hash, size_bytes, metadata, created_at
    FROM artifacts
    WHERE id = ${id}
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  return toRecord(rows[0]);
}

/**
 * List artifacts matching the given filters.
 *
 * Dynamically builds a WHERE clause. Supports JSONB containment via @>.
 * Results ordered by created_at DESC.
 */
export async function listArtifacts(
  filters: ListQuery,
): Promise<ArtifactRecord[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 0;

  const addCondition = (clause: string, value: unknown) => {
    paramIdx++;
    conditions.push(clause.replace("?", `$${paramIdx}`));
    values.push(value);
  };

  if (filters.agent_name) addCondition("agent_name = ?", filters.agent_name);
  if (filters.artifact_type)
    addCondition("artifact_type = ?", filters.artifact_type);
  if (filters.run_id) addCondition("run_id = ?", filters.run_id);
  if (filters.bucket) addCondition("bucket = ?", filters.bucket);
  if (filters.since) addCondition("created_at >= ?", filters.since);
  if (filters.metadata)
    addCondition("metadata @> ?::jsonb", JSON.stringify(filters.metadata));

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT
      id, filename, artifact_type, mime_type, agent_name,
      run_id, workspace, bucket, s3_key,
      content_hash, size_bytes, metadata, created_at
    FROM artifacts
    ${whereClause}
    ORDER BY created_at DESC
  `;

  const rows = await sql.unsafe(query, values) as Record<string, unknown>[];
  return rows.map(toRecord);
}

/**
 * Merge new metadata into an existing artifact's metadata (JSONB || operator).
 * Returns the updated record, or null if the id does not exist.
 */
export async function updateMetadata(
  id: string,
  metadata: Record<string, unknown>,
): Promise<ArtifactRecord | null> {
  const rows = await sql`
    UPDATE artifacts
    SET metadata = metadata || ${JSON.stringify(metadata)}::jsonb
    WHERE id = ${id}
    RETURNING
      id, filename, artifact_type, mime_type, agent_name,
      run_id, workspace, bucket, s3_key,
      content_hash, size_bytes, metadata, created_at
  `;

  if (rows.length === 0) return null;
  return toRecord(rows[0]);
}

/** Health check — run a trivial query to confirm Postgres is reachable. */
export async function checkConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Lineage edges
// ---------------------------------------------------------------------------

/** Insert one or more lineage edges. Skips duplicates (ON CONFLICT DO NOTHING). */
export async function insertEdges(edges: EdgeInsert[]): Promise<void> {
  if (edges.length === 0) return;
  for (const e of edges) {
    await sql`
      INSERT INTO artifact_edges (source_id, target_id, edge_type, metadata)
      VALUES (
        ${e.source_id},
        ${e.target_id},
        ${e.edge_type},
        ${JSON.stringify(e.metadata ?? {})}::jsonb
      )
      ON CONFLICT (source_id, target_id, edge_type) DO NOTHING
    `;
  }
}

/** Get all edges where the given artifact is source or target. */
export async function getEdgesByArtifact(
  artifactId: string,
): Promise<EdgeRecord[]> {
  const rows = await sql`
    SELECT source_id, target_id, edge_type, metadata, created_at
    FROM artifact_edges
    WHERE source_id = ${artifactId} OR target_id = ${artifactId}
    ORDER BY created_at
  `;
  return rows.map(toEdge);
}

/** Get all edges for artifacts within a run. */
export async function getEdgesByRunId(
  runId: string,
): Promise<EdgeRecord[]> {
  const rows = await sql`
    SELECT e.source_id, e.target_id, e.edge_type, e.metadata, e.created_at
    FROM artifact_edges e
    JOIN artifacts a ON a.id = e.source_id OR a.id = e.target_id
    WHERE a.run_id = ${runId}
    GROUP BY e.source_id, e.target_id, e.edge_type, e.metadata, e.created_at
    ORDER BY e.created_at
  `;
  return rows.map(toEdge);
}

/** Delete edges by source, target, or both. */
export async function deleteEdges(
  filter: { source_id?: string; target_id?: string },
): Promise<number> {
  if (!filter.source_id && !filter.target_id) return 0;

  if (filter.source_id && filter.target_id) {
    const result = await sql`
      DELETE FROM artifact_edges
      WHERE source_id = ${filter.source_id} AND target_id = ${filter.target_id}
    `;
    return result.count;
  }
  if (filter.source_id) {
    const result = await sql`
      DELETE FROM artifact_edges WHERE source_id = ${filter.source_id}
    `;
    return result.count;
  }
  const result = await sql`
    DELETE FROM artifact_edges WHERE target_id = ${filter.target_id}
  `;
  return result.count;
}

/** Recursive CTE: get ancestors (upstream) of an artifact. */
export async function getAncestors(
  artifactId: string,
  maxDepth: number = 10,
): Promise<Array<{ source_id: string; target_id: string; edge_type: string; depth: number }>> {
  const rows = await sql`
    WITH RECURSIVE lineage AS (
      SELECT source_id, target_id, edge_type, 1 as depth
      FROM artifact_edges WHERE target_id = ${artifactId}
      UNION ALL
      SELECT e.source_id, e.target_id, e.edge_type, l.depth + 1
      FROM artifact_edges e JOIN lineage l ON e.target_id = l.source_id
      WHERE l.depth < ${maxDepth}
    )
    SELECT DISTINCT source_id, target_id, edge_type, depth FROM lineage
    ORDER BY depth
  `;
  return rows as Array<{ source_id: string; target_id: string; edge_type: string; depth: number }>;
}

/** Recursive CTE: get descendants (downstream) of an artifact. */
export async function getDescendants(
  artifactId: string,
  maxDepth: number = 10,
): Promise<Array<{ source_id: string; target_id: string; edge_type: string; depth: number }>> {
  const rows = await sql`
    WITH RECURSIVE lineage AS (
      SELECT source_id, target_id, edge_type, 1 as depth
      FROM artifact_edges WHERE source_id = ${artifactId}
      UNION ALL
      SELECT e.source_id, e.target_id, e.edge_type, l.depth + 1
      FROM artifact_edges e JOIN lineage l ON e.source_id = l.target_id
      WHERE l.depth < ${maxDepth}
    )
    SELECT DISTINCT source_id, target_id, edge_type, depth FROM lineage
    ORDER BY depth
  `;
  return rows as Array<{ source_id: string; target_id: string; edge_type: string; depth: number }>;
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

/** Map a raw DB row to a typed EdgeRecord. */
function toEdge(row: Record<string, unknown>): EdgeRecord {
  return {
    source_id: row.source_id as string,
    target_id: row.target_id as string,
    edge_type: row.edge_type as EdgeRecord["edge_type"],
    metadata:
      typeof row.metadata === "string"
        ? JSON.parse(row.metadata)
        : (row.metadata as Record<string, unknown>) ?? {},
    created_at:
      row.created_at instanceof Date
        ? row.created_at
        : new Date(row.created_at as string),
  };
}

/** Map a raw DB row to a typed ArtifactRecord. */
function toRecord(row: Record<string, unknown>): ArtifactRecord {
  return {
    id: row.id as string,
    filename: row.filename as string,
    artifact_type: row.artifact_type as string,
    mime_type: row.mime_type as string,
    agent_name: row.agent_name as string,
    run_id: (row.run_id as string) ?? null,
    workspace: row.workspace as string,
    bucket: row.bucket as string,
    s3_key: row.s3_key as string,
    content_hash: row.content_hash as string,
    size_bytes: row.size_bytes as number,
    metadata:
      typeof row.metadata === "string"
        ? JSON.parse(row.metadata)
        : (row.metadata as Record<string, unknown>) ?? {},
    created_at:
      row.created_at instanceof Date
        ? row.created_at
        : new Date(row.created_at as string),
  };
}
