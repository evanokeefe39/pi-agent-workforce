import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readFileSync } from "node:fs";

const TOOL_ALTERNATIVES: Record<string, string> = {
  write: "your workproduct tools (record_finding, record_report, etc.) then publish_artifact",
  edit: "your workproduct tools then publish_artifact",
  write_artifact: "publish_artifact to upload files directly to storage",
};

export default function toolPolicyExtension(pi: ExtensionAPI) {
  const agentName = process.env.AGENT_NAME || "";
  if (!agentName) return;

  let policy: Record<string, string> = {};
  try {
    const raw = readFileSync(`/app/${agentName}/agent.json`, "utf-8");
    const parsed = JSON.parse(raw);
    policy = parsed.runtimeConfig?.toolPolicy || {};
  } catch {
    return;
  }

  if (Object.keys(policy).length === 0) return;

  pi.on("tool_call", (event: any) => {
    const rule = policy[event.toolName] ?? policy["*"] ?? "allow";
    if (rule === "block") {
      const alt = TOOL_ALTERNATIVES[event.toolName] || "an allowed tool for this agent";
      return {
        block: true,
        reason: `${event.toolName} is not available for ${agentName}. Use ${alt} instead.`,
      };
    }
  });
}
