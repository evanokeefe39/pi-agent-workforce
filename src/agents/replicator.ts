/**
 * Session artifact replicator.
 *
 * Watches /workspace/sessions/ for .meta.json files. On detection,
 * uploads the paired artifact via ArtifactStore interface.
 * Depends on ArtifactStore abstraction — no direct HTTP calls.
 */

import { watch, readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, basename } from "node:path";
import type { ArtifactStore } from "./artifact-store.js";

interface SidecarContent {
  id: string;
  filename: string;
  artifact_type: string;
  agent_name: string;
  session_id: string;
  created_at: string;
  content_hash: string;
  size_bytes: number;
  mime_type: string;
  tags: string[];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SESSIONS_ROOT = "/workspace/sessions";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const replicated = new Set<string>();
const pending = new Map<string, number>();
let failedCount = 0;
let store: ArtifactStore | null = null;

type LogFn = (level: string, event: string, data?: Record<string, unknown>) => void;
let logFn: LogFn = (level, event, data) => console.log(JSON.stringify({ level, event, ...data }));

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function init(artifactStore: ArtifactStore | null, logger?: LogFn): void {
  store = artifactStore;
  if (logger) logFn = logger;
}

export function startWatcher(): void {
  try {
    if (!existsSync(SESSIONS_ROOT)) {
      const { mkdirSync } = require("node:fs");
      mkdirSync(SESSIONS_ROOT, { recursive: true });
    }

    watch(SESSIONS_ROOT, { recursive: true }, (_eventType, filename) => {
      if (!filename) return;
      if (!filename.endsWith(".meta.json")) return;
      if (filename.includes("/scratch/") || filename.includes("\\scratch\\")) return;

      const metaPath = join(SESSIONS_ROOT, filename);
      if (replicated.has(metaPath)) return;

      pending.set(metaPath, Date.now());

      setTimeout(() => {
        if (pending.has(metaPath)) {
          replicateFile(metaPath).catch(() => {});
        }
      }, 200);
    });

    logFn("info", "replicator_started", { root: SESSIONS_ROOT });
  } catch (err: any) {
    logFn("warn", "replicator_watch_failed", { error: err.message });
  }
}

export async function waitForSession(
  sessionDir: string,
  timeoutMs: number = 10_000,
): Promise<{ ok: boolean; outstanding: number }> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const outstanding = scanSession(sessionDir);
    if (outstanding.length === 0) {
      return { ok: true, outstanding: 0 };
    }

    for (const metaPath of outstanding) {
      if (!replicated.has(metaPath)) {
        await replicateFile(metaPath);
      }
    }

    const remaining = scanSession(sessionDir);
    if (remaining.length === 0) {
      return { ok: true, outstanding: 0 };
    }

    await new Promise(r => setTimeout(r, 500));
  }

  const final = scanSession(sessionDir);
  return { ok: final.length === 0, outstanding: final.length };
}

export interface ReplicationStatus {
  replicated: number;
  pending: number;
  failed: number;
}

export function getStatus(): ReplicationStatus {
  return { replicated: replicated.size, pending: pending.size, failed: failedCount };
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function replicateFile(metaPath: string): Promise<boolean> {
  const artifactPath = metaPath.replace(/\.meta\.json$/, "");

  if (!existsSync(metaPath) || !existsSync(artifactPath)) {
    logFn("warn", "replicator_missing_file", { metaPath, artifactPath });
    return false;
  }

  let meta: SidecarContent;
  try {
    meta = JSON.parse(readFileSync(metaPath, "utf-8"));
  } catch (err: any) {
    logFn("error", "replicator_meta_parse_error", { metaPath, error: err.message });
    return false;
  }

  if (!store) {
    replicated.add(metaPath);
    pending.delete(metaPath);
    return true;
  }

  try {
    const content = readFileSync(artifactPath);
    const result = await store.upload({
      filename: meta.filename || basename(artifactPath),
      content,
      artifact_type: meta.artifact_type,
      agent_name: meta.agent_name,
      run_id: meta.session_id,
      mime: meta.mime_type,
      metadata: {
        tags: meta.tags,
        replicated_from: relative(SESSIONS_ROOT, artifactPath),
        replicated_at: new Date().toISOString(),
      },
    });

    replicated.add(metaPath);
    pending.delete(metaPath);
    logFn("info", "replicator_uploaded", {
      metaPath: relative(SESSIONS_ROOT, metaPath),
      artifactId: result.id,
      size: content.length,
      deduplicated: result.deduplicated,
    });
    return true;
  } catch (err: any) {
    logFn("error", "replicator_upload_error", { metaPath, error: err.message });
    failedCount++;
    return false;
  }
}

function scanSession(sessionDir: string): string[] {
  const metaFiles: string[] = [];

  function walk(dir: string) {
    if (!existsSync(dir)) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "scratch") continue;
          walk(full);
        } else if (entry.name.endsWith(".meta.json") && !replicated.has(full)) {
          metaFiles.push(full);
        }
      }
    } catch { /* skip unreadable dirs */ }
  }

  walk(sessionDir);
  return metaFiles;
}
