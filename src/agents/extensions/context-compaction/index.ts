import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

interface Rule {
  match: string;
  thresholdChars: number;
  summaryChars: number;
}

const SKIP_SET = new Set(["publish_artifact", "read_artifact", "list_artifacts",
  "get_template", "add_source", "query_findings", "get_finding", "subagent"]);

function shouldSkip(toolName: string): boolean {
  if (SKIP_SET.has(toolName)) return true;
  if (toolName.startsWith("record_")) return true;
  return false;
}

function loadRules(): Rule[] {
  const candidates = [
    join(import.meta.dir || "", "config.json"),
    "/root/.pi/agent/extensions/context-compaction/config.json",
  ];
  for (const p of candidates) {
    try {
      const raw = readFileSync(p, "utf-8");
      return JSON.parse(raw).rules || [];
    } catch {}
  }
  return [{ match: ".*", thresholdChars: 2000, summaryChars: 800 }];
}

function matchRule(toolName: string, rules: Rule[]): Rule | null {
  for (const rule of rules) {
    if (new RegExp(rule.match).test(toolName)) return rule;
  }
  return null;
}

function extractText(content: any[]): string {
  return content
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("\n");
}

function truncateAtLine(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.lastIndexOf("\n", maxChars);
  return text.slice(0, cut > 0 ? cut : maxChars);
}

export default function contextCompactionExtension(pi: ExtensionAPI) {
  const rules = loadRules();

  pi.on("tool_result", (event: any) => {
    if (event.isError) return;
    if (shouldSkip(event.toolName)) return;

    const rule = matchRule(event.toolName, rules);
    if (!rule) return;

    const fullText = extractText(event.content || []);
    if (fullText.length <= rule.thresholdChars) return;

    const sessionDir = process.env.PI_SESSION_DIR || process.cwd();
    const resultDir = join(sessionDir, "scratch", "tool-results");
    const filePath = join(resultDir, `${event.toolCallId}.md`);

    try {
      mkdirSync(resultDir, { recursive: true });
      writeFileSync(filePath, `# Full Tool Result: ${event.toolName}\n## Call ID: ${event.toolCallId}\n## Input\n${JSON.stringify(event.input, null, 2)}\n## Content\n${fullText}`);
    } catch (err) {
      console.error(`[context-compaction] write failed:`, err instanceof Error ? err.message : err);
      return;
    }

    const summary = truncateAtLine(fullText, rule.summaryChars);
    const compacted = `[Compacted — ${fullText.length} chars → ${summary.length} chars | Full: scratch/tool-results/${event.toolCallId}.md]\n\n${summary}\n\n[...truncated — read scratch/tool-results/${event.toolCallId}.md for full content]`;

    const images = (event.content || []).filter((c: any) => c.type === "image");

    return {
      content: [...images, { type: "text" as const, text: compacted }],
      details: {
        ...(event.details || {}),
        _compaction: {
          originalChars: fullText.length,
          summaryChars: summary.length,
          fullPath: filePath,
          toolName: event.toolName,
        },
      },
    };
  });
}
