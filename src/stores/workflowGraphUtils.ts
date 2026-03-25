import { type Edge, type Node, type XYPosition } from 'reactflow';
import {
  DEFAULT_GROUP_H,
  DEFAULT_GROUP_W,
  DEFAULT_NODE_H,
  DEFAULT_NODE_W,
} from '@/stores/workflowStore.constants';

export function capStack<T>(arr: T[], max: number): T[] {
  return arr.length > max ? arr.slice(-max) : arr;
}

export function bfsDownstream(startId: string, edges: Edge[]): string[][] {
  const adj: Record<string, string[]> = {};
  edges.forEach((e) => {
    if (!adj[e.source]) adj[e.source] = [];
    adj[e.source].push(e.target);
  });
  const levels: string[][] = [[startId]];
  const visited = new Set<string>([startId]);
  let frontier = [startId];
  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const nodeId of frontier) {
      for (const neighbor of adj[nodeId] || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          nextFrontier.push(neighbor);
        }
      }
    }
    if (nextFrontier.length > 0) {
      levels.push(nextFrontier);
      frontier = nextFrontier;
    } else break;
  }
  return levels;
}

export function edgesBetweenLevels(levels: string[][], edges: Edge[]): string[] {
  const allNodes = new Set(levels.flat());
  return edges.filter((e) => allNodes.has(e.source) && allNodes.has(e.target)).map((e) => e.id);
}

export function unionEdgeIdsByRunSource(reg: Record<string, string[]>): Set<string> {
  const out = new Set<string>();
  for (const ids of Object.values(reg)) {
    for (const eid of ids) out.add(eid);
  }
  return out;
}

export function topologicalOrderIdsForTypes(
  nodes: Node[],
  edges: Edge[],
  allowedTypes: Set<string>
): string[] {
  const ids = new Set(nodes.filter((n) => allowedTypes.has(n.type)).map((n) => n.id));
  if (ids.size === 0) return [];

  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const id of ids) {
    indeg.set(id, 0);
    adj.set(id, []);
  }
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }

  const queue = [...ids].filter((id) => indeg.get(id) === 0);
  queue.sort();
  const out: string[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    out.push(u);
    for (const v of adj.get(u) ?? []) {
      const next = (indeg.get(v) ?? 0) - 1;
      indeg.set(v, next);
      if (next === 0) {
        queue.push(v);
        queue.sort();
      }
    }
  }
  if (out.length < ids.size) {
    for (const id of ids) {
      if (!out.includes(id)) out.push(id);
    }
  }
  return out;
}

export function nodeDragSnapshotEqual(a: Node[], b: Node[]): boolean {
  if (a.length !== b.length) return false;
  const mapB = new Map(b.map((n) => [n.id, n]));
  for (const n of a) {
    const m = mapB.get(n.id);
    if (!m) return false;
    if (n.position.x !== m.position.x || n.position.y !== m.position.y) return false;
    if (n.parentId !== m.parentId) return false;
    if (n.extent !== m.extent) return false;
  }
  return true;
}

export function applyGroupDropReparent(nodes: Node[], draggedIds: Set<string>): Node[] {
  const list = nodes.map((n) => {
    const c = { ...n, position: { ...n.position } } as Node;
    delete (c as { positionAbsolute?: unknown }).positionAbsolute;
    return c;
  });
  const byId = new Map(list.map((n) => [n.id, n]));

  const absPos = (n: Node): { x: number; y: number } => {
    const pa = (n as Node & { positionAbsolute?: XYPosition }).positionAbsolute;
    if (pa && typeof pa.x === 'number' && typeof pa.y === 'number') {
      return { x: pa.x, y: pa.y };
    }
    let x = n.position.x;
    let y = n.position.y;
    let pid = n.parentId;
    while (pid) {
      const p = byId.get(pid);
      if (!p) break;
      x += p.position.x;
      y += p.position.y;
      pid = p.parentId;
    }
    return { x, y };
  };

  const groupBounds = (g: Node) => {
    const st = g.style as { width?: number; height?: number } | undefined;
    const w = typeof st?.width === 'number' && st.width > 0 ? st.width : DEFAULT_GROUP_W;
    const h = typeof st?.height === 'number' && st.height > 0 ? st.height : DEFAULT_GROUP_H;
    const p = absPos(g);
    return { x: p.x, y: p.y, w, h };
  };

  const groupArea = (g: Node) => {
    const b = groupBounds(g);
    return b.w * b.h;
  };

  const groups = list.filter((n) => n.type === 'group').sort((a, b) => groupArea(a) - groupArea(b));

  for (const n of list) {
    if (!draggedIds.has(n.id)) continue;
    if (n.type === 'group') continue;
    if (n.draggable === false) continue;

    const abs = absPos(n);
    const w = typeof n.width === 'number' && n.width > 0 ? n.width : DEFAULT_NODE_W;
    const h = typeof n.height === 'number' && n.height > 0 ? n.height : DEFAULT_NODE_H;
    const cx = abs.x + w / 2;
    const cy = abs.y + h / 2;

    let target: Node | null = null;
    for (const g of groups) {
      if (g.id === n.id) continue;
      const b = groupBounds(g);
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
        target = g;
        break;
      }
    }

    if (target) {
      const gAbs = absPos(target);
      if (n.parentId === target.id) continue;
      n.parentId = target.id;
      n.extent = 'parent';
      n.position = { x: abs.x - gAbs.x, y: abs.y - gAbs.y };
    } else if (n.parentId) {
      const p = byId.get(n.parentId);
      if (p?.type === 'group') {
        n.position = { x: abs.x, y: abs.y };
        n.parentId = undefined;
        n.extent = undefined;
      }
    }
  }

  return list;
}
