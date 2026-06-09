import Graph from "graphology";
import { bfsFromNode } from "graphology-traversal";
import type { ArtifactRecord, EdgeRecord } from "./types";
import { listArtifacts, getEdgesByRunId } from "./metastore";

/** Build a directed multigraph from all artifacts and edges in a run. */
export async function buildGraph(runId: string): Promise<Graph> {
  const graph = new Graph({ type: "directed", multi: true });
  const artifacts = await listArtifacts({ run_id: runId });
  const edges = await getEdgesByRunId(runId);

  for (const a of artifacts) {
    graph.addNode(a.id, {
      agent: a.agent_name,
      type: a.artifact_type,
      filename: a.filename,
      run_id: a.run_id,
      created_at: a.created_at,
    });
  }

  for (const e of edges) {
    if (graph.hasNode(e.source_id) && graph.hasNode(e.target_id)) {
      graph.addEdge(e.source_id, e.target_id, { type: e.edge_type });
    }
  }

  return graph;
}

/** BFS upstream — collect all ancestors through any edge type. */
export function traceToSources(graph: Graph, nodeId: string): string[] {
  const visited: string[] = [];
  const seen = new Set<string>();

  const reversed = new Graph({ type: "directed", multi: true });
  graph.forEachNode((node, attrs) => reversed.addNode(node, attrs));
  graph.forEachEdge((_edge, attrs, source, target) => {
    reversed.addEdge(target, source, attrs);
  });

  bfsFromNode(reversed, nodeId, (node) => {
    if (node !== nodeId && !seen.has(node)) {
      seen.add(node);
      visited.push(node);
    }
  });

  return visited;
}

/** BFS downstream — collect all descendants through any edge type. */
export function traceToOutputs(graph: Graph, nodeId: string): string[] {
  const visited: string[] = [];
  const seen = new Set<string>();

  bfsFromNode(graph, nodeId, (node) => {
    if (node !== nodeId && !seen.has(node)) {
      seen.add(node);
      visited.push(node);
    }
  });

  return visited;
}

/** Serialize graph to W3C PROV-JSON format. */
export function toProvJson(
  graph: Graph,
  artifacts: ArtifactRecord[],
): Record<string, unknown> {
  const artifactMap = new Map(artifacts.map(a => [a.id, a]));

  const entity: Record<string, unknown> = {};
  const activity: Record<string, unknown> = {};
  const agent: Record<string, unknown> = {};
  const wasGeneratedBy: Record<string, unknown> = {};
  const wasAttributedTo: Record<string, unknown> = {};
  const wasDerivedFrom: Record<string, unknown> = {};
  const wasInformedBy: Record<string, unknown> = {};

  const agentNames = new Set<string>();

  graph.forEachNode((nodeId) => {
    const a = artifactMap.get(nodeId);
    if (!a) return;

    entity[`artifact:${nodeId}`] = {
      "prov:type": a.artifact_type,
      "artifact:filename": a.filename,
      "artifact:agent": a.agent_name,
    };

    if (!agentNames.has(a.agent_name)) {
      agentNames.add(a.agent_name);
      agent[`agent:${a.agent_name}`] = {
        "prov:type": "prov:SoftwareAgent",
      };
    }

    const activityId = `activity:${a.agent_name}-${nodeId}`;
    activity[activityId] = {
      "prov:type": "artifact-production",
      "prov:startTime": a.created_at instanceof Date
        ? a.created_at.toISOString()
        : a.created_at,
    };

    wasGeneratedBy[`wGB:${nodeId}`] = {
      "prov:entity": `artifact:${nodeId}`,
      "prov:activity": activityId,
    };

    wasAttributedTo[`wAT:${nodeId}`] = {
      "prov:entity": `artifact:${nodeId}`,
      "prov:agent": `agent:${a.agent_name}`,
    };
  });

  let edgeIdx = 0;
  graph.forEachEdge((_edge, attrs, source, target) => {
    const edgeType = attrs.type as string;
    if (edgeType === "informed_by") {
      wasInformedBy[`wIB:${edgeIdx++}`] = {
        "prov:informant": `artifact:${source}`,
        "prov:informed": `artifact:${target}`,
      };
    } else {
      wasDerivedFrom[`wDF:${edgeIdx++}`] = {
        "prov:generatedEntity": `artifact:${target}`,
        "prov:usedEntity": `artifact:${source}`,
        "prov:type": edgeType,
      };
    }
  });

  return {
    prefix: {
      prov: "http://www.w3.org/ns/prov#",
      artifact: "urn:artifact:",
      agent: "urn:agent:",
      activity: "urn:activity:",
    },
    entity,
    activity,
    agent,
    wasGeneratedBy,
    wasAttributedTo,
    wasDerivedFrom,
    wasInformedBy,
  };
}
