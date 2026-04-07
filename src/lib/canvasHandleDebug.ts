import { internalsSymbol } from 'reactflow';
import type { Node } from 'reactflow';

type RFStoreGetState = () => {
  transform: [number, number, number];
  nodeInternals: Map<string, Node>;
};

/**
 * Legacy minimal handle snapshot (still exported for ad-hoc imports).
 * Prefer `canvasEdgeDebug.ts` + `?canvasEdgeDebug=1` — combined connection-line + audit log while dragging.
 */
export function logCanvasHandleDebug(getState: RFStoreGetState, nodeId: string): void {
  if (!import.meta.env.DEV) return;

  const state = getState();
  const n = state.nodeInternals.get(nodeId);
  const dom = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(nodeId)}"]`);
  const nodeRect = dom?.getBoundingClientRect();
  const firstHandle = dom?.querySelector<HTMLElement>('.react-flow__handle');
  const handleRect = firstHandle?.getBoundingClientRect();
  const internals = n ? (n as unknown as Record<symbol, { handleBounds?: unknown }>)[internalsSymbol] : undefined;

  console.debug('[canvas-handle-debug]', {
    nodeId,
    transform: state.transform,
    nodeWidth: n?.width,
    nodeHeight: n?.height,
    positionAbsolute: n?.positionAbsolute,
    handleBounds: internals?.handleBounds,
    nodeRect: nodeRect && { x: nodeRect.x, y: nodeRect.y, w: nodeRect.width, h: nodeRect.height },
    handleRect: handleRect && { x: handleRect.x, y: handleRect.y, w: handleRect.width, h: handleRect.height },
    deltaScreenPx:
      nodeRect && handleRect
        ? { x: handleRect.left - nodeRect.left, y: handleRect.top - nodeRect.top }
        : undefined,
  });
}
