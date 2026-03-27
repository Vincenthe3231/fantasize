/**
 * Dev-only canvas / edge / handle instrumentation.
 *
 * Enable in the browser (development builds only):
 * - `?canvasEdgeDebug=1` — logs on connect-start, move-end (throttled), periodic global snapshot
 * - `?debugNode=<nodeId>` — every 2s, full audit for that node (works with or without canvasEdgeDebug)
 *
 * Paste console output (expand objects) when reporting handle / connection-line mismatch.
 */
import { internalsSymbol } from 'reactflow';
import type { Node } from 'reactflow';

export function isCanvasEdgeDebugEnabled(searchParams: URLSearchParams): boolean {
  const v = searchParams.get('canvasEdgeDebug')?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

type RfStoreState = {
  transform: [number, number, number];
  nodeInternals: Map<string, Node>;
};

export type RfGetState = () => RfStoreState;

function readHandleBounds(node: Node | undefined): unknown {
  if (!node) return undefined;
  const bag = (node as unknown as Record<symbol, unknown>)[internalsSymbol];
  if (bag && typeof bag === 'object' && bag !== null && 'handleBounds' in bag) {
    return (bag as { handleBounds?: unknown }).handleBounds;
  }
  return undefined;
}

/** Full snapshot: Zustand vs RF internals vs DOM for every handle under the node. */
export function logCanvasEdgeAudit(opts: {
  tag: string;
  nodeId: string;
  rfGetState: RfGetState;
  workflowNodes: Node[];
}): void {
  if (!import.meta.env.DEV) return;

  const { tag, nodeId, rfGetState, workflowNodes } = opts;
  const state = rfGetState();
  const rfNode = state.nodeInternals.get(nodeId);
  const wfNode = workflowNodes.find((n) => n.id === nodeId);

  const dom = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(nodeId)}"]`);
  const nodeRect = dom?.getBoundingClientRect();

  const handlesDom: Array<Record<string, unknown>> = [];
  dom?.querySelectorAll<HTMLElement>('.react-flow__handle').forEach((el) => {
    const r = el.getBoundingClientRect();
    handlesDom.push({
      handleId: el.getAttribute('data-handleid'),
      handlePos: el.getAttribute('data-handlepos'),
      className: el.className,
      screenRect: {
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
      },
    });
  });

  const payload = {
    tag,
    nodeId,
    ts: new Date().toISOString(),
    rfTransform: [...state.transform] as [number, number, number],
    zustandNode: wfNode
      ? {
          type: wfNode.type,
          width: wfNode.width,
          height: wfNode.height,
          position: wfNode.position,
          positionAbsolute: wfNode.positionAbsolute,
          parentId: wfNode.parentId,
          style: wfNode.style,
        }
      : null,
    rfNodeInternal: rfNode
      ? {
          type: rfNode.type,
          width: rfNode.width,
          height: rfNode.height,
          position: rfNode.position,
          positionAbsolute: rfNode.positionAbsolute,
          parentId: rfNode.parentId,
        }
      : null,
    dimMismatch:
      wfNode && rfNode
        ? {
            w: wfNode.width !== rfNode.width ? { z: wfNode.width, rf: rfNode.width } : null,
            h: wfNode.height !== rfNode.height ? { z: wfNode.height, rf: rfNode.height } : null,
          }
        : null,
    handleBoundsFromInternals: readHandleBounds(rfNode),
    domNodeRect: nodeRect
      ? { x: nodeRect.x, y: nodeRect.y, w: nodeRect.width, h: nodeRect.height }
      : null,
    handlesDom,
  };

  console.log('%c[canvas-edge-debug] audit', 'color:#22d3ee;font-weight:bold', payload);
}

export function logCanvasEdgeGlobal(opts: {
  tag: string;
  rfGetState: RfGetState;
  workflowNodeCount: number;
  workflowEdgeCount: number;
}): void {
  if (!import.meta.env.DEV) return;
  const s = opts.rfGetState();
  console.log('%c[canvas-edge-debug] global', 'color:#a78bfa;font-weight:bold', {
    tag: opts.tag,
    ts: new Date().toISOString(),
    transform: [...s.transform] as [number, number, number],
    rfNodeInternalsSize: s.nodeInternals.size,
    workflowNodeCount: opts.workflowNodeCount,
    workflowEdgeCount: opts.workflowEdgeCount,
  });
}

type ConnectStartMeta = {
  nodeId: string | null;
  handleId: string | null;
  handleType: string | null;
};

export function logCanvasEdgeConnectStart(opts: {
  rfGetState: RfGetState;
  workflowNodes: Node[];
  meta: ConnectStartMeta;
}): void {
  if (!import.meta.env.DEV) return;
  console.groupCollapsed(
    '%c[canvas-edge-debug] connect-start',
    'color:#f472b6;font-weight:bold',
    opts.meta
  );
  console.log('meta', { ...opts.meta, ts: new Date().toISOString() });
  if (opts.meta.nodeId) {
    logCanvasEdgeAudit({
      tag: 'connect-start',
      nodeId: opts.meta.nodeId,
      rfGetState: opts.rfGetState,
      workflowNodes: opts.workflowNodes,
    });
  }
  console.groupEnd();
}

export function logCanvasEdgeMoveEnd(opts: {
  tag: string;
  rfGetState: RfGetState;
  workflowNodeCount: number;
  workflowEdgeCount: number;
  viewport: { x: number; y: number; zoom: number };
}): void {
  if (!import.meta.env.DEV) return;
  const s = opts.rfGetState();
  console.log('%c[canvas-edge-debug] move-end', 'color:#86efac;font-weight:bold', {
    tag: opts.tag,
    ts: new Date().toISOString(),
    viewport: opts.viewport,
    transform: [...s.transform] as [number, number, number],
    workflowNodeCount: opts.workflowNodeCount,
    workflowEdgeCount: opts.workflowEdgeCount,
    rfNodeInternalsSize: s.nodeInternals.size,
  });
}

/** Attach manual triggers on `window` when `canvasEdgeDebug=1` (dev only). */
export function installCanvasEdgeDebugWindowApi(opts: {
  rfGetState: RfGetState;
  getWorkflowNodes: () => Node[];
  getWorkflowEdgeCount: () => number;
}): () => void {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return () => {};
  }
  const api = {
    audit: (nodeId: string) =>
      logCanvasEdgeAudit({
        tag: 'manual-audit',
        nodeId,
        rfGetState: opts.rfGetState,
        workflowNodes: opts.getWorkflowNodes(),
      }),
    global: () =>
      logCanvasEdgeGlobal({
        tag: 'manual-global',
        rfGetState: opts.rfGetState,
        workflowNodeCount: opts.getWorkflowNodes().length,
        workflowEdgeCount: opts.getWorkflowEdgeCount(),
      }),
  };
  (window as unknown as { __VISION_FORGE_EDGE_DEBUG__?: typeof api }).__VISION_FORGE_EDGE_DEBUG__ =
    api;
  return () => {
    delete (window as unknown as { __VISION_FORGE_EDGE_DEBUG__?: typeof api })
      .__VISION_FORGE_EDGE_DEBUG__;
  };
}
