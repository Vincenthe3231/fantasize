import { useCallback, useEffect, useRef } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import { useStoreApi } from 'reactflow';
import type { Viewport2D } from '@/lib/pixiBoard/screenFlowTransform';
import { canvasPerfFlags } from '@/lib/canvasPerf';
import { useCanvasViewportGestureActive } from '@/contexts/CanvasViewportGestureContext';

/**
 * WebGL grid layer behind React Flow DOM (hybrid mode). Does not handle pointer events.
 *
 * Viewport is driven only by React Flow's internal transform (single source of truth).
 * Draw is scheduled with one requestAnimationFrame per frame (double rAF removed — it added
 * latency; avoid syncing the board viewport into Zustand every pan frame — only on gesture end
 * / coarse updates — to prevent heavy store subscribers during pan).
 *
 * Manual QA: slow trackpad zoom on Safari vs Chrome; if WebGL lags behind DOM, try useLayoutEffect.
 */
export function PixiHybridBackground() {
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<Container | null>(null);
  const gridRef = useRef<Graphics | null>(null);
  const edgeRef = useRef<Graphics | null>(null);
  const vpRef = useRef<Viewport2D>({ x: 0, y: 0, zoom: 1 });
  const graphRef = useRef<{
    edgeIds: string[];
    sourceByEdge: Map<string, string>;
    targetByEdge: Map<string, string>;
    centerByNode: Map<string, { x: number; y: number }>;
  }>({
    edgeIds: [],
    sourceByEdge: new Map(),
    targetByEdge: new Map(),
    centerByNode: new Map(),
  });
  const drawRafRef = useRef<number | null>(null);
  const gestureActive = useCanvasViewportGestureActive();
  const store = useStoreApi();

  const drawWorld = useCallback(() => {
    const world = worldRef.current;
    const gGrid = gridRef.current;
    const gEdge = edgeRef.current;
    if (!world || !gGrid || !gEdge) return;

    const v = vpRef.current;
    world.position.set(v.x, v.y);
    world.scale.set(v.zoom);

    gGrid.clear();
    const span = 6000;
    /** Fewer line segments when zoomed out (step widens). */
    const z = Math.max(0.2, Math.min(v.zoom, 6));
    const step = Math.max(24, Math.min(80, 28 / z));
    for (let x = -span; x <= span; x += step) {
      gGrid.moveTo(x, -span);
      gGrid.lineTo(x, span);
    }
    for (let y = -span; y <= span; y += step) {
      gGrid.moveTo(-span, y);
      gGrid.lineTo(span, y);
    }
    gGrid.stroke({ width: 1, color: 0xffffff, alpha: 0.055 });

    gEdge.clear();
    if (!canvasPerfFlags.hybridEdgeLayer) return;
    const {
      edgeIds,
      sourceByEdge,
      targetByEdge,
      centerByNode,
    } = graphRef.current;
    if (edgeIds.length < canvasPerfFlags.hybridEdgeMinCount) return;
    const reduced = canvasPerfFlags.hybridEdgeInteractionLod && gestureActive;
    const edgeAlpha = reduced ? 0.32 : 0.48;
    const edgeWidth = reduced ? 1 : 1.25;
    for (const eid of edgeIds) {
      const s = centerByNode.get(sourceByEdge.get(eid) ?? '');
      const t = centerByNode.get(targetByEdge.get(eid) ?? '');
      if (!s || !t) continue;
      gEdge.moveTo(s.x, s.y);
      gEdge.lineTo(t.x, t.y);
    }
    gEdge.stroke({ width: edgeWidth, color: 0xaab4c5, alpha: edgeAlpha });
  }, [gestureActive]);

  const scheduleDraw = useCallback(() => {
    if (drawRafRef.current != null) {
      cancelAnimationFrame(drawRafRef.current);
    }
    drawRafRef.current = requestAnimationFrame(() => {
      drawRafRef.current = null;
      drawWorld();
    });
  }, [drawWorld]);

  useEffect(() => {
    type RFState = ReturnType<typeof store.getState>;

    const rebuildGraph = (state: RFState) => {
      const edges = state.edges ?? [];
      const nodeInternals = state.nodeInternals;
      const sourceByEdge = new Map<string, string>();
      const targetByEdge = new Map<string, string>();
      const edgeIds: string[] = [];
      for (const e of edges) {
        if (!e?.id || !e?.source || !e?.target) continue;
        edgeIds.push(e.id);
        sourceByEdge.set(e.id, e.source);
        targetByEdge.set(e.id, e.target);
      }
      const centerByNode = new Map<string, { x: number; y: number }>();
      nodeInternals?.forEach((n, id) => {
        if (!n) return;
        const p = n.internals?.positionAbsolute;
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
        const w = typeof n.width === 'number' && n.width > 0 ? n.width : 0;
        const h = typeof n.height === 'number' && n.height > 0 ? n.height : 0;
        centerByNode.set(id, { x: p.x + w / 2, y: p.y + h / 2 });
      });
      graphRef.current = { edgeIds, sourceByEdge, targetByEdge, centerByNode };
    };

    const initial = store.getState();
    const [ix, iy, izoom] = initial.transform;
    vpRef.current = { x: ix, y: iy, zoom: izoom };
    rebuildGraph(initial);

    let prevEdges = initial.edges;
    let prevNodeInternals = initial.nodeInternals;

    const unsub = store.subscribe((state) => {
      const [x, y, zoom] = state.transform;
      vpRef.current = { x, y, zoom };

      const edges = state.edges;
      const nodeInternals = state.nodeInternals;
      if (edges !== prevEdges || nodeInternals !== prevNodeInternals) {
        prevEdges = edges;
        prevNodeInternals = nodeInternals;
        rebuildGraph(state);
      }
      scheduleDraw();
    });

    scheduleDraw();
    return () => {
      unsub();
      if (drawRafRef.current != null) {
        cancelAnimationFrame(drawRafRef.current);
        drawRafRef.current = null;
      }
    };
  }, [store, scheduleDraw]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    const detachRef: { current: (() => void) | null } = { current: null };
    const appRef: { current: Application | null } = { current: null };
    const app = new Application();
    appRef.current = app;

    void app
      .init({
        background: 0x0e0e10,
        antialias: false,
        resolution:
          typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1,
        autoDensity: true,
        resizeTo: host,
        preference: 'webgl',
      })
      .then(() => {
        if (disposed) {
          app.destroy(true);
          return;
        }

        host.appendChild(app.canvas as HTMLCanvasElement);
        const canvas = app.canvas as HTMLCanvasElement;
        canvas.style.pointerEvents = 'none';

        const world = new Container();
        app.stage.addChild(world);
        worldRef.current = world;

        const gGrid = new Graphics();
        world.addChild(gGrid);
        gridRef.current = gGrid;

        const gEdge = new Graphics();
        world.addChild(gEdge);
        edgeRef.current = gEdge;

        const onCtxLost = (ev: Event) => {
          ev.preventDefault();
          console.warn('[VF:Pixi hybrid] webglcontextlost');
        };
        canvas.addEventListener('webglcontextlost', onCtxLost);

        scheduleDraw();

        detachRef.current = () => {
          canvas.removeEventListener('webglcontextlost', onCtxLost);
        };
      })
      .catch((err) => {
        console.error('[VF:Pixi hybrid] init failed', err);
      });

    return () => {
      disposed = true;
      detachRef.current?.();
      detachRef.current = null;
      worldRef.current = null;
      gridRef.current = null;
      edgeRef.current = null;
      const a = appRef.current;
      appRef.current = null;
      if (a) {
        try {
          a.destroy(true, { children: true, texture: true });
        } catch {
          /* */
        }
      }
    };
  }, [scheduleDraw]);

  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute inset-0 z-0"
      aria-hidden
      data-vf-pixi-hybrid="true"
    />
  );
}
