import { useEffect, useRef, type RefObject } from 'react';
import { useReactFlow, useStoreApi } from 'reactflow';
import { useCanvasStrokeRender } from '@/contexts/CanvasStrokeRenderContext';
import { useWorkflowStore } from '@/stores/workflowStore';
import { isCanvasDrawUiBlocklisted } from '@/components/canvas/canvasDrawUiBlocklist';

type Props = {
  /** Shell that contains the React Flow instance (e.g. `.react-flow__pane`). */
  shellRef: RefObject<HTMLElement | null>;
};

/**
 * Freehand draw / eraser: pointer path in flow space, preview via `CanvasStrokeRenderContext`, commit on up.
 */
export function CanvasDrawInteraction({ shellRef }: Props) {
  const selectedTool = useWorkflowStore((s) => s.selectedTool);
  const { screenToFlowPosition } = useReactFlow();
  const storeApi = useStoreApi();
  const { previewPointsRef, previewMetaRef, requestRedraw } = useCanvasStrokeRender();

  const screenToFlowRef = useRef(screenToFlowPosition);
  screenToFlowRef.current = screenToFlowPosition;

  useEffect(() => {
    if (selectedTool !== 'draw') return;

    const shell = shellRef.current;
    if (!shell) return;

    const findPane = () => shell.querySelector('.react-flow__pane') as HTMLElement | null;

    const pointsBuf: [number, number][] = [];
    let capturing = false;
    let activePointerId: number | null = null;

    const clearWindowListeners = () => {
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerUp, true);
    };

    const syncPreviewMeta = () => {
      const st = useWorkflowStore.getState();
      const sub = st.drawSubTool;
      previewMetaRef.current =
        sub === 'eraser'
          ? { mode: 'eraser', color: st.drawColor, widthPx: st.drawWidthPx }
          : { mode: 'pencil', color: st.drawColor, widthPx: st.drawWidthPx };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!capturing || e.pointerId !== activePointerId) return;
      const p = screenToFlowRef.current({ x: e.clientX, y: e.clientY });
      pointsBuf.push([p.x, p.y]);
      previewPointsRef.current = pointsBuf;
      syncPreviewMeta();
      requestRedraw();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!capturing || e.pointerId !== activePointerId) return;
      capturing = false;
      activePointerId = null;
      clearWindowListeners();
      previewPointsRef.current = null;
      previewMetaRef.current = null;
      requestRedraw();

      const st = useWorkflowStore.getState();
      const zoom = storeApi.getState().transform[2] ?? 1;

      if (st.drawSubTool === 'eraser') {
        st.commitCanvasEraserGesture(pointsBuf, {
          zoom,
          eraserWidthPx: st.drawWidthPx,
        });
      } else {
        st.commitCanvasStroke(pointsBuf, {
          color: st.drawColor,
          widthPx: st.drawWidthPx,
        });
      }
      pointsBuf.length = 0;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const pane = findPane();
      if (!pane || !pane.contains(e.target as Node)) return;
      if (isCanvasDrawUiBlocklisted(e.target)) return;

      pointsBuf.length = 0;
      const p = screenToFlowRef.current({ x: e.clientX, y: e.clientY });
      pointsBuf.push([p.x, p.y]);
      capturing = true;
      activePointerId = e.pointerId;
      try {
        pane.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      previewPointsRef.current = [...pointsBuf];
      syncPreviewMeta();
      requestRedraw();

      window.addEventListener('pointermove', onPointerMove, true);
      window.addEventListener('pointerup', onPointerUp, true);
      window.addEventListener('pointercancel', onPointerUp, true);
    };

    shell.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      shell.removeEventListener('pointerdown', onPointerDown, true);
      clearWindowListeners();
      if (capturing) {
        capturing = false;
        activePointerId = null;
        previewPointsRef.current = null;
        previewMetaRef.current = null;
        pointsBuf.length = 0;
        requestRedraw();
      }
    };
  }, [selectedTool, shellRef, previewPointsRef, previewMetaRef, requestRedraw, storeApi]);

  return null;
}
