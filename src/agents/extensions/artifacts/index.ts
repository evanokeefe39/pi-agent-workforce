import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import * as fs from "node:fs";
import * as path from "node:path";
import * as client from "./client.js";

const TEMPLATES_ROOT = "/root/.pi/agent/extensions/workproduct-lib/templates";

function parseId(input: string): string {
  if (input.startsWith("artifact://")) {
    const lastSegment = input.split("/").pop() || "";
    const ulid = lastSegment.split("_")[0];
    return ulid;
  }
  return input;
}

function guessMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    json: "application/json", jsonl: "application/x-ndjson",
    md: "text/markdown", txt: "text/plain", csv: "text/csv",
    html: "text/html", png: "image/png", jpg: "image/jpeg",
    jpeg: "image/jpeg", svg: "image/svg+xml", pdf: "application/pdf",
  };
  return map[ext || ""] || "application/octet-stream";
}

export default function (pi: ExtensionAPI) {
  if (!client.getAgentName()) return;

  // ---- publish_artifact ----
  pi.registerTool({
    name: "publish_artifact",
    label: "Publish Artifact",
    description:
      "Upload a local file to the artifact service (MinIO/S3). Reads the file from disk and uploads via HTTP. " +
      "Use this after writing files with workproduct tools. Returns the artifact URI for cross-agent references.",
    promptSnippet:
      "After producing output files, ALWAYS publish them:\n" +
      "1. Write files using workproduct tools (record_finding, record_report, etc.)\n" +
      "2. Call publish_artifact with the file_path to upload to storage\n" +
      "Without publish_artifact, files stay local and other agents cannot access them.",
    parameters: Type.Object({
      file_path: Type.String({ description: "Path to the local file to publish. Absolute or relative to session dir." }),
      type: Type.String({ description: "Artifact type: report, dataset, code, brief, image, render, finding, metric, chart" }),
      filename: Type.Optional(Type.String({ description: "Override filename in storage (defaults to basename of file_path)" })),
      tags: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: "Optional metadata tags" })),
      run_id: Type.Optional(Type.String({ description: "Run ID (auto-set from session if omitted)" })),
      workspace: Type.Optional(Type.String({ description: "Workspace name (auto-set from env if omitted)" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = ctx?.sessionManager?.getCwd?.() || process.cwd();
        const srcPath = path.isAbsolute(params.file_path)
          ? params.file_path
          : path.join(cwd, params.file_path);

        if (!fs.existsSync(srcPath)) {
          return { content: [{ type: "text" as const, text: `Error: file not found: ${srcPath}` }] };
        }

        const contentBuf = fs.readFileSync(srcPath);
        const contentBase64 = contentBuf.toString("base64");
        const storageName = params.filename || path.basename(srcPath);

        const result = await client.writeRaw({
          filename: storageName,
          content: "",
          contentBase64,
          type: params.type,
          mime: guessMime(storageName),
          metadata: params.tags || {},
          run_id: params.run_id || ctx?.sessionManager?.getSessionId?.() || undefined,
          workspace: params.workspace || process.env.WORKSPACE || undefined,
        });

        const text = `Published to artifact service.\nRef: ${result.ref}\nID: ${result.id}\nSize: ${result.size} bytes\nHash: ${result.hash}`;
        return { content: [{ type: "text" as const, text }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }] };
      }
    },
  });

  // ---- read_artifact ----
  pi.registerTool({
    name: "read_artifact",
    label: "Read Artifact",
    description:
      "Read an artifact by ULID or artifact:// URI. Returns file content and metadata.",
    parameters: Type.Object({
      id: Type.String({ description: "Artifact ULID or artifact:// URI" }),
    }),
    async execute(_toolCallId, params, _signal) {
      try {
        const id = parseId(params.id);
        const result = await client.read(id);
        const content = result.content.toString("utf8");
        const text = content + "\n---\n" + JSON.stringify(result.metadata, null, 2);
        return { content: [{ type: "text" as const, text }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }] };
      }
    },
  });

  // ---- list_artifacts ----
  pi.registerTool({
    name: "list_artifacts",
    label: "List Artifacts",
    description:
      "List artifacts from the artifact service with optional filters.",
    parameters: Type.Object({
      agent: Type.Optional(Type.String({ description: "Filter by agent name" })),
      type: Type.Optional(Type.String({ description: "Filter by artifact type" })),
      since: Type.Optional(Type.String({ description: "ISO 8601 timestamp — only artifacts created after this" })),
      run_id: Type.Optional(Type.String({ description: "Filter by run ID" })),
      bucket: Type.Optional(Type.String({ description: "Filter by bucket" })),
    }),
    async execute(_toolCallId, params, _signal) {
      try {
        const records = await client.list({
          agent: params.agent,
          type: params.type,
          since: params.since,
          run_id: params.run_id,
          bucket: params.bucket,
        });

        if (records.length === 0) {
          return { content: [{ type: "text" as const, text: "No artifacts found matching filters." }] };
        }

        const lines: string[] = [`Found ${records.length} artifact(s):\n`];
        for (const r of records) {
          lines.push(`- ${r.id} | ${r.filename}`);
          lines.push(`  agent: ${r.agent_name} | type: ${r.artifact_type} | created: ${r.created_at} | size: ${r.size_bytes}b`);
        }

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }] };
      }
    },
  });

  // ---- get_template ----
  pi.registerTool({
    name: "get_template",
    label: "Get Template",
    description:
      "Retrieve an output or brief template from the templates directory. Returns the template content.",
    parameters: Type.Object({
      category: Type.Union([Type.Literal("brief"), Type.Literal("output")], {
        description: "Template category: brief or output",
      }),
      name: Type.String({ description: "Template name (without extension)" }),
    }),
    async execute(_toolCallId, params, _signal) {
      try {
        const categoryDir = params.category === "brief" ? "briefs" : "outputs";
        const baseDir = path.join(TEMPLATES_ROOT, categoryDir);
        const mdPath = path.join(baseDir, `${params.name}.md`);
        const jsonPath = path.join(baseDir, `${params.name}.json`);

        let templatePath: string | null = null;
        if (fs.existsSync(mdPath)) {
          templatePath = mdPath;
        } else if (fs.existsSync(jsonPath)) {
          templatePath = jsonPath;
        }

        if (templatePath) {
          const content = fs.readFileSync(templatePath, "utf8");
          return {
            content: [{ type: "text" as const, text: content }],
            details: { template_path: templatePath },
          };
        }

        const available: string[] = [];
        if (fs.existsSync(baseDir)) {
          const dirEntries = fs.readdirSync(baseDir);
          for (const entry of dirEntries) {
            available.push(entry);
          }
        }

        const optionsText = available.length > 0
          ? `Available in ${categoryDir}/: ${available.join(", ")}`
          : `No templates found in ${categoryDir}/ directory.`;

        return {
          content: [{ type: "text" as const, text: `Error: template "${params.name}" not found in ${categoryDir}/. ${optionsText}` }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }] };
      }
    },
  });
}
