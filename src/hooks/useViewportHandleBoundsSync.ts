import { useCallback, useEffect, useRef } from 'react';
import { useStore, useUpdateNodeInternals, useReactFlow } from 'reactflow';

/**
 * React Flow recomputes handle bounds in `updateNodeDimensions` using the current viewport zoom.
 * Pan/zoom does not resize `.react-flow__node`, so ResizeObserver often does not run — internals go stale.
 *
 * **Performance:** We only subscribe to **zoom** (`transform[2]`), not pan (`x`/`y`). Subscribing to all
 * transform components ran `updateNodeInternals(all nodes)` on every pan frame and tanked INP on
 * large canvases. Pure translation uses stable flow-space handle geometry; **`onMoveEnd` in
 * `Index.tsx`** still calls `refreshAllHandleBounds()` when a pan gesture finishes to correct any
 * drift. Zoom changes still need timely refresh because scale affects how RF caches bounds.
 */
export function useViewportHandleBoundsSync(): {
  refreshAllHandleBounds: () => void;
} {
  const updateNodeInternals = useUpdateNodeInternals();
  const { getNodes } = useReactFlow();

  const refreshAllHandleBounds = useCallback(() => {
    const ids = getNodes().map((n) => n.id);
    if (ids.length > 0) updateNodeInternals(ids);
  }, [getNodes, updateNodeInternals]);

  const zoom = useStore((s) => s.transform[2]);

  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      refreshAllHandleBounds();
    });
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [zoom, refreshAllHandleBounds]);

  return { refreshAllHandleBounds };
}
