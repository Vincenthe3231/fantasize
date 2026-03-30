import { useCallback, useEffect, useRef } from 'react';
import { useStore, useUpdateNodeInternals, useReactFlow } from 'reactflow';
import { canvasPerfFlags, runWithCanvasPerfMark } from '@/lib/canvasPerf';

/**
 * React Flow recomputes handle bounds in `updateNodeDimensions` using the current viewport zoom.
 * Pan/zoom does not resize `.react-flow__node`, so ResizeObserver often does not run — internals go stale.
 *
 * **Performance:** We only subscribe to **zoom** (`transform[2]`), not pan (`x`/`y`). Subscribing to all
 * transform components ran `updateNodeInternals(all nodes)` on every pan frame and tanked INP on
 * large canvases. Pure translation uses stable flow-space handle geometry; **`onMoveEnd` in
 * `Index.tsx`** still calls `refreshAllHandleBounds()` when a pan gesture finishes to correct any
 * drift. Zoom changes still need timely refresh because scale affects how RF caches bounds.
 *
 * Keep this behavior intact: connection UX relies on fresh handle internals so newly connected
 * edges can anchor immediately to the visible handle position.
 */
export function useViewportHandleBoundsSync(): {
  refreshAllHandleBounds: () => void;
  queueHandleBoundsRefresh: (nodeIds: Iterable<string>) => void;
} {
  const updateNodeInternals = useUpdateNodeInternals();
  const { getNodes } = useReactFlow();
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const dirtyRafRef = useRef<number | null>(null);

  const flushDirtyNodeInternals = useCallback(() => {
    if (dirtyRafRef.current != null) {
      cancelAnimationFrame(dirtyRafRef.current);
      dirtyRafRef.current = null;
    }
    const ids = [...dirtyIdsRef.current];
    dirtyIdsRef.current.clear();
    if (ids.length === 0) return;
    runWithCanvasPerfMark('canvas.refreshHandleBounds.scoped', () => {
      updateNodeInternals(ids);
    });
  }, [updateNodeInternals]);

  const queueHandleBoundsRefresh = useCallback(
    (nodeIds: Iterable<string>) => {
      for (const id of nodeIds) {
        if (id) dirtyIdsRef.current.add(id);
      }
      if (!canvasPerfFlags.scopedInternalsRefresh) {
        flushDirtyNodeInternals();
        return;
      }
      if (dirtyRafRef.current != null) return;
      dirtyRafRef.current = requestAnimationFrame(() => {
        dirtyRafRef.current = null;
        flushDirtyNodeInternals();
      });
    },
    [flushDirtyNodeInternals]
  );

  const refreshAllHandleBounds = useCallback(() => {
    const ids = getNodes().map((n) => n.id);
    queueHandleBoundsRefresh(ids);
  }, [getNodes, queueHandleBoundsRefresh]);

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
      if (dirtyRafRef.current != null) {
        cancelAnimationFrame(dirtyRafRef.current);
        dirtyRafRef.current = null;
      }
    };
  }, [zoom, refreshAllHandleBounds]);

  return { refreshAllHandleBounds, queueHandleBoundsRefresh };
}
