/**
 * Enables the Pixi/WebGL board instead of React Flow.
 * - URL: `?vfBoard=pixi` or `?vfBoard=1`
 * - localStorage: `vf.perf.board` = `pixi`
 */
export function readVfPixiBoardEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search).get('vfBoard');
  if (q === 'pixi' || q === '1' || q === 'true') return true;
  try {
    if (window.localStorage.getItem('vf.perf.board') === 'pixi') return true;
  } catch {
    /* private mode */
  }
  return false;
}

/**
 * WebGL grid behind React Flow DOM nodes (hybrid layered canvas).
 * - URL: `?vfBoard=hybrid`
 * - localStorage: `vf.perf.board` = `hybrid`
 */
export function readVfHybridBoardEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search).get('vfBoard');
  if (q === 'hybrid') return true;
  try {
    if (window.localStorage.getItem('vf.perf.board') === 'hybrid') return true;
  } catch {
    /* private mode */
  }
  return false;
}
