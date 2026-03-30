import { useEffect, useRef, useCallback, useState } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import { useWorkflowStore } from '@/stores/workflowStore';
import type { Edge, Node } from 'reactflow';
import { getEdgeEndpoints, getNodeFlowRect } from '@/lib/pixiBoard/nodeBounds';
import {
  horizontalBezierControls,
  minDistSqToPolyline,
  sampleCubicBezier,
} from '@/lib/pixiBoard/cubicBezier';
import { screenToFlow, zoomViewportAtScreenPoint, type Viewport2D } from '@/lib/pixiBoard/screenFlowTransform';

const EDGE_PICK_THRESH_SQ = 10 * 10;

function pickTopNodeAt(flowX: number, flowY: number, nodes: Node[]): Node | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i]!;
    const r = getNodeFlowRect(n);
    if (flowX >= r.x && flowX <= r.x + r.w && flowY >= r.y && flowY <= r.y + r.h) return n;
  }
  return null;
}

function pickEdgeAt(flowX: number, flowY: number, nodes: Node[], edges: Edge[]): Edge | null {
  for (let i = edges.length - 1; i >= 0; i--) {
    const e = edges[i]!;
    const pts = getEdgeEndpoints(nodes, e.source, e.target);
    if (!pts) continue;
    const [p0, p1, p2, p3] = horizontalBezierControls(pts.sx, pts.sy, pts.tx, pts.ty);
    const samples = sampleCubicBezier(p0, p1, p2, p3, 24);
    if (minDistSqToPolyline(flowX, flowY, samples, EDGE_PICK_THRESH_SQ)) return e;
  }
  return null;
}

function applySelection(
  nodes: Node[],
  edges: Edge[],
  selNodeId: string | null,
  selEdgeId: string | null,
  setNodesSilently: (n: Node[]) => void,
  setEdgesSilently: (e: Edge[]) => void
) {
  setNodesSilently(nodes.map((n) => ({ ...n, selected: selNodeId != null && n.id === selNodeId })));
  setEdgesSilently(edges.map((e) => ({ ...e, selected: selEdgeId != null && e.id === selEdgeId })));
}

type PixiBoardViewportProps = {
  spaceId: string;
};

/**
 * WebGL (Pixi) board: grid, edges, node shells + pan/zoom + picking (plan Phases 1–2).
 */
export function PixiBoardViewport({ spaceId }: PixiBoardViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<Container | null>(null);
  const gridRef = useRef<Graphics | null>(null);
  const edgesRef = useRef<Graphics | null>(null);
  const nodesRef = useRef<Graphics | null>(null);

  const lastVp = useWorkflowStore((s) => s.lastViewport);
  const setLastViewport = useWorkflowStore((s) => s.setLastViewport);
  const setNodesSilently = useWorkflowStore((s) => s.setNodesSilently);
  const setEdgesSilently = useWorkflowStore((s) => s.setEdgesSilently);
  const selectedTool = useWorkflowStore((s) => s.selectedTool);
  const selectedToolRef = useRef(selectedTool);
  selectedToolRef.current = selectedTool;

  const [vp, setVp] = useState<Viewport2D>(() => ({ x: lastVp.x, y: lastVp.y, zoom: lastVp.zoom }));
  const vpRef = useRef(vp);
  vpRef.current = vp;

  useEffect(() => {
    const s = useWorkflowStore.getState().lastViewport;
    setVp({ x: s.x, y: s.y, zoom: s.zoom });
  }, [spaceId]);

  const drawWorld = useCallback(() => {
    const world = worldRef.current;
    const gGrid = gridRef.current;
    const gE = edgesRef.current;
    const gN = nodesRef.current;
    if (!world || !gGrid || !gE || !gN) return;

    const v = vpRef.current;
    world.position.set(v.x, v.y);
    world.scale.set(v.zoom);

    const st = useWorkflowStore.getState();
    const nodes = st.nodes;
    const edges = st.edges;

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

    gE.clear();
    for (const e of edges) {
      const ep = getEdgeEndpoints(nodes, e.source, e.target);
      if (!ep) continue;
      const [p0, p1, p2, p3] = horizontalBezierControls(ep.sx, ep.sy, ep.tx, ep.ty);
      gE.moveTo(p0.x, p0.y);
      gE.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      const col = e.selected ? 0x7c6ff7 : 0x22d3ee;
      gE.stroke({ width: e.selected ? 3 : 2, color: col, alpha: 0.92 });
    }

    gN.clear();
    for (const n of nodes) {
      const r = getNodeFlowRect(n);
      gN
        .roundRect(r.x, r.y, r.w, r.h, 10)
        .fill({ color: 0x1a1a1c, alpha: 0.94 })
        .stroke({
          width: n.selected ? 2.5 : 1,
          color: n.selected ? 0x7c6ff7 : 0x333338,
          alpha: 1,
        });
    }
  }, []);

  useEffect(() => {
    drawWorld();
  }, [vp, drawWorld]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    const detachRef: { current: (() => void) | null } = { current: null };
    const app = new Application();

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

        const world = new Container();
        app.stage.addChild(world);
        worldRef.current = world;

        const gGrid = new Graphics();
        const gEdges = new Graphics();
        const gNodes = new Graphics();
        world.addChild(gGrid);
        world.addChild(gEdges);
        world.addChild(gNodes);
        gridRef.current = gGrid;
        edgesRef.current = gEdges;
        nodesRef.current = gNodes;

        const onCtxLost = (ev: Event) => {
          ev.preventDefault();
          console.warn('[VF:Pixi] webglcontextlost — reload or clear vf.perf.board');
        };
        app.canvas.addEventListener('webglcontextlost', onCtxLost);

        const unsub = useWorkflowStore.subscribe((s, p) => {
          if (s.nodes !== p.nodes || s.edges !== p.edges) {
            requestAnimationFrame(drawWorld);
          }
        });

        requestAnimationFrame(drawWorld);

        const canvas = app.canvas as HTMLCanvasElement;
        let dragPan: { lx: number; ly: number } | null = null;

        const commitVp = (next: Viewport2D) => {
          vpRef.current = next;
          setVp(next);
          setLastViewport(next);
          requestAnimationFrame(drawWorld);
        };

        const onPointerDown = (ev: PointerEvent) => {
          const tool = selectedToolRef.current;
          if (ev.button === 1 || (tool === 'hand' && ev.button === 0)) {
            dragPan = { lx: ev.clientX, ly: ev.clientY };
            canvas.setPointerCapture(ev.pointerId);
            ev.preventDefault();
            return;
          }

        if (tool !== 'select') return;

        const rect = host.getBoundingClientRect();
          const { x: fx, y: fy } = screenToFlow(ev.clientX, ev.clientY, rect, vpRef.current);
          const st = useWorkflowStore.getState();
          const hitNode = pickTopNodeAt(fx, fy, st.nodes);
          const hitEdge = hitNode ? null : pickEdgeAt(fx, fy, st.nodes, st.edges);

          if (hitNode) {
            applySelection(st.nodes, st.edges, hitNode.id, null, setNodesSilently, setEdgesSilently);
          } else if (hitEdge) {
            applySelection(st.nodes, st.edges, null, hitEdge.id, setNodesSilently, setEdgesSilently);
          } else if (tool === 'select') {
            applySelection(st.nodes, st.edges, null, null, setNodesSilently, setEdgesSilently);
          }
          requestAnimationFrame(drawWorld);
        };

        const onPointerMove = (ev: PointerEvent) => {
          if (!dragPan) return;
          const dx = ev.clientX - dragPan.lx;
          const dy = ev.clientY - dragPan.ly;
          dragPan = { lx: ev.clientX, ly: ev.clientY };
          const cur = vpRef.current;
          commitVp({ x: cur.x + dx, y: cur.y + dy, zoom: cur.zoom });
        };

        const onPointerUp = (ev: PointerEvent) => {
          if (dragPan) {
            dragPan = null;
            try {
              canvas.releasePointerCapture(ev.pointerId);
            } catch {
              /* */
            }
          }
        };

        const onWheel = (ev: WheelEvent) => {
          ev.preventDefault();
          const rect = host.getBoundingClientRect();
          const cur = vpRef.current;
          const factor = ev.deltaY > 0 ? 0.92 : 1.08;
          const next = zoomViewportAtScreenPoint(cur, rect, ev.clientX, ev.clientY, cur.zoom * factor);
          commitVp(next);
        };

        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointercancel', onPointerUp);
        canvas.addEventListener('wheel', onWheel, { passive: false });

        detachRef.current = () => {
          unsub();
          canvas.removeEventListener('webglcontextlost', onCtxLost);
          canvas.removeEventListener('pointerdown', onPointerDown);
          canvas.removeEventListener('pointermove', onPointerMove);
          canvas.removeEventListener('pointerup', onPointerUp);
          canvas.removeEventListener('pointercancel', onPointerUp);
          canvas.removeEventListener('wheel', onWheel);
        };
      })
      .catch((err) => {
        console.error('[VF:Pixi] init failed', err);
      });

    return () => {
      disposed = true;
      detachRef.current?.();
      detachRef.current = null;
      worldRef.current = null;
      gridRef.current = null;
      edgesRef.current = null;
      nodesRef.current = null;
      try {
        app.destroy(true, { children: true, texture: true });
      } catch {
        /* */
      }
    };
  }, [spaceId, drawWorld, setLastViewport, setNodesSilently, setEdgesSilently]);

  return <div ref={hostRef} className="absolute inset-0 z-0" aria-label="WebGL canvas board" />;
}
