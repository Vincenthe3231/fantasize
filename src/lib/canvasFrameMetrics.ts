/** Rolling frame-time sample for dev overlay (p50 / p95, smoothed FPS). */

export type FrameMetricsSnapshot = {
  fps: number;
  p50ms: number;
  p95ms: number;
  lastMs: number;
  samples: number;
};

const MAX_SAMPLES = 120;

export class CanvasFrameMetricsSampler {
  private samples: number[] = [];
  private lastTs = 0;
  private rafId: number | null = null;
  private callback: ((s: FrameMetricsSnapshot) => void) | null = null;

  start(cb: (s: FrameMetricsSnapshot) => void): void {
    this.stop();
    this.callback = cb;
    this.lastTs = performance.now();
    const tick = (now: number) => {
      const dt = now - this.lastTs;
      this.lastTs = now;
      if (dt > 0 && dt < 500) {
        this.samples.push(dt);
        if (this.samples.length > MAX_SAMPLES) this.samples.shift();
      }
      const snap = this.snapshot(now, dt);
      this.callback?.(snap);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.callback = null;
    this.samples = [];
  }

  private snapshot(now: number, lastDt: number): FrameMetricsSnapshot {
    const arr = [...this.samples].sort((a, b) => a - b);
    const n = arr.length;
    const p50ms = n ? arr[Math.floor(n * 0.5)]! : 0;
    const p95ms = n ? arr[Math.floor(n * 0.95)]! : 0;
    const mean = n ? arr.reduce((a, b) => a + b, 0) / n : 16.67;
    const fps = mean > 0 ? Math.min(999, Math.round(1000 / mean)) : 0;
    return {
      fps,
      p50ms: Math.round(p50ms * 100) / 100,
      p95ms: Math.round(p95ms * 100) / 100,
      lastMs: Math.round(lastDt * 100) / 100,
      samples: n,
    };
  }
}
