import { useSyncExternalStore } from 'react';

const NATURAL_H = 430;
const NATURAL_W = 54;
const MARGIN_Y = 28;
const MARGIN_X = 20;
/** Below this, targets get cramped; prefer scaling over scrolling until then. */
const MIN_SCALE = 0.58;

function readViewportSize(): { w: number; h: number } {
  if (typeof window === 'undefined') return { w: 1024, h: 768 };
  const vv = window.visualViewport;
  return {
    w: vv?.width ?? window.innerWidth,
    h: vv?.height ?? window.innerHeight,
  };
}

function computeScale(): number {
  const { w, h } = readViewportSize();
  const scaleH = (h - MARGIN_Y * 2) / NATURAL_H;
  const scaleW = (w - MARGIN_X * 2) / NATURAL_W;
  return Math.max(MIN_SCALE, Math.min(1, scaleH, scaleW));
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const run = () => onChange();
  window.addEventListener('resize', run);
  window.visualViewport?.addEventListener('resize', run);
  window.visualViewport?.addEventListener('scroll', run);
  return () => {
    window.removeEventListener('resize', run);
    window.visualViewport?.removeEventListener('resize', run);
    window.visualViewport?.removeEventListener('scroll', run);
  };
}

function getSnapshot(): number {
  return computeScale();
}

function getServerSnapshot(): number {
  return 1;
}

/** Scale factor (0.58–1) so the vertical canvas toolbar fits the viewport without clipping. */
export function useResponsiveToolbarScale(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
