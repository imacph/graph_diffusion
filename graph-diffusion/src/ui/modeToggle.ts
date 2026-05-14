import type { AppMode } from "../types";

export type ModeToggleController = {
  setMode: (mode: AppMode) => void;
  teardown: () => void;
};

export function setupModeToggle(
  container: HTMLElement,
  initialMode: AppMode,
  onModeChange: (mode: AppMode) => void
): ModeToggleController {
  let mode = initialMode;

  const bar = document.createElement("div");
  bar.className = "mode-toggle-bar";

  const button = document.createElement("button");
  button.className = "sim-button mode-toggle-button";

  function renderLabel(): void {
    button.textContent = mode === "editor" ? "Run Simulation" : "Edit Graph";
  }

  const handleClick = (): void => {
    const nextMode: AppMode = mode === "editor" ? "simulation" : "editor";
    onModeChange(nextMode);
    mode = nextMode;
    renderLabel();
  };

  button.addEventListener("click", handleClick);
  renderLabel();

  bar.appendChild(button);
  container.appendChild(bar);

  return {
    setMode(nextMode: AppMode): void {
      mode = nextMode;
      renderLabel();
    },
    teardown(): void {
      button.removeEventListener("click", handleClick);
      bar.remove();
    },
  };
}