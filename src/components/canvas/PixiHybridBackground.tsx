import { useCallback, useEffect, useRef } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import { useStoreApi } from 'reactflow';
import { useWorkflowStore } from '@/stores/workflowStore';
import type { Viewport2D } from '@/lib/pixiBoard/screenFlowTransform';

/**
 * WebGL grid layer behind React Flow DOM (hybrid mode). Does not handle pointer events.
 *
 * Viewport is driven only by React Flow's internal transform (single source of truth).
 * Draw is scheduled with double requestAnimationFrame so WebGL composites after the RF
 * viewport transform for the frame — reduces "jiggle" vs CSS/DOM on some browsers (notably Safari).
 *
 * Manual QA: slow trackpad zoom on Safari vs Chrome; if drift remains, try one rAF or
 * useLayoutEffect + single rAF after reading transform.
 */
export function PixiHybridBackground() {
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<Container | null>(null);
  const gridRef = useRef<Graphics | null>(null);
  const vpRef = useRef<Viewport2D>({ x: 0, y: 0, zoom: 1 });
  const drawRafRef = useRef<number | null>(null);
  const setLastViewport = useWorkflowStore((s) => s.setLastViewport);
  const store = useStoreApi();

  const drawWorld = useCallback(() => {
    const world = worldRef.current;
    const gGrid = gridRef.current;
    if (!world || !gGrid) return;

    const v = vpRef.current;
    world.position.set(v.x, v.y);
    world.scale.set(v.zoom);

    gGrid.clear();
    const span = 6000;
    const step = 28;
    for (let x = -span; x <= span; x += step) {
      gGrid.moveTo(x, -span);
      gGrid.lineTo(x, span);
    }
    for (let y = -span; y <= span; y += step) {
      gGrid.moveTo(-span, y);
      gGrid.lineTo(span, y);
    }
    gGrid.stroke({ width: 1, color: 0xffffff, alpha: 0.055 });
  }, []);

  const scheduleDraw = useCallback(() => {
    if (drawRafRef.current != null) {
      cancelAnimationFrame(drawRafRef.current);
    }
    drawRafRef.current = requestAnimationFrame(() => {
      drawRafRef.current = requestAnimationFrame(() => {
        drawRafRef.current = null;
        drawWorld();
      });
    });
  }, [drawWorld]);

  useEffect(() => {
    const unsub = store.subscribe((state) => {
      const [x, y, zoom] = state.transform;
      vpRef.current = { x, y, zoom };
      setLastViewport({ x, y, zoom });
      scheduleDraw();
    });
    const initial = store.getState().transform;
    vpRef.current = { x: initial[0], y: initial[1], zoom: initial[2] };
    setLastViewport({ x: initial[0], y: initial[1], zoom: initial[2] });
    scheduleDraw();
    return () => {
      unsub();
      if (drawRafRef.current != null) {
        cancelAnimationFrame(drawRafRef.current);
        drawRafRef.current = null;
      }
    };
  }, [store, scheduleDraw, setLastViewport]);

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
        antialias: true,
        resolution: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
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
