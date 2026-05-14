import { GraphRenderer } from "./render/renderer";
import { DiffusionSolver } from "./simulation/diffusionSolver";
import { loadGraph } from "./ui/graphLoader";
import { setupUI } from "./ui/simControls";
import "./style.css";

async function main() {
  const { graph, initialValues } = await loadGraph("/graph.json");

  const container = document.getElementById("app")!;

  const renderer = await GraphRenderer.create(container, graph, {
    width: 1200,
    height: 800,
    nodeMinSize: 5,
    nodeMaxSize: 25,
    nodeMinValue: 0,
    nodeMaxValue: 1.5,
    edgeWidth: 2,
    edgeAlpha: 0.6,
    padding: 150,
  });

  const solver = new DiffusionSolver(graph, {
    diffusionRate: 0.5,
    timeStep: 0.01,
    iterations: 1000,
    initialValues: initialValues,
  });

  setupUI(container, solver, renderer);
}

main().catch(console.error);
