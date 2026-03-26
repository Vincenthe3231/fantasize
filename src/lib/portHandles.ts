import type { Edge } from 'reactflow';

/** Delimiter between React Flow node id and logical port name on the wire. */
export const SCOPED_PORT_SEP = '|vf|';

export function scopedPortHandle(nodeId: string, logicalPort: string): string {
  return `${nodeId}${SCOPED_PORT_SEP}${logicalPort}`;
}

/** Logical port id for contracts, scout, and dataflow (`text-in`, …). Legacy edges omit the prefix. */
export function logicalPortId(handleId: string | null | undefined): string {
  if (handleId == null || handleId === '') return 'default';
  const i = handleId.indexOf(SCOPED_PORT_SEP);
  if (i === -1) return handleId;
  const tail = handleId.slice(i + SCOPED_PORT_SEP.length);
  return tail || 'default';
}

/** One-time normalization: legacy `sourceHandle`/`targetHandle` → node-scoped ids for React Flow. */
export function migrateEdgesToScopedHandles(edges: Edge[]): Edge[] {
  return edges.map((e) => {
    let next: Edge = e;
    if (e.sourceHandle && !e.sourceHandle.includes(SCOPED_PORT_SEP)) {
      next = { ...next, sourceHandle: scopedPortHandle(e.source, e.sourceHandle) };
    }
    if (e.targetHandle && !e.targetHandle.includes(SCOPED_PORT_SEP)) {
      next = { ...next, targetHandle: scopedPortHandle(e.target, e.targetHandle) };
    }
    return next;
  });
}

export function edgeHandleForNode(nodeId: string, handle: string | null | undefined): string | undefined {
  if (handle == null || handle === '') return undefined;
  if (handle.includes(SCOPED_PORT_SEP)) return handle;
  return scopedPortHandle(nodeId, handle);
}

export function makeWorkflowEdge(
  source: string,
  target: string,
  sourceHandle?: string | null,
  targetHandle?: string | null
): Edge {
  return {
    id: `e-${source}-${target}-${Date.now()}`,
    source,
    target,
    sourceHandle: edgeHandleForNode(source, sourceHandle),
    targetHandle: edgeHandleForNode(target, targetHandle),
    type: 'custom',
  };
}
