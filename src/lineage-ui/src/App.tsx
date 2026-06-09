import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { fetchGraph, fetchRuns, fetchTrace } from "./api";
import { layoutGraph } from "./layout";
import ArtifactNode from "./ArtifactNode";
import type { ArtifactNode as ArtifactNodeType, GraphData } from "./types";

const nodeTypes = { artifact: ArtifactNode };

const EDGE_COLORS: Record<string, string> = {
  derived_from: "#ef4444",
  informed_by: "#3b82f6",
  cites: "#8b5cf6",
  contains: "#22c55e",
  references: "#f59e0b",
  extracted_from: "#ec4899",
};

export default function App() {
  const [runs, setRuns] = useState<string[]>([]);
  const [selectedRun, setSelectedRun] = useState<string>("");
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<ArtifactNodeType | null>(null);
  const [selectedEdgeInfo, setSelectedEdgeInfo] = useState<{ source: string; target: string; type: string } | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [agentFilter, setAgentFilter] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetchRuns().then(setRuns).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedRun) return;
    setError("");
    fetchGraph(selectedRun)
      .then((data) => {
        setGraphData(data);
        setSelectedNode(null);
        setSelectedEdgeInfo(null);
        setHighlightedIds(new Set());
      })
      .catch((e) => setError(e.message));
  }, [selectedRun]);

  const allAgents = useMemo(
    () => [...new Set(graphData?.nodes.map((n) => n.agent_name) ?? [])].sort(),
    [graphData],
  );
  const allTypes = useMemo(
    () => [...new Set(graphData?.nodes.map((n) => n.artifact_type) ?? [])].sort(),
    [graphData],
  );

  useEffect(() => {
    if (!graphData) return;

    const filteredNodes = graphData.nodes.filter((n) => {
      if (agentFilter.size > 0 && !agentFilter.has(n.agent_name)) return false;
      if (typeFilter.size > 0 && !typeFilter.has(n.artifact_type)) return false;
      return true;
    });

    const nodeIds = new Set(filteredNodes.map((n) => n.id));

    const rfNodes: Node[] = filteredNodes.map((n) => ({
      id: n.id,
      type: "artifact",
      position: { x: 0, y: 0 },
      data: {
        agentName: n.agent_name,
        artifactType: n.artifact_type,
        filename: n.filename,
        highlighted: highlightedIds.has(n.id),
      },
    }));

    const rfEdges: Edge[] = graphData.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e, i) => ({
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        label: e.type,
        style: { stroke: EDGE_COLORS[e.type] ?? "#94a3b8" },
        labelStyle: { fontSize: 10, fill: EDGE_COLORS[e.type] ?? "#94a3b8" },
        animated: highlightedIds.has(e.source) && highlightedIds.has(e.target),
      }));

    const laid = layoutGraph(rfNodes, rfEdges);
    setNodes(laid.nodes);
    setEdges(laid.edges);
  }, [graphData, agentFilter, typeFilter, highlightedIds]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const artifact = graphData?.nodes.find((n) => n.id === node.id) ?? null;
      setSelectedNode(artifact);
      setSelectedEdgeInfo(null);
    },
    [graphData],
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setSelectedEdgeInfo({
        source: edge.source,
        target: edge.target,
        type: edge.label as string,
      });
      setSelectedNode(null);
    },
    [],
  );

  const handleTrace = useCallback(
    async (direction: string) => {
      if (!selectedNode) return;
      try {
        const result = await fetchTrace(selectedNode.id, direction);
        const ids = new Set(result.traced.map((t) => t.id));
        ids.add(selectedNode.id);
        setHighlightedIds(ids);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "trace failed");
      }
    },
    [selectedNode],
  );

  const toggleFilter = (set: Set<string>, value: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      {/* Sidebar */}
      <div
        style={{
          width: 280,
          borderRight: "1px solid #e5e7eb",
          padding: 16,
          overflowY: "auto",
          background: "#f9fafb",
          fontSize: 13,
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Artifact Lineage</h2>

        {/* Run selector */}
        <label style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>Run</label>
        <select
          value={selectedRun}
          onChange={(e) => setSelectedRun(e.target.value)}
          style={{ width: "100%", padding: 6, marginBottom: 12, fontSize: 12 }}
        >
          <option value="">Select a run...</option>
          {runs.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {/* Agent filter */}
        {allAgents.length > 0 && (
          <>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>Agents</label>
            {allAgents.map((a) => (
              <label key={a} style={{ display: "block", marginBottom: 2 }}>
                <input
                  type="checkbox"
                  checked={agentFilter.size === 0 || agentFilter.has(a)}
                  onChange={() => toggleFilter(agentFilter, a, setAgentFilter)}
                />{" "}
                {a}
              </label>
            ))}
            <div style={{ marginBottom: 12 }} />
          </>
        )}

        {/* Type filter */}
        {allTypes.length > 0 && (
          <>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>Types</label>
            {allTypes.map((t) => (
              <label key={t} style={{ display: "block", marginBottom: 2 }}>
                <input
                  type="checkbox"
                  checked={typeFilter.size === 0 || typeFilter.has(t)}
                  onChange={() => toggleFilter(typeFilter, t, setTypeFilter)}
                />{" "}
                {t}
              </label>
            ))}
            <div style={{ marginBottom: 12 }} />
          </>
        )}

        {/* Edge type legend */}
        <label style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>Edge types</label>
        {Object.entries(EDGE_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: "flex", alignItems: "center", marginBottom: 2 }}>
            <div style={{ width: 12, height: 3, background: color, marginRight: 6 }} />
            <span>{type}</span>
          </div>
        ))}
        <div style={{ marginBottom: 12 }} />

        {/* Selected node detail */}
        {selectedNode && (
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>Selected</label>
            <div><strong>ID:</strong> {selectedNode.id}</div>
            <div><strong>Agent:</strong> {selectedNode.agent_name}</div>
            <div><strong>Type:</strong> {selectedNode.artifact_type}</div>
            <div><strong>File:</strong> {selectedNode.filename}</div>
            <div><strong>Created:</strong> {selectedNode.created_at}</div>
            <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
              <button onClick={() => handleTrace("sources")} style={btnStyle}>
                Trace sources
              </button>
              <button onClick={() => handleTrace("outputs")} style={btnStyle}>
                Trace outputs
              </button>
            </div>
            <button
              onClick={() => { setHighlightedIds(new Set()); }}
              style={{ ...btnStyle, marginTop: 4, background: "#6b7280" }}
            >
              Clear highlight
            </button>
          </div>
        )}

        {/* Selected edge detail */}
        {selectedEdgeInfo && (
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>Edge</label>
            <div><strong>Type:</strong> {selectedEdgeInfo.type}</div>
            <div><strong>From:</strong> {selectedEdgeInfo.source}</div>
            <div><strong>To:</strong> {selectedEdgeInfo.target}</div>
          </div>
        )}

        {error && (
          <div style={{ color: "#ef4444", marginTop: 12, fontSize: 12 }}>{error}</div>
        )}
      </div>

      {/* Graph */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.1}
          maxZoom={2}
        >
          <Background />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const colors: Record<string, string> = {
                dataset: "#3b82f6",
                research: "#22c55e",
                finding: "#22c55e",
                report: "#f97316",
                brief: "#f59e0b",
                code: "#8b5cf6",
              };
              return colors[node.data?.artifactType as string] ?? "#6b7280";
            }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: 11,
  background: "#3b82f6",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
};
