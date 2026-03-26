import type { Edge, Node } from 'reactflow';
import {
  inputContractForHandle,
  resolveOutputContractForEdge,
  type NodeDataflowMergeMode,
  type NodeDataflowPacket,
} from '@/lib/nodePortDataTypes';

export type NodePatchMap = Record<string, Partial<Record<string, unknown>>>;

function mergeTextConcatDedupe(packets: NodeDataflowPacket[]): NodeDataflowPacket | null {
  const parts: string[] = [];
  for (const p of packets) {
    if (p.kind !== 'text') continue;
    const t = p.value.trim();
    if (t) parts.push(t);
  }
  if (parts.length === 0) return null;
  const seen = new Set<string>();
  const deduped = parts.filter((p) => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });
  return { kind: 'text', value: deduped.join('\n\n') };
}

function mergeImageLike(
  packets: NodeDataflowPacket[],
  kind: 'image' | 'video'
): NodeDataflowPacket | null {
  const out: {
    url: string;
    label?: string;
    referer?: string;
    generatedBy?: string;
    timestamp?: number;
    supabaseUrl?: string;
  }[] = [];
  const seen = new Set<string>();
  for (const p of packets) {
    if (p.kind !== kind) continue;
    for (const item of p.value) {
      const url = item.url.trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push({
        url,
        label: item.label?.trim() || undefined,
        ...(kind === 'image' ?
          {
            referer:
              'referer' in item ? String((item as { referer?: string }).referer ?? '').trim() || undefined : undefined,
            generatedBy:
              'generatedBy' in item ?
                String((item as { generatedBy?: string }).generatedBy ?? '').trim() || undefined
              : undefined,
            timestamp:
              'timestamp' in item && typeof (item as { timestamp?: unknown }).timestamp === 'number' ?
                (item as { timestamp?: number }).timestamp
              : undefined,
            supabaseUrl:
              'supabaseUrl' in item ?
                String((item as { supabaseUrl?: string }).supabaseUrl ?? '').trim() || undefined
              : undefined,
          }
        : {}),
      });
    }
  }
  if (out.length === 0) return null;
  return kind === 'image' ? { kind: 'image', value: out } : { kind: 'video', value: out };
}

function mergeLastNonNull(packets: NodeDataflowPacket[]): NodeDataflowPacket | null {
  for (let i = packets.length - 1; i >= 0; i--) {
    const p = packets[i];
    if (p.kind === 'text' && p.value.trim()) return p;
    if ((p.kind === 'image' || p.kind === 'video') && p.value.length > 0) return p;
    if (p.kind === 'generic' && p.value != null) return p;
  }
  return null;
}

function mergeByMode(mode: NodeDataflowMergeMode, packets: NodeDataflowPacket[]): NodeDataflowPacket | null {
  switch (mode) {
    case 'textConcatDedupe':
      return mergeTextConcatDedupe(packets);
    case 'imageListByUrl':
      return mergeImageLike(packets, 'image');
    case 'videoListByUrl':
      return mergeImageLike(packets, 'video');
    case 'lastNonNull':
    default:
      return mergeLastNonNull(packets);
  }
}

function incomingEdgesForTarget(edges: Edge[], targetId: string): Edge[] {
  return edges.filter((e) => e.target === targetId);
}

export function computeNodeInputPatch(node: Node, nodes: Node[], edges: Edge[]): Partial<Record<string, unknown>> | null {
  const incomings = incomingEdgesForTarget(edges, node.id);
  if (incomings.length === 0) return null;

  const byHandle = new Map<string, NodeDataflowPacket[]>();
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  for (const e of incomings) {
    const targetHandle = e.targetHandle ?? 'default';
    const src = nodesById.get(e.source);
    if (!src) continue;
    const outContract = resolveOutputContractForEdge(
      src.type,
      e.sourceHandle,
      node.type,
      e.targetHandle
    );
    if (!outContract) continue;
    const inContract = inputContractForHandle(node.type, targetHandle);
    if (!inContract) continue;
    if (inContract.dataType !== 'generic' && outContract.dataType !== inContract.dataType) continue;
    const packet = outContract.read(src, { nodes });
    if (!packet) continue;
    const list = byHandle.get(targetHandle) ?? [];
    list.push(packet);
    byHandle.set(targetHandle, list);
  }

  const patch: Partial<Record<string, unknown>> = {};
  for (const [targetHandle, packets] of byHandle) {
    const inContract = inputContractForHandle(node.type, targetHandle);
    if (!inContract) continue;
    const merged = mergeByMode(inContract.merge, packets);
    if (!merged) continue;
    const next = inContract.apply(node, merged);
    if (!next) continue;
    Object.assign(patch, next);
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

export function computeReactivePatchesFromSources(
  changedSourceIds: string[],
  nodes: Node[],
  edges: Edge[]
): NodePatchMap {
  const out: NodePatchMap = {};
  if (changedSourceIds.length === 0) return out;

  const visited = new Set<string>();
  const workingNodes = new Map<string, Node>(nodes.map((n) => [n.id, { ...n, data: { ...(n.data ?? {}) } }]));
  const queue = [...new Set(changedSourceIds)];

  while (queue.length > 0) {
    const sourceId = queue.shift()!;
    for (const edge of edges) {
      if (edge.source !== sourceId) continue;
      const targetId = edge.target;
      const targetNode = workingNodes.get(targetId);
      if (!targetNode) continue;
      const patch = computeNodeInputPatch(targetNode, [...workingNodes.values()], edges);
      if (patch && Object.keys(patch).length > 0) {
        out[targetId] = { ...(out[targetId] ?? {}), ...patch };
        workingNodes.set(targetId, {
          ...targetNode,
          data: { ...(targetNode.data ?? {}), ...patch },
        });
      }
      if (!visited.has(targetId)) {
        visited.add(targetId);
        queue.push(targetId);
      }
    }
  }
  return out;
}
