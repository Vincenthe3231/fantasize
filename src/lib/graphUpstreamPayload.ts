import type { Node } from 'reactflow';
import { effectiveScoutPropSlots, plainTextFromHtml } from '@/lib/scoutPipeline';
import { richTextToPlainForScout } from '@/lib/richTextForScout';
import type { NodeDataflowPacket } from '@/lib/nodePortDataTypes';

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url);
}

function uploadMediaUrl(n: Node): string {
  const d = n.data as { mediaUrl?: string; media_url?: string };
  return String(d?.mediaUrl?.trim() || d?.media_url?.trim() || '');
}

function uploadLabelText(n: Node): string {
  const d = n.data as { labelText?: string; label?: string; title?: string };
  return String(d?.labelText ?? d?.label ?? d?.title ?? '').trim();
}

function isPlacementRefImageUrl(url: string): boolean {
  const u = url.trim();
  if (!u || u.startsWith('blob:') || !/^https?:\/\//i.test(u)) return false;
  if (isVideoUrl(u)) return false;
  return true;
}

/** Join non-empty unique text parts (order preserved). */
export function mergeTextPartsDedupe(parts: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.join('\n\n');
}

/** Matches ListNode `data.items` entries. */
type ListNodeItem = {
  type?: string;
  text?: string;
  mediaUrl?: string;
  mediaName?: string;
  referer?: string;
  generatedBy?: string;
  timestamp?: number;
  created_at?: string;
  supabaseUrl?: string;
};

/** Plain text from listNode `items` (text rows only, array order, then deduped like group merge). */
export function listNodeTextFromNode(n: Node): string {
  if (n.type !== 'listNode') return '';
  return mergeTextPartsDedupe(listNodeTextItemsFromNode(n));
}

/** Ordered non-empty text cells from ListNode items (no dedupe, no merge). */
export function listNodeTextItemsFromNode(n: Node): string[] {
  if (n.type !== 'listNode') return [];
  const items = ((n.data as { items?: ListNodeItem[] })?.items ?? []) as ListNodeItem[];
  const out: string[] = [];
  for (const it of items) {
    if (it.type !== 'text') continue;
    const t = String(it.text ?? '').trim();
    if (t) out.push(t);
  }
  return out;
}

/** Text from a single non-group node (assistant / IG / text / placement). */
export function leafTextFromNode(n: Node): string {
  if (n.type === 'textNode') {
    const c = String((n.data as { content?: string })?.content ?? '');
    return plainTextFromHtml(c);
  }
  if (n.type === 'placementRefNode') {
    const html = String((n.data as { placementText?: string })?.placementText ?? '');
    return plainTextFromHtml(html);
  }
  if (n.type === 'assistantNode') {
    const d = n.data as {
      refinedPrompt?: string;
      result?: string;
      prompt?: string;
      wiredTextFromEdges?: string;
    };
    const refined = String(d?.refinedPrompt ?? '').trim();
    if (refined) return refined;
    const result = String(d?.result ?? '').trim();
    if (result) return result;
    const wired = String(d?.wiredTextFromEdges ?? '').trim();
    const promptPlain = richTextToPlainForScout(String(d?.prompt ?? '')).trim();
    return mergeTextPartsDedupe([wired, promptPlain].filter(Boolean));
  }
  if (n.type === 'imageGeneratorNode') {
    return richTextToPlainForScout(String((n.data as { prompt?: string })?.prompt ?? ''));
  }
  if (n.type === 'listNode') {
    return listNodeTextFromNode(n);
  }
  return '';
}

function aggregateGroupTextString(groupId: string, nodes: Node[]): string {
  const children = nodes
    .filter((x) => x.parentId === groupId)
    .sort((a, b) => a.id.localeCompare(b.id));
  const parts: string[] = [];
  for (const c of children) {
    if (c.type === 'group') parts.push(aggregateGroupTextString(c.id, nodes));
    else parts.push(leafTextFromNode(c));
  }
  return mergeTextPartsDedupe(parts);
}

/**
 * Plain text extractable from a node for graph edges (assistant, image generator, group aggregate).
 */
export function upstreamTextFromNode(n: Node | undefined, nodes: Node[]): string {
  if (!n) return '';
  if (n.type === 'group') return aggregateGroupTextString(n.id, nodes);
  return leafTextFromNode(n);
}

export type UpstreamMediaItem = {
  url: string;
  label?: string;
  referer?: string;
  generatedBy?: string;
  timestamp?: number;
  created_at?: string;
  supabaseUrl?: string;
};

/** Non-video image URLs from listNode `items` (newest-first: `created_at` / `timestamp`). */
export function listNodeImageItemsFromNode(n: Node): UpstreamMediaItem[] {
  if (n.type !== 'listNode') return [];
  const items = ((n.data as { items?: ListNodeItem[] })?.items ?? []) as ListNodeItem[];
  const out: UpstreamMediaItem[] = [];
  for (const it of items) {
    if (it.type !== 'image') continue;
    const url = String(it.mediaUrl ?? '').trim();
    if (!url || isVideoUrl(url)) continue;
    const label = String(it.mediaName ?? '').trim() || undefined;
    const referer = String(it.referer ?? '').trim() || undefined;
    const generatedBy = String(it.generatedBy ?? '').trim() || undefined;
    const timestamp = typeof it.timestamp === 'number' ? it.timestamp : undefined;
    const createdRaw = String(it.created_at ?? '').trim();
    const created_at =
      createdRaw && !Number.isNaN(Date.parse(createdRaw)) ? new Date(createdRaw).toISOString() : undefined;
    const supabaseUrl = String(it.supabaseUrl ?? '').trim() || undefined;
    out.push({
      url,
      label,
      ...(referer ? { referer } : {}),
      ...(generatedBy ? { generatedBy } : {}),
      ...(timestamp ? { timestamp } : {}),
      ...(created_at ? { created_at } : {}),
      ...(supabaseUrl ? { supabaseUrl } : {}),
    });
  }
  return out;
}

/** Image-like URLs from one non-group node (no recursion into child groups). */
export function leafImageItemsFromNode(n: Node): UpstreamMediaItem[] {
  if (n.type === 'listNode') {
    return listNodeImageItemsFromNode(n);
  }
  if (n.type === 'uploadNode') {
    const url = uploadMediaUrl(n);
    if (!url || isVideoUrl(url)) return [];
    return [{ url, label: uploadLabelText(n) || undefined }];
  }
  if (n.type === 'imageGeneratorNode') {
    const d = (n.data ?? {}) as {
      generatedUrl?: string;
      generatedUrls?: string[];
      labelText?: string;
      generatedImageMetaByUrl?: Record<
        string,
        { referer?: string; generatedBy?: string; timestamp?: number; created_at?: string; supabaseUrl?: string }
      >;
    };
    const urls = [
      ...(Array.isArray(d.generatedUrls) ? d.generatedUrls.map((u) => String(u ?? '').trim()) : []),
      String(d.generatedUrl ?? '').trim(),
    ].filter(Boolean);
    if (urls.length === 0) return [];
    const label = String(d.labelText ?? '').trim() || undefined;
    const metaByUrl = d.generatedImageMetaByUrl ?? {};
    const unique = [...new Set(urls)];
    return unique.map((url) => ({ url, label, ...(metaByUrl[url] ?? {}) }));
  }
  if (n.type === 'propsInputNode') {
    const slots = effectiveScoutPropSlots((n.data ?? {}) as Record<string, unknown>);
    const out: UpstreamMediaItem[] = [];
    for (const p of slots) {
      if (!p.label?.trim() || !p.src?.trim()) continue;
      const url = p.src.trim();
      if (isVideoUrl(url)) continue;
      out.push({ url, label: p.label.trim() });
    }
    return out;
  }
  if (n.type === 'placementRefNode') {
    const url = String((n.data as { placementRefUrl?: string })?.placementRefUrl ?? '').trim();
    if (!url || !isPlacementRefImageUrl(url)) return [];
    return [{ url }];
  }
  if (n.type === 'assistantNode') {
    const d = n.data as { generatedUrl?: string; referenceUrl?: string; mediaUrl?: string };
    const urls = [
      String(d.generatedUrl ?? '').trim(),
      String(d.referenceUrl ?? '').trim(),
      String(d.mediaUrl ?? '').trim(),
    ].filter((u) => u && !isVideoUrl(u));
    if (urls.length === 0) return [];
    return [{ url: urls[0]! }];
  }
  return [];
}

function leafVideoItemsFromNode(n: Node): UpstreamMediaItem[] {
  if (n.type === 'uploadNode') {
    const url = uploadMediaUrl(n);
    if (!url || !isVideoUrl(url)) return [];
    return [{ url, label: uploadLabelText(n) || undefined }];
  }
  if (n.type === 'videoGeneratorNode') {
    const url = String((n.data as { videoUrl?: string })?.videoUrl ?? '').trim();
    if (!url) return [];
    return [{ url }];
  }
  return [];
}

function aggregateGroupImageItems(groupId: string, nodes: Node[]): UpstreamMediaItem[] {
  const children = nodes
    .filter((x) => x.parentId === groupId)
    .sort((a, b) => a.id.localeCompare(b.id));
  const out: UpstreamMediaItem[] = [];
  const seen = new Set<string>();
  for (const c of children) {
    const items = c.type === 'group' ? aggregateGroupImageItems(c.id, nodes) : leafImageItemsFromNode(c);
    for (const it of items) {
      const u = it.url.trim();
      if (!u || seen.has(u)) continue;
      seen.add(u);
      out.push(it);
    }
  }
  return out;
}

function aggregateGroupVideoItems(groupId: string, nodes: Node[]): UpstreamMediaItem[] {
  const children = nodes
    .filter((x) => x.parentId === groupId)
    .sort((a, b) => a.id.localeCompare(b.id));
  const out: UpstreamMediaItem[] = [];
  const seen = new Set<string>();
  for (const c of children) {
    const items = c.type === 'group' ? aggregateGroupVideoItems(c.id, nodes) : leafVideoItemsFromNode(c);
    for (const it of items) {
      const u = it.url.trim();
      if (!u || seen.has(u)) continue;
      seen.add(u);
      out.push(it);
    }
  }
  return out;
}

/**
 * All image (non-video) URLs from a node or aggregated from a group's children.
 */
export function upstreamImageItemsFromNode(n: Node | undefined, nodes: Node[]): UpstreamMediaItem[] {
  if (!n) return [];
  if (n.type === 'group') return aggregateGroupImageItems(n.id, nodes);
  return leafImageItemsFromNode(n);
}

export function upstreamVideoItemsFromNode(n: Node | undefined, nodes: Node[]): UpstreamMediaItem[] {
  if (!n) return [];
  if (n.type === 'group') return aggregateGroupVideoItems(n.id, nodes);
  return leafVideoItemsFromNode(n);
}

/** First image-like media from a node (assistant-style single edge). */
export function upstreamPrimaryImageMedia(n: Node | undefined, nodes: Node[]): UpstreamMediaItem | null {
  const items = upstreamImageItemsFromNode(n, nodes);
  return items[0] ?? null;
}

/** First video-like media from a node. */
export function upstreamPrimaryVideoMedia(n: Node | undefined, nodes: Node[]): UpstreamMediaItem | null {
  const items = upstreamVideoItemsFromNode(n, nodes);
  return items[0] ?? null;
}

/**
 * Single primary media URL for assistant-style edges (upload video allowed; props first slot only).
 * For groups: first aggregated image, else first aggregated video.
 */
export function upstreamPrimaryMediaLikeAssistant(n: Node | undefined, nodes: Node[]): UpstreamMediaItem | null {
  if (!n) return null;
  if (n.type === 'group') {
    const imgs = aggregateGroupImageItems(n.id, nodes);
    if (imgs.length > 0) return imgs[0]!;
    const vids = aggregateGroupVideoItems(n.id, nodes);
    return vids[0] ?? null;
  }
  if (n.type === 'uploadNode') {
    const url = uploadMediaUrl(n);
    if (!url) return null;
    return { url, label: uploadLabelText(n) || undefined };
  }
  if (n.type === 'imageGeneratorNode') {
    const d = (n.data ?? {}) as { generatedUrl?: string; generatedUrls?: string[] };
    const url =
      (Array.isArray(d.generatedUrls) ? d.generatedUrls.map((u) => String(u ?? '').trim()).find(Boolean) : '') ||
      String(d.generatedUrl ?? '').trim();
    if (!url) return null;
    const label = String((n.data as { labelText?: string })?.labelText ?? '').trim() || undefined;
    return { url, label };
  }
  if (n.type === 'propsInputNode') {
    const slots = effectiveScoutPropSlots((n.data ?? {}) as Record<string, unknown>);
    const first = slots.find((p) => p.label?.trim() && p.src?.trim());
    if (!first) return null;
    return { url: first.src!.trim(), label: first.label!.trim() };
  }
  if (n.type === 'listNode') {
    const items = listNodeImageItemsFromNode(n);
    return items[0] ?? null;
  }
  return null;
}

/**
 * Merged packet for a group's `group-out-text` / `group-out-image` / `group-out-video` handle.
 */
export function aggregateGroupOutputPacket(
  groupNode: Node,
  nodes: Node[],
  outKind: 'text' | 'image' | 'video'
): NodeDataflowPacket | null {
  if (groupNode.type !== 'group') return null;
  if (outKind === 'text') {
    const s = aggregateGroupTextString(groupNode.id, nodes).trim();
    if (!s) return null;
    return { kind: 'text', value: s };
  }
  if (outKind === 'image') {
    const items = aggregateGroupImageItems(groupNode.id, nodes);
    if (items.length === 0) return null;
    return { kind: 'image', value: items };
  }
  const items = aggregateGroupVideoItems(groupNode.id, nodes);
  if (items.length === 0) return null;
  return { kind: 'video', value: items };
}
