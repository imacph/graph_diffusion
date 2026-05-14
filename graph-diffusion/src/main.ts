import { GraphRenderer } from "./render/renderer";
import { DiffusionSolver } from "./simulation/diffusionSolver";
import type { AppMode, GraphState } from "./types";
import { loadGraph } from "./ui/graphLoader";
import { setupGraphEditor } from "./ui/graphEditor";
import { setupModeToggle } from "./ui/modeToggle";
import { setupUI } from "./ui/simControls";
import "./style.css";

async function main() {
  const { graph, initialValues } = await loadGraph("/graph.json");
  const graphState: GraphState = { graph, initialValues };

  const container = document.getElementById("app")!;

  const renderer = await GraphRenderer.create(container, graphState.graph, {
    width: window.innerWidth,
    height: window.innerHeight,
    nodeMinSize: 5,
    nodeMaxSize: 25,
    nodeMinValue: 0,
    nodeMaxValue: 1.5,
    edgeWidth: 2,
    edgeAlpha: 0.6,
    padding: 150,
  });

  let currentMode: AppMode = "editor";
  let activeTeardown: (() => void) | null = null;

  function mountEditor(): void {
    const controller = setupGraphEditor(container, renderer, graphState);
    activeTeardown = controller.teardown;
  }

  function mountSimulation(): void {
    const solver = new DiffusionSolver(graphState.graph, {
      diffusionRate: 0.5,
      timeStep: 0.01,
      iterations: 1000,
      initialValues: graphState.initialValues,
    });
    const controller = setupUI(container, solver, renderer);
    activeTeardown = controller.teardown;
  }

  function mountMode(mode: AppMode): void {
    if (mode === "simulation") {
      mountSimulation();
      return;
    }
    mountEditor();
  }

  const modeToggle = setupModeToggle(container, currentMode, (nextMode) => {
    if (nextMode === currentMode) {
      return;
    }

    activeTeardown?.();
    activeTeardown = null;
    currentMode = nextMode;
    mountMode(currentMode);
    modeToggle.setMode(currentMode);
  });

  mountMode(currentMode);
}

main().catch(console.error);
