# Lessons (session corrections)

## Browser MCP when the user asks for in-app verification

- If the user asks to **test in the browser**, **@Browser**, or to reproduce something at a given zoom (e.g. ~10%), **use the Cursor IDE Browser MCP** (`cursor-ide-browser`): read tool descriptors under the project `mcps` folder, then run a short loop — `browser_tabs` (list) → optional `browser_navigate` → `browser_lock` before interactions → `browser_snapshot` / `browser_click` / `browser_take_screenshot` → `browser_unlock` when finished.
- **Do not** substitute-only code reasoning when they explicitly requested live browser verification; pair explanation with MCP steps and report what the snapshot/screenshot showed (e.g. zoom %, whether controls/edges behaved).
- If interactions fail with **intercepted** or **script** errors after `browser_lock`, try **`browser_unlock`** and retry; lock can block hovers/clicks on the canvas.

_Date: 2026-03-27 — correction after user asked for browser MCP testing and EdgeLabelRenderer/low-zoom edge UI work._

## React Flow handle bounds vs viewport (edge alignment)

- Edge endpoints come from cached **`handleBounds`**; RF recomputes them in `updateNodeDimensions` using the **current viewport zoom**. Pan/zoom does not resize `.react-flow__node`, so **ResizeObserver** often does not run — subscribe to a **primitive derived from `transform`** (e.g. `` `${x},${y},${z}` ``), **not** the `transform` tuple with `shallow`: the store may mutate x/y/z **in place**, so the array reference stays the same and Zustand skips updates. Batch **`updateNodeInternals(all ids)`** (see `useViewportHandleBoundsSync`).
- **Animated** `fitView` / `zoomIn` / `setViewport({ duration })` need the same refresh after the transform settles; transform subscription covers that without relying only on `onMoveEnd`.
- **Group nodes**: prefer **pixel** `top` for handles from the node’s `style.height` when `%` layout can diverge from the measured RF box (floating label + subflows).
- If misalignment remains with v11 + deep groups, evaluate **@xyflow/react** (v12) migration notes for subflow/handle behavior before adding more workarounds.

_Date: 2026-03-27 — plan implementation for persistent handle/edge mismatch._

## Store ↔ React Flow: never substitute raw `storeNodes` if RF has fresher geometry

- **`useNodesState(storeNodes)` + `useEffect` that does `setNodes(storeNodes)`** will revert React Flow’s **measured** `width`/`height` to whatever Zustand last saved whenever **any** node update hits the store. Content-driven growth (ResizeObserver) updates RF locally but often **does not** write back unless you handle **`dimensions`** changes that lack NodeResizer’s `resizing` flag.
- **Fix pattern:** On every store-driven sync, **`mergeStoreNodesWithFlowGeometry(storeNodes, getNodes())`** so live `position`, `width`, `height`, and `style` win. Persist **`dimensions`** to the store for organic resizes (and resize end); optionally **skip** `setNodesSilently` on every `resizing: true` frame to limit churn.

_Date: 2026-03-27 — after persistent handle/edge offset with growing nodes._

## React Flow handles: avoid CSS `transform: scale` on `.react-flow__handle`

- RF caches **handle bounds** from the handle element’s geometry; scaling the **root** handle makes the **painted** port disagree with **math** used for the connection line and edges. Prefer hover feedback via **box-shadow** or scale a **child** (e.g. inner glyph) only.

_Date: 2026-03-27 — edge origin mismatch persisted after store/viewport fixes._

## Never call Zustand `set` inside React `setEdges` / `setNodes` updaters

- **`useEdgesState` + `setEdges((eds) => { connectEdgeWithHistory(...); return next; })`** triggers `set({ edges })` on the store **during** React’s state update → “Cannot update CanvasInner while rendering CanvasInner” / **maximum update depth**. Compute `next` with **`getEdges()`**, **`setEdges(next)`**, then **`queueMicrotask(() => connectEdgeWithHistory(...))`**. Same pattern for **`onEdgesChangeTracked`** vs `applyEdgeRemoval` / `setEdgesSilently`.

_Date: 2026-03-27 — after connect-start debug + infinite loop in console._

## `setNodesSilently` / selection sync must not run full dataflow

- **`setNodesSilently` / `setEdgesSilently`** are used to mirror React Flow into Zustand (selection flags, resize commits). Calling **`applyReactiveDataflow([], true)`** there re-runs propagation for **every node** on **every** selection tick — React Flow can emit many updates while connecting or dragging, which **freezes the UI** and floods devtools if debug logs run before the “no actual change” check.
- Keep full recompute for **hydrate**, **saved row apply**, **edge removal**, **delete node**, etc.; wire incremental sources from **`connectEdgeWithHistory`** / **`updateNodeData`** as before.

_Date: 2026-03-27 — fix after console spam + canvas freeze on connect._

## `onConnectStart`: never `updateNodeInternals` for the whole graph

- **`refreshAllHandleBounds()`** → `updateNodeInternals(allIds)` scales with **node count** and runs in the **handle pointer** critical path → poor INP (multi-second **processing duration** on large canvases).
- Prefer **`updateNodeInternals([sourceId, …parentIds])`** (walk `parentId` chain for nested groups) plus at most one **`requestAnimationFrame`** retry — keep **viewport-wide** refresh for **pan/zoom** (`useViewportHandleBoundsSync`, `onMoveEnd`) only.
- Avoid **`flushSync`** for connection UI flags; **`startTransition`** is enough for `vf-connecting-edge` toggling.

_Date: 2026-03-27 — after Chrome Performance showed ~2s handle pointer processing._

## Viewport handle sync: zoom subscription, not full transform

- Subscribing to **`transform` x/y/z** and calling **`updateNodeInternals(all nodes)`** on every change runs that work **on every pan frame** → poor INP / presentation delay on large graphs.
- Prefer **zoom (`transform[2]`) only** for continuous sync; run a **full refresh on `onMoveEnd`** (and connect / hydrate paths) so pan still ends in a consistent state.

_Date: 2026-03-27 — pan vs hand tool performance._
