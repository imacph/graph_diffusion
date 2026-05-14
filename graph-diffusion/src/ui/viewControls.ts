import type { GraphRenderer } from "../render/renderer";

export function createViewControlsPanel(
  canvasShell: HTMLElement,
  renderer: GraphRenderer
): { teardown(): void } {
  const viewControlsPanel = document.createElement("div");
  viewControlsPanel.className = "view-controls";

  // Labels toggle row
  const labelsToggleRow = document.createElement("label");
  labelsToggleRow.className = "view-control-row";

  const labelsToggleInput = document.createElement("input");
  labelsToggleInput.type = "checkbox";
  labelsToggleInput.checked = renderer.getTextLabelsVisible();

  const labelsToggleText = document.createElement("span");
  labelsToggleText.textContent = "Show text labels";

  labelsToggleRow.append(labelsToggleInput, labelsToggleText);
  viewControlsPanel.appendChild(labelsToggleRow);

  // Dark mode toggle row
  const darkModeToggleRow = document.createElement("label");
  darkModeToggleRow.className = "view-control-row";

  const darkModeInput = document.createElement("input");
  darkModeInput.type = "checkbox";
  darkModeInput.checked = document.body.classList.contains("dark-mode");

  const darkModeText = document.createElement("span");
  darkModeText.textContent = "Dark mode";

  darkModeToggleRow.append(darkModeInput, darkModeText);
  viewControlsPanel.appendChild(darkModeToggleRow);

  // Grid toggle row
  const gridToggleRow = document.createElement("label");
  gridToggleRow.className = "view-control-row";

  const gridToggleInput = document.createElement("input");
  gridToggleInput.type = "checkbox";
  gridToggleInput.checked = renderer.getGridVisible();

  const gridToggleText = document.createElement("span");
  gridToggleText.textContent = "Show grid";

  gridToggleRow.append(gridToggleInput, gridToggleText);
  viewControlsPanel.appendChild(gridToggleRow);

  // Grid size row (hidden until grid is enabled)
  const gridSizeRow = document.createElement("div");
  gridSizeRow.className = "view-control-row";
  gridSizeRow.hidden = !renderer.getGridVisible();

  const gridSizeLabel = document.createElement("span");
  gridSizeLabel.textContent = "Grid size";

  const gridSizeSlider = document.createElement("input");
  gridSizeSlider.type = "range";

  const wb = renderer.getWorldBounds();
  const worldSpan = Math.max(wb.maxX - wb.minX, wb.maxY - wb.minY);
  const gridMin = parseFloat((worldSpan / 50).toPrecision(2));
  const gridMax = parseFloat((worldSpan * 2).toPrecision(2));
  const gridDefault = parseFloat((worldSpan / 10).toPrecision(2));
  const gridStep = parseFloat((worldSpan / 200).toPrecision(2));

  gridSizeSlider.min = String(gridMin);
  gridSizeSlider.max = String(gridMax);
  gridSizeSlider.step = String(gridStep);
  gridSizeSlider.value = String(renderer.getGridCellSize() || gridDefault);
  gridSizeSlider.className = "grid-size-slider";

  const gridSizeValue = document.createElement("span");
  gridSizeValue.className = "grid-size-value";
  gridSizeValue.textContent = gridSizeSlider.value;

  gridSizeRow.append(gridSizeLabel, gridSizeSlider, gridSizeValue);
  viewControlsPanel.appendChild(gridSizeRow);

  // Value range row
  const valueRangeRow = document.createElement("div");
  valueRangeRow.className = "view-control-row";

  const valueRangeLabel = document.createElement("span");
  valueRangeLabel.textContent = "Value range";

  const valueRange = renderer.getValueRange();

  const valueMinInput = document.createElement("input");
  valueMinInput.type = "number";
  valueMinInput.step = "any";
  valueMinInput.value = String(valueRange.min);
  valueMinInput.className = "value-range-input";
  valueMinInput.title = "Min value";

  const valueRangeSep = document.createElement("span");
  valueRangeSep.textContent = "–";

  const valueMaxInput = document.createElement("input");
  valueMaxInput.type = "number";
  valueMaxInput.step = "any";
  valueMaxInput.value = String(valueRange.max);
  valueMaxInput.className = "value-range-input";
  valueMaxInput.title = "Max value";

  valueRangeRow.append(valueRangeLabel, valueMinInput, valueRangeSep, valueMaxInput);
  viewControlsPanel.appendChild(valueRangeRow);

  canvasShell.appendChild(viewControlsPanel);

  const handleLabelsToggleChange = () => {
    renderer.setTextLabelsVisible(labelsToggleInput.checked);
  };
  labelsToggleInput.addEventListener("change", handleLabelsToggleChange);

  const handleDarkModeChange = () => {
    renderer.setDarkMode(darkModeInput.checked);
    document.body.classList.toggle("dark-mode", darkModeInput.checked);
  };
  darkModeInput.addEventListener("change", handleDarkModeChange);

  const handleGridToggleChange = () => {
    renderer.setGridVisible(gridToggleInput.checked);
    if (gridToggleInput.checked) {
      renderer.setGridSize(parseFloat(gridSizeSlider.value));
    }
    gridSizeRow.hidden = !gridToggleInput.checked;
  };
  gridToggleInput.addEventListener("change", handleGridToggleChange);

  const handleGridSizeChange = () => {
    const size = parseFloat(gridSizeSlider.value);
    gridSizeValue.textContent = String(size);
    renderer.setGridSize(size);
  };
  gridSizeSlider.addEventListener("input", handleGridSizeChange);

  const handleValueRangeChange = () => {
    const min = parseFloat(valueMinInput.value);
    const max = parseFloat(valueMaxInput.value);
    if (Number.isFinite(min) && Number.isFinite(max) && min < max) {
      renderer.setValueRange(min, max);
    }
  };
  valueMinInput.addEventListener("change", handleValueRangeChange);
  valueMaxInput.addEventListener("change", handleValueRangeChange);

  return {
    teardown() {
      labelsToggleInput.removeEventListener("change", handleLabelsToggleChange);
      darkModeInput.removeEventListener("change", handleDarkModeChange);
      gridToggleInput.removeEventListener("change", handleGridToggleChange);
      gridSizeSlider.removeEventListener("input", handleGridSizeChange);
      valueMinInput.removeEventListener("change", handleValueRangeChange);
      valueMaxInput.removeEventListener("change", handleValueRangeChange);
      viewControlsPanel.remove();
    },
  };
}
