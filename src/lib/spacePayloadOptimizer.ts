import type { Edge, Node } from 'reactflow';
import type { CanvasSnapshotPayload } from '@/lib/spaceDraftStorage';
import { normalizeImageReferenceUrl } from '@/lib/scoutMediaUrlNormalizer';

/** React Flow UI-only keys — safe to omit from persisted JSON (parity helpers already strip these). */
const STRIP_NODE_KEYS = ['selected', 'dragging', 'resizing', 'positionAbsolute'] as const;
const STRIP_EDGE_KEYS = ['selected'] as const;

export type NodeDataFieldSize = {
  nodeId: string;
  path: string;
  bytes: number;
};

function stripNodeForRemoteSave(n: Node): Node {
  const o = structuredClone(n) as Record<string, unknown>;
  for (const k of STRIP_NODE_KEYS) {
    delete o[k];
  }
  return o as Node;
}

function stripEdgeForRemoteSave(e: Edge): Edge {
  const o = structuredClone(e) as Record<string, unknown>;
  for (const k of STRIP_EDGE_KEYS) {
    delete o[k];
  }
  return o as Edge;
}

/**
 * Clone snapshot and strip transient RF fields so payloads are smaller and stable on the wire.
 */
export function sanitizeSnapshotForRemoteSave(payload: CanvasSnapshotPayload): CanvasSnapshotPayload {
  return {
    nodes: payload.nodes.map(stripNodeForRemoteSave),
    edges: payload.edges.map(stripEdgeForRemoteSave),
    comments: structuredClone(payload.comments),
    settings: structuredClone(payload.settings),
    node_grid_layouts: structuredClone(payload.node_grid_layouts),
    viewport: payload.viewport ? { ...payload.viewport } : payload.viewport,
  };
}

export function estimateSnapshotBytes(payload: CanvasSnapshotPayload): number {
  try {
    return new TextEncoder().encode(JSON.stringify(payload)).length;
  } catch {
    return 0;
  }
}

/**
 * Top string fields by UTF-8 size under `node.data` (helps find base64 blobs).
 */
export function listLargestNodeDataFields(nodes: Node[], topN = 15): NodeDataFieldSize[] {
  const rows: NodeDataFieldSize[] = [];

  function walk(value: unknown, path: string, nodeId: string) {
    if (value == null) return;
    if (typeof value === 'string') {
      const bytes = new TextEncoder().encode(value).length;
      rows.push({ nodeId, path: path || '(root)', bytes });
      return;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return;
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`, nodeId));
      return;
    }
    if (typeof value === 'object') {
      for (const k of Object.keys(value as object)) {
        walk((value as Record<string, unknown>)[k], path ? `${path}.${k}` : k, nodeId);
      }
    }
  }

  for (const n of nodes) {
    if (!n.data || typeof n.data !== 'object') continue;
    walk(n.data, '', n.id);
  }

  rows.sort((a, b) => b.bytes - a.bytes);
  return rows.slice(0, topN);
}

function needsRemoteMediaNormalization(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (t.startsWith('blob:')) return true;
  if (t.startsWith('data:image/')) return true;
  return false;
}

async function normalizeUnknownJsonValue(value: unknown): Promise<unknown> {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (!needsRemoteMediaNormalization(value)) return value;
    try {
      return await normalizeImageReferenceUrl(value);
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value) {
      out.push(await normalizeUnknownJsonValue(item));
    }
    return out;
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const k of Object.keys(o)) {
      next[k] = await normalizeUnknownJsonValue(o[k]);
    }
    return next;
  }
  return value;
}

/**
 * Upload blob: and data:image* strings inside node `data` to workflow storage; replace with https URLs.
 * Leaves values unchanged on failure so saves can still proceed with original data.
 */
export async function normalizeSnapshotMediaForRemoteSave(
  payload: CanvasSnapshotPayload
): Promise<CanvasSnapshotPayload> {
  const nodes: Node[] = [];
  for (const n of payload.nodes) {
    const data = n.data != null && typeof n.data === 'object' ? await normalizeUnknownJsonValue(n.data) : n.data;
    nodes.push({ ...n, data: data as Record<string, unknown> });
  }
  return { ...payload, nodes };
}

/** Postgres `query_canceled` / statement timeout (Supabase often surfaces `57014`). */
export function isPostgresStatementTimeoutError(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  if (e?.code === '57014') return true;
  const m = typeof e?.message === 'string' ? e.message : '';
  return /statement timeout|57014/i.test(m);
}
