import type { GraphRenderer } from "../render/renderer";
import type { DiffusionSolver } from "../simulation/diffusionSolver";

export function setupUI(
  container: HTMLElement,
  solver: DiffusionSolver,
  renderer: GraphRenderer
): void {
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
