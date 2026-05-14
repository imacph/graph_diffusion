/**
 * Graph Renderer - Minimal rendering API for graph visualization
 *
 * Usage:
 *   const renderer = new GraphRenderer(container, graph, options);
 *   renderer.update(functionValues);
 *   
 * To animate:
 *   function animate() {
 *     functionValues.set(0, Math.sin(Date.now() / 1000));
 *     renderer.update(functionValues);
 *     renderer.render();
 *     requestAnimationFrame(animate);
 *   }
 */

import * as PIXI from "pixi.js";
import type {
  Edge,
  Graph,
  FunctionValues,
  RenderOptions,
  Vertex,
} from "../types";
import { DEFAULT_RENDER_OPTIONS } from "../types";

export class GraphRenderer {
  private app: PIXI.Application;
  private graph: Graph;
  private options: RenderOptions;

  // Graphics layers
  private graphContainer: PIXI.Container;
  private edgesLayer: PIXI.Container;
  private nodesLayer: PIXI.Container;

  // Camera state
  private camera = { x: 0, y: 0, zoom: 1 };
  private panState = { active: false, lastX: 0, lastY: 0 };

  // Grid state
  private gridLayer: PIXI.Graphics;
  private gridVisible = false;
  private gridCellSize = 60;
  private isDarkMode = false;

  private get scheme() {
    return this.isDarkMode ? {
      background: 0x111827,
      edgeColor: 0x6b7280,
      edgeAlpha: 0.7,
      arrowColor: 0xd1d5db,
      nodeStrokeColor: 0x9ca3af,
      nodeStrokeAlpha: 0.9,
      labelFill: 0xf9fafb,
      labelStroke: 0x111827,
      flowPositiveFill: 0x4ade80,
      flowNegativeFill: 0xf87171,
      gridColor: 0x4b5563,
    } : {
      background: 0xffffff,
      edgeColor: 0x999999,
      edgeAlpha: 0.5,
      arrowColor: 0x374151,
      nodeStrokeColor: 0x333333,
      nodeStrokeAlpha: 0.8,
      labelFill: 0x1f2937,
      labelStroke: 0xffffff,
      flowPositiveFill: 0x166534,
      flowNegativeFill: 0xb91c1c,
      gridColor: 0xd1d5db,
    };
  }

  // Node graphics (one per vertex)
  private nodeGraphics: Map<number, PIXI.Graphics>;
  private vertexTextGraphics: Map<number, PIXI.Text>;
  private edgeTextGraphics: Map<number, PIXI.Text>;
  private edgeArrowGraphics: Map<number, PIXI.Graphics>;
  private edgeLinesGraphics: PIXI.Graphics;

  // Current function values
  private functionValues: FunctionValues;
  private edgeFluxValues: Map<number, number>;
  private vertexByIndex: Map<number, Graph["vertices"][number]>;
  private textLabelsVisible: boolean;
  private editorModeEnabled: boolean;

  public onNodePointerDown: ((vertexIndex: number, screenX: number, screenY: number) => void) | null;
  public onCanvasPointerDown: ((worldX: number, worldY: number) => void) | null;
  public onCameraChange: (() => void) | null = null;

  // Coordinate bounds for scaling
  private boundsX: [number, number] = [0, 1];
  private boundsY: [number, number] = [0, 1];

  /**
   * Initialize the renderer (async)
   */
  static async create(
    container: HTMLElement,
    graph: Graph,
    options: RenderOptions = {}
  ): Promise<GraphRenderer> {
    const renderer = new GraphRenderer(graph, options);
    await renderer.init(container);
    return renderer;
  }

  private constructor(graph: Graph, options: RenderOptions = {}) {
    this.graph = graph;
    this.options = { ...DEFAULT_RENDER_OPTIONS, ...options };
    this.nodeGraphics = new Map();
    this.vertexTextGraphics = new Map();
    this.edgeTextGraphics = new Map();
    this.edgeArrowGraphics = new Map();
    this.edgeLinesGraphics = new PIXI.Graphics();
    this.functionValues = new Map();
    this.edgeFluxValues = new Map();
    this.vertexByIndex = new Map(graph.vertices.map((vertex) => [vertex.index, vertex]));
    this.textLabelsVisible = true;
    this.editorModeEnabled = false;
    this.onNodePointerDown = null;
    this.onCanvasPointerDown = null;

    // Compute bounds from graph vertices
    this.computeBounds();

    // Initialize Pixi app object (not initialized yet)
    this.app = new PIXI.Application();

    // Create layers
    this.graphContainer = new PIXI.Container();
    this.gridLayer = new PIXI.Graphics();
    this.edgesLayer = new PIXI.Container();
    this.nodesLayer = new PIXI.Container();
  }

  private async init(container: HTMLElement): Promise<void> {
    await this.app.init({
      width: this.options.width,
      height: this.options.height,
      backgroundColor: 0xffffff,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    container.appendChild(this.app.canvas);

    this.app.stage.addChild(this.graphContainer);
    this.graphContainer.addChild(this.gridLayer);
    this.graphContainer.addChild(this.edgesLayer);
    this.graphContainer.addChild(this.nodesLayer);

    this.setupCameraEvents();
    this.applyCamera();

    // Render graph structure
    this.renderEdges();
    this.renderNodes();
  }

  /**
   * Update function values and re-render nodes
   */
  public update(functionValues: FunctionValues, edgeFluxValues?: Map<number, number>): void {
    this.functionValues = functionValues;
    if (edgeFluxValues) {
      this.edgeFluxValues = edgeFluxValues;
      this.updateEdgeFluxLabels();
      this.updateEdgeFluxArrows();
    }
    this.updateNodes();
  }

  /**
   * Render the scene (call this after update)
   */
  public render(): void {
    this.app.render();
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.app.destroy(true);
  }

  /**
   * Get canvas element for custom styling
   */
  public getCanvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  /**
   * Get Pixi ticker for animation integration
   */
  public get ticker() {
    return this.app.ticker;
  }

  /**
   * Resize the renderer
   */
  public resize(width: number, height: number): void {
    this.app.renderer.resize(width, height);
    this.options.width = width;
    this.options.height = height;
    this.redrawGrid();
  }

  public setTextLabelsVisible(visible: boolean): void {
    this.textLabelsVisible = visible;
    for (const label of this.edgeTextGraphics.values()) {
      label.visible = visible;
    }
    for (const label of this.vertexTextGraphics.values()) {
      label.visible = visible;
    }
  }

  public getTextLabelsVisible(): boolean {
    return this.textLabelsVisible;
  }

  public getGridVisible(): boolean {
    return this.gridVisible;
  }

  public getGridCellSize(): number {
    return this.gridCellSize;
  }

  public getValueRange(): { min: number; max: number } {
    return {
      min: this.options.nodeMinValue ?? 0,
      max: this.options.nodeMaxValue ?? 1,
    };
  }

  public setValueRange(min: number, max: number): void {
    this.options.nodeMinValue = min;
    this.options.nodeMaxValue = max;
    this.updateNodes();
    this.render();
  }

  public setEditorMode(enabled: boolean): void {
    this.editorModeEnabled = enabled;
    this.configureStageInteraction();
    this.configureNodeInteractions();
  }

  public setGridVisible(visible: boolean): void {
    this.gridVisible = visible;
    this.redrawGrid();
    this.render();
  }

  public setGridSize(size: number): void {
    this.gridCellSize = size;
    this.redrawGrid();
    this.render();
  }

  public setDarkMode(enabled: boolean): void {
    this.isDarkMode = enabled;
    this.app.renderer.background.color = this.scheme.background;
    this.rebuildEdgeGraphics();
    this.renderNodes();
    this.updateNodes();
    this.redrawGrid();
    this.render();
  }

  public getWorldBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    return {
      minX: this.boundsX[0],
      maxX: this.boundsX[1],
      minY: this.boundsY[0],
      maxY: this.boundsY[1],
    };
  }

  public addVertex(vertex: Vertex): void {
    this.graph.vertices.push(vertex);
    this.vertexByIndex.set(vertex.index, vertex);
    this.renderNodes();
    this.rebuildEdgeGraphics();
    this.updateNodes();
    this.render();
  }

  public removeVertex(index: number): void {
    if (!this.vertexByIndex.has(index)) {
      return;
    }

    this.graph.vertices = this.graph.vertices.filter((vertex) => vertex.index !== index);
    for (const vertex of this.graph.vertices) {
      vertex.edges = vertex.edges.filter((neighbor) => neighbor !== index);
    }

    const removedEdgeIndexes = new Set<number>();
    this.graph.edges = this.graph.edges.filter((edge) => {
      const keep = edge.v1 !== index && edge.v2 !== index;
      if (!keep) {
        removedEdgeIndexes.add(edge.index);
      }
      return keep;
    });

    this.functionValues.delete(index);
    for (const edgeIndex of removedEdgeIndexes) {
      this.edgeFluxValues.delete(edgeIndex);
    }

    this.rebuildVertexLookup();
    this.renderNodes();
    this.rebuildEdgeGraphics();
    this.updateNodes();
    this.render();
  }

  public addEdge(edge: Edge): void {
    if (!this.vertexByIndex.has(edge.v1) || !this.vertexByIndex.has(edge.v2)) {
      return;
    }

    this.graph.edges.push(edge);

    const v1 = this.vertexByIndex.get(edge.v1);
    const v2 = this.vertexByIndex.get(edge.v2);
    if (v1 && !v1.edges.includes(edge.v2)) {
      v1.edges.push(edge.v2);
    }
    if (v2 && !v2.edges.includes(edge.v1)) {
      v2.edges.push(edge.v1);
    }

    this.rebuildEdgeGraphics();
    this.updateNodes();
    this.render();
  }

  public removeEdge(index: number): void {
    const edge = this.graph.edges.find((entry) => entry.index === index);
    if (!edge) {
      return;
    }

    this.graph.edges = this.graph.edges.filter((entry) => entry.index !== index);
    this.edgeFluxValues.delete(index);

    const v1 = this.vertexByIndex.get(edge.v1);
    const v2 = this.vertexByIndex.get(edge.v2);
    if (v1) {
      v1.edges = v1.edges.filter((neighbor) => neighbor !== edge.v2);
    }
    if (v2) {
      v2.edges = v2.edges.filter((neighbor) => neighbor !== edge.v1);
    }

    this.rebuildEdgeGraphics();
    this.updateNodes();
    this.render();
  }

  public setVertexPosition(index: number, worldX: number, worldY: number): void {
    const vertex = this.vertexByIndex.get(index);
    if (!vertex) {
      return;
    }

    vertex.x = worldX;
    vertex.y = worldY;

    this.redrawEdgeLines();
    this.updateEdgeFluxLabels();
    this.updateEdgeFluxArrows();
    this.updateNodes();
    this.render();
  }

  // ========== Private Methods ==========

  private computeBounds(): void {
    if (this.graph.vertices.length === 0) return;

    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;

    for (const vertex of this.graph.vertices) {
      minX = Math.min(minX, vertex.x);
      maxX = Math.max(maxX, vertex.x);
      minY = Math.min(minY, vertex.y);
      maxY = Math.max(maxY, vertex.y);
    }

    // Add small epsilon to avoid division by zero
    const eps = 1e-6;
    this.boundsX = [minX, maxX + eps];
    this.boundsY = [minY, maxY + eps];
  }

  private worldToLocal(x: number, y: number): [number, number] {
    const padding = this.options.padding || 0;
    const w = this.options.width! - 2 * padding;
    const h = this.options.height! - 2 * padding;

    const worldXRange = this.boundsX[1] - this.boundsX[0];
    const worldYRange = this.boundsY[1] - this.boundsY[0];
    const scale = Math.min(w / worldXRange, h / worldYRange);

    const worldCenterX = (this.boundsX[0] + this.boundsX[1]) / 2;
    const worldCenterY = (this.boundsY[0] + this.boundsY[1]) / 2;

    const localX = padding + w / 2 + (x - worldCenterX) * scale;
    const localY = padding + h / 2 + (y - worldCenterY) * scale;

    return [localX, localY];
  }

  public worldToScreen(x: number, y: number): [number, number] {
    const [lx, ly] = this.worldToLocal(x, y);
    return [lx * this.camera.zoom + this.camera.x, ly * this.camera.zoom + this.camera.y];
  }

  public screenToWorld(screenX: number, screenY: number): [number, number] {
    const padding = this.options.padding || 0;
    const w = this.options.width! - 2 * padding;
    const h = this.options.height! - 2 * padding;

    const lx = (screenX - this.camera.x) / this.camera.zoom;
    const ly = (screenY - this.camera.y) / this.camera.zoom;

    const worldXRange = this.boundsX[1] - this.boundsX[0];
    const worldYRange = this.boundsY[1] - this.boundsY[0];
    const scale = Math.min(w / worldXRange, h / worldYRange);

    const worldCenterX = (this.boundsX[0] + this.boundsX[1]) / 2;
    const worldCenterY = (this.boundsY[0] + this.boundsY[1]) / 2;

    const x = worldCenterX + (lx - (padding + w / 2)) / scale;
    const y = worldCenterY + (ly - (padding + h / 2)) / scale;

    return [x, y];
  }

  private rebuildVertexLookup(): void {
    this.vertexByIndex = new Map(this.graph.vertices.map((vertex) => [vertex.index, vertex]));
  }

  private configureStageInteraction(): void {
    this.app.stage.eventMode = this.editorModeEnabled ? "static" : "none";
    this.app.stage.cursor = this.editorModeEnabled ? "crosshair" : "default";
    this.app.stage.hitArea = this.app.screen;

    this.app.stage.removeAllListeners("pointerdown");
    if (!this.editorModeEnabled) {
      return;
    }

    this.app.stage.on("pointerdown", (event: PIXI.FederatedPointerEvent) => {
      if (!this.onCanvasPointerDown || event.button !== 0) {
        return;
      }
      const [worldX, worldY] = this.screenToWorld(event.global.x, event.global.y);
      this.onCanvasPointerDown(worldX, worldY);
    });
  }

  private configureNodeInteractions(): void {
    for (const [vertexIndex, nodeGfx] of this.nodeGraphics.entries()) {
      nodeGfx.removeAllListeners("pointerdown");
      nodeGfx.eventMode = this.editorModeEnabled ? "static" : "none";
      nodeGfx.cursor = this.editorModeEnabled ? "pointer" : "default";

      if (!this.editorModeEnabled) {
        continue;
      }

      nodeGfx.on("pointerdown", (event: PIXI.FederatedPointerEvent) => {
        event.stopPropagation();
        if (!this.onNodePointerDown || event.button !== 0) {
          return;
        }
        this.onNodePointerDown(vertexIndex, event.global.x, event.global.y);
      });
    }
  }

  private rebuildEdgeGraphics(): void {
    for (const text of this.edgeTextGraphics.values()) {
      text.destroy();
    }
    for (const arrow of this.edgeArrowGraphics.values()) {
      arrow.destroy();
    }

    this.edgeTextGraphics.clear();
    this.edgeArrowGraphics.clear();
    this.edgesLayer.removeChildren();

    this.edgeLinesGraphics = new PIXI.Graphics();
    this.edgesLayer.addChild(this.edgeLinesGraphics);

    for (const edge of this.graph.edges) {
      const edgeLabel = new PIXI.Text({
        text: "0.000",
        style: {
          fontFamily: "Courier New",
          fontSize: 11,
          fill: this.scheme.labelFill,
          stroke: {
            color: this.scheme.labelStroke,
            width: 3,
          },
        },
      });
      edgeLabel.anchor.set(0.5);
      edgeLabel.visible = this.textLabelsVisible;
      this.edgeTextGraphics.set(edge.index, edgeLabel);
      this.edgesLayer.addChild(edgeLabel);

      const edgeArrow = new PIXI.Graphics();
      this.edgeArrowGraphics.set(edge.index, edgeArrow);
      this.edgesLayer.addChild(edgeArrow);
    }

    this.redrawEdgeLines();
    this.updateEdgeFluxLabels();
    this.updateEdgeFluxArrows();
  }

  private redrawEdgeLines(): void {
    this.edgeLinesGraphics.clear();
    this.edgeLinesGraphics.setStrokeStyle({
      width: this.options.edgeWidth,
      color: this.scheme.edgeColor,
      alpha: this.scheme.edgeAlpha,
    });

    for (const edge of this.graph.edges) {
      const v1 = this.vertexByIndex.get(edge.v1);
      const v2 = this.vertexByIndex.get(edge.v2);
      if (!v1 || !v2) {
        continue;
      }

      const [x1, y1] = this.worldToLocal(v1.x, v1.y);
      const [x2, y2] = this.worldToLocal(v2.x, v2.y);
      this.edgeLinesGraphics.moveTo(x1, y1);
      this.edgeLinesGraphics.lineTo(x2, y2);
      this.edgeLinesGraphics.stroke();
    }
  }

  private renderNodes(): void {
    for (const text of this.vertexTextGraphics.values()) {
      text.destroy();
    }
    for (const node of this.nodeGraphics.values()) {
      node.destroy();
    }
    this.vertexTextGraphics.clear();
    this.nodeGraphics.clear();
    this.nodesLayer.removeChildren();

    for (const vertex of this.graph.vertices) {
      const [screenX, screenY] = this.worldToLocal(vertex.x, vertex.y);

      const nodeGfx = new PIXI.Graphics();
      nodeGfx.position.set(screenX, screenY);

      this.nodeGraphics.set(vertex.index, nodeGfx);
      this.nodesLayer.addChild(nodeGfx);

      const vertexLabel = new PIXI.Text({
        text: "0.000",
        style: {
          fontFamily: "Courier New",
          fontSize: 11,
          fill: this.scheme.labelFill,
          stroke: {
            color: this.scheme.labelStroke,
            width: 3,
          },
        },
      });
      vertexLabel.anchor.set(0.5);
      vertexLabel.visible = this.textLabelsVisible;
      this.vertexTextGraphics.set(vertex.index, vertexLabel);
      this.nodesLayer.addChild(vertexLabel);
    }

    this.configureNodeInteractions();
  }

  private toFiniteNumber(value: unknown, fallback = 0): number {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (Array.isArray(value) && value.length > 0) {
      return this.toFiniteNumber(value[0], fallback);
    }
    return fallback;
  }

  private renderEdges(): void {
    this.rebuildEdgeGraphics();
  }

  private updateNodes(): void {
    const vertexFlowSummary = this.computeVertexFlowSummary();

    for (const vertex of this.graph.vertices) {
      const nodeGfx = this.nodeGraphics.get(vertex.index);
      if (!nodeGfx) continue;

      const [screenX, screenY] = this.worldToLocal(vertex.x, vertex.y);
      nodeGfx.position.set(screenX, screenY);

      // Get function value (default to 0.5 if not set)
      const value = this.toFiniteNumber(this.functionValues.get(vertex.index), 0.5);

      // Normalize value to [0, 1]
      const minVal = this.options.nodeMinValue ?? 0;
      const maxVal = this.options.nodeMaxValue ?? 1;
      const normalized = (value - minVal) / (maxVal - minVal);
      const clipped = Math.max(0, Math.min(1, normalized));

      // Compute size based on normalized value
      const size =
        this.options.nodeMinSize! +
        clipped * (this.options.nodeMaxSize! - this.options.nodeMinSize!);

      // Compute color based on normalized value
      const color = this.options.colorScale!(clipped);

      // Draw node with border for visibility
      nodeGfx.clear();
      nodeGfx.circle(0, 0, size);
      nodeGfx.fill(color);
      nodeGfx.setStrokeStyle({
        width: 1.5,
        color: this.scheme.nodeStrokeColor,
        alpha: this.scheme.nodeStrokeAlpha,
      });
      nodeGfx.stroke();

      const label = this.vertexTextGraphics.get(vertex.index);
      if (!label) continue;
      const flow = vertexFlowSummary.get(vertex.index) ?? { in: 0, out: 0, net: 0 };
      label.text = `${vertex.index}: ${value.toFixed(3)}\nin: ${flow.in.toFixed(3)}\nout: ${flow.out.toFixed(3)}\nnet: ${flow.net.toFixed(3)}`;
      const netFlow = flow.net;
      if (Math.abs(netFlow) < 1e-9) {
        label.style.fill = this.scheme.labelFill;
      } else {
        label.style.fill = netFlow > 0 ? this.scheme.flowPositiveFill : this.scheme.flowNegativeFill;
      }
      label.position.set(nodeGfx.position.x, nodeGfx.position.y - (size + 34));
    }
  }

  private computeVertexFlowSummary(): Map<number, { in: number; out: number; net: number }> {
    const flowByVertex = new Map<number, { in: number; out: number; net: number }>();

    for (const vertex of this.graph.vertices) {
      flowByVertex.set(vertex.index, { in: 0, out: 0, net: 0 });
    }

    for (const edge of this.graph.edges) {
      const flux = this.toFiniteNumber(this.edgeFluxValues.get(edge.index), 0);
      const magnitude = Math.abs(flux);
      const v1Flow = flowByVertex.get(edge.v1);
      const v2Flow = flowByVertex.get(edge.v2);
      if (!v1Flow || !v2Flow) continue;

      if (flux >= 0) {
        v1Flow.out += magnitude;
        v2Flow.in += magnitude;
      } else {
        v2Flow.out += magnitude;
        v1Flow.in += magnitude;
      }
    }

    for (const flow of flowByVertex.values()) {
      flow.net = flow.in - flow.out;
    }

    return flowByVertex;
  }

  private updateEdgeFluxLabels(): void {
    for (const edge of this.graph.edges) {
      const label = this.edgeTextGraphics.get(edge.index);
      if (!label) continue;

      const v1 = this.vertexByIndex.get(edge.v1);
      const v2 = this.vertexByIndex.get(edge.v2);
      if (!v1 || !v2) continue;

      const [x1, y1] = this.worldToLocal(v1.x, v1.y);
      const [x2, y2] = this.worldToLocal(v2.x, v2.y);

      const midX = 0.5 * (x1 + x2);
      const midY = 0.5 * (y1 + y2);
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.hypot(dx, dy) || 1;

      // Offset label normal to edge to reduce overlap with edge line.
      const normalX = -dy / length;
      const normalY = dx / length;
      label.position.set(midX + 10 * normalX, midY + 10 * normalY);

      const flux = this.edgeFluxValues.get(edge.index) ?? 0;
      label.text = Math.abs(flux).toFixed(3);
      label.style.fill = this.scheme.labelFill;
    }
  }

  private updateEdgeFluxArrows(): void {
    let maxAbsFlux = 0;
    for (const flux of this.edgeFluxValues.values()) {
      maxAbsFlux = Math.max(maxAbsFlux, Math.abs(flux));
    }
    const denom = maxAbsFlux > 1e-12 ? maxAbsFlux : 1;

    for (const edge of this.graph.edges) {
      const arrow = this.edgeArrowGraphics.get(edge.index);
      if (!arrow) continue;

      const v1 = this.vertexByIndex.get(edge.v1);
      const v2 = this.vertexByIndex.get(edge.v2);
      if (!v1 || !v2) continue;

      const [x1, y1] = this.worldToLocal(v1.x, v1.y);
      const [x2, y2] = this.worldToLocal(v2.x, v2.y);

      const flux = this.edgeFluxValues.get(edge.index) ?? 0;
      const absFlux = Math.abs(flux);
      const normalized = Math.max(0, Math.min(1, absFlux / denom));

      const fromX = flux >= 0 ? x1 : x2;
      const fromY = flux >= 0 ? y1 : y2;
      const toX = flux >= 0 ? x2 : x1;
      const toY = flux >= 0 ? y2 : y1;

      const dx = toX - fromX;
      const dy = toY - fromY;
      const edgeLength = Math.hypot(dx, dy) || 1;
      const dirX = dx / edgeLength;
      const dirY = dy / edgeLength;

      // Keep arrow centered on edge while showing orientation and strength.
      const midX = 0.5 * (fromX + toX);
      const midY = 0.5 * (fromY + toY);
      const arrowLength = 10 + 22 * normalized;
      const halfArrow = 0.5 * arrowLength;
      const startX = midX - dirX * halfArrow;
      const startY = midY - dirY * halfArrow;
      const endX = midX + dirX * halfArrow;
      const endY = midY + dirY * halfArrow;

      const color = this.scheme.arrowColor;
      const alpha = 0.35 + 0.65 * normalized;
      const lineWidth = 1 + 2 * normalized;
      const headSize = 4 + 6 * normalized;

      arrow.clear();
      if (absFlux < 1e-8) {
        continue;
      }

      arrow.setStrokeStyle({ width: lineWidth, color, alpha });
      arrow.moveTo(startX, startY);
      arrow.lineTo(endX, endY);
      arrow.stroke();

      const leftX = endX - dirX * headSize - dirY * (0.6 * headSize);
      const leftY = endY - dirY * headSize + dirX * (0.6 * headSize);
      const rightX = endX - dirX * headSize + dirY * (0.6 * headSize);
      const rightY = endY - dirY * headSize - dirX * (0.6 * headSize);

      arrow.moveTo(endX, endY);
      arrow.lineTo(leftX, leftY);
      arrow.lineTo(rightX, rightY);
      arrow.closePath();
      arrow.fill({ color, alpha });
    }
  }

  private setupCameraEvents(): void {
    const canvas = this.app.canvas;

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newZoom = Math.max(0.05, Math.min(20, this.camera.zoom * factor));
      this.camera.x = cursorX - (cursorX - this.camera.x) * (newZoom / this.camera.zoom);
      this.camera.y = cursorY - (cursorY - this.camera.y) * (newZoom / this.camera.zoom);
      this.camera.zoom = newZoom;
      this.applyCamera();
    }, { passive: false });

    canvas.addEventListener("pointerdown", (e) => {
      const shouldPan =
        e.button === 1 || e.button === 2 || (e.button === 0 && !this.editorModeEnabled);
      if (!shouldPan) return;
      this.panState = { active: true, lastX: e.clientX, lastY: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!this.panState.active) return;
      this.camera.x += e.clientX - this.panState.lastX;
      this.camera.y += e.clientY - this.panState.lastY;
      this.panState.lastX = e.clientX;
      this.panState.lastY = e.clientY;
      this.applyCamera();
    });

    canvas.addEventListener("pointerup", () => {
      this.panState.active = false;
    });

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private applyCamera(): void {
    this.graphContainer.scale.set(this.camera.zoom);
    this.graphContainer.position.set(this.camera.x, this.camera.y);
    this.onCameraChange?.();
    this.redrawGrid();
    this.render();
  }

  private redrawGrid(): void {
    this.gridLayer.clear();
    if (!this.gridVisible || this.gridCellSize <= 0) return;

    const width = this.options.width!;
    const height = this.options.height!;
    const padding = this.options.padding || 0;
    const w = width - 2 * padding;
    const h = height - 2 * padding;

    // Visible area in graphContainer-local space
    const localX0 = -this.camera.x / this.camera.zoom;
    const localX1 = (width - this.camera.x) / this.camera.zoom;
    const localY0 = -this.camera.y / this.camera.zoom;
    const localY1 = (height - this.camera.y) / this.camera.zoom;

    // Convert visible local bounds to world coordinates
    const worldXRange = this.boundsX[1] - this.boundsX[0];
    const worldYRange = this.boundsY[1] - this.boundsY[0];
    const scale = Math.min(w / worldXRange, h / worldYRange);
    const worldCenterX = (this.boundsX[0] + this.boundsX[1]) / 2;
    const worldCenterY = (this.boundsY[0] + this.boundsY[1]) / 2;

    const worldX0 = worldCenterX + (localX0 - (padding + w / 2)) / scale;
    const worldX1 = worldCenterX + (localX1 - (padding + w / 2)) / scale;
    const worldY0 = worldCenterY + (localY0 - (padding + h / 2)) / scale;
    const worldY1 = worldCenterY + (localY1 - (padding + h / 2)) / scale;

    const cellSize = this.gridCellSize; // in world units
    const startWorldX = Math.floor(worldX0 / cellSize) * cellSize;
    const startWorldY = Math.floor(worldY0 / cellSize) * cellSize;

    // Keep lines visually ~1px wide regardless of zoom level
    const strokeWidth = Math.max(0.5, 1 / this.camera.zoom);
    this.gridLayer.setStrokeStyle({ width: strokeWidth, color: this.scheme.gridColor, alpha: 0.8 });

    for (let wx = startWorldX; wx <= worldX1 + cellSize; wx += cellSize) {
      const lx = padding + w / 2 + (wx - worldCenterX) * scale;
      this.gridLayer.moveTo(lx, localY0);
      this.gridLayer.lineTo(lx, localY1);
      this.gridLayer.stroke();
    }

    for (let wy = startWorldY; wy <= worldY1 + cellSize; wy += cellSize) {
      const ly = padding + h / 2 + (wy - worldCenterY) * scale;
      this.gridLayer.moveTo(localX0, ly);
      this.gridLayer.lineTo(localX1, ly);
      this.gridLayer.stroke();
    }
  }
}
