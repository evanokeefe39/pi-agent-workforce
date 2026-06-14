import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import * as fs from "node:fs";
import * as path from "node:path";
import { ulid } from "./ulid.js";
import { validateByStyle } from "./validate.js";
import type {
  WorkproductConfig,
  LocalRecord,
  WorkproductHandle,
  ListFilters,
} from "./types.js";

const AGENT_NAME = process.env.AGENT_NAME || "unknown";

function getSessionCwd(ctx?: any): string {
  return ctx?.sessionManager?.getCwd?.() || process.cwd();
}

function getSessionId(ctx?: any): string {
  return ctx?.sessionManager?.getSessionId?.() || "unknown";
}

function getBasedir(ctx?: any): string {
  return path.join(getSessionCwd(ctx), "workproduct");
}

function walkJsonFiles(dir: string, cb: (filePath: string) => void): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsonFiles(full, cb);
    else if (entry.name.endsWith(".json") && !entry.name.endsWith(".meta.json")) cb(full);
  }
}

function findRecordWithPath(dir: string, id: string): { rec: LocalRecord; filePath: string } | null {
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findRecordWithPath(full, id);
      if (found) return found;
    } else if (entry.name.startsWith(id) && entry.name.endsWith(".json") && !entry.name.endsWith(".meta.json")) {
      try {
        return { rec: JSON.parse(fs.readFileSync(full, "utf8")), filePath: full };
      } catch { return null; }
    }
  }
  return null;
}

function writeRecord(
  basedir: string,
  subdir: string,
  type: string,
  filename: string,
  content: string,
  metadata: Record<string, unknown>,
): { id: string } {
  const dir = path.join(basedir, subdir);
  fs.mkdirSync(dir, { recursive: true });
  const id = ulid();
  const record: LocalRecord = {
    id,
    agent: AGENT_NAME,
    type,
    filename,
    timestamp: new Date().toISOString(),
    content,
    metadata,
  };
  const filePath = path.join(dir, `${id}_${filename}`);
  fs.writeFileSync(filePath + ".tmp", JSON.stringify(record, null, 2));
  fs.renameSync(filePath + ".tmp", filePath);
  return { id };
}

function readRecord(basedir: string, id: string): LocalRecord | null {
  return findRecordWithPath(basedir, id)?.rec ?? null;
}

function patchMetadata(basedir: string, id: string, metadata: Record<string, unknown>): boolean {
  const found = findRecordWithPath(basedir, id);
  if (!found) return false;
  found.rec.metadata = { ...found.rec.metadata, ...metadata };
  fs.writeFileSync(found.filePath + ".tmp", JSON.stringify(found.rec, null, 2));
  fs.renameSync(found.filePath + ".tmp", found.filePath);
  return true;
}

function listRecords(basedir: string, filters?: ListFilters): LocalRecord[] {
  const records: LocalRecord[] = [];
  walkJsonFiles(basedir, (filePath) => {
    try {
      const rec = JSON.parse(fs.readFileSync(filePath, "utf8")) as LocalRecord;
      if (filters?.type && rec.type !== filters.type) return;
      if (filters?.session_id && rec.metadata.session_id !== filters.session_id) return;
      if (filters?.since && rec.timestamp < filters.since) return;
      records.push(rec);
    } catch { /* skip corrupt */ }
  });
  return records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function asText(text: string, details?: Record<string, unknown>) {
  return details
    ? { content: [{ type: "text" as const, text }], details }
    : { content: [{ type: "text" as const, text }] };
}

function asError(msg: string) {
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }] };
}

export function createWorkproductExtension(
  pi: ExtensionAPI,
  config: WorkproductConfig,
): void {
  if (AGENT_NAME !== config.agentName) {
    if (AGENT_NAME) {
      console.warn(
        `[workproduct] ${config.agentName} extension loaded in wrong agent: ${AGENT_NAME}`,
      );
    }
    return;
  }

  const handle: WorkproductHandle = {
    read: (id, ctx) => readRecord(getBasedir(ctx), id),
    updateMetadata: (id, meta, ctx) => patchMetadata(getBasedir(ctx), id, meta),
    list: (filters, ctx) => listRecords(getBasedir(ctx), filters),
  };

  // -- record_{kind} tools --
  for (const [kindName, kind] of Object.entries(config.kinds)) {
    pi.registerTool({
      name: `record_${kindName}`,
      label: kind.label,
      description: kind.description,
      promptSnippet: kind.promptSnippet,
      parameters: kind.schema,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        try {
          if (kind.validate) {
            const vr = kind.validate(params);
            if (vr && vr.errors.length > 0) {
              return asText(`Validation failed:\n${vr.errors.join("\n")}`);
            }
          }

          const sources = kind.sources ? kind.sources(params) : [];
          const { errors, warnings } = validateByStyle(
            config.profiles, kindName, sources, params as Record<string, unknown>,
          );
          if (errors.length > 0) {
            return asText(`Validation failed:\n${errors.join("\n")}`);
          }

          const sessionId = getSessionId(ctx);
          const result = writeRecord(
            getBasedir(ctx), kind.subdir, kindName,
            kind.filename(params),
            kind.content(params),
            kind.metadata(params, sessionId),
          );

          let text = kind.summary(result.id, params);
          if (warnings.length > 0) {
            text += `\nWarnings:\n${warnings.join("\n")}`;
          }

          const details = kind.details
            ? { ...kind.details(result.id, params), warnings }
            : { id: result.id, warnings };

          return asText(text, details);
        } catch (err: unknown) {
          return asError(err instanceof Error ? err.message : String(err));
        }
      },
    });
  }

  // -- query tool --
  const qt = config.queryTool;
  const queryKinds = qt.kinds || Object.keys(config.kinds);
  const queryParams: Record<string, any> = {};

  if (queryKinds.length > 1) {
    queryParams.kind = Type.Optional(
      Type.Union(
        queryKinds.map(k => Type.Literal(k)) as [any, ...any[]],
        { description: "Filter to a specific kind" },
      ),
    );
  }
  queryParams.agent = Type.Optional(Type.String({ description: "Filter by producing agent" }));
  queryParams.session_id = Type.Optional(Type.String({ description: "Filter by session" }));
  queryParams.since = Type.Optional(Type.String({ description: "ISO 8601 — only items after this timestamp" }));
  queryParams.limit = Type.Optional(Type.Integer({ minimum: 1, maximum: 200, description: "Max results, default 50" }));

  if (qt.extraFilters) {
    for (const ef of qt.extraFilters) {
      queryParams[ef.name] = ef.schema;
    }
  }

  pi.registerTool({
    name: qt.name,
    label: qt.label,
    description: qt.description,
    parameters: Type.Object(queryParams),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      try {
        let records = listRecords(getBasedir(ctx), {
          type: params.kind,
          session_id: params.session_id,
          since: params.since,
        });

        if (!params.kind) {
          const kindSet = new Set(queryKinds);
          records = records.filter(r => kindSet.has(r.type));
        }
        if (params.agent) {
          records = records.filter(r => r.agent === params.agent);
        }

        if (qt.extraFilters) {
          for (const ef of qt.extraFilters) {
            const val = params[ef.name];
            if (val !== undefined && val !== null) {
              records = records.filter(r => ef.filter(r, val));
            }
          }
        }

        records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        records = records.slice(0, params.limit || 50);

        if (records.length === 0) {
          return asText(qt.noMatchText || "No items match the filters.", { count: 0 });
        }

        const lines: string[] = [`Found ${records.length} item(s):\n`];
        for (const rec of records) lines.push(qt.formatLine(rec));

        return asText(lines.join("\n"), { count: records.length });
      } catch (err: unknown) {
        return asError(err instanceof Error ? err.message : String(err));
      }
    },
  });

  // -- get tool --
  const gt = config.getTool;
  const getKinds = new Set(gt.kinds || Object.keys(config.kinds));

  pi.registerTool({
    name: gt.name,
    label: gt.label,
    description: gt.description,
    parameters: Type.Object({
      id: Type.String({ description: "Artifact ULID" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      try {
        const rec = readRecord(getBasedir(ctx), params.id);
        if (!rec) {
          return asError(`artifact ${params.id} not found`);
        }
        if (!getKinds.has(rec.type)) {
          return asError(
            `artifact ${params.id} has type '${rec.type}', expected one of ${[...getKinds].join(", ")}`,
          );
        }

        if (gt.formatResult) {
          const result = gt.formatResult(rec);
          return asText(result.text, result.details);
        }

        let parsed: unknown = rec.content;
        try { parsed = JSON.parse(rec.content); } catch {}
        const payload = {
          id: rec.id, kind: rec.type, agent: rec.agent,
          created_at: rec.timestamp, metadata: rec.metadata, content: parsed,
        };
        return asText(JSON.stringify(payload, null, 2), { id: rec.id, kind: rec.type });
      } catch (err: unknown) {
        return asError(err instanceof Error ? err.message : String(err));
      }
    },
  });

  // -- extra tools --
  if (config.extraTools) {
    for (const tool of config.extraTools) {
      pi.registerTool({
        name: tool.name,
        label: tool.label,
        description: tool.description,
        promptSnippet: tool.promptSnippet,
        parameters: tool.parameters,
        async execute(toolCallId, params, signal, onUpdate, ctx) {
          try {
            return await tool.execute(handle, toolCallId, params, signal, onUpdate, ctx);
          } catch (err: unknown) {
            return asError(err instanceof Error ? err.message : String(err));
          }
        },
      });
    }
  }
}
