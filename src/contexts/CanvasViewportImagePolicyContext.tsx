import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'reactflow';
import { canvasPerfFlags } from '@/lib/canvasPerf';

/**
 * When true, `CanvasNodeImage` skips `<img>` (decode, srcSet churn) and renders a lightweight
 * placeholder — intended for zoomed-out boards where many thumbnails are on screen.
 * Value is stable across zoom ticks while the boolean does not change (see bridge).
 */
const CanvasViewportImagePolicyContext = createContext(false);

export function useCanvasViewportHideNodeImages(): boolean {
  return useContext(CanvasViewportImagePolicyContext);
}

/**
 * Subscribes to viewport zoom only in this small subtree so the rest of the canvas does not
 * re-render on every zoom frame. Must be rendered under `ReactFlowProvider`.
 */
export function CanvasViewportImagePolicyBridge({ children }: { children: ReactNode }) {
  const zoom = useStore((s) => s.transform[2]);
  const hideImages =
    canvasPerfFlags.canvasImageHideLowZoom && zoom <= canvasPerfFlags.canvasImageLowZoomMax;
  return (
    <CanvasViewportImagePolicyContext.Provider value={hideImages}>{children}</CanvasViewportImagePolicyContext.Provider>
  );
}
