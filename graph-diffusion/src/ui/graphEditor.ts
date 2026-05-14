import type { GraphState } from "../types";
import type { GraphRenderer } from "../render/renderer";

type EditorTool = "move" | "addNode" | "addEdge" | "delete";

function getCanvasShell(container: HTMLElement, renderer: GraphRenderer): HTMLElement {
  const canvas = renderer.getCanvas();
  const existingShell = canvas.parentElement;

  if (existingShell && existingShell.classList.contains("canvas-shell")) {
    return existingShell;
  }

  const canvasShell = document.createElement("div");
  canvasShell.className = "canvas-shell";
  canvasShell.style.width = `${canvas.clientWidth || canvas.width}px`;
  canvasShell.style.height = `${canvas.clientHeight || canvas.height}px`;
  container.insertBefore(canvasShell, canvas);
  canvasShell.appendChild(canvas);
  return canvasShell;
}

function getNextIndex(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return Math.max(...values) + 1;
}

function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function findEdgeNearPoint(
  graphState: GraphState,
  renderer: GraphRenderer,
  worldX: number,
  worldY: number,
  thresholdPx = 12
): number | null {
  const [clickX, clickY] = renderer.worldToScreen(worldX, worldY);

  for (const edge of graphState.graph.edges) {
    const v1 = graphState.graph.vertices.find((vertex) => vertex.index === edge.v1);
    const v2 = graphState.graph.vertices.find((vertex) => vertex.index === edge.v2);
    if (!v1 || !v2) {
      continue;
    }
    const [x1, y1] = renderer.worldToScreen(v1.x, v1.y);
    const [x2, y2] = renderer.worldToScreen(v2.x, v2.y);
    if (distanceToSegment(clickX, clickY, x1, y1, x2, y2) <= thresholdPx) {
      return edge.index;
    }
  }

  return null;
}

export function setupGraphEditor(
  container: HTMLElement,
  renderer: GraphRenderer,
  graphState: GraphState
): { teardown(): void } {
  renderer.setEditorMode(true);
  const canvasShell = getCanvasShell(container, renderer);

  let currentTool: EditorTool = "move";
  let selectedVertexIndex: number | null = null;
  let addEdgeSource: number | null = null;
  let draggingVertexIndex: number | null = null;

  const toolbar = document.createElement("div");
  toolbar.className = "editor-toolbar";

  const moveButton = document.createElement("button");
  moveButton.type = "button";
  moveButton.className = "sim-button tool-button";
  moveButton.textContent = "Move";

  const addNodeButton = document.createElement("button");
  addNodeButton.type = "button";
  addNodeButton.className = "sim-button tool-button";
  addNodeButton.textContent = "Add Node";

  const addEdgeButton = document.createElement("button");
  addEdgeButton.type = "button";
  addEdgeButton.className = "sim-button tool-button";
  addEdgeButton.textContent = "Add Edge";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "sim-button tool-button";
  deleteButton.textContent = "Delete";

  const clearGraphButton = document.createElement("button");
  clearGraphButton.type = "button";
  clearGraphButton.className = "sim-button tool-button tool-button-danger";
  clearGraphButton.textContent = "Clear Graph";

  toolbar.append(moveButton, addNodeButton, addEdgeButton, deleteButton, clearGraphButton);
  canvasShell.appendChild(toolbar);

  const edgePlacementStatus = document.createElement("div");
  edgePlacementStatus.className = "edge-placement-status";
  edgePlacementStatus.hidden = true;
  canvasShell.appendChild(edgePlacementStatus);

  const tooltip = document.createElement("div");
  tooltip.className = "node-tooltip";
  tooltip.hidden = true;

  const tooltipTitle = document.createElement("div");
  tooltipTitle.className = "node-tooltip-title";

  const valueLabel = document.createElement("label");
  valueLabel.className = "node-tooltip-label";
  valueLabel.textContent = "Initial value";

  const valueInput = document.createElement("input");
  valueInput.type = "number";
  valueInput.step = "any";
  valueInput.className = "node-tooltip-input";

  const addConnectionButton = document.createElement("button");
  addConnectionButton.type = "button";
  addConnectionButton.className = "sim-button node-tooltip-button";
  addConnectionButton.textContent = "Add Connection";

  tooltip.append(tooltipTitle, valueLabel, valueInput, addConnectionButton);
  canvasShell.appendChild(tooltip);

  const toolButtons: Record<EditorTool, HTMLButtonElement> = {
    move: moveButton,
    addNode: addNodeButton,
    addEdge: addEdgeButton,
    delete: deleteButton,
  };

  function getVertex(vertexIndex: number) {
    return graphState.graph.vertices.find((vertex) => vertex.index === vertexIndex) ?? null;
  }

  function hideTooltip(): void {
    selectedVertexIndex = null;
    tooltip.hidden = true;
  }

  function positionTooltip(vertexIndex: number): void {
    const vertex = getVertex(vertexIndex);
    if (!vertex) {
      return;
    }
    const [x, y] = renderer.worldToScreen(vertex.x, vertex.y);
    tooltip.style.left = `${x + 12}px`;
    tooltip.style.top = `${y + 12}px`;
  }

  function showTooltip(vertexIndex: number): void {
    const vertex = getVertex(vertexIndex);
    if (!vertex) {
      hideTooltip();
      return;
    }

    selectedVertexIndex = vertexIndex;
    tooltip.hidden = false;
    tooltipTitle.textContent = `Node #${vertexIndex}`;
    valueInput.value = String(graphState.initialValues.get(vertexIndex) ?? 0);
    positionTooltip(vertexIndex);
  }

  function refreshToolUI(): void {
    for (const [tool, button] of Object.entries(toolButtons) as Array<[EditorTool, HTMLButtonElement]>) {
      button.classList.toggle("active", tool === currentTool);
    }
  }

  function refreshEdgePlacementStatus(): void {
    const active = currentTool === "addEdge" && addEdgeSource !== null;
    edgePlacementStatus.hidden = !active;
    if (!active) {
      edgePlacementStatus.textContent = "";
      return;
    }
    edgePlacementStatus.textContent =
      `Connecting from Node #${addEdgeSource}. Click a target node, or right-click to cancel.`;
  }

  function setTool(tool: EditorTool): void {
    currentTool = tool;
    stopDragging();
    if (tool !== "addEdge") {
      addEdgeSource = null;
    }
    refreshToolUI();
    refreshEdgePlacementStatus();
  }

  function refreshIncidentEdgeLengths(vertexIndex: number): void {
    if (!getVertex(vertexIndex)) {
      return;
    }

    for (const edge of graphState.graph.edges) {
      if (edge.v1 !== vertexIndex && edge.v2 !== vertexIndex) {
        continue;
      }

      const v1 = getVertex(edge.v1);
      const v2 = getVertex(edge.v2);
      if (!v1 || !v2) {
        continue;
      }

      edge.length = Math.hypot(v1.x - v2.x, v1.y - v2.y);
    }
  }

  function onCanvasPointerMove(event: PointerEvent): void {
    if (draggingVertexIndex === null) {
      return;
    }

    const rect = renderer.getCanvas().getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    const [worldX, worldY] = renderer.screenToWorld(canvasX, canvasY);
    renderer.setVertexPosition(draggingVertexIndex, worldX, worldY);
    refreshIncidentEdgeLengths(draggingVertexIndex);

    if (selectedVertexIndex === draggingVertexIndex && !tooltip.hidden) {
      positionTooltip(draggingVertexIndex);
    }
  }

  function stopDragging(): void {
    draggingVertexIndex = null;
  }

  function addEdgeBetween(v1Index: number, v2Index: number): void {
    if (v1Index === v2Index) {
      return;
    }

    const v1 = getVertex(v1Index);
    const v2 = getVertex(v2Index);
    if (!v1 || !v2) {
      return;
    }

    const exists = graphState.graph.edges.some((edge) =>
      (edge.v1 === v1Index && edge.v2 === v2Index) ||
      (edge.v1 === v2Index && edge.v2 === v1Index)
    );
    if (exists) {
      return;
    }

    const edgeIndex = getNextIndex(graphState.graph.edges.map((edge) => edge.index));
    const length = Math.hypot(v1.x - v2.x, v1.y - v2.y);
    renderer.addEdge({ index: edgeIndex, v1: v1Index, v2: v2Index, length });
  }

  function handleNodePointerDown(vertexIndex: number): void {
    if (currentTool === "delete") {
      graphState.initialValues.delete(vertexIndex);
      renderer.removeVertex(vertexIndex);
      hideTooltip();
      if (addEdgeSource === vertexIndex) {
        addEdgeSource = null;
      }
      refreshEdgePlacementStatus();
      return;
    }

    if (currentTool === "addEdge") {
      if (addEdgeSource === null) {
        addEdgeSource = vertexIndex;
        hideTooltip();
      } else {
        addEdgeBetween(addEdgeSource, vertexIndex);
        addEdgeSource = null;
        showTooltip(vertexIndex);
      }
      refreshEdgePlacementStatus();
      return;
    }

    if (currentTool === "move") {
      draggingVertexIndex = vertexIndex;
    }

    showTooltip(vertexIndex);
  }

  function handleCanvasPointerDown(worldX: number, worldY: number): void {
    if (currentTool === "addNode") {
      const vertexIndex = getNextIndex(graphState.graph.vertices.map((vertex) => vertex.index));
      renderer.addVertex({ index: vertexIndex, x: worldX, y: worldY, edges: [] });
      graphState.initialValues.set(vertexIndex, 0);
      showTooltip(vertexIndex);
      return;
    }

    if (currentTool === "delete") {
      const edgeIndex = findEdgeNearPoint(graphState, renderer, worldX, worldY);
      if (edgeIndex !== null) {
        renderer.removeEdge(edgeIndex);
      }
      hideTooltip();
      return;
    }

    hideTooltip();
    if (currentTool !== "addEdge") {
      addEdgeSource = null;
    }
    refreshEdgePlacementStatus();
  }

  function handleEscape(event: KeyboardEvent): void {
    if (event.key !== "Escape") {
      return;
    }
    stopDragging();
    addEdgeSource = null;
    hideTooltip();
    refreshEdgePlacementStatus();
  }

  const handleMoveToolClick = () => setTool("move");
  const handleAddNodeToolClick = () => setTool("addNode");
  const handleAddEdgeToolClick = () => setTool("addEdge");
  const handleDeleteToolClick = () => setTool("delete");

  const handleClearGraphClick = () => {
    stopDragging();
    hideTooltip();
    addEdgeSource = null;

    const vertexIndexes = graphState.graph.vertices.map((vertex) => vertex.index);
    for (const vertexIndex of vertexIndexes) {
      renderer.removeVertex(vertexIndex);
    }

    graphState.initialValues.clear();
    renderer.update(graphState.initialValues);
    renderer.render();
    refreshEdgePlacementStatus();
  };

  const handleContextMenu = (event: MouseEvent) => {
    if (currentTool !== "addEdge" || addEdgeSource === null) {
      return;
    }
    event.preventDefault();
    addEdgeSource = null;
    hideTooltip();
    refreshEdgePlacementStatus();
  };

  const handleValueInput = () => {
    if (selectedVertexIndex === null) {
      return;
    }

    const value = Number(valueInput.value);
    if (!Number.isFinite(value)) {
      return;
    }

    graphState.initialValues.set(selectedVertexIndex, value);
    renderer.update(graphState.initialValues);
    renderer.render();
  };

  const handleAddConnectionClick = () => {
    if (selectedVertexIndex === null) {
      return;
    }
    addEdgeSource = selectedVertexIndex;
    setTool("addEdge");
    hideTooltip();
    refreshEdgePlacementStatus();
  };

  moveButton.addEventListener("click", handleMoveToolClick);
  addNodeButton.addEventListener("click", handleAddNodeToolClick);
  addEdgeButton.addEventListener("click", handleAddEdgeToolClick);
  deleteButton.addEventListener("click", handleDeleteToolClick);
  clearGraphButton.addEventListener("click", handleClearGraphClick);
  valueInput.addEventListener("input", handleValueInput);
  addConnectionButton.addEventListener("click", handleAddConnectionClick);
  canvasShell.addEventListener("contextmenu", handleContextMenu);
  window.addEventListener("pointermove", onCanvasPointerMove);
  window.addEventListener("pointerup", stopDragging);
  window.addEventListener("keydown", handleEscape);

  renderer.onNodePointerDown = (vertexIndex) => {
    handleNodePointerDown(vertexIndex);
  };
  renderer.onCanvasPointerDown = (worldX, worldY) => {
    handleCanvasPointerDown(worldX, worldY);
  };

  refreshToolUI();
  refreshEdgePlacementStatus();

  renderer.update(graphState.initialValues);
  renderer.render();

  return {
    teardown(): void {
      window.removeEventListener("pointermove", onCanvasPointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("keydown", handleEscape);
      moveButton.removeEventListener("click", handleMoveToolClick);
      addNodeButton.removeEventListener("click", handleAddNodeToolClick);
      addEdgeButton.removeEventListener("click", handleAddEdgeToolClick);
      deleteButton.removeEventListener("click", handleDeleteToolClick);
      clearGraphButton.removeEventListener("click", handleClearGraphClick);
      valueInput.removeEventListener("input", handleValueInput);
      addConnectionButton.removeEventListener("click", handleAddConnectionClick);
      canvasShell.removeEventListener("contextmenu", handleContextMenu);

      renderer.setEditorMode(false);
      renderer.onNodePointerDown = null;
      renderer.onCanvasPointerDown = null;

      stopDragging();
      hideTooltip();
      toolbar.remove();
      edgePlacementStatus.remove();
      tooltip.remove();
    },
  };
}
