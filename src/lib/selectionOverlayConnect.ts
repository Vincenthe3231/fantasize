import type { Edge, Node } from 'reactflow';
import {
  handlesCompatible,
  isTargetHandleOccupied,
  validateScoutConnection,
} from '@/lib/scoutPipeline';
import { aggregatePortTypesForChildTypes } from '@/lib/nodePortDataTypes';
import { getNodeTypeDisplayLabel } from '@/lib/groupInsertableNodes';
import type { NodeType } from '@/stores/workflowStore';
import { makeWorkflowEdge, scopedPortHandle } from '@/lib/portHandles';

const DEFAULT_GROUP_IN_TYPES = ['text', 'image'] as const;

export function formatCanvasNodeLabelForConnect(n: Node): string {
  const d = (n.data ?? {}) as Record<string, unknown>;
  const labelText = typeof d.labelText === 'string' && d.labelText.trim() ? d.labelText.trim() : '';
  const title = typeof d.title === 'string' && d.title.trim() ? d.title.trim() : '';
  if (labelText) return labelText;
  if (title) return title;
  return getNodeTypeDisplayLabel(n.type as NodeType);
}

/** Output logical port ids per node type (order = preference when multiple match a target). */
export function listLogicalSourcePorts(nodeType: string | undefined): string[] {
  if (nodeType === 'videoGeneratorNode') {
    return ['text-out', 'image-out', 'video-out'];
  }
  return ['text-out', 'image-out'];
}

export type TargetPortOption = { logicalId: string; label: string };

/** Target inputs actually rendered for each node kind (must stay in sync with canvas nodes). */
export function listLogicalTargetPorts(node: Node, allNodes: Node[]): TargetPortOption[] {
  const t = node.type;
  if (t === 'setDressingNode') {
    return [
      { logicalId: 'text-in', label: 'Text' },
      { logicalId: 'image-in', label: 'Image' },
      { logicalId: 'location-in', label: 'Location (image)' },
      { logicalId: 'placement-in', label: 'Placement (text)' },
      { logicalId: 'props-in', label: 'Props (image)' },
      { logicalId: 'scene-in', label: 'Scene (generic)' },
    ];
  }
  if (t === 'group') {
    const children = allNodes.filter((n) => n.parentId === node.id && n.type !== 'group');
    const dts = aggregatePortTypesForChildTypes(children.map((c) => String(c.type)));
    const types = dts.length > 0 ? dts : [...DEFAULT_GROUP_IN_TYPES];
    return types.map((dt) => ({
      logicalId: `group-in-${dt}`,
      label:
        dt === 'text' ? 'Text' : dt === 'image' ? 'Image' : dt === 'video' ? 'Video' : 'Generic',
    }));
  }
  return [
    { logicalId: 'text-in', label: 'Text' },
    { logicalId: 'image-in', label: 'Image' },
  ];
}

function pickSourceLogicalForTarget(sourceType: string | undefined, targetLogical: string): string | null {
  const candidates = listLogicalSourcePorts(sourceType);
  const compat = candidates.filter((s) => handlesCompatible(s, targetLogical));
  if (compat.length === 0) return null;
  const order = listLogicalSourcePorts(sourceType);
  for (const o of order) {
    if (compat.includes(o)) return o;
  }
  return compat[0]!;
}

export type ViableTargetPort = TargetPortOption & { sourceLogical: string };

/** Target ports that accept an edge from `source` and have a free handle (same rules as drag-connect). */
export function listViableTargetPorts(
  source: Node,
  target: Node,
  edges: Edge[],
  allNodes: Node[]
): ViableTargetPort[] {
  const out: ViableTargetPort[] = [];
  for (const { logicalId, label } of listLogicalTargetPorts(target, allNodes)) {
    const scopedT = scopedPortHandle(target.id, logicalId);
    if (isTargetHandleOccupied(edges, target.id, scopedT)) continue;
    const sourceLogical = pickSourceLogicalForTarget(source.type, logicalId);
    if (sourceLogical == null) continue;
    if (!handlesCompatible(sourceLogical, logicalId)) continue;
    const conn = {
      source: source.id,
      target: target.id,
      sourceHandle: scopedPortHandle(source.id, sourceLogical),
      targetHandle: scopedT,
    };
    if (!validateScoutConnection(conn, edges).ok) continue;
    out.push({ logicalId, label, sourceLogical });
  }
  return out;
}

export function resolveConnectSourceNode(
  selectedNodes: Node[],
  focusedNodeContentId: string | null,
  allNodes: Node[],
  selectedIds: Set<string>
): Node | null {
  const byId = new Map(allNodes.map((n) => [n.id, n]));
  const under = (id: string) => {
    let cur: Node | undefined = byId.get(id);
    while (cur) {
      if (selectedIds.has(cur.id)) return true;
      const pid = cur.parentId;
      if (!pid) return false;
      cur = byId.get(pid);
    }
    return false;
  };

  if (focusedNodeContentId) {
    const n = byId.get(focusedNodeContentId);
    if (n && n.type !== 'group' && under(focusedNodeContentId)) return n;
  }

  const nonGroupSelected = selectedNodes.filter((n) => n.type !== 'group');
  if (nonGroupSelected.length === 1) return nonGroupSelected[0]!;
  return null;
}

export function buildConnectEdge(source: Node, target: Node, targetLogical: string, sourceLogical: string) {
  return makeWorkflowEdge(source.id, target.id, sourceLogical, targetLogical);
}
