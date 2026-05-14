# Graph Renderer - Library Documentation

A TypeScript rendering library for visualizing scalar functions on graph structures. Built on Pixi.js v8 for GPU-accelerated rendering. Designed to integrate with simulation libraries that compute discrete differential equations on graphs.

**Visual features:**
- Nodes colored and sized by per-vertex scalar values
- Directed flux arrows on edges, scaled by magnitude
- Per-vertex text labels: current value, inflow, outflow, net flow
- Per-edge text labels: flux magnitude
- Toggleable text label overlay
- Spatial grid overlay with world-coordinate cell sizing
- Dark mode

**Navigation features:**
- Mouse-wheel zoom toward cursor
- Middle-click or right-click drag to pan
- Coordinate conversion between world space, local (canvas-pixel) space, and screen space

**Graph editing features:**
- Add and remove vertices and edges at runtime
- Reposition vertices
- Editor mode that suppresses left-drag pan to allow node dragging

## Table of Contents
- [Quick Start](#quick-start)
- [Data Types](#data-types)
- [GraphRenderer Reference](#graphrenderer-reference)
  - [GraphRenderer.create()](#static-method-graphrenderercreate)
  - [update()](#instance-method-update)
  - [render()](#instance-method-render)
  - [setTextLabelsVisible()](#instance-method-settextlabelsvisible)
  - [getTextLabelsVisible()](#instance-method-gettextlabelsvisible)
  - [setValueRange()](#instance-method-setvaluerange)
  - [getValueRange()](#instance-method-getvaluerange)
  - [setDarkMode()](#instance-method-setdarkmode)
  - [setGridVisible()](#instance-method-setgridvisible)
  - [setGridSize()](#instance-method-setgridsize)
  - [getGridVisible()](#instance-method-getgridvisible)
  - [getGridCellSize()](#instance-method-getgridcellsize)
  - [setEditorMode()](#instance-method-seteditormode)
  - [addVertex()](#instance-method-addvertex)
  - [removeVertex()](#instance-method-removevertex)
  - [addEdge()](#instance-method-addedge)
  - [removeEdge()](#instance-method-removeedge)
  - [setVertexPosition()](#instance-method-setvertexposition)
  - [worldToScreen()](#instance-method-worldtoscreen)
  - [screenToWorld()](#instance-method-screentoworld)
  - [getWorldBounds()](#instance-method-getworldbounds)
  - [getCanvas()](#instance-method-getcanvas)
  - [ticker](#instance-property-ticker)
  - [resize()](#instance-method-resize)
  - [destroy()](#instance-method-destroy)
  - [Callbacks](#callbacks)
- [RenderOptions](#renderoptions)
- [Examples](#examples)
- [Integration Patterns](#integration-patterns)

---

## Quick Start

### 1. Build a Graph Object

The renderer requires a `Graph` with both `vertices` and `edges` populated. The `loadGraph()` helper in `main.ts` builds this from a JSON adjacency list; use it as a reference for your own loading code.

```typescript
import type { Graph, Edge } from "./types";

// Build edges from vertex adjacency list
function buildEdges(vertices: Graph["vertices"]): Edge[] {
  const edges: Edge[] = [];
  const seen = new Set<string>();
  let idx = 0;
  for (const v of vertices) {
    for (const neighborIdx of v.edges) {
      const key = [v.index, neighborIdx].sort().join("-");
      if (!seen.has(key)) {
        const neighbor = vertices[neighborIdx];
        const length = Math.hypot(v.x - neighbor.x, v.y - neighbor.y);
        edges.push({ index: idx++, v1: v.index, v2: neighborIdx, length });
        seen.add(key);
      }
    }
  }
  return edges;
}

const raw = await fetch("graph.json").then(r => r.json());
const graph: Graph = {
  vertices: raw.vertices,
  edges: buildEdges(raw.vertices),
};
```

### 2. Create a Renderer and Render

```typescript
import { GraphRenderer } from "./render/renderer";
import type { FunctionValues } from "./types";

const container = document.getElementById("app")!;
const renderer = await GraphRenderer.create(container, graph);

// Scalar values at each vertex
const values: FunctionValues = new Map([
  [0, 0.3],
  [1, 0.7],
  [2, 0.5],
]);

renderer.update(values);
renderer.render();
```

---

## Data Types

### `Graph`

Represents the full graph structure passed to the renderer.

```typescript
interface Graph {
  vertices: Vertex[];
  edges: Edge[];
}
```

**Properties:**
- `vertices`: Array of vertex objects (positions and adjacency)
- `edges`: Array of edge objects (explicit, with computed lengths)

> **Note:** The graph JSON format uses an adjacency list on vertices only. You must build the `Edge` array before passing the graph to `GraphRenderer.create()`. See the Quick Start above or `main.ts` for reference.

### `Vertex`

Represents a single vertex in the graph.

```typescript
interface Vertex {
  index: number;      // Unique identifier (0-indexed)
  x: number;          // X coordinate (Euclidean)
  y: number;          // Y coordinate (Euclidean)
  edges: number[];    // Indices of connected vertices
}
```

**Example:**
```json
{ "index": 5, "x": 1.2, "y": 3.4, "edges": [2, 3, 7] }
```

### `Edge`

Represents a single undirected edge between two vertices, with an orientation used for flux sign conventions.

```typescript
interface Edge {
  index: number;    // Unique identifier (0-indexed)
  v1: number;       // Index of the first vertex (flux origin when positive)
  v2: number;       // Index of the second vertex
  length?: number;  // Euclidean distance between v1 and v2
}
```

**Notes:**
- `v1` → `v2` defines the positive flux direction. Flux values reported by the solver follow this convention.
- `length` is optional; the renderer uses it only to position labels and arrows (it reads lengths from `edgeFluxValues` magnitudes, not from `Edge.length` directly).

### `FunctionValues`

Maps vertex indices to scalar values (the function being visualized).

```typescript
type FunctionValues = Map<number, number>;
```

**Example:**
```typescript
const values = new Map<number, number>();
values.set(0, 0.5);   // Vertex 0 has value 0.5
values.set(1, -0.3);  // Vertex 1 has value -0.3
values.set(2, 0.8);   // Vertex 2 has value 0.8
```

**Notes:**
- Missing vertex indices default to `0.5` (normalized midpoint)
- Values are normalized using `nodeMinValue` and `nodeMaxValue`

### `RenderOptions`

Configuration for renderer appearance and behavior.

```typescript
interface RenderOptions {
  width?: number;                              // Canvas width in pixels (default: 800)
  height?: number;                             // Canvas height in pixels (default: 600)
  nodeMinSize?: number;                        // Min node radius in pixels (default: 4)
  nodeMaxSize?: number;                        // Max node radius in pixels (default: 20)
  nodeMinValue?: number;                       // Min value for normalization (default: 0)
  nodeMaxValue?: number;                       // Max value for normalization (default: 1)
  colorScale?: (value: number) => number;      // Color function: [0,1] → 0xRRGGBB
  edgeColor?: number;                          // Edge line color as 0xRRGGBB (default: 0x999999)
  edgeAlpha?: number;                          // Edge line opacity [0,1] (default: 0.5)
  edgeWidth?: number;                          // Edge line width in pixels (default: 1)
  padding?: number;                            // Canvas margin in pixels (default: 40)
}
```

---

## GraphRenderer Reference

### Static Method: `GraphRenderer.create()`

Factory method to asynchronously create and initialize a renderer.

```typescript
static async create(
  container: HTMLElement,
  graph: Graph,
  options?: RenderOptions
): Promise<GraphRenderer>
```

**Parameters:**
- `container`: HTMLElement where the canvas will be appended
- `graph`: Graph structure with populated `vertices` and `edges`
- `options`: Optional rendering configuration (see [RenderOptions](#renderoptions))

**Returns:** Promise resolving to initialized `GraphRenderer`

**Example:**
```typescript
const renderer = await GraphRenderer.create(
  document.getElementById('app')!,
  graph,
  {
    width: 1200,
    height: 800,
    nodeMinSize: 8,
    nodeMaxSize: 24,
    padding: 60
  }
);
```

### Instance Method: `update()`

Update vertex function values, and optionally edge flux values, then redraw nodes and overlays.

```typescript
update(functionValues: FunctionValues, edgeFluxValues?: Map<number, number>): void
```

**Parameters:**
- `functionValues`: Map of vertex index → scalar value
- `edgeFluxValues` *(optional)*: Map of edge index → signed flux. When provided, flux arrows and flux magnitude labels on edges are redrawn.

**Notes:**
- Must call `render()` after to display changes
- Vertex values are normalized to [0, 1] using `nodeMinValue` and `nodeMaxValue`
- Missing vertices default to `0.5`
- Flux arrows are sized and directed by the magnitude and sign of each edge's flux. Arrows are hidden when `edgeFluxValues` is omitted.

**Example:**
```typescript
// Vertex values only
renderer.update(values);
renderer.render();

// Vertex values + edge fluxes
renderer.update(state.currentValues, state.edgeFluxValues);
renderer.render();
```

### Instance Method: `setTextLabelsVisible()`

Show or hide all text label overlays (vertex labels and edge flux labels).

```typescript
setTextLabelsVisible(visible: boolean): void
```

**Parameters:**
- `visible`: `true` to show labels, `false` to hide them

**Notes:**
- Vertex labels display: `<index>: <value>\nin: <inflow>\nout: <outflow>\nnet: <netflow>`
- Net flow is color-coded: green for positive (net inflow), red for negative (net outflow), neutral for zero
- Edge labels display the flux magnitude as a 3-decimal number, offset perpendicular to the edge

**Example:**
```typescript
renderer.setTextLabelsVisible(false); // hide for cleaner screenshots
renderer.setTextLabelsVisible(true);  // restore
```

### Instance Method: `getTextLabelsVisible()`

Return the current visibility state of text labels.

```typescript
getTextLabelsVisible(): boolean
```

---

### Instance Method: `setValueRange()`

Update the value range used to normalize vertex values for color and size mapping. Takes effect immediately without needing a separate `render()` call.

```typescript
setValueRange(min: number, max: number): void
```

**Parameters:**
- `min`: Value mapped to the bottom of the color/size scale
- `max`: Value mapped to the top of the color/size scale

**Notes:**
- Equivalent to changing `nodeMinValue` / `nodeMaxValue` at construction time, but live
- `min` must be strictly less than `max`; no validation is performed internally

**Example:**
```typescript
// Rescale to show fine detail in a narrow band
renderer.setValueRange(0.4, 0.6);
```

### Instance Method: `getValueRange()`

Return the current value normalization range.

```typescript
getValueRange(): { min: number; max: number }
```

---

### Instance Method: `setDarkMode()`

Switch between light and dark color schemes. Rebuilds all text objects (whose styles are baked at creation time) and redraws the scene.

```typescript
setDarkMode(enabled: boolean): void
```

**Parameters:**
- `enabled`: `true` for dark mode, `false` for light mode

**Light scheme:** white background, gray edges, dark labels, green/red flow colors, light gray grid  
**Dark scheme:** `#111827` background, lighter edges, near-white labels, bright green/red flow colors, mid-gray grid

---

### Instance Method: `setGridVisible()`

Show or hide the spatial grid overlay.

```typescript
setGridVisible(visible: boolean): void
```

### Instance Method: `setGridSize()`

Set the grid cell size in **world coordinate units** (not pixels). The grid redraws immediately.

```typescript
setGridSize(size: number): void
```

**Notes:**
- Grid lines are drawn at multiples of `size` in world space, so they maintain consistent physical spacing regardless of zoom level.
- A reasonable default is `worldSpan / 10`.

**Example:**
```typescript
renderer.setGridVisible(true);
renderer.setGridSize(0.5); // one grid line every 0.5 world units
```

### Instance Method: `getGridVisible()`

```typescript
getGridVisible(): boolean
```

### Instance Method: `getGridCellSize()`

```typescript
getGridCellSize(): number
```

---

### Instance Method: `setEditorMode()`

Enable or disable editor mode. In editor mode, left-click drag on the canvas does **not** pan the camera (so left-drag can be used for node dragging). In simulation mode (editor mode disabled), left-click drag pans.

```typescript
setEditorMode(enabled: boolean): void
```

---

### Instance Method: `addVertex()`

Add a new vertex to the live scene.

```typescript
addVertex(vertex: Vertex): void
```

**Parameters:**
- `vertex`: A `Vertex` object with `index`, `x`, `y`, and `edges` fields. The `edges` array is used for display only; the renderer does not validate adjacency.

**Notes:**
- The vertex is rendered immediately.
- Call `render()` after if not using the ticker.

### Instance Method: `removeVertex()`

Remove a vertex and all incident edges from the scene.

```typescript
removeVertex(index: number): void
```

### Instance Method: `addEdge()`

Add a new edge to the live scene.

```typescript
addEdge(edge: Edge): void
```

### Instance Method: `removeEdge()`

Remove an edge from the scene by its index.

```typescript
removeEdge(index: number): void
```

### Instance Method: `setVertexPosition()`

Move a vertex to a new world-coordinate position. Updates the vertex in the internal graph state and redraws incident edges.

```typescript
setVertexPosition(index: number, worldX: number, worldY: number): void
```

---

### Instance Method: `worldToScreen()`

Convert a world-coordinate point to screen (canvas CSS pixel) coordinates, accounting for the current camera position and zoom.

```typescript
worldToScreen(x: number, y: number): [number, number]
```

**Returns:** `[screenX, screenY]` in canvas CSS pixel space.

**Use case:** Positioning HTML overlay elements (tooltips, labels) on top of graph nodes.

```typescript
const [sx, sy] = renderer.worldToScreen(vertex.x, vertex.y);
tooltip.style.left = `${sx + 12}px`;
tooltip.style.top  = `${sy + 12}px`;
```

### Instance Method: `screenToWorld()`

Convert a canvas CSS pixel coordinate back to world space.

```typescript
screenToWorld(screenX: number, screenY: number): [number, number]
```

**Use case:** Converting a pointer event position into a world-coordinate location for node placement or hit testing.

```typescript
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const [wx, wy] = renderer.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  console.log('Clicked at world', wx, wy);
});
```

### Instance Method: `getWorldBounds()`

Return the axis-aligned bounding box of all vertices in world coordinates.

```typescript
getWorldBounds(): { minX: number; maxX: number; minY: number; maxY: number }
```

**Use case:** Computing a sensible default grid cell size or zoom-to-fit behavior.

```typescript
const wb = renderer.getWorldBounds();
const span = Math.max(wb.maxX - wb.minX, wb.maxY - wb.minY);
renderer.setGridSize(span / 10);
```

---

### Callbacks

The renderer exposes three public callback fields that the UI layer can assign to hook into renderer events.

#### `onNodePointerDown`

Called when the user presses a pointer button on a node (left button only).

```typescript
onNodePointerDown: ((vertexIndex: number, screenX: number, screenY: number) => void) | null
```

#### `onCanvasPointerDown`

Called when the user presses the pointer on the canvas background (not on a node).

```typescript
onCanvasPointerDown: ((worldX: number, worldY: number) => void) | null
```

#### `onCameraChange`

Called whenever the camera is updated (zoom or pan). Use this to dismiss UI overlays that track world positions.

```typescript
onCameraChange: (() => void) | null
```

**Example:**
```typescript
renderer.onCameraChange = () => tooltip.hidden = true;
```

---

### Instance Method: `render()`

Render the current scene to canvas.

```typescript
render(): void
```

**Notes:**
- Call after `update()` to display changes

**Example:**
```typescript
renderer.update(newValues);
renderer.render();
```

### Instance Method: `resize()`

Resize the canvas.

```typescript
resize(width: number, height: number): void
```

**Parameters:**
- `width`: New canvas width in pixels
- `height`: New canvas height in pixels

**Example:**
```typescript
renderer.resize(1200, 900);
```

### Instance Method: `destroy()`

Clean up renderer resources and remove canvas from DOM.

```typescript
destroy(): void
```

**Example:**
```typescript
renderer.destroy();
```

### Instance Method: `getCanvas()`

Get the underlying HTML canvas element for custom styling.

```typescript
getCanvas(): HTMLCanvasElement
```

**Example:**
```typescript
const canvas = renderer.getCanvas();
canvas.style.border = '2px solid blue';
```

### Instance Property: `ticker`

Access to the Pixi.js application ticker for animation loops.

```typescript
ticker: PIXI.Ticker
```

**Example:**
```typescript
renderer.ticker.add(() => {
  renderer.update(newValues, newFluxes);
  renderer.render();
});
```

---

## RenderOptions

### Default Options

```typescript
const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  width: 800,
  height: 600,
  nodeMinSize: 4,
  nodeMaxSize: 20,
  nodeMinValue: 0,
  nodeMaxValue: 1,
  colorScale: defaultColorScale,    // Red → Dark Purple → Blue
  edgeColor: 0x999999,              // Gray
  edgeAlpha: 0.5,
  edgeWidth: 1,
  padding: 40,
};
```

### Color Scale

The default color scale maps normalized values [0, 1] to:
- **0.0**: Red (255, 0, 0)
- **0.5**: Dark Purple (128, 0, 128)
- **1.0**: Blue (0, 0, 255)

#### Custom Color Scale

Provide your own color function:

```typescript
const customColorScale = (value: number): number => {
  // value is normalized to [0, 1]
  // return 24-bit RGB color as 0xRRGGBB
  
  const r = Math.round(255 * value);
  const g = Math.round(128 * (1 - Math.abs(value - 0.5)));
  const b = Math.round(255 * (1 - value));
  
  return (r << 16) | (g << 8) | b;
};

const renderer = await GraphRenderer.create(container, graph, {
  colorScale: customColorScale
});
```

### Value Normalization

Function values are normalized before visualization:

```
normalized = (value - nodeMinValue) / (nodeMaxValue - nodeMinValue)
normalized = clamp(normalized, 0, 1)
```

**Example:**
```typescript
// With nodeMinValue: -2, nodeMaxValue: 2
// Value -2 → normalized 0 → Red
// Value  0 → normalized 0.5 → Dark Purple
// Value  2 → normalized 1 → Blue
```

---

## Examples

### Example 1: Static Visualization

Display a fixed set of values on an already-loaded graph (with edges populated):

```typescript
import { GraphRenderer } from "./render/renderer";
import type { Graph, FunctionValues } from "./types";

async function visualizeStatic(graph: Graph) {
  const container = document.getElementById('app')!;
  
  const renderer = await GraphRenderer.create(container, graph, {
    nodeMinValue: 0,
    nodeMaxValue: 10
  });

  const values = new Map<number, number>();
  for (let i = 0; i < graph.vertices.length; i++) {
    values.set(i, Math.random() * 10);
  }

  renderer.update(values);
  renderer.render();
}
```

### Example 2: Animated Visualization

Update values continuously using the ticker:

```typescript
async function visualizeAnimated(graph: Graph) {
  const container = document.getElementById('app')!;
  
  const renderer = await GraphRenderer.create(container, graph);
  const values = new Map<number, number>();

  let time = 0;

  renderer.ticker.add(() => {
    time += 0.016; // ~60fps

    for (const vertex of graph.vertices) {
      const wave = 0.5 + 0.5 * Math.sin(vertex.x * 5 - time * 2);
      values.set(vertex.index, wave);
    }

    renderer.update(values);
    renderer.render();
  });
}
```

### Example 3: Integration with DiffusionSolver

The `update()` method accepts an optional second argument for edge fluxes. Pass `state.edgeFluxValues` from the solver to enable the directed flux arrow overlay:

```typescript
import { GraphRenderer } from "./render/renderer";
import { DiffusionSolver } from "./simulation/diffusionSolver";
import type { Graph, FunctionValues } from "./types";

async function runSimulation(graph: Graph, initialValues: FunctionValues) {
  const container = document.getElementById('app')!;
  
  const renderer = await GraphRenderer.create(container, graph, {
    nodeMinValue: 0,
    nodeMaxValue: 10,
    nodeMinSize: 5,
    nodeMaxSize: 25,
  });

  const solver = new DiffusionSolver(graph, {
    diffusionRate: 0.5,
    timeStep: 0.01,
    iterations: 1000,
    initialValues,
  });

  renderer.ticker.add(() => {
    solver.timestep();
    const state = solver.getState();
    renderer.update(state.currentValues, state.edgeFluxValues);
    renderer.render();
  });
}
```

### Example 4: Custom Color Scale

Provide your own color function mapping normalized [0, 1] values to `0xRRGGBB`:

```typescript
const customColorScale = (value: number): number => {
  const v = Math.max(0, Math.min(1, value));
  const r = Math.round(255 * v);
  const g = Math.round(128 * (1 - Math.abs(v - 0.5) * 2));
  const b = Math.round(255 * (1 - v));
  return (r << 16) | (g << 8) | b;
};

const renderer = await GraphRenderer.create(container, graph, {
  colorScale: customColorScale,
  nodeMinValue: -2,
  nodeMaxValue: 2
});
```

### Example 5: Toggling Labels

Hide labels for a cleaner view, then restore on demand:

```typescript
const renderer = await GraphRenderer.create(container, graph);

const toggle = document.getElementById('label-toggle') as HTMLInputElement;
toggle.addEventListener('change', () => {
  renderer.setTextLabelsVisible(toggle.checked);
});
```

---

## Integration Patterns

### Pattern 1: One-Shot Render

```typescript
const renderer = await GraphRenderer.create(container, graph);
renderer.update(values);
renderer.render();
// Canvas remains static
```

### Pattern 2: Continuous Animation

```typescript
const renderer = await GraphRenderer.create(container, graph);

renderer.ticker.add(() => {
  const newValues = computeValues();
  renderer.update(newValues);
  renderer.render();
});
```

### Pattern 3: Simulation Integration (with flux overlay)

```typescript
const renderer = await GraphRenderer.create(container, graph);
const sim = new DiffusionSolver(graph, params);

renderer.ticker.add(() => {
  sim.timestep();
  const state = sim.getState();
  // Pass edgeFluxValues to render directed flux arrows
  renderer.update(state.currentValues, state.edgeFluxValues);
  renderer.render();
});
```

### Pattern 4: Responsive Canvas

```typescript
const renderer = await GraphRenderer.create(container, graph);

window.addEventListener('resize', () => {
  renderer.resize(window.innerWidth - 20, window.innerHeight - 20);
  renderer.render();
});
```

---

## Performance Notes

- **Rendering**: Uses Pixi.js with WebGL/GPU acceleration
- **Node limit**: Tested up to 1000 nodes; performance depends on browser and GPU
- **Update frequency**: Call `render()` only after `update()` for best performance
- **Ticker**: Runs at browser refresh rate (typically 60 fps)

---

## Troubleshooting

**Nodes appear too small/large:**
- Adjust `nodeMinSize` and `nodeMaxSize` options

**Colors not visible or all look the same:**
- Check that `nodeMinValue` and `nodeMaxValue` bracket your actual data range
- Ensure values aren't all identical (try `Math.random()` for testing)

**No flux arrows visible:**
- Confirm you are passing `edgeFluxValues` as the second argument to `update()`
- Check that flux magnitudes are non-zero (arrows are hidden for `|flux| < 1e-8`)

**Canvas is blank:**
- Check the browser console for errors
- Verify the `Graph` object has both `vertices` and `edges` populated
- Ensure the container element exists in the DOM before calling `GraphRenderer.create()`
