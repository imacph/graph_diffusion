# Graph Renderer - API Documentation

A minimal TypeScript rendering library for visualizing functions on graph structures. Perfect for integrating with simulation libraries that compute discrete differential equations on graphs.

## Table of Contents
- [Quick Start](#quick-start)
- [Data Types](#data-types)
- [GraphRenderer API](#graphrenderer-api)
- [RenderOptions](#renderoptions)
- [Examples](#examples)
- [Integration Patterns](#integration-patterns)

---

## Quick Start

### 1. Define Your Graph (JSON)

Create a JSON file with vertices and edges:

```json
{
  "vertices": [
    { "index": 0, "x": 0.0, "y": 0.5, "edges": [1, 2] },
    { "index": 1, "x": 0.5, "y": 0.0, "edges": [0, 2] },
    { "index": 2, "x": 1.0, "y": 0.5, "edges": [0, 1] }
  ]
}
```

### 2. Load and Render

```typescript
import { GraphRenderer } from "./render/renderer";
import type { Graph, FunctionValues } from "./types";

// Load graph
const graph: Graph = await fetch('graph.json').then(r => r.json());

// Create renderer
const container = document.getElementById('app')!;
const renderer = await GraphRenderer.create(container, graph);

// Set vertex values
const values: FunctionValues = new Map([
  [0, 0.3],
  [1, 0.7],
  [2, 0.5]
]);

// Render
renderer.update(values);
renderer.render();
```

---

## Data Types

### `Graph`

Represents the graph structure.

```typescript
interface Graph {
  vertices: Vertex[];
}
```

**Properties:**
- `vertices`: Array of vertex objects

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
- Missing vertices default to 0.5
- Values are normalized using `nodeMinValue` and `nodeMaxValue`

### `RenderOptions`

Configuration for renderer appearance and behavior.

```typescript
interface RenderOptions {
  width?: number;                              // Canvas width (default: 800)
  height?: number;                             // Canvas height (default: 600)
  nodeMinSize?: number;                        // Min node radius in pixels (default: 4)
  nodeMaxSize?: number;                        // Max node radius in pixels (default: 20)
  nodeMinValue?: number;                       // Min value for normalization (default: 0)
  nodeMaxValue?: number;                       // Max value for normalization (default: 1)
  colorScale?: (value: number) => number;      // Color function: [0,1] → 0xRRGGBB
  edgeColor?: number;                          // Edge color as 0xRRGGBB (default: 0x999999)
  edgeAlpha?: number;                          // Edge opacity [0,1] (default: 0.5)
  edgeWidth?: number;                          // Edge width in pixels (default: 1)
  padding?: number;                            // Canvas margin in pixels (default: 40)
}
```

---

## GraphRenderer API

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
- `graph`: Graph structure with vertices and edges
- `options`: Optional rendering configuration (see [RenderOptions](#renderoptions))

**Returns:** Promise resolving to initialized `GraphRenderer`

**Example:**
```typescript
const renderer = await GraphRenderer.create(
  document.getElementById('app')!,
  graph,
  {
    width: 1000,
    height: 800,
    nodeMinSize: 8,
    nodeMaxSize: 24,
    padding: 60
  }
);
```

### Instance Method: `update()`

Update vertex function values and update node colors/sizes.

```typescript
update(functionValues: FunctionValues): void
```

**Parameters:**
- `functionValues`: Map of vertex index to scalar value

**Notes:**
- Must call `render()` after to display changes
- Values are automatically normalized to [0, 1] using `nodeMinValue` and `nodeMaxValue`
- Missing vertices default to 0.5

**Example:**
```typescript
const values = new Map([[0, 0.2], [1, 0.8], [2, 0.5]]);
renderer.update(values);
renderer.render();
```

### Instance Method: `render()`

Render the current scene to canvas.

```typescript
render(): void
```

**Notes:**
- Call after `update()` to display changes
- Uses Pixi.js internal rendering

**Example:**
```typescript
renderer.update(newValues);
renderer.render();
```

### Instance Method: `resize()`

Resize the canvas and re-layout the graph.

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

Access to Pixi.js application ticker for animation loops.

```typescript
ticker: PIXI.Ticker
```

**Example:**
```typescript
renderer.ticker.add(() => {
  // Called every frame
  renderer.update(newValues);
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

Display a fixed set of values:

```typescript
import { GraphRenderer } from "./render/renderer";
import type { Graph, FunctionValues } from "./types";

async function visualizeStatic() {
  const graph = await fetch('graph.json').then(r => r.json());
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

visualizeStatic();
```

### Example 2: Animated Visualization

Update values continuously:

```typescript
async function visualizeAnimated() {
  const graph = await fetch('graph.json').then(r => r.json());
  const container = document.getElementById('app')!;
  
  const renderer = await GraphRenderer.create(container, graph);
  const values = new Map<number, number>();

  let time = 0;

  renderer.ticker.add(() => {
    time += 0.016; // ~60fps

    // Update values based on time
    for (const vertex of graph.vertices) {
      const wave = Math.sin(vertex.x * 5 - time * 2);
      values.set(vertex.index, wave);
    }

    renderer.update(values);
    renderer.render();
  });
}

visualizeAnimated();
```

### Example 3: Integration with Simulation

Typical usage pattern with a simulation library:

```typescript
import { GraphRenderer } from "./render/renderer";
import { MySimulator } from "./simulator"; // Your simulation library
import type { Graph, FunctionValues } from "./types";

async function runSimulation() {
  // Load graph and create renderer
  const graph = await fetch('graph.json').then(r => r.json());
  const container = document.getElementById('app')!;
  
  const renderer = await GraphRenderer.create(container, graph, {
    nodeMinValue: -1,
    nodeMaxValue: 1,
    nodeMinSize: 6,
    nodeMaxSize: 20
  });

  // Initialize simulator
  const simulator = new MySimulator(graph);

  // Animation loop: simulation → visualization
  renderer.ticker.add(() => {
    // Step the simulation
    simulator.timestep();

    // Get current state from simulator
    const state = simulator.getState(); // Returns FunctionValues

    // Visualize
    renderer.update(state);
    renderer.render();
  });
}

runSimulation();
```

### Example 4: Custom Coloring

Define a custom color scale:

```typescript
const viridis = (value: number): number => {
  // Approximate viridis colormap
  const v = Math.max(0, Math.min(1, value));
  
  let r, g, b;
  if (v < 0.25) {
    r = 0;
    g = Math.round(255 * (v / 0.25));
    b = Math.round(255);
  } else if (v < 0.5) {
    r = 0;
    g = 255;
    b = Math.round(255 * (1 - (v - 0.25) / 0.25));
  } else if (v < 0.75) {
    r = Math.round(255 * ((v - 0.5) / 0.25));
    g = 255;
    b = 0;
  } else {
    r = 255;
    g = Math.round(255 * (1 - (v - 0.75) / 0.25));
    b = 0;
  }
  
  return (r << 16) | (g << 8) | b;
};

const renderer = await GraphRenderer.create(container, graph, {
  colorScale: viridis,
  nodeMinValue: 0,
  nodeMaxValue: 100
});
```

### Example 5: Interactive Node Size Control

Adjust node sizing dynamically:

```typescript
async function interactiveVisualization() {
  const graph = await fetch('graph.json').then(r => r.json());
  const container = document.getElementById('app')!;

  // Create with initial sizes
  const renderer = await GraphRenderer.create(container, graph, {
    nodeMinSize: 5,
    nodeMaxSize: 15
  });

  const values = new Map<number, number>();
  for (let i = 0; i < graph.vertices.length; i++) {
    values.set(i, Math.random());
  }

  // Update on slider input
  const slider = document.getElementById('size-slider') as HTMLInputElement;
  slider?.addEventListener('input', () => {
    const maxSize = parseInt(slider.value);
    
    // Recreate renderer with new size range
    renderer.destroy();
    
    const newRenderer = await GraphRenderer.create(container, graph, {
      nodeMinSize: 3,
      nodeMaxSize: maxSize
    });
    
    newRenderer.update(values);
    newRenderer.render();
  });

  renderer.update(values);
  renderer.render();
}
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
  // Your logic here
  const newValues = computeValues();
  renderer.update(newValues);
  renderer.render();
});
```

### Pattern 3: Simulation Integration

```typescript
const renderer = await GraphRenderer.create(container, graph);
const sim = new Simulator(graph);

renderer.ticker.add(() => {
  sim.step();  // Update simulation state
  const state = sim.getState();
  renderer.update(state);
  renderer.render();
});
```

### Pattern 4: Responsive Canvas

```typescript
const renderer = await GraphRenderer.create(container, graph);

window.addEventListener('resize', () => {
  const width = window.innerWidth - 20;
  const height = window.innerHeight - 20;
  renderer.resize(width, height);
  renderer.render();
});
```

---

## Performance Notes

- **Rendering**: Uses Pixi.js with GPU acceleration
- **Node limit**: Tested up to 1000 nodes; performance depends on browser
- **Update frequency**: Call `render()` only after `update()` for best performance
- **Ticker**: Runs at browser refresh rate (typically 60fps)

---

## Troubleshooting

**Nodes appear too small/large:**
- Adjust `nodeMinSize` and `nodeMaxSize` options

**Colors not visible:**
- Check `nodeMinValue` and `nodeMaxValue` match your data range
- Ensure graph values aren't all at same point (try `Math.random()` for testing)

**Performance degradation:**
- Reduce number of vertices
- Disable transparency on edges (`edgeAlpha: 1`)
- Monitor canvas size

**Canvas is blank:**
- Check browser console for errors
- Verify graph JSON is valid
- Ensure container element exists
