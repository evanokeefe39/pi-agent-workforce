export interface ArtifactNode {
  id: string;
  agent_name: string;
  artifact_type: string;
  filename: string;
  run_id: string | null;
  created_at: string;
}

export interface LineageEdge {
  source: string;
  target: string;
  type: string;
}

export interface GraphData {
  nodes: ArtifactNode[];
  edges: LineageEdge[];
}

export interface TraceResponse {
  root: string;
  direction: string;
  traced: Array<{
    id: string;
    agent_name: string;
    artifact_type: string;
    filename: string;
  }>;
}
