import type { Node } from 'reactflow';

/** Sort key for list image rows: ISO `created_at`, else numeric `timestamp`, else 0. */
export function listImageSortKeyMs(item: { created_at?: unknown; timestamp?: unknown }): number {
  const ca = item.created_at;
  if (typeof ca === 'string' && ca.trim()) {
    const t = Date.parse(ca);
    if (!Number.isNaN(t)) return t;
  }
  const ts = item.timestamp;
  if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
  return 0;
}

export function sortListImageItemsDescending<T extends { id?: unknown }>(images: T[]): T[] {
  return [...images].sort((a, b) => {
    const da = listImageSortKeyMs(a as { created_at?: unknown; timestamp?: unknown });
    const db = listImageSortKeyMs(b as { created_at?: unknown; timestamp?: unknown });
    if (db !== da) return db - da;
    return String(a.id ?? '').localeCompare(String(b.id ?? ''));
  });
}

export function mergeTextAndSortedListImages<T extends { type?: unknown }>(text: T[], images: T[]): T[] {
  return [...text, ...sortListImageItemsDescending(images)];
}

/** Ensure persisted list nodes show images newest-first (text block unchanged). */
export function normalizeListNodeImageItemsInNodeData(node: Node): Node {
  if (node.type !== 'listNode' || !node.data || typeof node.data !== 'object') return node;
  const data = node.data as Record<string, unknown>;
  if (!Array.isArray(data.items)) return node;
  const items = data.items as Array<Record<string, unknown>>;
  const text: typeof items = [];
  const image: typeof items = [];
  for (const it of items) {
    if (String(it.type) === 'text') text.push(it);
    else image.push(it);
  }
  const sorted = sortListImageItemsDescending(image);
  if (sorted.length === image.length && sorted.every((x, i) => x === image[i])) return node;
  return { ...node, data: { ...data, items: [...text, ...sorted] } };
}
