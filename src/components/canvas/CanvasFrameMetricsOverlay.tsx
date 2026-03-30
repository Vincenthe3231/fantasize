import { useEffect, useState } from 'react';
import { CanvasFrameMetricsSampler, type FrameMetricsSnapshot } from '@/lib/canvasFrameMetrics';
import { readVfPerfOverlayEnabled } from '@/lib/pixiBoard/readVfPerfOverlayEnabled';

/**
 * Dev-only overlay: FPS + frame-time p50/p95. Enable with `?vfPerf=1` or `localStorage vf.perf.overlay=1`.
 */
export function CanvasFrameMetricsOverlay() {
  const [enabled] = useState(() => readVfPerfOverlayEnabled());
  const [snap, setSnap] = useState<FrameMetricsSnapshot | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const s = new CanvasFrameMetricsSampler();
    s.start(setSnap);
    return () => s.stop();
  }, [enabled]);

  if (!enabled || !snap) return null;

  return (
    <div
      className="pointer-events-none fixed left-3 top-16 z-[300] rounded-md border border-white/15 bg-black/75 px-2 py-1.5 font-mono text-[10px] text-white/90 shadow-lg"
      aria-hidden
    >
      <div>FPS ~{snap.fps}</div>
      <div>
        p50 {snap.p50ms}ms · p95 {snap.p95ms}ms
      </div>
      <div>last {snap.lastMs}ms · n={snap.samples}</div>
    </div>
  );
}
