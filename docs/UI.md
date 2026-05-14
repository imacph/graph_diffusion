# Interactive Application UI

Reference for the interactive graph diffusion application. The application renders in two switchable modes — **Editor** and **Simulation** — with a shared camera system and a shared view controls panel available in both.

## Table of Contents
- [Layout Overview](#layout-overview)
- [Mode Toggle](#mode-toggle)
- [Camera Navigation](#camera-navigation)
- [View Controls Panel](#view-controls-panel)
- [Editor Mode](#editor-mode)
  - [Toolbar](#toolbar)
  - [Move Tool](#move-tool)
  - [Add Node Tool](#add-node-tool)
  - [Add Edge Tool](#add-edge-tool)
  - [Delete Tool](#delete-tool)
  - [Node Tooltip](#node-tooltip)
- [Simulation Mode](#simulation-mode)
  - [Sim Controls Panel](#sim-controls-panel)
- [Dark Mode](#dark-mode)
- [Architecture Notes](#architecture-notes)

---

## Layout Overview

The canvas fills the full browser window. All UI panels are HTML elements positioned as absolute overlays inside `.canvas-shell`, which itself fills the viewport via `position: absolute; inset: 0`.

```
┌──────────────────────────────────────────────────────┐
│  [Mode Toggle]           (top center)                │
│  [Toolbar]               (top left, editor mode)     │
│  [Status Banner]         (top left, below toolbar)   │
│                                                      │
│                   canvas                             │
│                                                      │
│  [View Controls]         (bottom left, both modes)   │
│                          [Sim Controls] (top right)  │
└──────────────────────────────────────────────────────┘
```

Panels are created and destroyed as part of mode switching. The view controls panel persists across mode switches (its state is read from the renderer at mount time), but it is technically remounted each time because the `.canvas-shell` element is replaced.

---

## Mode Toggle

A button centered at the top of the screen switches between modes.

| State | Button Label |
|-------|-------------|
| Editor mode active | **Run Simulation** |
| Simulation mode active | **Edit Graph** |

Clicking the button tears down the current mode's UI (removing all event listeners and DOM panels), then mounts the other mode's UI.

---

## Camera Navigation

The camera is available in both modes. It controls the zoom level and pan offset applied to the entire graph.

| Input | Action |
|-------|--------|
| Mouse wheel | Zoom toward cursor position |
| Middle-click drag | Pan |
| Right-click drag | Pan |
| Left-click drag | Pan (simulation mode only) |

Zoom is multiplicative (each wheel tick multiplies zoom by ≈ 0.9 or 1.1). The zoom pivot is the cursor's current world position, so the point under the cursor stays fixed.

---

## View Controls Panel

**Location:** lower-left corner, both modes.

| Control | Description |
|---------|-------------|
| **Show Labels** checkbox | Toggles vertex/edge text label overlay |
| **Dark Mode** checkbox | Applies `body.dark-mode` CSS class and calls `renderer.setDarkMode()` |
| **Show Grid** checkbox | Toggles the spatial grid overlay |
| **Grid Size** slider | Sets grid cell size in world-coordinate units |
| **Value Min** / **Value Max** inputs | Sets the range used to normalize values for color and size mapping |

### Grid Size Slider

The slider range is `[worldSpan / 20, worldSpan / 2]` where `worldSpan = max(xRange, yRange)` of the graph's bounding box. The default is `worldSpan / 10`. Step size is `worldSpan / 100`.

### Value Range Inputs

Both inputs accept any numeric value. On change, `renderer.setValueRange(min, max)` is called immediately. Min defaults to `options.nodeMinValue`, max to `options.nodeMaxValue` (set at construction time in `main.ts`; currently `0` and `1`).

---

## Editor Mode

Editor mode lets you construct or modify the graph before running a simulation.

### Toolbar

Located in the upper-left. Contains five tools:

| Button | Tool |
|--------|------|
| **Move** | Select and drag nodes; click to open tooltip |
| **Add Node** | Click canvas to place a new node |
| **Add Edge** | Click source node, then target node |
| **Delete** | Click node to remove it (and all its edges); click near an edge to remove the edge |
| **Clear Graph** | Removes all nodes and edges |

The active tool is highlighted. Switching tools dismisses any in-progress operations (e.g., a pending edge source selection).

### Move Tool

- **Click a node** (with no movement): Opens the [Node Tooltip](#node-tooltip). If the tooltip is already open for that node, clicking it again closes the tooltip.
- **Drag a node**: Moves the node to the pointer's world position. The tooltip is hidden while dragging. On release:
  - If the pointer moved (dragged), the tooltip remains hidden.
  - If the pointer did not move (clean click), the tooltip is shown.
- **Click canvas background**: Closes any open tooltip.

Movement threshold: any `pointermove` event fired while the button is held counts as a drag; there is no pixel-distance threshold.

### Add Node Tool

- Click anywhere on the canvas background to place a node at that world position.
- The node is assigned the next available index.
- The node starts with no edges and an initial value of `0`.

### Add Edge Tool

- **First click**: Select a source node. A status banner appears below the toolbar: `"Select target node (right-click or Escape to cancel)"`.
- **Second click (on a different node)**: Creates an edge between source and target. The edge is bidirectional (both `vertex.edges` arrays are updated). Edge length is the Euclidean distance between the two nodes.
- **Click same node**: Ignored (self-loops not permitted).
- **Right-click** or **Escape**: Cancels the pending edge operation and clears the status banner.

### Delete Tool

- **Click a node**: Removes the node and all edges incident to it. Reindexes remaining vertices so indices remain contiguous.
- **Click near an edge midpoint**: Removes that edge (hit radius ≈ 12 CSS pixels from the edge midpoint).

### Node Tooltip

A floating HTML panel that appears near a selected node in Move mode.

**Contents:**
- Node index (heading)
- **Initial Value** number input: sets the node's starting value for the next simulation reset
- **Add Connection** button: switches to Add Edge tool with this node pre-selected as the source

**Behavior:**
- Positioned 12px to the right and 12px below the node's screen position.
- Clamped to remain within the canvas bounds.
- Dismissed by:
  - Zooming or panning (camera change)
  - Clicking the same node again
  - Clicking the canvas background
  - Switching tools

---

## Simulation Mode

Simulation mode runs the diffusion solver in real time on the current graph.

### Sim Controls Panel

**Location:** upper-right corner.

| Control | Description |
|---------|-------------|
| **Play / Pause** button | Starts or pauses the simulation ticker |
| **Reset** button | Resets solver to initial conditions and re-renders at `t = 0` |
| Status text | Shows current simulation state: `Playing` / `Paused` / `Complete` |
| **t =** display | Current simulation time |
| **Step** display | Number of solver steps taken |

The ticker calls `solver.timestep()` each frame, then passes `currentValues` and `edgeFluxValues` to `renderer.update()` and `renderer.render()`.

**Solver parameters** (set at startup in `main.ts`):

| Parameter | Default |
|-----------|---------|
| `diffusionRate` | `0.5` |
| `timeStep` | `0.01` |
| `iterations` | `1000` |

See [SOLVER.md](SOLVER.md) for parameter documentation.

---

## Dark Mode

Dark mode is toggled via the **Dark Mode** checkbox in the view controls panel.

**Effect:**
- Adds/removes the `body.dark-mode` CSS class, which reskins all panels, buttons, inputs, and tooltips via CSS.
- Calls `renderer.setDarkMode(enabled)`, which switches the canvas color scheme (background, edges, text labels, grid, node colors).

**Persistence:** The `body.dark-mode` class is not saved to `localStorage`; it resets to light mode on page reload. However, because mode switching remounts panels that read initial state from the renderer and `document.body`, the dark mode setting persists across Editor ↔ Simulation mode switches within the same session.

---

## Architecture Notes

### File Map

| File | Responsibility |
|------|----------------|
| `src/ui/modeToggle.ts` | Creates the mode toggle button; manages mount/teardown cycle |
| `src/ui/graphEditor.ts` | Editor mode UI: toolbar, tooltip, pointer event routing |
| `src/ui/simControls.ts` | Simulation mode UI: play/pause/reset, ticker management |
| `src/ui/viewControls.ts` | Shared view controls panel factory (`createViewControlsPanel`) |
| `src/ui/graphLoader.ts` | JSON graph loading and edge construction from adjacency lists |

### Mode Switching

`modeToggle.ts` calls `teardown()` on the outgoing mode controller, then calls the incoming mode's mount function. Each mount function:
1. Creates its DOM panels inside the provided `canvasShell` element.
2. Registers pointer event listeners on the canvas.
3. Calls `createViewControlsPanel(canvasShell, renderer)` for the shared panel.
4. Returns a `teardown()` function that removes panels, clears listeners, and calls `viewControls.teardown()`.

### Renderer Callbacks

The editor mounts three callbacks on the renderer that it clears in teardown:

```typescript
renderer.onNodePointerDown   = (idx, sx, sy) => { /* handle node click */ };
renderer.onCanvasPointerDown = (wx, wy)       => { /* handle canvas click */ };
renderer.onCameraChange      = ()             => { hideTooltip(); };
```

All three are set to `null` in the editor's `teardown()`.
