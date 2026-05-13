import { GraphRenderer } from "./render/renderer";
import type { Graph, FunctionValues, Edge } from "./types";
import { DiffusionSolver } from "./simulation/diffusionSolver";
import "./style.css";

// Load graph from JSON
async function loadGraph(path: string): Promise<Graph> {
  const response = await fetch(path);
  const data = await response.json();
  
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

  return { vertices: data.vertices, edges };
}

async function main() {
  // Load graph structure
  const graph = await loadGraph("/graph.json");

  // Get container
  const container = document.getElementById("app")!;

  // Create renderer with custom options (async)
  const renderer = await GraphRenderer.create(container, graph, {
    width: 800,
    height: 600,
    nodeMinSize: 5,
    nodeMaxSize: 25,
    nodeMinValue: 0,
    nodeMaxValue: 1,
    edgeWidth: 2,
    edgeAlpha: 0.6,
    padding: 50,
  });

  // Initialize function values
  const initialValues: FunctionValues = new Map();
  for (const vertex of graph.vertices) {
    initialValues.set(vertex.index, Math.random());
  }

  // Create solver with initial conditions
  const solver = new DiffusionSolver(graph, {
    diffusionRate: 0.01,
    timeStep: 0.01,
    iterations: 1000,
    initialValues: initialValues
  });

  // Use Pixi ticker for animation loop
  renderer.ticker.add(() => {
    solver.timestep();
    renderer.update(solver.getState().currentValues);
    renderer.render();
  });
}

main().catch(console.error);
