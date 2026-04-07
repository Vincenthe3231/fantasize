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
 * drift. Zoom changes still need refresh because scale affects how RF caches bounds; those
 * refreshes are **throttled** (`canvasPerfFlags.zoomHandleBoundsThrottleMs`) so wheel/pinch does
 * not run `updateNodeInternals(all nodes)` on every zoom tick. `0` disables throttling. While
 * `connectionNodeId` is set (dragging a new connection), throttling is bypassed so the preview
 * line stays aligned with visible handles.
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
  /** While dragging a new edge, stale handle bounds make the preview line float off the visible port; bypass zoom throttle for those frames. */
  const isConnecting = useStore((s) => s.connectionNodeId != null);
  const lastZoomForInternalsRef = useRef<number | null>(null);

  const rafRef = useRef<number | null>(null);
  const zoomThrottleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastZoomRefreshAtRef = useRef(0);

  useEffect(() => {
    const prevZ = lastZoomForInternalsRef.current;
    if (prevZ != null && Math.abs(prevZ - zoom) < 1e-6) {
      return;
    }
    lastZoomForInternalsRef.current = zoom;

    const throttleMs = canvasPerfFlags.zoomHandleBoundsThrottleMs;

    const runRefresh = () => {
      zoomThrottleTimerRef.current = null;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        lastZoomRefreshAtRef.current = performance.now();
        refreshAllHandleBounds();
      });
    };

    if (isConnecting || throttleMs <= 0) {
      runRefresh();
    } else {
      const now = performance.now();
      const elapsed = now - lastZoomRefreshAtRef.current;
      if (elapsed >= throttleMs) {
        runRefresh();
      } else {
        if (zoomThrottleTimerRef.current != null) {
          clearTimeout(zoomThrottleTimerRef.current);
        }
        zoomThrottleTimerRef.current = setTimeout(runRefresh, throttleMs - elapsed);
      }
    }

    return () => {
      if (zoomThrottleTimerRef.current != null) {
        clearTimeout(zoomThrottleTimerRef.current);
        zoomThrottleTimerRef.current = null;
      }
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (dirtyRafRef.current != null) {
        cancelAnimationFrame(dirtyRafRef.current);
        dirtyRafRef.current = null;
      }
    };
  }, [zoom, refreshAllHandleBounds, isConnecting]);

  return { refreshAllHandleBounds, queueHandleBoundsRefresh };
}
