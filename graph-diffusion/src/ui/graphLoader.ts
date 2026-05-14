import type { Graph, FunctionValues, Edge } from "../types";

type GraphJsonVertex = {
  index: number;
  x: number;
  y: number;
  edges: number[];
  initialValue?: number;
};

type GraphJson = {
  vertices: GraphJsonVertex[];
  // Supports either { "0": 1.0, "1": 0.2 } or [1.0, 0.2, ...] or [{index, value}, ...]
  initialValues?: Record<string, number> | number[] | Array<{ index: number; value: number }>;
};

export type LoadedGraphData = {
  graph: Graph;
  initialValues: FunctionValues;
};

function getInitialValuesFromJson(data: GraphJson): FunctionValues {
  const initialValues: FunctionValues = new Map();

  for (const vertex of data.vertices) {
    if (typeof vertex.initialValue === "number" && Number.isFinite(vertex.initialValue)) {
      initialValues.set(vertex.index, vertex.initialValue);
    }
  }

  const rawInitialValues = data.initialValues;
  if (rawInitialValues && !Array.isArray(rawInitialValues)) {
    for (const [indexKey, value] of Object.entries(rawInitialValues)) {
      const index = Number(indexKey);
      if (Number.isInteger(index) && Number.isFinite(value)) {
        initialValues.set(index, value);
      }
    }
  } else if (Array.isArray(rawInitialValues)) {
    if (rawInitialValues.every((entry): entry is number => typeof entry === "number")) {
      for (let i = 0; i < rawInitialValues.length; i += 1) {
        const value = rawInitialValues[i];
        if (Number.isFinite(value)) {
          initialValues.set(i, value);
        }
      }
    } else {
      for (const entry of rawInitialValues) {
        // Expecting {index, value} objects in the array
        if (!entry || typeof entry !== "object") continue;
        const index = (entry as { index?: unknown }).index;
        const value = (entry as { value?: unknown }).value;
        if (
          typeof index === "number" &&
          Number.isInteger(index) &&
          typeof value === "number" &&
          Number.isFinite(value)
        ) {
          initialValues.set(index, value);
        }
      }
    }
  }

  return initialValues;
}

export async function loadGraph(path: string): Promise<LoadedGraphData> {
  const response = await fetch(path);
  const data = (await response.json()) as GraphJson;

  // Validate symmetric adjacency
  for (const vertex of data.vertices) {
    for (const neighbor of vertex.edges) {
      if (!data.vertices[neighbor].edges.includes(vertex.index)) {
        console.warn(`Asymmetric edge: ${vertex.index} → ${neighbor}`);
      }
    }
  }

  // Build edges from vertex adjacency
  const edges: Edge[] = [];
  const seenEdges = new Set<string>();

  let edgeIndex = 0;
  for (const vertex of data.vertices) {
    for (const neighborIndex of vertex.edges) {
      const edgeKey = [vertex.index, neighborIndex].sort().join("-");
      if (!seenEdges.has(edgeKey)) {
        const length = Math.sqrt(
          Math.pow(data.vertices[vertex.index].x - data.vertices[neighborIndex].x, 2) +
          Math.pow(data.vertices[vertex.index].y - data.vertices[neighborIndex].y, 2)
        );
        edges.push({ index: edgeIndex++, v1: vertex.index, v2: neighborIndex, length: length });
        seenEdges.add(edgeKey);
      }
    }
  }

  const graph: Graph = { vertices: data.vertices, edges };
  const jsonInitialValues = getInitialValuesFromJson(data);

  // Fallback to random value for any vertex missing from JSON-provided initial values.
  const initialValues: FunctionValues = new Map();
  for (const vertex of graph.vertices) {
    initialValues.set(vertex.index, jsonInitialValues.get(vertex.index) ?? Math.random());
  }

  return { graph, initialValues };
}
