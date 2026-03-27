import type { FitViewOptions } from 'reactflow';

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export const DEFAULT_FIT_VIEW_OPTIONS: FitViewOptions = {
  padding: 0.25,
  duration: 450,
  ease: easeOutCubic,
  interpolate: 'smooth',
};
