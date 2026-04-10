import type { Edge, Node } from 'reactflow';
import { logicalPortId } from '@/lib/portHandles';
import { mergeTextAndSortedListImages } from '@/lib/listNodeImageSort';
import type { GeneratedImageMeta } from '@/lib/batchImageUpload';

type ListItemRow = {
  id: string;
  type: 'text' | 'image';
  text?: string;
  mediaUrl?: string;
  mediaName?: string;
  referer?: string;
  generatedBy?: string;
  timestamp?: number;
  created_at?: string;
  supabaseUrl?: string;
};

function splitListItems(items: ListItemRow[]): { text: ListItemRow[]; image: ListItemRow[] } {
  const text: ListItemRow[] = [];
  const image: ListItemRow[] = [];
  for (const it of items) {
    if (it.type === 'text') text.push(it);
    else image.push(it);
  }
  return { text, image };
}

/** Edge: image generator → list `image-in` (or default handles that resolve to that flow). */
export function isImageGeneratorToListImageInEdge(
  e: Edge,
  nodes: Node[],
  imageGeneratorNodeId: string
): boolean {
  if (e.source !== imageGeneratorNodeId) return false;
  const target = nodes.find((n) => n.id === e.target);
  if (!target || target.type !== 'listNode') return false;
  const src = logicalPortId(e.sourceHandle);
  const tgt = logicalPortId(e.targetHandle);
  const sourceOk = src === 'image-out' || src === 'default';
  const targetOk = tgt === 'image-in' || tgt === 'default';
  return sourceOk && targetOk;
}

function buildListImageRows(
  urls: string[],
  metaByUrl: Record<string, GeneratedImageMeta>,
  generatedBy: string
): ListItemRow[] {
  const out: ListItemRow[] = [];
  const base = Date.now();
  for (let i = 0; i < urls.length; i++) {
    const url = String(urls[i] ?? '').trim();
    if (!url) continue;
    const m = metaByUrl[url] ?? {};
    const created = m.created_at?.trim();
    const created_at =
      created && !Number.isNaN(Date.parse(created)) ?
        new Date(created).toISOString()
      : new Date(base + i).toISOString();
    const displayUrl = String(m.supabaseUrl ?? '').trim() || url;
    out.push({
      id: crypto.randomUUID(),
      type: 'image',
      mediaUrl: displayUrl,
      mediaName: 'Generated',
      ...(m.referer ? { referer: m.referer } : {}),
      generatedBy,
      timestamp: m.timestamp ?? Date.parse(created_at),
      created_at,
      ...(m.supabaseUrl ? { supabaseUrl: m.supabaseUrl } : {}),
    });
  }
  return out;
}

export interface ListAppendDeps {
  nodes: Node[];
  edges: Edge[];
  updateNodeDataSilent: (id: string, data: Partial<Record<string, unknown>>) => void;
}

/**
 * Appends generated image rows to every `listNode` connected from this image generator via
 * `image-out` → `image-in` (or default handles). New images follow `mergeTextAndSortedListImages`
 * (newest-first among images).
 */
export function appendGeneratedImagesToDownstreamListNodes(
  deps: ListAppendDeps,
  imageGeneratorNodeId: string,
  urls: string[],
  generatedImageMetaByUrl: Record<string, GeneratedImageMeta>
): void {
  if (urls.length === 0) return;
  const targets = deps.edges.filter((e) =>
    isImageGeneratorToListImageInEdge(e, deps.nodes, imageGeneratorNodeId)
  );
  if (targets.length === 0) return;

  const newRows = buildListImageRows(urls, generatedImageMetaByUrl, imageGeneratorNodeId);
  if (newRows.length === 0) return;

  const listIds = [...new Set(targets.map((e) => e.target))];

  for (const listId of listIds) {
    const listNode = deps.nodes.find((n) => n.id === listId);
    if (!listNode || listNode.type !== 'listNode') continue;
    const data = (listNode.data ?? {}) as { items?: unknown };
    const raw = Array.isArray(data.items) ? data.items : [];
    const prev = raw.map((x) => x as ListItemRow);
    const { text, image } = splitListItems(prev);
    const merged = mergeTextAndSortedListImages(text, [...newRows, ...image]);
    deps.updateNodeDataSilent(listId, { items: merged });
  }
}
