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

export const canvasPerfFlags = {
  enablePerfMarks: readBoolFlag('canvasPerfMarks', import.meta.env.DEV),
  deltaDragTxn: readBoolFlag('canvasDeltaDragTxn', true),
  diffHistory: readBoolFlag('canvasDiffHistory', true),
  scopedInternalsRefresh: readBoolFlag('canvasScopedInternals', true),
  deferSavesDuringDrag: readBoolFlag('canvasDeferSaves', true),
  coalesceReactiveDataflow: readBoolFlag('canvasCoalesceDataflow', true),
  reduceMotionDuringDrag: readBoolFlag('canvasReduceMotion', true),
  enableCanvasWorkerBridge: readBoolFlag('canvasWorkerBridge', true),
  enableSpatialIndexing: readBoolFlag('canvasSpatialIndex', false),
  enableWorkerEdgePicking: readBoolFlag('canvasWorkerEdgePick', false),
  enableWorkerEdgePickWasm: readBoolFlag('canvasWorkerEdgePickWasm', true),
  spatialIndexThreshold: 250,
} as const;

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

