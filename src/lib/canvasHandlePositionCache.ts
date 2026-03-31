type FlowPoint = { x: number; y: number };

type CacheEntry = {
  point: FlowPoint;
  revision: number;
};

const handleFlowCache = new Map<string, CacheEntry>();
let handleFlowRevision = 1;

function cacheKey(nodeId: string, handleId: string): string {
  return `${nodeId}::${handleId}`;
}

export function readCachedHandleFlowPosition(nodeId: string, handleId: string): FlowPoint | null {
  const entry = handleFlowCache.get(cacheKey(nodeId, handleId));
  if (!entry || entry.revision !== handleFlowRevision) return null;
  return entry.point;
}

export function writeCachedHandleFlowPosition(
  nodeId: string,
  handleId: string,
  point: FlowPoint
): void {
  handleFlowCache.set(cacheKey(nodeId, handleId), {
    point,
    revision: handleFlowRevision,
  });
}

export function bumpHandleFlowPositionRevision(): void {
  handleFlowRevision += 1;
  // Keep bounded memory if old cache entries accumulate.
  if (handleFlowCache.size > 4096) handleFlowCache.clear();
}

export function measureAndCacheHandleFlowPosition(
  nodeId: string,
  handleId: string,
  screenToFlowPosition: (point: { x: number; y: number }) => FlowPoint
): FlowPoint | null {
  const root = document.querySelector<HTMLElement>(
    `.react-flow__node[data-id="${CSS.escape(nodeId)}"]`
  );
  const handleEl = root?.querySelector<HTMLElement>(
    `.react-flow__handle[data-handleid="${CSS.escape(handleId)}"]`
  );
  if (!handleEl) return null;
  const r = handleEl.getBoundingClientRect();
  const point = screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  writeCachedHandleFlowPosition(nodeId, handleId, point);
  return point;
}
