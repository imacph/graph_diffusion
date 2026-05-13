# DiffusionSolver - API Documentation

An implicit, second-order time-stepping solver for the heat (diffusion) equation on weighted graphs. Computes the evolution of a scalar function $u$ on graph vertices according to:

$$\frac{du}{dt} = -D \cdot L \cdot u$$

where $D$ is the diffusion rate and $L$ is the weighted graph Laplacian.

## Table of Contents
- [Quick Start](#quick-start)
- [Data Types](#data-types)
  - [DiffusionParams](#diffusionparams)
  - [solutionState](#solutionstate)
- [DiffusionSolver API](#diffusionsolver-api)
- [Numerical Method](#numerical-method)
- [Graph JSON Initial Conditions](#graph-json-initial-conditions)
- [Examples](#examples)

---

## Quick Start

```typescript
import { DiffusionSolver } from "./simulation/diffusionSolver";
import type { Graph, FunctionValues, DiffusionParams } from "./types";

// Build or load a graph (vertices + edges)
const graph: Graph = /* ... */;

// Set initial conditions
const initialValues: FunctionValues = new Map([
  [0, 10.0],
  [1, 0.0],
  [2, 0.0],
]);

// Create solver
const solver = new DiffusionSolver(graph, {
  diffusionRate: 0.5,
  timeStep: 0.01,
  iterations: 1000,
  initialValues,
});

// Step and read state
solver.timestep();
const state = solver.getState();
console.log(state.time);           // 0.01
console.log(state.currentValues);  // Map<vertexIndex, value>
console.log(state.edgeFluxValues); // Map<edgeIndex, signedFlux>
```

---

## Data Types

### `DiffusionParams`

Configuration passed to the `DiffusionSolver` constructor.

```typescript
interface DiffusionParams {
  diffusionRate: number;      // Diffusion coefficient D (≥ 0)
  timeStep: number;           // dt for each call to timestep()
  iterations: number;         // Informational; not used internally by the solver
  initialValues: FunctionValues; // Initial condition u(t=0)
}
```

**Properties:**

| Property | Type | Description |
|---|---|---|
| `diffusionRate` | `number` | Diffusion coefficient $D$. Larger values spread the function faster. |
| `timeStep` | `number` | Time increment $h$ applied per `timestep()` call. |
| `iterations` | `number` | Informational field. Not consumed by the solver internally. |
| `initialValues` | `FunctionValues` | Scalar values at each vertex at $t = 0$. |

---

### `solutionState`

The solver's complete state, returned by `getState()`.

```typescript
interface solutionState {
  currentValues: FunctionValues;        // u at current time step
  previousValues?: FunctionValues;      // u at previous time step (used by BDF2)
  edgeFluxValues: Map<number, number>;  // Signed flux on each edge
  time: number;                         // Accumulated simulation time
  timeStepCount: number;                // Number of timestep() calls completed
}
```

**Properties:**

| Property | Type | Description |
|---|---|---|
| `currentValues` | `FunctionValues` | Current vertex values $u_n$. Keys are vertex indices. |
| `previousValues` | `FunctionValues \| undefined` | Vertex values from the preceding step $u_{n-1}$. Available after the first step. |
| `edgeFluxValues` | `Map<number, number>` | Signed flux $q_{ij}$ on each edge, keyed by edge index. |
| `time` | `number` | Total elapsed simulation time: `timeStepCount * timeStep`. |
| `timeStepCount` | `number` | Total number of `timestep()` calls completed since last `reset()`. |

#### Edge Flux Sign Convention

Flux on edge $(i, j)$ (where $i = $ `edge.v1`, $j = $ `edge.v2`) is defined as:

$$q_{ij} = D \cdot \frac{u_i - u_j}{\ell_{ij}}$$

- **Positive flux** ($q_{ij} > 0$): flow from vertex $v_1$ toward vertex $v_2$
- **Negative flux** ($q_{ij} < 0$): flow from vertex $v_2$ toward vertex $v_1$

---

## DiffusionSolver API

### Constructor

```typescript
new DiffusionSolver(graph: Graph, params: DiffusionParams)
```

Initializes the solver and precomputes the BDF2 LHS matrix.

**Parameters:**
- `graph`: A `Graph` with populated `vertices` and `edges` arrays (including `edge.length` values).
- `params`: Solver configuration (see [DiffusionParams](#diffusionparams)).

**Notes:**
- The initial state is set from `params.initialValues`. Any vertex not present in the map defaults to `0`.
- The BDF2 LHS matrix $(I + \frac{2}{3} h D L)$ is factored once during construction.

---

### `timestep()`

Advance the simulation by one time step $h$.

```typescript
timestep(): void
```

**Behavior:**
- On the first call (`timeStepCount === 0`): uses **implicit Euler** to bootstrap the BDF2 scheme.
- On subsequent calls: uses **BDF2** for second-order accuracy.
- Updates `currentValues`, `previousValues`, `edgeFluxValues`, `time`, and `timeStepCount`.

**Example:**
```typescript
solver.timestep();
const { currentValues, time } = solver.getState();
```

---

### `reset()`

Reset the solver to the initial conditions supplied at construction.

```typescript
reset(): void
```

Restores `currentValues`, `previousValues`, `edgeFluxValues`, `time`, and `timeStepCount` to their $t = 0$ state. The precomputed LHS matrix is retained.

**Example:**
```typescript
solver.reset();
const state = solver.getState();
console.log(state.time);          // 0
console.log(state.timeStepCount); // 0
```

---

### `getState()`

Return the current solution state (by reference).

```typescript
getState(): solutionState
```

Returns the live `solutionState` object. The returned reference stays valid across calls to `timestep()` and `reset()`, but its contents will be mutated.

**Example:**
```typescript
const state = solver.getState();
console.log(`t=${state.time.toFixed(3)}, step=${state.timeStepCount}`);
```

---

## Numerical Method

### Governing Equation

The solver integrates the semi-discrete diffusion equation on a weighted graph:

$$\frac{du}{dt} = -D \cdot L \cdot u, \quad u \in \mathbb{R}^n$$

where $n$ is the number of vertices and $L$ is the **weighted graph Laplacian**.

### Weighted Graph Laplacian

The Laplacian is constructed via the oriented incidence matrix $B \in \mathbb{R}^{n \times m}$ and a diagonal edge weight matrix $W \in \mathbb{R}^{m \times m}$:

$$B_{v,e} = \begin{cases} +1 & \text{if } v = e.v_1 \\ -1 & \text{if } v = e.v_2 \\ 0 & \text{otherwise} \end{cases}, \qquad W_{e,e} = \frac{1}{\ell_e}$$

$$L = B W B^\top$$

This produces a positive semi-definite matrix. Edge weights $1/\ell_e$ encode the inverse of the Euclidean length between the two vertices, so longer edges conduct less flux.

### Time Discretization

#### Step 0 — Implicit Euler (bootstrap)

The first step uses first-order implicit Euler to start the two-step BDF2 recurrence:

$$\left(I + h D L\right) u_1 = u_0$$

#### Steps 1+ — BDF2

All subsequent steps use the second-order Backward Differentiation Formula:

$$\left(I + \tfrac{2}{3} h D L\right) u_{n+1} = \tfrac{4}{3} u_n - \tfrac{1}{3} u_{n-1}$$

The BDF2 LHS matrix $\left(I + \frac{2}{3} h D L\right)$ is **precomputed once** during construction and reused for every BDF2 step. Each step solves the linear system via LU decomposition (`math.lusolve`).

### Stability

BDF2 is A-stable for this problem: it remains stable for any time step $h > 0$ and any diffusion rate $D \geq 0$. In practice, choose $h$ small enough to resolve the dynamics of interest (a good starting point is $h \leq 0.1 / (D \cdot \lambda_{\max}(L))$, where $\lambda_{\max}$ is the largest eigenvalue of $L$).

---

## Graph JSON Initial Conditions

The `loadGraph()` function in `main.ts` supports three formats for specifying initial conditions in the JSON file. Priority order: per-vertex `initialValue` fields are read first, then a top-level `initialValues` key (which overwrites per-vertex values for any overlapping indices).

### Format 1: Per-vertex `initialValue`

```json
{
  "vertices": [
    { "index": 0, "x": 0.0, "y": 0.5, "edges": [1, 2], "initialValue": 10.0 },
    { "index": 1, "x": 0.5, "y": 0.0, "edges": [0, 2], "initialValue": 0.0 },
    { "index": 2, "x": 1.0, "y": 0.5, "edges": [0, 1], "initialValue": 0.0 }
  ]
}
```

### Format 2: Top-level `initialValues` object (index → value)

```json
{
  "vertices": [ /* ... */ ],
  "initialValues": {
    "0": 10.0,
    "1": 0.0,
    "2": 0.0
  }
}
```

### Format 3: Top-level `initialValues` array (positional)

```json
{
  "vertices": [ /* ... */ ],
  "initialValues": [10.0, 0.0, 0.0]
}
```

Position $i$ in the array maps to vertex index $i$.

**Fallback:** Any vertex without a specified initial value is assigned a random value in $[0, 1)$.

---

## Examples

### Example 1: Single Point Source

Place all mass at one vertex and let it diffuse:

```typescript
const n = graph.vertices.length;
const initialValues: FunctionValues = new Map();
for (let i = 0; i < n; i++) {
  initialValues.set(i, 0.0);
}
initialValues.set(0, 1.0); // Point source at vertex 0

const solver = new DiffusionSolver(graph, {
  diffusionRate: 1.0,
  timeStep: 0.005,
  iterations: 500,
  initialValues,
});
```

### Example 2: Run to Steady State

Diffusion converges to a uniform distribution. Run until the maximum change per step falls below a threshold:

```typescript
const tol = 1e-6;
let prev = new Map(solver.getState().currentValues);

while (true) {
  solver.timestep();
  const curr = solver.getState().currentValues;

  let maxChange = 0;
  for (const [idx, val] of curr) {
    maxChange = Math.max(maxChange, Math.abs(val - (prev.get(idx) ?? 0)));
  }
  if (maxChange < tol) break;
  prev = new Map(curr);
}

console.log(`Converged at t=${solver.getState().time.toFixed(4)}`);
```

### Example 3: Renderer Integration

The solver integrates directly with `GraphRenderer` via the Pixi.js ticker:

```typescript
import { GraphRenderer } from "./render/renderer";
import { DiffusionSolver } from "./simulation/diffusionSolver";

const renderer = await GraphRenderer.create(container, graph, {
  nodeMinValue: 0,
  nodeMaxValue: 10,
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
  // Pass both vertex values and edge fluxes to enable arrow overlay
  renderer.update(state.currentValues, state.edgeFluxValues);
  renderer.render();
});
```

### Example 4: Reset on User Input

```typescript
document.getElementById('reset-btn')!.addEventListener('click', () => {
  solver.reset();
  const state = solver.getState();
  renderer.update(state.currentValues, state.edgeFluxValues);
  renderer.render();
});
```
