/** Dev-only FPS / frame-time overlay: `?vfPerf=1` or localStorage `vf.perf.overlay` = `1` */
export function readVfPerfOverlayEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search).get('vfPerf');
  if (q === '1' || q === 'true') return true;
  try {
    return window.localStorage.getItem('vf.perf.overlay') === '1';
  } catch {
    return false;
  }
}
