import { createContext, useContext, useRef, type ReactNode } from 'react';
import { useStore } from 'reactflow';
import { canvasPerfFlags, getCanvasImageLowZoomThresholds } from '@/lib/canvasPerf';

/**
 * When true, `CanvasNodeImage` applies **visual** low-zoom hiding (keeps `<img>` mounted so loads can
 * finish and cache). Hysteresis around `canvasImageLowZoomMax` avoids threshold flapping.
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
 * Subscribes to viewport zoom only in this small subtree so the rest of the canvas does not
 * re-render on every zoom frame. Uses **hysteresis** (hide at center−h, show at center+h) so zoom
 * wobble near 50% does not mount/unmount or thrash image loads.
 */
export function CanvasViewportImagePolicyBridge({ children }: { children: ReactNode }) {
  const zoom = useStore((s) => s.transform[2]);
  const latchRef = useRef<boolean | null>(null);
  const thresholds = getCanvasImageLowZoomThresholds();

  let visuallyHidden: boolean;
  if (!thresholds) {
    visuallyHidden = false;
    latchRef.current = null;
  } else {
    const { hideAt, showAt } = thresholds;
    const prev = latchRef.current;
    if (prev === null) {
      visuallyHidden = zoom <= hideAt;
      latchRef.current = visuallyHidden;
    } else if (zoom <= hideAt) {
      visuallyHidden = true;
      latchRef.current = true;
    } else if (zoom >= showAt) {
      visuallyHidden = false;
      latchRef.current = false;
    } else {
      visuallyHidden = prev;
    }
  }

  return (
    <CanvasViewportImagePolicyContext.Provider value={visuallyHidden}>
      {children}
    </CanvasViewportImagePolicyContext.Provider>
  );
}
