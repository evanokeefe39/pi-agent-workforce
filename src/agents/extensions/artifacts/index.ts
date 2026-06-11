import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
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

function generateId(): string {
  try {
    const mod = require("./workproduct-lib/ulid.js");
    return mod.ulid();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
}

export default function (pi: ExtensionAPI) {
  if (!client.getAgentName()) return;

  // ---- write_artifact ----
  pi.registerTool({
    name: "write_artifact",
    label: "Write Artifact",
    description:
      "Write a file to the session output directory. The file is automatically replicated to object storage for other agents to read. Returns an artifact ID, size, and hash.",
    promptSnippet:
      "When sharing work with other agents or referencing artifacts:\n" +
      "- Write output using write_artifact. It returns an artifact ID.\n" +
      "- For text files, pass content directly. For binary files (images, PDFs), save the file first then pass file_path.\n" +
      "- Pass that ID in task responses or handoff messages. Never paste artifact content inline.\n" +
      "- To read another agent's work, call read_artifact with the ID you received.\n" +
      "- To discover available artifacts, call list_artifacts with filters.",
    parameters: Type.Object({
      name: Type.String({ description: "Filename including extension, e.g. findings.jsonl" }),
      content: Type.Optional(Type.String({ description: "File content to write (text). Omit if using file_path for binary files." })),
      file_path: Type.Optional(Type.String({ description: "Path to an existing file to publish as artifact (use for binary files like images, PDFs). Relative to session dir or absolute." })),
      type: Type.String({ description: "Artifact type, e.g. report, dataset, code, brief, image, render" }),
      template: Type.Optional(Type.String({ description: "Template name used to produce this artifact" })),
      run_id: Type.Optional(Type.String({ description: "Run ID (auto-set from session if omitted)" })),
      workspace: Type.Optional(Type.String({ description: "Workspace name (auto-set from env if omitted)" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      try {
        if (!params.content && !params.file_path) {
          return { content: [{ type: "text" as const, text: "Error: provide either content or file_path" }] };
        }

        const sessionId = ctx?.sessionManager?.getSessionId?.() || "unknown";
        const cwd = ctx?.sessionManager?.getCwd?.() || process.cwd();
        const outputDir = path.join(cwd, "output");
        fs.mkdirSync(outputDir, { recursive: true });

        const id = generateId();
        const fullFilename = `${id}_${params.name}`;
        const filePath = path.join(outputDir, fullFilename);

        let contentBuf: Buffer;
        if (params.file_path) {
          const srcPath = path.isAbsolute(params.file_path)
            ? params.file_path
            : path.join(cwd, params.file_path);
          if (!fs.existsSync(srcPath)) {
            return { content: [{ type: "text" as const, text: `Error: file not found: ${srcPath}` }] };
          }
          contentBuf = fs.readFileSync(srcPath);
          fs.copyFileSync(srcPath, filePath);
        } else {
          contentBuf = Buffer.from(params.content!, "utf-8");
          fs.writeFileSync(filePath + ".tmp", params.content!);
          fs.renameSync(filePath + ".tmp", filePath);
        }

        const hash = createHash("sha256").update(contentBuf).digest("hex");

        const text = `Artifact written.\nID: ${id}\nSize: ${contentBuf.length} bytes\nHash: sha256:${hash}`;
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
