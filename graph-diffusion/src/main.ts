import { GraphRenderer } from "./render/renderer";
import type { Graph, FunctionValues, Edge } from "./types";
import { DiffusionSolver } from "./simulation/diffusionSolver";
import "./style.css";

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

type LoadedGraphData = {
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

// Load graph from JSON
async function loadGraph(path: string): Promise<LoadedGraphData> {
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

async function main() {
  // Load graph structure
  const { graph, initialValues } = await loadGraph("/graph.json");

  // Get container
  const container = document.getElementById("app")!;

  // Create renderer with custom options (async)
  const renderer = await GraphRenderer.create(container, graph, {
    width: 800,
    height: 600,
    nodeMinSize: 5,
    nodeMaxSize: 25,
    nodeMinValue: 0,
    nodeMaxValue: 1.5,
    edgeWidth: 2,
    edgeAlpha: 0.6,
    padding: 120,
  });

  const canvas = renderer.getCanvas();
  const canvasShell = document.createElement("div");
  canvasShell.className = "canvas-shell";
  canvasShell.style.width = `${canvas.clientWidth || canvas.width}px`;
  canvasShell.style.height = `${canvas.clientHeight || canvas.height}px`;
  container.insertBefore(canvasShell, canvas);
  canvasShell.appendChild(canvas);

  const labelsToggleWrap = document.createElement("label");
  labelsToggleWrap.className = "labels-toggle";

  const labelsToggleInput = document.createElement("input");
  labelsToggleInput.type = "checkbox";
  labelsToggleInput.checked = true;

  const labelsToggleText = document.createElement("span");
  labelsToggleText.textContent = "Show text labels";

  labelsToggleWrap.append(labelsToggleInput, labelsToggleText);
  container.appendChild(labelsToggleWrap);

  renderer.setTextLabelsVisible(labelsToggleInput.checked);
  labelsToggleInput.addEventListener("change", () => {
    renderer.setTextLabelsVisible(labelsToggleInput.checked);
  });

  const simControls = document.createElement("div");
  simControls.className = "sim-controls";

  const playPauseButton = document.createElement("button");
  playPauseButton.className = "sim-button";

  const resetButton = document.createElement("button");
  resetButton.className = "sim-button";
  resetButton.textContent = "Reset";

  const statusText = document.createElement("span");
  statusText.className = "sim-status";

  const timeText = document.createElement("span");
  timeText.className = "sim-metric";

  const stepText = document.createElement("span");
  stepText.className = "sim-metric";

  simControls.append(playPauseButton, resetButton, statusText, timeText, stepText);
  canvasShell.appendChild(simControls);

  // Create solver with initial conditions
  const solver = new DiffusionSolver(graph, {
    diffusionRate: 0.5,
    timeStep: 0.01,
    iterations: 1000,
    initialValues: initialValues
  });

  let isRunning = true;

  function renderStateUI(): void {
    const state = solver.getState();
    playPauseButton.textContent = isRunning ? "Pause" : "Play";
    statusText.textContent = isRunning ? "Running" : "Paused";
    timeText.textContent = `t=${state.time.toFixed(3)}`;
    stepText.textContent = `step=${state.timeStepCount}`;
  }

  playPauseButton.addEventListener("click", () => {
    isRunning = !isRunning;
    renderStateUI();
  });

  resetButton.addEventListener("click", () => {
    isRunning = false;
    solver.reset();
    const resetState = solver.getState();
    renderer.update(resetState.currentValues, resetState.edgeFluxValues);
    renderer.render();
    renderStateUI();
  });

  const initialState = solver.getState();
  renderer.update(initialState.currentValues, initialState.edgeFluxValues);
  renderer.render();
  renderStateUI();

  // Use Pixi ticker for animation loop
  renderer.ticker.add(() => {
    if (!isRunning) {
      return;
    }

    solver.timestep();
    const state = solver.getState();
    renderer.update(state.currentValues, state.edgeFluxValues);
    renderer.render();
    renderStateUI();
  });
}

main().catch(console.error);
