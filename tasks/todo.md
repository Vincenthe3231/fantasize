# Canvas performance (connect / selection)

## Done

- [x] Dev-only React Profiler (`DevReactProfiler`) — slow commits (≥16ms) log as `[VF:react-profiler]`; disable with `localStorage vf.reactProfiler=0`.
- [x] Code-splitting: lazy `Index` + `NotFound` routes; lazy canvas node/edge/connection-line modules (`canvasFlowLazy.ts`); settings + selection overlay load on demand; Pixi hybrid via `PixiHybridBackgroundGate`.
- [x] `spacePayloadOptimizer`: static import `scoutMediaUrlNormalizer` (removes Rollup mixed static/dynamic warning).
- [x] Vite `manualChunks`: `react-vendor`, `reactflow-vendor`, `supabase-vendor`.
- [x] Remove full `applyReactiveDataflow([], true)` from `setNodesSilently` / `setEdgesSilently` (selection sync was re-running graph dataflow on every RF selection tick).
- [x] Log Scout image-generator prompt only when a node’s data actually changes (not when patch equals current).
- [x] Settings Shortcuts tab: shared `CANVAS_SHORTCUT_SECTIONS` + `isCanvasShortcutTargetBlocked` / `nextCanvasPattern` in `src/lib/canvasKeymap.ts`; zoom +/- and `G` cycle background in `Index.tsx`; Toolbar keydown uses same focus guard as Index.
- [x] INP / presentation delay: no per-pan `refreshAllHandleBounds` or `setLastViewport` (`Index.tsx`); route profiler removed from `App.tsx`; zoom epsilon + viewport-only parity debounce (`useViewportHandleBoundsSync`, `useSpaceLocalPersistence`); `Toolbar` memoized.
- [x] Phase 5 — Edge / overlay LOD: `CanvasEdgeLodContext` + simplified `CustomEdge` during viewport/node-drag gestures (and optional dense-graph mode via `vf.perf.canvasEdgeLodDense`); quantized RF transform for `SelectionOverlay` during gestures (`canvasPerf.ts` flags).
- [x] Canvas image delivery: `CanvasNodeImage` + `canvasImagePlanForBox` (Supabase `src`/`srcSet`/`sizes` from CSS box × DPR, debounced `ResizeObserver`); freeze URL churn during viewport/node drag (`CanvasViewportGestureContext`); `decode()` after load; video `preload="metadata"` on `UploadNode`. **Toggles:** `vf.perf.canvasImageDeferGesture`, `canvasImageResizeDebounceMs` in `canvasPerf.ts`.

## INP / presentation delay

### Checklist (plan phases)

- [x] Baseline: capture INP + `[VF:react-profiler]` during pan / `pointerup` (compare before/after locally).
- [x] Phase 1 — Route isolation: remove `DevReactProfiler` from wrapping `<Routes>` in [`src/App.tsx`](src/App.tsx); workspace profiling remains [`vf-canvas-inner`](src/pages/Index.tsx) only.
- [x] Phase 2 — Index hot path: drop `onMove`; do not call `setLastViewport` or `refreshAllHandleBounds` on every pan frame; `onMoveEnd` commits viewport + handle refresh (pure pan: stable flow-space handle geometry per `useViewportHandleBoundsSync` docs).
- [x] Phase 3 — Handle bounds: epsilon guard on zoom-driven full refresh in [`src/hooks/useViewportHandleBoundsSync.ts`](src/hooks/useViewportHandleBoundsSync.ts).
- [x] Phase 4 — Persistence + toolbar: 350ms debounced `refreshParity` for viewport-only store churn in [`src/hooks/useSpaceLocalPersistence.ts`](src/hooks/useSpaceLocalPersistence.ts); `React.memo` on [`src/components/canvas/Toolbar.tsx`](src/components/canvas/Toolbar.tsx).
- [ ] Gate: re-measure INP (presentation delay) + profiler; decide Hybrid / WASM using escalation policy below.

### 5) Then choose architecture escalation

After steps 1–4:

If presentation delay is still high due to DOM/layout: move toward **Hybrid (WebGL for board visuals + DOM for active editors/controls).**

Use **WASM** only for proven hot math paths (edge picking/spatial queries), not as a general INP fix.

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

- **Bundle + dev profiling (2026-04):** Lazy route + lazy RF node/edge/connection modules, deferred Settings/SelectionOverlay/Pixi hybrid chunks, `DevReactProfiler` on `vf-canvas-inner` (not route shell), `vite.config.ts` `manualChunks`. Verify: `pnpm build:analyze`, `pnpm dev` + `[VF:react-profiler]`.

- **INP presentation delay (2026-04):** Removed per-pan `refreshAllHandleBounds` + `setLastViewport` from `onMove` (`Index.tsx`); `onMoveEnd` only. Debounced viewport-only `refreshParity` (`useSpaceLocalPersistence`). Zoom micro-change skip for handle refresh (`useViewportHandleBoundsSync`). Route-level profiler removed (`App.tsx`). **Verify:** pan on `react-flow__pane` — INP presentation delay and slow profiler commits should drop; after pan/zoom, edges still anchor to handles.

- **Phase 5 edge LOD (2026-04):** `CustomEdge` drops wide hit-area path, hover/snippet `foreignObject`, and dash animation while `CanvasEdgeLodProvider` is `reduced` (viewport/node-drag by default; optional `canvasEdgeLodDense` when edge count ≥ `denseEdgeLodThreshold`). **`localStorage` / query:** `vf.perf.canvasEdgeLod=0` disables gesture LOD; `vf.perf.canvasEdgeLodDense=1` enables always-on dense LOD. **Verify:** pan across dense hairball — lower presentation delay; after release, cut/snippet and hover behave again; dense-flag-on may weaken edge hit targets until zoomed in.

- **Settings shortcuts (2026-04):** Shortcuts panel renders from `canvasKeymap.ts` (labels: Ctrl/⌘, Delete+Backspace, Redo + Windows Ctrl+Y). `Index.tsx` adds `zoomIn`/`zoomOut` on Ctrl/Cmd + +/- / numpad, and `G` cycles `canvasPattern` (dots→grid→lines→none). `Toolbar.tsx` skips shortcuts when focus is in ProseMirror, contenteditable, or combobox. Verify: open Settings → Shortcuts matches behavior; type in a text node — tool keys and undo should not fire; `G` and zoom keys on canvas.

- **Undo/redo coalescing (2026-04):** Pending `updateNodeData` history is **flushed** synchronously before `undo`/`redo` (replacing clear-only). `commitPendingNodeDataHistoryForNode` + `flushPendingNodeDataHistoryCommits`; public `flushNodeDataHistory(id?)`. Debounce **300ms** in `workflowStore.constants.ts`. `RichTextField` `onFlushHistory` on wrapper blur; wired in `TextNode` + `AssistantNode`. Scout `executeScoutNode` uses `updateNodeDataSilent` only. **Verify:** `pnpm test` / `pnpm lint` (local Node env); type in rich field → blur → undo reverts burst; mid-edit Ctrl+Z commits pending then undoes; run Scout → undo stack not spammed by status fields.
