# Canvas performance (connect / selection)

## Done

- [x] Remove full `applyReactiveDataflow([], true)` from `setNodesSilently` / `setEdgesSilently` (selection sync was re-running graph dataflow on every RF selection tick).
- [x] Log Scout image-generator prompt only when a node’s data actually changes (not when patch equals current).

## Review

- **Cause:** Silent node/edge sync from React Flow triggered full-graph reactive dataflow on tight selection loops → main-thread stall + misleading `[Scout] Dataflow` spam.
- **Change:** `src/stores/workflowStore.ts` — silent setters now only `set`; experimental debug moved inside the `hasAnyChange` branch.
- **Verify:** `pnpm vitest run src/test/nodeDataflow.test.ts` (12/12 passed).

- **Handle / connection line offset:** `useViewportHandleBoundsSync` selected `transform` with `shallow`; RF may mutate the tuple in place → Zustand skipped updates → stale handle bounds after pan/zoom. Fixed by subscribing to a string `transformKey`. `onConnectStart` now calls `refreshAllHandleBounds` + double-`rAF` follow-up; `onMoveEnd` refreshes after viewport commits.
- **Files:** `src/hooks/useViewportHandleBoundsSync.ts`, `src/pages/Index.tsx`.
- **Verify:** `pnpm exec tsc --noEmit`; manually pan/zoom then drag a new edge from a handle — preview should start on the handle.

- **Stale node box vs DOM (handles/edges offset):** The `storeNodes → setNodes` effect sometimes substituted raw `storeNodes`, wiping RF auto-measured `width`/`height` after content growth; only NodeResizer end synced dimensions to the store. **Fix:** always `mergeStoreNodesWithFlowGeometry(storeNodes, current)` on store updates; persist dimensions to Zustand for organic `dimensions` changes (skip only `resizing: true` ticks). **File:** `src/pages/Index.tsx`.
- **Verify:** `pnpm exec tsc --noEmit`; grow a ListNode, trigger a store-only update, pull a connection — line should stay on the handle.

- **Handle scale vs RF bounds:** Removed `transform: scale` from `.react-flow__handle` / port roots; moved hover scale to `.port-type-glyph-inner` only. **`onConnectStart`:** `refreshAllHandleBounds` + rAF repeat; **`onMove`:** rAF-coalesced full refresh during pan/zoom. **Files:** `src/index.css`, `src/pages/Index.tsx`.

- **Edge mismatch console instrumentation (dev):** `src/lib/canvasEdgeDebug.ts` — URL `?canvasEdgeDebug=1` (connect-start groups, throttled move-end, 2s global + `window.__VISION_FORGE_EDGE_DEBUG__`); optional `?debugNode=<id>` for 2s per-node audit (Zustand vs RF internals vs DOM handles). Wired in `Index.tsx`.

- **Connect infinite loop:** `connectEdgeWithHistory` ran inside `setEdges` updater → Zustand `set` during React update. **Fix:** `getEdges()` → `addEdge` → `setEdges(next)` → `queueMicrotask(() => connectEdgeWithHistory(...))`; same for `onEdgesChangeTracked`. **File:** `src/pages/Index.tsx`.

- **Connect-start INP:** `onConnectStart` was calling `refreshAllHandleBounds()` (all nodes) twice per interaction + `flushSync` → multi-second processing on large graphs. **Change:** target only the source node + parent id chain with `updateNodeInternals(chain)`; one follow-up `rAF` for the same chain; `startTransition` for `isConnectingFromHandle`. Pan/zoom still uses `refreshAllHandleBounds` via `useViewportHandleBoundsSync` + `onMoveEnd`.

- **Pan INP:** `useViewportHandleBoundsSync` subscribed to full `x,y,z` → full `updateNodeInternals` on every pan frame. **Change:** subscribe to **zoom only**; rely on `onMoveEnd` → `refreshAllHandleBounds` after pan completes (`src/hooks/useViewportHandleBoundsSync.ts`).

- **DOM / render cost (React mapping vs Vue plan):** Primary hot paths are **React Flow** (`src/pages/Index.tsx` — many nodes/edges), **list-heavy custom nodes** (`ListNode`, `AngleVariationsListNode`), and **AddNodePanel** (~30 static rows). Use **React DevTools Profiler** and **Lighthouse** before broad `memo`/virtualization. Implemented: Zustand `useShallow` for stable action bundles, `useMemo` for derived list slices, optional **row virtualizer** for large angle grids (`@tanstack/react-virtual`), **Vite** `rollup-plugin-visualizer` via `pnpm build:analyze` (writes `dist/stats.html`).
