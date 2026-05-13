/**
 * Example: Graph Diffusion Visualization
 *
 * This demonstrates the GraphRenderer API for visualizing functions on a graph.
 * 
 * The rendering API design philosophy:
 * - Separate data (Graph) from rendering (GraphRenderer)
 * - Simple update loop: update(functionValues) -> render()
 * - Clean integration with simulation: simulator updates values, renderer visualizes
 */

import { GraphRenderer } from "./render/renderer";
import type { Graph, FunctionValues } from "./types";
import "./style.css";

// Load graph from JSON
async function loadGraph(path: string): Promise<Graph> {
  const response = await fetch(path);
  return response.json();
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

  // Initialize function values (one value per vertex)
  const values: FunctionValues = new Map();

  // Set constant values for each vertex
  for (const vertex of graph.vertices) {
    values.set(vertex.index, Math.random()); // Random values for demonstration
  }

  // Use Pixi ticker for animation loop
  renderer.ticker.add(() => {
    renderer.update(values);
    renderer.render();
  });
}

main().catch(console.error);
