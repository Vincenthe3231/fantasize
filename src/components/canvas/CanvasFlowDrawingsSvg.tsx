import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore, useStoreApi } from 'reactflow';
import { useCanvasStrokeRender } from '@/contexts/CanvasStrokeRenderContext';
import { useWorkflowStore } from '@/stores/workflowStore';
import type { CanvasStroke } from '@/lib/canvasStrokeUtils';

function rebuildSvg(
  svg: SVGSVGElement,
  strokes: CanvasStroke[],
  preview: [number, number][] | null,
  zoom: number
): void {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const z = Math.max(zoom, 1e-6);
  const addPoly = (pts: [number, number][], stroke: string, widthPx: number) => {
    if (pts.length < 2) return;
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', stroke);
    poly.setAttribute('stroke-width', String(widthPx / z));
    poly.setAttribute('stroke-linecap', 'round');
    poly.setAttribute('stroke-linejoin', 'round');
    poly.setAttribute('points', pts.map((p) => `${p[0]},${p[1]}`).join(' '));
    svg.appendChild(poly);
  };
  for (const s of strokes) {
    addPoly(s.points, s.color, s.widthPx);
  }
  if (preview && preview.length >= 2) {
    addPoly(preview, '#22d3ee', 2.25);
  }
}

/**
 * DOM fallback for persisted + preview strokes when hybrid WebGL grid is off.
 * Portals into `.react-flow__viewport` so polylines use flow space under the viewport transform.
 */
export function CanvasFlowDrawingsSvg() {
  const store = useStoreApi();
  const domNode = useStore((s) => s.domNode);
  const [viewportEl, setViewportEl] = useState<HTMLElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const strokesRef = useRef<CanvasStroke[]>([]);
  const { previewPointsRef, registerRedraw } = useCanvasStrokeRender();

  useLayoutEffect(() => {
    const vp = domNode?.querySelector('.react-flow__viewport') ?? null;
    setViewportEl(vp);
  }, [domNode]);

  const redraw = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const [, , zoom] = store.getState().transform;
    rebuildSvg(svg, strokesRef.current, previewPointsRef.current, zoom);
  }, [previewPointsRef, store]);

  useEffect(() => {
    strokesRef.current = useWorkflowStore.getState().canvasDrawings;
    registerRedraw(redraw);
    return () => registerRedraw(null);
  }, [registerRedraw, redraw]);

  useEffect(() => {
    let raf: number | null = null;
    const sched = () => {
      if (raf != null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        redraw();
      });
    };
    const unsubWf = useWorkflowStore.subscribe((s) => {
      strokesRef.current = s.canvasDrawings;
      sched();
    });
    const unsubRf = store.subscribe(() => sched());
    sched();
    return () => {
      unsubWf();
      unsubRf();
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [store, redraw]);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    const host = viewportEl;
    if (!svg || !host) return;
    if (svg.parentElement === host && host.firstChild !== svg) {
      host.insertBefore(svg, host.firstChild);
    }
  }, [viewportEl]);

  if (!viewportEl) return null;

  return createPortal(
    <svg
      ref={svgRef}
      className="vf-flow-drawings-layer pointer-events-none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
        zIndex: 0,
      }}
      aria-hidden
    />,
    viewportEl
  );
}
