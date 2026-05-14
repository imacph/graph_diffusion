import type { GraphRenderer } from "../render/renderer";
import type { DiffusionSolver } from "../simulation/diffusionSolver";

export function setupUI(
  container: HTMLElement,
  solver: DiffusionSolver,
  renderer: GraphRenderer
): { teardown(): void } {
  renderer.setEditorMode(false);
  renderer.onNodePointerDown = null;
  renderer.onCanvasPointerDown = null;

  const canvas = renderer.getCanvas();
  let canvasShell: HTMLElement;
  const existingShell = canvas.parentElement;
  if (existingShell && existingShell.classList.contains("canvas-shell")) {
    canvasShell = existingShell;
  } else {
    canvasShell = document.createElement("div");
    canvasShell.className = "canvas-shell";
    canvasShell.style.width = `${canvas.clientWidth || canvas.width}px`;
    canvasShell.style.height = `${canvas.clientHeight || canvas.height}px`;
    container.insertBefore(canvasShell, canvas);
    canvasShell.appendChild(canvas);
  }

  const labelsToggleWrap = document.createElement("label");
  labelsToggleWrap.className = "labels-toggle";

  const labelsToggleInput = document.createElement("input");
  labelsToggleInput.type = "checkbox";
  labelsToggleInput.checked = true;

  const labelsToggleText = document.createElement("span");
  labelsToggleText.textContent = "Show text labels";

  labelsToggleWrap.append(labelsToggleInput, labelsToggleText);
  canvasShell.appendChild(labelsToggleWrap);

  renderer.setTextLabelsVisible(labelsToggleInput.checked);
  const handleLabelsToggleChange = () => {
    renderer.setTextLabelsVisible(labelsToggleInput.checked);
  };
  labelsToggleInput.addEventListener("change", handleLabelsToggleChange);

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

  const handlePlayPauseClick = () => {
    isRunning = !isRunning;
    renderStateUI();
  };
  playPauseButton.addEventListener("click", handlePlayPauseClick);

  const handleResetClick = () => {
    isRunning = false;
    solver.reset();
    const resetState = solver.getState();
    renderer.update(resetState.currentValues, resetState.edgeFluxValues);
    renderer.render();
    renderStateUI();
  };
  resetButton.addEventListener("click", handleResetClick);

  const initialState = solver.getState();
  renderer.update(initialState.currentValues, initialState.edgeFluxValues);
  renderer.render();
  renderStateUI();

  const tick = () => {
    if (!isRunning) {
      return;
    }

    solver.timestep();
    const state = solver.getState();
    renderer.update(state.currentValues, state.edgeFluxValues);
    renderer.render();
    renderStateUI();
  };
  renderer.ticker.add(tick);

  return {
    teardown() {
      renderer.ticker.remove(tick);
      labelsToggleInput.removeEventListener("change", handleLabelsToggleChange);
      playPauseButton.removeEventListener("click", handlePlayPauseClick);
      resetButton.removeEventListener("click", handleResetClick);
      simControls.remove();
      labelsToggleWrap.remove();
    },
  };
}
