/// <reference path="./env.d.ts" />
/**
 * Multimodal user message parts for Stage 2 instructions (OpenRouter chat format).
 * Shapes align with @openrouter/sdk ChatMessageContentItem (plain JSON for Deno).
 *
 * Structured canvas context is encoded with `@toon-format/toon` in a single text part (fewer
 * tokens than markdown sections). Image/video parts follow in ascending `slot` order.
 *
 * Payload is intentionally bounded (image/video caps, text truncation, `detail: low` by default)
 * to reduce OpenRouter/Cloudflare worker load on large Scout graphs.
 */

import { encode } from '@toon-format/toon';

export type Stage2MultimodalPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; imageUrl: { url: string; detail?: 'auto' | 'low' | 'high' } }
  | { type: 'video_url'; videoUrl: { url: string } };

type ImageDetail = 'auto' | 'low' | 'high';

function envString(key: string, defaultValue: string): string {
  if (typeof Deno !== 'undefined' && typeof Deno.env?.get === 'function') {
    return Deno.env.get(key) ?? defaultValue;
  }
  return defaultValue;
}

function envInt(key: string, defaultValue: number): number {
  const raw =
    typeof Deno !== 'undefined' && typeof Deno.env?.get === 'function' ? Deno.env.get(key) : undefined;
  const n = raw != null ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : defaultValue;
}

function parseImageDetail(raw: string): ImageDetail {
  const s = raw.trim().toLowerCase();
  if (s === 'low' || s === 'high' || s === 'auto') return s;
  return 'low';
}

/**
 * Defaults are conservative to avoid OpenRouter/Cloudflare "Worker exceeded resource limits" (503)
 * on large multimodal payloads. Raise via Supabase `scout-execute` secrets if needed.
 */
export function getStage2ContentLimits() {
  return {
    maxImageParts: envInt('STAGE2_MAX_IMAGE_PARTS', 6),
    maxVideoParts: envInt('STAGE2_MAX_VIDEO_PARTS', 2),
    maxPlacementChars: envInt('STAGE2_MAX_PLACEMENT_CHARS', 5000),
    maxUserPromptChars: envInt('STAGE2_MAX_USER_PROMPT_CHARS', 2500),
    maxEdgeTextChars: envInt('STAGE2_MAX_EDGE_TEXT_CHARS', 2500),
    imageDetail: parseImageDetail(envString('STAGE2_IMAGE_DETAIL', 'low')),
  };
}

function truncateText(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 24)) + '\n…[truncated]';
}

type MediaBudget = { imagesLeft: number; videosLeft: number };

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url);
}

function isBlobUrl(url: string): boolean {
  return url.startsWith('blob:');
}

function isProbablyHttp(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** Placement board / reference: treat as image if HTTPS and not a video file. */
export function isPlacementRefImageUrl(url: string): boolean {
  if (!url.trim() || isBlobUrl(url) || !isProbablyHttp(url)) return false;
  if (isVideoUrl(url)) return false;
  return true;
}

type EdgeInputRaw = {
  kind?: string;
  edgeId?: string;
  sourceNodeId?: string;
  sourceType?: string;
  text?: string;
  url?: string;
  label?: string;
};

function parseEdgeInputs(context: Record<string, unknown>): EdgeInputRaw[] {
  const raw = context.edgeInputs;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is EdgeInputRaw => x != null && typeof x === 'object');
}

type EdgeTextRow = {
  edgeId: string;
  sourceNodeId: string;
  sourceType: string;
  text: string;
};

type AttachmentRow = {
  slot: number;
  section: 'edge' | 'placementRef' | 'location' | 'prop';
  kind: 'image' | 'video';
  edgeId: string;
  sourceNodeId: string;
  sourceType: string;
  label: string;
};

const STAGE2_TOON_INTRO =
  'Virtual production scout — Stage 2 instructions.\nCanvas below uses TOON (Token-Oriented Object Notation). The following message parts are image_url / video_url attachments in ascending `slot` order (see `attachments`).\n\n';

/**
 * Build multimodal content from the JSON context produced by the app resolver.
 * Order: edgeInputs first (edge-first), then Stage 1 placement / ref / locations / props with URL dedupe.
 * One TOON text block replaces verbose markdown headers to reduce LLM tokens.
 */
export function buildStage2InstructionsContent(context: Record<string, unknown>): Stage2MultimodalPart[] {
  const limits = getStage2ContentLimits();
  const edgeUrls = new Set<string>();
  const budget: MediaBudget = { imagesLeft: limits.maxImageParts, videosLeft: limits.maxVideoParts };
  const detail = limits.imageDetail;

  const edgeTexts: EdgeTextRow[] = [];
  const attachments: AttachmentRow[] = [];
  const mediaQueue: { kind: 'image' | 'video'; url: string }[] = [];
  let slot = 1;

  const pushEdgeHint = (e: EdgeInputRaw) => ({
    edgeId: String(e.edgeId ?? ''),
    sourceNodeId: String(e.sourceNodeId ?? ''),
    sourceType: String(e.sourceType ?? 'node'),
  });

  for (const e of parseEdgeInputs(context)) {
    const edgeHint = e.edgeId ? `edge ${e.edgeId}` : 'edge';
    const meta = pushEdgeHint(e);

    if (e.kind === 'text') {
      const text = truncateText(String(e.text ?? '').trim(), limits.maxEdgeTextChars);
      if (!text) continue;
      edgeTexts.push({
        edgeId: meta.edgeId,
        sourceNodeId: meta.sourceNodeId,
        sourceType: meta.sourceType,
        text,
      });
      continue;
    }

    if (e.kind === 'image') {
      const url = String(e.url ?? '').trim();
      if (!url) continue;
      if (isBlobUrl(url)) {
        console.warn('[scout-execute] Skipping blob: URL on edge input (not reachable from edge).');
        continue;
      }
      if (edgeUrls.has(url)) {
        console.warn('[scout-execute] Skipping duplicate edge image URL (already in payload).', edgeHint);
        continue;
      }
      if (budget.imagesLeft <= 0) {
        console.warn('[scout-execute] Stage2 image budget exhausted; skipping edge image.', edgeHint);
        continue;
      }
      edgeUrls.add(url);
      const label = String(e.label ?? '').trim();
      attachments.push({
        slot,
        section: 'edge',
        kind: 'image',
        edgeId: meta.edgeId,
        sourceNodeId: meta.sourceNodeId,
        sourceType: meta.sourceType,
        label,
      });
      mediaQueue.push({ kind: 'image', url });
      slot++;
      budget.imagesLeft--;
      continue;
    }

    if (e.kind === 'video') {
      const url = String(e.url ?? '').trim();
      if (!url) continue;
      if (isBlobUrl(url)) {
        console.warn('[scout-execute] Skipping blob: video URL on edge input.');
        continue;
      }
      if (edgeUrls.has(url)) {
        console.warn('[scout-execute] Skipping duplicate edge video URL (already in payload).', edgeHint);
        continue;
      }
      if (budget.videosLeft <= 0) {
        console.warn('[scout-execute] Stage2 video budget exhausted; skipping edge video.', edgeHint);
        continue;
      }
      edgeUrls.add(url);
      const label = String(e.label ?? '').trim();
      attachments.push({
        slot,
        section: 'edge',
        kind: 'video',
        edgeId: meta.edgeId,
        sourceNodeId: meta.sourceNodeId,
        sourceType: meta.sourceType,
        label,
      });
      mediaQueue.push({ kind: 'video', url });
      slot++;
      budget.videosLeft--;
    }
  }

  const placementAndNotes = truncateText(String(context.placementAndNotes ?? ''), limits.maxPlacementChars);

  const placementRefImageUrl = context.placementRefImageUrl ? String(context.placementRefImageUrl) : '';
  if (
    placementRefImageUrl &&
    !edgeUrls.has(placementRefImageUrl) &&
    isPlacementRefImageUrl(placementRefImageUrl) &&
    !isBlobUrl(placementRefImageUrl)
  ) {
    if (budget.imagesLeft <= 0) {
      console.warn('[scout-execute] Stage2 image budget exhausted; skipping placement reference image.');
    } else {
      attachments.push({
        slot,
        section: 'placementRef',
        kind: 'image',
        edgeId: '',
        sourceNodeId: '',
        sourceType: '',
        label: '',
      });
      mediaQueue.push({ kind: 'image', url: placementRefImageUrl });
      edgeUrls.add(placementRefImageUrl);
      slot++;
      budget.imagesLeft--;
    }
  }

  const locationImages = (
    context.locationImages as
      | Array<{ url?: string; label?: string; mediaKind?: 'image' | 'video' }>
      | undefined
  ) ?? [];

  for (const loc of locationImages) {
    const url = String(loc?.url ?? '').trim();
    if (!url || edgeUrls.has(url)) continue;
    if (isBlobUrl(url)) {
      console.warn('[scout-execute] Skipping blob: URL (not reachable from edge). Upload to storage for LLM access.');
      continue;
    }
    const label = String(loc?.label ?? '').trim();
    const kind = loc?.mediaKind ?? (isVideoUrl(url) ? 'video' : 'image');

    if (kind === 'video' || isVideoUrl(url)) {
      if (budget.videosLeft <= 0) {
        console.warn('[scout-execute] Stage2 video budget exhausted; skipping location video.', label);
        continue;
      }
      attachments.push({
        slot,
        section: 'location',
        kind: 'video',
        edgeId: '',
        sourceNodeId: '',
        sourceType: '',
        label,
      });
      mediaQueue.push({ kind: 'video', url });
      edgeUrls.add(url);
      slot++;
      budget.videosLeft--;
    } else {
      if (budget.imagesLeft <= 0) {
        console.warn('[scout-execute] Stage2 image budget exhausted; skipping location image.', label);
        continue;
      }
      attachments.push({
        slot,
        section: 'location',
        kind: 'image',
        edgeId: '',
        sourceNodeId: '',
        sourceType: '',
        label,
      });
      mediaQueue.push({ kind: 'image', url });
      edgeUrls.add(url);
      slot++;
      budget.imagesLeft--;
    }
  }

  const props = (context.props as Array<{ label: string; imageUrl: string }> | undefined) ?? [];
  for (const p of props) {
    const url = String(p.imageUrl ?? '').trim();
    const label = String(p.label ?? '').trim();
    if (!url || edgeUrls.has(url)) continue;
    if (isBlobUrl(url)) {
      console.warn('[scout-execute] Skipping blob: prop image for', label);
      continue;
    }
    if (budget.imagesLeft <= 0) {
      console.warn('[scout-execute] Stage2 image budget exhausted; skipping prop image.', label);
      continue;
    }
    attachments.push({
      slot,
      section: 'prop',
      kind: 'image',
      edgeId: '',
      sourceNodeId: '',
      sourceType: '',
      label: label || 'unnamed',
    });
    mediaQueue.push({ kind: 'image', url });
    edgeUrls.add(url);
    slot++;
    budget.imagesLeft--;
  }

  const userPrompt = truncateText(String(context.userPrompt ?? ''), limits.maxUserPromptChars);

  const canvasPayload = {
    stage: 'stage2_instructions',
    placement: placementAndNotes,
    operatorNotes: userPrompt || '(none)',
    edgeTexts,
    attachments,
  };

  const parts: Stage2MultimodalPart[] = [
    { type: 'text', text: STAGE2_TOON_INTRO + encode(canvasPayload) },
  ];

  for (const m of mediaQueue) {
    if (m.kind === 'image') {
      parts.push({ type: 'image_url', imageUrl: { url: m.url, detail } });
    } else {
      parts.push({ type: 'video_url', videoUrl: { url: m.url } });
    }
  }

  return parts;
}
