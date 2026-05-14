/**
 * Graph data structures for function visualization
 */

export interface Vertex {
  index: number;
  x: number;
  y: number;
  edges: number[]; // indices of connected vertices
}

export interface Edge {
  index: number;
  length?: number; // Optional length (can be computed from vertex positions)
  v1: number; // index of vertex 1
  v2: number; // index of vertex 2
}

export interface Graph {
  vertices: Vertex[];
  edges: Edge[];
}

/**
 * Function values at each vertex.
 * Maps vertex index to scalar value.
 */
export type FunctionValues = Map<number, number>;

/**
 * Configuration options for graph rendering
 */
export interface RenderOptions {
  width?: number;
  height?: number;
  
  // Node appearance
  nodeMinSize?: number;
  nodeMaxSize?: number;
  nodeMinValue?: number;
  nodeMaxValue?: number;
  colorScale?: (value: number) => number; // value [0,1] -> 0xRRGGBB
  
  // Edge appearance
  edgeColor?: number;
  edgeAlpha?: number;
  edgeWidth?: number;
  
  // Padding
  padding?: number;
}

export const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  width: 800,
  height: 600,
  nodeMinSize: 4,
  nodeMaxSize: 20,
  nodeMinValue: 0,
  nodeMaxValue: 1,
  colorScale: defaultColorScale,
  edgeColor: 0x999999,
  edgeAlpha: 0.5,
  edgeWidth: 1,
  padding: 40,
};

/**
 * Default color scale: red -> dark purple -> blue (sequential for positive values)
 * value: [0, 1] -> color
 */
function defaultColorScale(value: number): number {
  const v = Math.max(0, Math.min(1, value));
  
  if (v < 0.5) {
    // Red to dark purple: [0, 0.5]
    const t = v * 2;
    const r = Math.round(255 - 127 * t);
    const g = 0;
    const b = Math.round(128 * t);
    return (r << 16) | (g << 8) | b;
  } else {
    // Dark purple to blue: [0.5, 1]
    const t = (v - 0.5) * 2;
    const r = Math.round(128 - 128 * t);
    const g = 0;
    const b = Math.round(128 + 127 * t);
    return (r << 16) | (g << 8) | b;
  }
}

/**
 * Simulation parameters for diffusion solver
 * 
 */
export interface DiffusionParams {
  diffusionRate: number; // Rate of diffusion (D)
  timeStep: number; // Time step for simulation (dt)
  iterations: number; // Number of iterations to run
  initialValues: FunctionValues; // Initial condition at t=0
}

/**
 * shared app-mode state to toggle editor and simulator modes
 * 
 */

export type AppMode = "editor" | "simulation";

/**
 * State of the graph and function values, used for simulation, rendering and editing.
 */
export interface GraphState {
  graph: Graph;
  initialValues: FunctionValues;
}

