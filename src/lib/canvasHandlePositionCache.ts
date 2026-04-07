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

type DomSearchRoot = Document | Element;

export type ViewportTransform = readonly [number, number, number];

/**
 * Mirrors React Flow’s `screenToFlowPosition` when `snapToGrid` is off — maps a **viewport client**
 * point (e.g. from `getBoundingClientRect`) into flow coordinates. Use this with `domNode` and
 * `transform` read from the same RF store in the same render so you never hit the library’s
 * no-op fallback (`screenToFlowPosition` returns the input unchanged if `domNode` is null), which
 * would interpret raw pixel values as flow space and explode the connection preview off-canvas.
 */
export function clientViewportPointToFlowPosition(
  clientX: number,
  clientY: number,
  domNode: HTMLElement,
  transform: ViewportTransform,
  snapToGrid = false,
  snapGrid: readonly [number, number] = [15, 15]
): FlowPoint {
  const { left: domX, top: domY } = domNode.getBoundingClientRect();
  const relX = clientX - domX;
  const relY = clientY - domY;
  const [tx, ty, zoom] = transform;
  const z = zoom === 0 || !Number.isFinite(zoom) ? 1 : zoom;
  let x = (relX - tx) / z;
  let y = (relY - ty) / z;
  if (snapToGrid) {
    const [gx, gy] = snapGrid;
    x = gx * Math.round(x / gx);
    y = gy * Math.round(y / gy);
  }
  return { x, y };
}

/**
 * Handle center in client space → flow space, using the same pipeline as the connection cursor
 * (`toX` / `toY`), without going through `useReactFlow().screenToFlowPosition`.
 */
export function measureHandleFlowPositionWithViewport(
  nodeId: string,
  handleId: string,
  scopeRoot: HTMLElement,
  domNode: HTMLElement,
  transform: ViewportTransform,
  snapToGrid = false,
  snapGrid: readonly [number, number] = [15, 15]
): FlowPoint | null {
  const handleEl = queryHandleElement(scopeRoot, nodeId, handleId);
  if (!handleEl) return null;
  const r = handleEl.getBoundingClientRect();
  return clientViewportPointToFlowPosition(
    r.left + r.width / 2,
    r.top + r.height / 2,
    domNode,
    transform,
    snapToGrid,
    snapGrid
  );
}

function queryHandleElement(
  scopeRoot: DomSearchRoot,
  nodeId: string,
  handleId: string
): HTMLElement | null {
  const root = scopeRoot.querySelector<HTMLElement>(
    `.react-flow__node[data-id="${CSS.escape(nodeId)}"]`
  );
  return (
    root?.querySelector<HTMLElement>(
      `.react-flow__handle[data-handleid="${CSS.escape(handleId)}"]`
    ) ?? null
  );
}

/**
 * Map the handle’s on-screen center to flow coordinates. Does not read/write the cache.
 * Use this while the connection preview is updating so pan/zoom/layout/animations cannot
 * reuse a stale cached point (fixes preview line starting above/below the visible handle).
 */
export function measureHandleFlowPosition(
  nodeId: string,
  handleId: string,
  screenToFlowPosition: (point: { x: number; y: number }) => FlowPoint,
  /** Prefer React Flow’s pane root so we never resolve a handle outside this instance. */
  scopeRoot: DomSearchRoot | null | undefined = document
): FlowPoint | null {
  const root: DomSearchRoot = scopeRoot ?? document;
  const handleEl = queryHandleElement(root, nodeId, handleId);
  if (!handleEl) return null;
  const r = handleEl.getBoundingClientRect();
  return screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
}

export function measureAndCacheHandleFlowPosition(
  nodeId: string,
  handleId: string,
  screenToFlowPosition: (point: { x: number; y: number }) => FlowPoint,
  scopeRoot?: DomSearchRoot | null
): FlowPoint | null {
  const point = measureHandleFlowPosition(nodeId, handleId, screenToFlowPosition, scopeRoot);
  if (point) writeCachedHandleFlowPosition(nodeId, handleId, point);
  return point;
}
