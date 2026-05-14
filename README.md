
# Graph Diffusion

Visualization and simulation framework for studying diffusion dynamics on graph-structured domains. Includes a GPU-accelerated rendering library and a second-order implicit diffusion solver, wired together in an interactive application with play/pause/reset controls and real-time edge flux visualization.

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
│   ├── types.ts                         # Core type definitions
│   ├── main.ts                          # Entry point: loads graph, wires renderer + solver
│   ├── style.css                        # Application styles
│   ├── render/
│   │   └── renderer.ts                  # GraphRenderer implementation
│   └── simulation/
│       └── diffusionSolver.ts           # DiffusionSolver implementation
├── public/
│   └── graph.json                       # Example graph with initial conditions
├── docs/
│   ├── RENDERING_LIBRARY.md             # Renderer API reference
│   ├── SOLVER.md                        # Solver API reference
│   └── COMMIT_MSG_TEMPLATES.md          # Commit message conventions
├── package.json
└── tsconfig.json
```

## Current Status

### ✓ Complete: Rendering Library

A composable graph visualization API built on Pixi.js v8. Renders vertices and edges with function values encoded as node color and size, and overlays directed flux arrows and per-vertex flow summaries.

**Key features:**
- Async factory initialization with Pixi.js v8
- Automatic coordinate scaling and centering
- Customizable color scales, node sizes, and edge styling
- Edge flux arrows scaled and oriented by signed flux magnitude
- Per-vertex text labels: current value, inflow, outflow, net flow
- Per-edge text labels: flux magnitude
- Toggleable text label overlay (`setTextLabelsVisible`)
- Frame-synced animation via Pixi.js ticker

See [docs/RENDERING_LIBRARY.md](docs/RENDERING_LIBRARY.md) for the full API reference.

### ✓ Complete: Diffusion Solver

A numerically stable implicit solver for the heat equation on weighted graphs: $\frac{du}{dt} = -D \cdot L \cdot u$, where $L$ is the weighted graph Laplacian.

**Key features:**
- Weighted graph Laplacian built from edge lengths: $L = B W B^\top$
- BDF2 (2nd-order Backward Differentiation Formula) time stepping
- Implicit Euler bootstrap on the first step
- Precomputed LHS matrix for efficient per-step solves
- Per-edge signed flux output: $q_{ij} = D(u_i - u_j) / \ell_{ij}$
- `reset()` to return to initial conditions

See [docs/SOLVER.md](docs/SOLVER.md) for the full API reference.

### ✓ Complete: Interactive Application

`main.ts` wires the renderer and solver into a runnable application:

- Loads a graph from `public/graph.json` (vertex adjacency list format; edges and lengths are computed automatically)
- Parses initial conditions from the JSON (per-vertex `initialValue`, top-level `initialValues` object/array, or random fallback)
- Play/Pause/Reset controls with live time and step-count display
- Toggleable text label overlay

## Graph JSON Format

Graphs are specified as vertex adjacency lists. Edge objects and lengths are computed automatically at load time; you do not need to provide them.

```json
{
  "vertices": [
    { "index": 0, "x": 0.0, "y": 0.5, "edges": [1, 2], "initialValue": 1.0 },
    { "index": 1, "x": 0.5, "y": 0.0, "edges": [0, 2], "initialValue": 0.0 },
    { "index": 2, "x": 1.0, "y": 0.5, "edges": [0, 1], "initialValue": 0.0 }
  ]
}
```

Each vertex specifies its unique index, 2D Euclidean position, and the indices of its neighbors. Adjacency must be symmetric. Initial conditions can also be supplied via a top-level `initialValues` key (see [docs/SOLVER.md](docs/SOLVER.md#graph-json-initial-conditions)).

## Usage

### Basic Visualization

```typescript
import { GraphRenderer } from "./render/renderer";
import type { Graph, FunctionValues } from "./types";

// graph must have both vertices and edges populated
const renderer = await GraphRenderer.create(
  document.getElementById('app')!,
  graph,
  { nodeMinValue: 0, nodeMaxValue: 1 }
);

const values: FunctionValues = new Map([
  [0, 1.0],
  [1, 0.0],
  [2, 0.5]
]);

renderer.update(values);
renderer.render();
```

### Simulation Integration

```typescript
import { DiffusionSolver } from "./simulation/diffusionSolver";

const solver = new DiffusionSolver(graph, {
  diffusionRate: 0.5,
  timeStep: 0.01,
  iterations: 1000,
  initialValues: initialConditions,
});

renderer.ticker.add(() => {
  solver.timestep();
  const state = solver.getState();
  renderer.update(state.currentValues, state.edgeFluxValues);
  renderer.render();
});
```

## Development

```bash
npm run dev       # Start dev server (Vite)
npm run build     # TypeScript + Vite production build
npm run preview   # Preview production build
```

## Dependencies

- **pixi.js** (^8.18.1): GPU-accelerated 2D rendering
- **mathjs** (^15.2.0): Matrix operations for the implicit solver (LU decomposition)
- **TypeScript** (~6.0.2): Type-safe development
- **Vite** (^8.0.12): Build tooling and dev server

## Architecture

```
graph.json ──► loadGraph() ──► Graph (vertices + edges)
                                    │
                          ┌─────────┴─────────┐
                          ▼                   ▼
                  DiffusionSolver       GraphRenderer
                  (timestep, reset)     (update, render)
                          │                   ▲
                          └── solutionState ──┘
                              (currentValues,
                               edgeFluxValues)
```

The solver and renderer are independent components connected only through `FunctionValues` and `Map<number, number>` (edge fluxes). Either component can be used standalone or replaced.

## Documentation

- [docs/RENDERING_LIBRARY.md](docs/RENDERING_LIBRARY.md): Full renderer API reference, examples, troubleshooting
- [docs/SOLVER.md](docs/SOLVER.md): Full solver API reference, numerical method, examples
- `src/types.ts`: Shared type definitions with JSDoc comments

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.


