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
- [x] Canvas image delivery: `CanvasNodeImage` uses **stable** Supabase URLs (`canvasStableImageUrl` — fixed `width` from `canvasImageStableMaxWidth`, default 1280) or explicit `fixedCssWidth` for small thumbs; no `ResizeObserver`/zoom-churn. `canvasImagePlanForBox` kept for any legacy/tests. Gesture defer + low-zoom placeholder unchanged. **Toggles:** `vf.perf.canvasImageDeferGesture`, `?canvasImageStableMaxWidth=…` / `vf.perf.canvasImageStableMaxWidth`.
- [x] Hybrid v1 (grid + edges): Pixi layer now mirrors dense-edge geometry from RF internals in hybrid mode (`PixiHybridBackground`); interaction LOD + DOM edge cutover flags added in `canvasPerf.ts`; image-heavy drag hardening suppresses hover overlays during gestures (`ImageCellOverlay`, `SelectedShotNode`).

## INP / presentation delay

### Checklist (plan phases)

- [x] Baseline: capture INP + `[VF:react-profiler]` during pan / `pointerup` (compare before/after locally).
- [x] Phase 1 — Route isolation: remove `DevReactProfiler` from wrapping `<Routes>` in [`src/App.tsx`](src/App.tsx); workspace profiling remains [`vf-canvas-inner`](src/pages/Index.tsx) only.
- [x] Phase 2 — Index hot path: drop `onMove`; do not call `setLastViewport` or `refreshAllHandleBounds` on every pan frame; `onMoveEnd` commits viewport + handle refresh (pure pan: stable flow-space handle geometry per `useViewportHandleBoundsSync` docs).
- [x] Phase 3 — Handle bounds: epsilon guard on zoom-driven full refresh in [`src/hooks/useViewportHandleBoundsSync.ts`](src/hooks/useViewportHandleBoundsSync.ts).
- [x] Phase 4 — Persistence + toolbar: 350ms debounced `refreshParity` for viewport-only store churn in [`src/hooks/useSpaceLocalPersistence.ts`](src/hooks/useSpaceLocalPersistence.ts); `React.memo` on [`src/components/canvas/Toolbar.tsx`](src/components/canvas/Toolbar.tsx).
- [ ] Gate: re-measure INP (presentation delay) + profiler; decide Hybrid / WASM using escalation policy below.

### Hybrid v1 checklist (grid + edges)

- [x] Phase 0: baseline/gates recorded for dense pan/zoom/drag; keep rollback flags for each hybrid behavior.
- [x] Phase 1: Pixi edge mirror skeleton added behind DOM in hybrid board mode.
- [x] Phase 2: interaction LOD added for hybrid edge layer (`canvasHybridEdgesLod`).
- [x] Phase 3: guarded DOM edge cutover (`canvasHybridDomEdgeCutover`) with cut/selected affordance safety in `CustomEdge`.
- [x] Phase 4: grouped image drag hardening — gesture-time hover suppression for image overlays.
- [x] Phase 5: gate decision — proceed with Hybrid v1 experimentation; WASM remains math-only escalation.

### 5) Then choose architecture escalation

After steps 1–4:

If presentation delay is still high due to DOM/layout: move toward **Hybrid (WebGL for board visuals + DOM for active editors/controls).**

Use **WASM** only for proven hot math paths (edge picking/spatial queries), not as a general INP fix.

## Review

- **Stable canvas image URLs (2026-04):** `CanvasNodeImage` no longer measures CSS box × DPR for Supabase transforms. Default path: `canvasStableImageUrl` with `canvasPerfFlags.canvasImageStableMaxWidth` (1280). Optional `fixedCssWidth`/`fixedCssHeight` for grid/list thumbs. **Verify:** Network tab — same `width=` in URL when panning/zooming; crossing low-zoom placeholder still remounts `<img>` once.

- **Middle-mouse pan (2026-04):** Hand tool uses `panOnDrag={[0, 1]}`; Select/other tools use `[1]` for middle-only pan. **Removed** `middleMouseButtonHeld` gating of wheel — wheel follows Settings only (Zoom = scale, Pan = move view); middle **drag** is separate (React Flow `panOnDrag`). Settings copy documents this. **Verify:** wheel Zoom vs Pan modes; middle-drag pans without affecting wheel semantics.

- **Select vs Hand (2026-04):** Toolbar **Select** (V) = marquee + node selection — `selectionOnDrag={selectedTool === 'select' && !nodeContentFocusActive}`, `panOnDrag={[1]}` so left-drag is not canvas pan. **Hand** (H) = move the canvas — `panOnDrag={[0, 1]}` when `selectedTool === 'hand'`. A prior `selectionOnDrag={false}` change wrongly removed marquee; reverted.

- **Low-zoom canvas images (2026-04):** When `canvasPerfFlags.canvasImageHideLowZoom` (default on) and viewport zoom ≤ `canvasImageLowZoomMax` (default **0.5**), `CanvasNodeImage` renders a muted placeholder instead of `<img>` — fewer decodes/composites when zoomed out. Tuning: `?canvasImageHideLowZoom=0`, `?canvasImageLowZoomMax=0.45`, or `localStorage` `vf.perf.canvasImageLowZoomMax`. `CanvasViewportImagePolicyBridge` in `Index.tsx` holds the single `useStore` zoom subscription so only that bridge re-renders per zoom frame; consumers update when crossing the threshold. **Verify:** zoom out past 50% — thumbnails become placeholders; zoom in — images return; list/grid layouts unchanged.

- **Zoom handle-bounds throttle (2026-04):** `useViewportHandleBoundsSync` no longer runs `refreshAllHandleBounds` on **every** zoom tick; interval is capped by `canvasPerfFlags.zoomHandleBoundsThrottleMs` (default **120ms**, query `?zoomHandleThrottleMs=…`, or `localStorage` `vf.perf.zoomHandleThrottleMs`; **0** = legacy unthrottled rAF). `onMoveEnd` in `Index.tsx` still does a full refresh after pan/zoom. **Verify:** dense graph, wheel zoom — INP should improve; after zoom release, edges still meet handles.

- **Supabase egress / “cached egress” (when metrics climb):** Dashboard “cached egress” is bytes Supabase’s **edge/CDN** serves (often Storage); it is **not** the same as TanStack’s in-memory cache. **Canvas/hybrid/React Flow optimizations are client-side** and do not by themselves increase Supabase traffic unless fetch patterns changed. **Likely drivers:** (1) **Storage** — public image URLs (`getPublicUrl`), many views/large files; (2) **API** — full-row `spaces` loads via `select('*')` (large JSON); (3) **post-save** `invalidateQueries` + `refetchQueries` for `canvas-space` in `useSpaceLocalPersistence` — extra full reads after each save; (4) Edge Functions (`scout-execute`) response sizes. **Mitigations:** confirm split in Dashboard (Storage vs Database vs Functions); tighten TanStack usage (`staleTime`, avoid redundant `refetch`/`invalidate` when server state is already applied); consider slimmer queries or not refetching immediately after save if parity allows; for Storage — smaller dimensions, stable URLs, good `Cache-Control`, or external CDN if needed. **TanStack** reduces egress only by **avoiding duplicate HTTP requests**, not by changing Supabase’s billing labels.

- **Supabase org migration (2026-04):** Migration [`20260403120000_storage_bucket_1_policies.sql`](../supabase/migrations/20260403120000_storage_bucket_1_policies.sql) adds `bucket-1` to storage buckets + RLS. Doc [`docs/supabase-migrate-between-projects.md`](../docs/supabase-migrate-between-projects.md) + [`scripts/supabase-migrate/`](../scripts/supabase-migrate/) (`export-auth.sh`, `export-public.sh`, `export-storage-objects.sh`, `import-to-target.sh`, SQL trigger/instance helpers, `verify-counts.sql`). README + `.env.example` point to Postgres URLs for migration. Verify: `pnpm db:push-sync` on target; run exports with real `DATABASE_URL_SOURCE`; dry-run import on a scratch project before production.

- **Sign-in route (2026-04):** Added `/signin` (lazy `SignIn.tsx`), `/siginin` → `/signin` alias with query preserved; canvas routes redirect unauthenticated users to `/signin?redirect=…`; removed auto `signInAnonymously` and password-failure anonymous fallback in `useAuth.ts`. Verify: open `http://localhost:8082/signin` and `http://localhost:8082/siginin`; sign in with seeded email user; deep link `/w/:id` redirects to sign-in then returns after login.

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
