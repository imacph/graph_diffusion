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
  Graph,
  FunctionValues,
  RenderOptions,
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

  // Current function values
  private functionValues: FunctionValues;

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
    this.functionValues = new Map();

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
  public update(functionValues: FunctionValues): void {
    this.functionValues = functionValues;
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

  private worldToScreen(x: number, y: number): [number, number] {
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

  private renderEdges(): void {
    const edges = new PIXI.Graphics();
    edges.setStrokeStyle({
      width: this.options.edgeWidth,
      color: this.options.edgeColor,
      alpha: this.options.edgeAlpha,
    });

    const drawnEdges = new Set<string>();

    for (const vertex of this.graph.vertices) {
      const [x1, y1] = this.worldToScreen(vertex.x, vertex.y);

      for (const neighborIdx of vertex.edges) {
        // Avoid drawing edges twice
        const edgeKey = [vertex.index, neighborIdx].sort().join("-");
        if (drawnEdges.has(edgeKey)) continue;
        drawnEdges.add(edgeKey);

        const neighbor = this.graph.vertices[neighborIdx];
        if (!neighbor) continue;

        const [x2, y2] = this.worldToScreen(neighbor.x, neighbor.y);

        edges.moveTo(x1, y1);
        edges.lineTo(x2, y2);
        edges.stroke();
      }
    }

    this.edgesLayer.addChild(edges);
  }

  private renderNodes(): void {
    for (const vertex of this.graph.vertices) {
      const [screenX, screenY] = this.worldToScreen(vertex.x, vertex.y);

      const nodeGfx = new PIXI.Graphics();
      nodeGfx.position.set(screenX, screenY);

      this.nodeGraphics.set(vertex.index, nodeGfx);
      this.nodesLayer.addChild(nodeGfx);
    }
  }

  private updateNodes(): void {
    for (const vertex of this.graph.vertices) {
      const nodeGfx = this.nodeGraphics.get(vertex.index);
      if (!nodeGfx) continue;

      // Get function value (default to 0.5 if not set)
      const value = this.functionValues.get(vertex.index) ?? 0.5;

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
    }
  }
}
