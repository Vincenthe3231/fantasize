import { lazy } from 'react';

const PixiHybridBackgroundLazy = lazy(() =>
  import('@/components/canvas/PixiHybridBackground').then((m) => ({
    default: m.PixiHybridBackground,
  }))
);

/**
 * Pixi/WebGL grid — chunk loads only when hybrid board mode mounts this component.
 * Parent should wrap the canvas region in `<Suspense fallback={null}>`.
 */
export function PixiHybridBackgroundGate() {
  return <PixiHybridBackgroundLazy />;
}
