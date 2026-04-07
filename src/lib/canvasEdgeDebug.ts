/**
 * Dev-only canvas / edge instrumentation.
 *
 * `?canvasEdgeDebug=1` — while dragging a new connection, logs **one** `[canvas-edge-debug] connection+audit`
 * message per gesture: React Flow `fromX`/`fromY` vs DOM-measured source, target `toX`/`toY`, and the same
 * full audit snapshot (Zustand vs RF internals vs DOM handles) as before.
 *
 * No separate flags, intervals, move-end spam, or `window` hooks.
 */
import { internalsSymbol } from 'reactflow';
import type { Node } from 'reactflow';

function truthyParam(searchParams: URLSearchParams, key: string): boolean {
  const v = searchParams.get(key)?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function isCanvasEdgeDebugEnabled(searchParams: URLSearchParams): boolean {
  return truthyParam(searchParams, 'canvasEdgeDebug');
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

/** Same payload shape as the historical standalone audit log. */
export function buildCanvasEdgeAuditPayload(opts: {
  tag: string;
  nodeId: string;
  rfGetState: RfGetState;
  workflowNodes: Node[];
}): Record<string, unknown> {
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

  return {
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
    nodeScreenRect: nodeRect
      ? { x: nodeRect.x, y: nodeRect.y, w: nodeRect.width, h: nodeRect.height }
      : null,
    handlesDom,
  };
}

/**
 * Single console message: `connectionLineComponent` source (RF vs DOM) + full audit at the same moment.
 */
export function logCanvasEdgeConnectionAndAudit(opts: {
  tag: string;
  nodeId: string;
  rfGetState: RfGetState;
  workflowNodes: Node[];
  connectionLine: {
    fromRf: { x: number; y: number };
    fromMeasured: { x: number; y: number };
    to: { x: number; y: number };
    measureSucceeded: boolean;
    domNodePresent: boolean;
    transform: [number, number, number];
  };
}): void {
  if (!import.meta.env.DEV) return;
  const audit = buildCanvasEdgeAuditPayload({
    tag: opts.tag,
    nodeId: opts.nodeId,
    rfGetState: opts.rfGetState,
    workflowNodes: opts.workflowNodes,
  });
  const { fromRf, fromMeasured } = opts.connectionLine;
  console.log('%c[canvas-edge-debug] connection+audit', 'color:#22d3ee;font-weight:bold', {
    tag: opts.tag,
    ts: new Date().toISOString(),
    connectionLine: {
      ...opts.connectionLine,
      fromRfVsMeasured: {
        dx: fromMeasured.x - fromRf.x,
        dy: fromMeasured.y - fromRf.y,
      },
    },
    audit,
  });
}
