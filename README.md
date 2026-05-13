```markdown
# Graph Diffusion

Visualization and simulation framework for studying dynamics on graph-structured domains. Currently includes a production-ready rendering library; additional simulation components to follow.

## Quick Start

```bash
cd graph-diffusion
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser.

## Project Structure

```
graph-diffusion/
├── src/
│   ├── types.ts                 # Core type definitions
│   ├── main.ts                  # Example entry point
│   ├── style.css                # Canvas styling
│   └── render/
│       └── renderer.ts          # GraphRenderer implementation
├── public/
│   └── graph.json               # Example graph topology
├── RENDERING_API.md             # Complete rendering library documentation
├── package.json
├── tsconfig.json
└── vite.config.ts               # (auto-generated)
```

## Current Status

### ✓ Complete: Rendering Library

A minimal, composable graph visualization API built on Pixi.js. Renders vertices (nodes) and edges with function values encoded as node color and size.

**Key features:**
- Async initialization with Pixi.js v8
- Automatic coordinate scaling and centering
- Customizable color scales, node sizes, and edge styling
- Frame-synced animation via ticker integration
- Default color scale: red → dark purple → blue (sequential)

See RENDERING_API.md for complete API reference, examples, and integration patterns.

## Usage

### Basic Visualization

```typescript
import { GraphRenderer } from "./render/renderer";
import type { Graph, FunctionValues } from "./types";

// Load your graph
const graph: Graph = await fetch('graph.json').then(r => r.json());

// Create renderer
const renderer = await GraphRenderer.create(
  document.getElementById('app')!,
  graph,
  { nodeMinValue: -1, nodeMaxValue: 1 }
);

// Set vertex values
const values: FunctionValues = new Map([
  [0, 0.5],
  [1, -0.3],
  [2, 0.8]
]);

renderer.update(values);
renderer.render();
```

### Animation Loop

```typescript
renderer.ticker.add(() => {
  // Your update logic
  renderer.update(newValues);
  renderer.render();
});
```

### Simulation Integration

```typescript
const simulator = new MySimulator(graph);

renderer.ticker.add(() => {
  simulator.timestep();  // Advance simulation
  const state = simulator.getState();
  renderer.update(state);
  renderer.render();
});
```

## Graph Format

Graphs are specified as JSON with vertices and edges:

```json
{
  "vertices": [
    { "index": 0, "x": 0.0, "y": 0.5, "edges": [1, 2] },
    { "index": 1, "x": 0.5, "y": 0.0, "edges": [0, 2] },
    { "index": 2, "x": 1.0, "y": 0.5, "edges": [0, 1] }
  ]
}
```

Each vertex specifies its index, 2D Euclidean position, and array of connected vertex indices.

## Development

```bash
npm run dev       # Start dev server (Vite)
npm run build     # TypeScript + Vite production build
npm run preview   # Preview production build
```

## Dependencies

- **pixi.js** (8.18.1): GPU-accelerated 2D rendering
- **TypeScript** (6.0.2): Type-safe development
- **Vite** (8.0.12): Build and dev server

## Architecture Notes

The renderer is designed as a clean API for simulation integration:

1. **Graph definition** (JSON) → Independent of rendering
2. **Simulation library** (not included) → Computes vertex values via discrete diff eqs
3. **GraphRenderer** → Visualizes function state via `update(values)` + `render()`

This separation enables simulation libraries to evolve independently from visualization.

## Documentation

- **RENDERING_API.md**: Full API reference, 5+ examples, troubleshooting
- **src/types.ts**: Type definitions with JSDoc comments
- **src/render/renderer.ts**: Implementation with inline docs

## License

TBD
