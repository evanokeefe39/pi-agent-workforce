import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

const TYPE_COLORS: Record<string, string> = {
  dataset: "#3b82f6",
  research: "#22c55e",
  finding: "#22c55e",
  report: "#f97316",
  brief: "#f59e0b",
  code: "#8b5cf6",
  state: "#6b7280",
  session: "#6b7280",
  log: "#6b7280",
};

function ArtifactNode({ data }: NodeProps) {
  const color = TYPE_COLORS[data.artifactType as string] ?? "#6b7280";
  const highlighted = data.highlighted as boolean;

  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 6,
        border: highlighted ? "3px solid #fbbf24" : `2px solid ${color}`,
        background: highlighted ? "#fef3c7" : "#fff",
        fontFamily: "system-ui, sans-serif",
        fontSize: 12,
        minWidth: 180,
        boxShadow: highlighted ? "0 0 8px rgba(251, 191, 36, 0.5)" : "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ fontWeight: 600, color, marginBottom: 2 }}>
        {data.agentName as string}
      </div>
      <div style={{ color: "#374151" }}>{data.filename as string}</div>
      <div
        style={{
          fontSize: 10,
          color: "#9ca3af",
          marginTop: 2,
          display: "inline-block",
          background: `${color}20`,
          padding: "1px 6px",
          borderRadius: 3,
        }}
      >
        {data.artifactType as string}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default memo(ArtifactNode);
