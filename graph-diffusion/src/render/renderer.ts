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
  private edgesLayer: PIXI.Container;
  private nodesLayer: PIXI.Container;

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

    this.app.stage.addChild(this.edgesLayer);
    this.app.stage.addChild(this.nodesLayer);

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

  public setEditorMode(enabled: boolean): void {
    this.editorModeEnabled = enabled;
    this.configureStageInteraction();
    this.configureNodeInteractions();
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

  public worldToScreen(x: number, y: number): [number, number] {
    const padding = this.options.padding || 0;
    const w = this.options.width! - 2 * padding;
    const h = this.options.height! - 2 * padding;

    const screenX =
      padding +
      ((x - this.boundsX[0]) / (this.boundsX[1] - this.boundsX[0])) * w;
    const screenY =
      padding +
      ((y - this.boundsY[0]) / (this.boundsY[1] - this.boundsY[0])) * h;

    return [screenX, screenY];
  }

  public screenToWorld(screenX: number, screenY: number): [number, number] {
    const padding = this.options.padding || 0;
    const w = this.options.width! - 2 * padding;
    const h = this.options.height! - 2 * padding;

    const x = (screenX - padding) / w  * (this.boundsX[1] - this.boundsX[0]) + this.boundsX[0];
    const y = (screenY - padding) / h * (this.boundsY[1] - this.boundsY[0]) + this.boundsY[0];

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
      if (!this.onCanvasPointerDown) {
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
        if (!this.onNodePointerDown) {
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
          fill: 0x1f2937,
          stroke: {
            color: 0xffffff,
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
      color: this.options.edgeColor,
      alpha: this.options.edgeAlpha,
    });

    for (const edge of this.graph.edges) {
      const v1 = this.vertexByIndex.get(edge.v1);
      const v2 = this.vertexByIndex.get(edge.v2);
      if (!v1 || !v2) {
        continue;
      }

      const [x1, y1] = this.worldToScreen(v1.x, v1.y);
      const [x2, y2] = this.worldToScreen(v2.x, v2.y);
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
      const [screenX, screenY] = this.worldToScreen(vertex.x, vertex.y);

      const nodeGfx = new PIXI.Graphics();
      nodeGfx.position.set(screenX, screenY);

      this.nodeGraphics.set(vertex.index, nodeGfx);
      this.nodesLayer.addChild(nodeGfx);

      const vertexLabel = new PIXI.Text({
        text: "0.000",
        style: {
          fontFamily: "Courier New",
          fontSize: 11,
          fill: 0x1f2937,
          stroke: {
            color: 0xffffff,
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

      const [screenX, screenY] = this.worldToScreen(vertex.x, vertex.y);
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
        color: 0x333333,
        alpha: 0.8,
      });
      nodeGfx.stroke();

      const label = this.vertexTextGraphics.get(vertex.index);
      if (!label) continue;
      const flow = vertexFlowSummary.get(vertex.index) ?? { in: 0, out: 0, net: 0 };
      label.text = `${vertex.index}: ${value.toFixed(3)}\nin: ${flow.in.toFixed(3)}\nout: ${flow.out.toFixed(3)}\nnet: ${flow.net.toFixed(3)}`;
      const netFlow = flow.net;
      if (Math.abs(netFlow) < 1e-9) {
        label.style.fill = 0x1f2937;
      } else {
        label.style.fill = netFlow > 0 ? 0x166534 : 0xb91c1c;
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

      const [x1, y1] = this.worldToScreen(v1.x, v1.y);
      const [x2, y2] = this.worldToScreen(v2.x, v2.y);

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
      label.style.fill = 0x1f2937;
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

      const [x1, y1] = this.worldToScreen(v1.x, v1.y);
      const [x2, y2] = this.worldToScreen(v2.x, v2.y);

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

      const color = 0x374151;
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
}
