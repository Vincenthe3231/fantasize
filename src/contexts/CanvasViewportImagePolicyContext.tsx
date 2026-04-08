import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'reactflow';
import { getCanvasImageLowZoomUnmountMaxZoom } from '@/lib/canvasPerf';

/**
 * When true, viewport zoom is **at or below** `canvasImageLowZoomMax` (default 49%): `CanvasNodeImage`
 * unmounts the `<img>` (default) or CSS-hides it (`canvasImageUnmountLowZoom=0`).
 */
const CanvasViewportImagePolicyContext = createContext(false);

export function useCanvasViewportLowZoomVisualHide(): boolean {
  return useContext(CanvasViewportImagePolicyContext);
}

/** @deprecated Use `useCanvasViewportLowZoomVisualHide`; same boolean, clearer name. */
export function useCanvasViewportHideNodeImages(): boolean {
  return useContext(CanvasViewportImagePolicyContext);
}

/**
 * Subscribes to viewport zoom only in this subtree. Suppresses node images when `zoom <=` configured
 * max (default 0.49); remounts when `zoom >` that value.
 */
export function CanvasViewportImagePolicyBridge({ children }: { children: ReactNode }) {
  const zoom = useStore((s) => s.transform[2]);
  const maxZoomForImages = getCanvasImageLowZoomUnmountMaxZoom();
  const suppressImages = maxZoomForImages != null && zoom <= maxZoomForImages;

  return (
    <CanvasViewportImagePolicyContext.Provider value={suppressImages}>
      {children}
    </CanvasViewportImagePolicyContext.Provider>
  );
}
