import { CANVAS_PERF_SCENARIOS } from '@/lib/canvasScenarios';

/** Documented perf scenarios for Chrome Performance recordings (canvas baseline). */
export { CANVAS_PERF_SCENARIOS };

const FLAG_PREFIX = 'vf.perf.';

function readBoolFlag(name: string, defaultValue: boolean): boolean {
  if (typeof window === 'undefined') return defaultValue;
  const fromQuery = new URLSearchParams(window.location.search).get(name);
  if (fromQuery === '1' || fromQuery === 'true') return true;
  if (fromQuery === '0' || fromQuery === 'false') return false;
  try {
    const stored = window.localStorage.getItem(`${FLAG_PREFIX}${name}`);
    if (stored === '1' || stored === 'true') return true;
    if (stored === '0' || stored === 'false') return false;
  } catch {
    /* ignore storage access */
  }
  return defaultValue;
}

/** Query `?zoomHandleThrottleMs=150` or `localStorage` `vf.perf.zoomHandleThrottleMs`. `0` = no throttle (legacy per-zoom rAF). */
function readNumberFlag(name: string, defaultValue: number, min: number, max: number): number {
  if (typeof globalThis === 'undefined' || typeof window === 'undefined') return defaultValue;
  const parseRaw = (raw: string | null): number | null => {
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const fromQuery = parseRaw(new URLSearchParams(window.location.search).get(name));
  if (fromQuery != null) return Math.min(max, Math.max(min, fromQuery));
  try {
    const fromStored = parseRaw(window.localStorage.getItem(`${FLAG_PREFIX}${name}`));
    if (fromStored != null) return Math.min(max, Math.max(min, fromStored));
  } catch {
    /* ignore */
  }
  return defaultValue;
}

export const canvasPerfFlags = {
  enablePerfMarks: readBoolFlag('canvasPerfMarks', import.meta.env.DEV),
  deltaDragTxn: readBoolFlag('canvasDeltaDragTxn', true),
  diffHistory: readBoolFlag('canvasDiffHistory', true),
  scopedInternalsRefresh: readBoolFlag('canvasScopedInternals', true),
  deferSavesDuringDrag: readBoolFlag('canvasDeferSaves', true),
  coalesceReactiveDataflow: readBoolFlag('canvasCoalesceDataflow', true),
  reduceMotionDuringDrag: readBoolFlag('canvasReduceMotion', true),
  enableCanvasWorkerBridge: readBoolFlag('canvasWorkerBridge', true),
  enableSpatialIndexing: readBoolFlag('canvasSpatialIndex', true),
  enableWorkerEdgePicking: readBoolFlag('canvasWorkerEdgePick', true),
  enableWorkerEdgePickWasm: readBoolFlag('canvasWorkerEdgePickWasm', true),
  fastStartupMode: readBoolFlag('canvasFastStartup', true),
  deferNonCriticalCanvasUi: readBoolFlag('canvasDeferUi', true),
  deferToastsDuringInteraction: readBoolFlag('canvasDeferToasts', true),
  /**
   * During pan/zoom (and node drag, which sets the same interacting flag), render edges in
   * `CustomEdge` with a single simplified path and no hover / snip chrome to cut paint cost in
   * dense graphs.
   */
  edgeLodDuringViewportInteraction: readBoolFlag('canvasEdgeLod', true),
  /**
   * While the flag above is on, also use reduced edges when the board has many connections,
   * even if the user is not mid-gesture — lowers baseline cost in “hairball” graphs; cut/snip
   * on edges may be degraded until zooming in or pausing.
   */
  edgeLodInDenseGraph: readBoolFlag('canvasEdgeLodDense', false),
  /** Edge count at/above which dense-graph LOD applies (see `edgeLodInDenseGraph`). */
  denseEdgeLodThreshold: 350,
  /** Draw read-only edge mirror in Pixi when hybrid board is active. */
  hybridEdgeLayer: readBoolFlag('canvasHybridEdges', true),
  /** Reduce edge detail in Pixi during viewport/node drag gestures. */
  hybridEdgeInteractionLod: readBoolFlag('canvasHybridEdgesLod', true),
  /** Hide most DOM edge visuals while hybrid Pixi edges are active (keeps cut/selected affordances). */
  hybridEdgeDomCutover: readBoolFlag('canvasHybridDomEdgeCutover', false),
  /** Skip Pixi edge mirror if the graph is too small; avoid overhead on tiny boards. */
  hybridEdgeMinCount: 80,
  /** Quantize pan deltas for selection overlay positioning to fewer React commits during gesture */
  selectionOverlayQuantizeDuringViewport: readBoolFlag('canvasOverlayQuantize', true),
  /** Flow-space pixels to quantize viewport x/y when overlay quantize is active */
  selectionOverlayViewportQuantizePx: 8,
  /** Freeze CDN `src` / `srcSet` churn while panning/zooming or dragging nodes (see `CanvasNodeImage`). */
  deferCanvasImageUrlDuringViewport: readBoolFlag('canvasImageDeferGesture', true),
  /** Legacy: was used by `CanvasNodeImage` + ResizeObserver; stable URLs no longer debounce layout. */
  canvasImageResizeDebounceMs: 120,
  /**
   * Minimum interval between full handle-bounds refreshes driven by **zoom** changes
   * (`useViewportHandleBoundsSync`). Reduces `updateNodeInternals(all nodes)` during wheel/pinch.
   * `onMoveEnd` in `Index.tsx` still runs a full refresh after the gesture. `0` disables throttling.
   */
  zoomHandleBoundsThrottleMs: readNumberFlag('zoomHandleThrottleMs', 120, 0, 2000),
  /**
   * When true, node images use **visual hiding** (not unmount) below a zoom band centered on
   * `canvasImageLowZoomMax` with `canvasImageLowZoomHysteresis` — avoids flapping and `NS_BINDING_ABORTED`
   * from mount/unmount near the threshold. Query `?canvasImageHideLowZoom=0`.
   */
  canvasImageHideLowZoom: readBoolFlag('canvasImageHideLowZoom', true),
  /**
   * Center of the low-zoom band (e.g. 0.5 = 50%). Images **hide** when zoom ≤ `center - hysteresis`
   * and **show** when zoom ≥ `center + hysteresis` (latched between). Query `?canvasImageLowZoomMax=0.5`.
   */
  canvasImageLowZoomMax: readNumberFlag('canvasImageLowZoomMax', 0.5, 0.05, 1),
  /**
   * Half-width of the hysteresis band around `canvasImageLowZoomMax` (default 0.05 → hide ≤45%, show ≥55%).
   * Query `?canvasImageLowZoomHysteresis=0.05` or `vf.perf.canvasImageLowZoomHysteresis`.
   */
  canvasImageLowZoomHysteresis: readNumberFlag('canvasImageLowZoomHysteresis', 0.05, 0.01, 0.25),
  /**
   * Fixed Supabase transform width for `CanvasNodeImage` when not using `fixedCssWidth` (stable URL,
   * no zoom-based churn). Query `?canvasImageStableMaxWidth=1024` or `vf.perf.canvasImageStableMaxWidth`.
   */
  canvasImageStableMaxWidth: readNumberFlag('canvasImageStableMaxWidth', 1280, 128, 4096),
  /**
   * When true (default), `CanvasNodeImage` uses `loading="eager"` unless overridden — avoids native
   * lazy-load re-intersection fighting React Flow pan/zoom transforms. Query `?canvasImageEager=0` or
   * `vf.perf.canvasImageEager=0` to restore lazy for debugging.
   */
  canvasImageEagerInFlow: readBoolFlag('canvasImageEager', true),
  spatialIndexThreshold: 250,
} as const;

/** Hysteresis band for low-zoom image hiding; `null` when the feature is off. */
export function getCanvasImageLowZoomThresholds(): { hideAt: number; showAt: number } | null {
  if (!canvasPerfFlags.canvasImageHideLowZoom) return null;
  const c = canvasPerfFlags.canvasImageLowZoomMax;
  const h = canvasPerfFlags.canvasImageLowZoomHysteresis;
  let hideAt = c - h;
  let showAt = c + h;
  hideAt = Math.max(0.05, hideAt);
  showAt = Math.min(1, showAt);
  if (hideAt >= showAt) {
    const mid = Math.min(1, Math.max(0.05, c));
    hideAt = Math.max(0.05, mid - 0.01);
    showAt = Math.min(1, mid + 0.01);
    if (hideAt >= showAt) showAt = Math.min(1, hideAt + 0.02);
  }
  return { hideAt, showAt };
}

export function markCanvasPerfStart(name: string): number {
  if (!canvasPerfFlags.enablePerfMarks || typeof performance === 'undefined') return 0;
  const start = performance.now();
  performance.mark(`${name}:start`);
  return start;
}

export function markCanvasPerfEnd(name: string, startMs?: number): void {
  if (!canvasPerfFlags.enablePerfMarks || typeof performance === 'undefined') return;
  try {
    performance.mark(`${name}:end`);
    performance.measure(name, `${name}:start`, `${name}:end`);
  } catch {
    /* missing mark */
  }
  if (startMs && import.meta.env.DEV) {
    const d = Math.round((performance.now() - startMs) * 100) / 100;
    if (d >= 16) {
      console.info('[VF:perf]', name, `${d}ms`);
    }
  }
}

export function runWithCanvasPerfMark<T>(name: string, fn: () => T): T {
  const t0 = markCanvasPerfStart(name);
  try {
    return fn();
  } finally {
    markCanvasPerfEnd(name, t0);
  }
}

