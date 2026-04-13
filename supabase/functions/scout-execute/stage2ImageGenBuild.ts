/**
 * Pure helpers for Stage 2 image generator — safe to unit-test from Vitest (no Deno / OpenRouter).
 */

import { encode } from '@toon-format/toon';

/** OpenRouter image_config.aspect_ratio supported values (subset matching canvas aspect dropdown). */
const ALLOWED_ASPECT_RATIOS = new Set([
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '21:9',
]);

export type ImageGenUserContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; imageUrl: { url: string; detail?: 'low' | 'auto' | 'high' } };

export function isUsableHttpImageUrl(url: string): boolean {
  const t = url.trim();
  if (!t || t.startsWith('blob:')) return false;
  return t.startsWith('https://') || t.startsWith('http://');
}

/** HTTP(S) or inline `data:image/...` for multimodal anchors (blob: URLs are not usable server-side). */
export function isUsableMultimodalImageUrl(url: string): boolean {
  const t = url.trim();
  if (!t || t.startsWith('blob:')) return false;
  if (t.startsWith('https://') || t.startsWith('http://')) return true;
  if (t.startsWith('data:image/')) return true;
  return false;
}

export function buildStage2ImageGenFinalPrompt(context: Record<string, unknown>): string {
  const prompt = String(context.prompt ?? '').trim();
  const wired = normalizeConstraintText(String(context.wiredTextFromEdges ?? '').trim());
  const neg = normalizeConstraintText(String(context.negativePrompt ?? '').trim());

  if (!prompt && !wired && !neg) return '';

  const payload: Record<string, string> = {
    stage: 'stage2_image_generator',
    output: 'single photorealistic cinematic still',
  };
  if (prompt) payload.prompt = prompt;
  if (wired) payload.contextConstraints = wired;
  if (neg) payload.negative = neg;

  const sections: string[] = [
    'You are generating one final production image.',
    'MUST KEEP (identity lock): Preserve room geometry, scene identity, and anchor-image structure.',
    prompt ? `TARGET LOOK:\n${prompt}` : '',
    wired ? `CONTEXT CONSTRAINTS:\n${wired}` : '',
    neg ? `DO NOT:\n${neg}` : '',
    'OUTPUT: Photorealistic cinematic still with coherent lighting and natural material response.',
    `Image brief (TOON):\n${encode(payload)}`,
  ].filter(Boolean);

  return sections.join('\n\n').trim();
}

function normalizeConstraintText(input: string): string {
  const parts = input
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(p);
  }
  return deduped.join('\n');
}

/**
 * Default cap on anchors sent to OpenRouter per request (Cloudflare 1102 / worker limits on large multimodal payloads).
 * Override on the edge with `OPENROUTER_IMAGE_GEN_MAX_ANCHORS` (1–8). Vitest uses max 8 when Deno is absent.
 */
export const DEFAULT_MAX_ANCHOR_IMAGES_EDGE = 3;

/** Combined text + TOON brief cap (characters) to keep requests within OpenRouter edge limits. */
export const MAX_IMAGE_GEN_COMBINED_TEXT_CHARS = 14_000;

function resolveMaxAnchorImagesForEdge(): number {
  if (typeof Deno !== 'undefined' && typeof Deno.env?.get === 'function') {
    const raw = Deno.env.get('OPENROUTER_IMAGE_GEN_MAX_ANCHORS')?.trim();
    const n = raw ? parseInt(raw, 10) : DEFAULT_MAX_ANCHOR_IMAGES_EDGE;
    return Number.isFinite(n) && n >= 1 && n <= 8 ? n : DEFAULT_MAX_ANCHOR_IMAGES_EDGE;
  }
  return 8;
}

export function filterAnchorImageUrls(urls: unknown, maxAnchors = 8): string[] {
  if (!Array.isArray(urls)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of urls) {
    const s = String(u ?? '').trim();
    if (!isUsableMultimodalImageUrl(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= maxAnchors) break;
  }
  return out;
}

/**
 * Multimodal user message: text first, then reference images (detail low to reduce payload).
 */
export function buildStage2ImageGenUserContentParts(context: Record<string, unknown>): ImageGenUserContentPart[] {
  const maxAnchors = resolveMaxAnchorImagesForEdge();
  const anchors = filterAnchorImageUrls(context.anchorImageUrls, maxAnchors);
  let text = buildStage2ImageGenFinalPrompt(context);
  if (!text) text = 'Generate a single high-quality image matching the creative brief.';
  if (anchors.length > 0) {
    text =
      `Reference image(s) are provided below for layout, composition, or style. Follow the text brief and use references as appropriate.\n\n${text}`;
  }
  if (text.length > MAX_IMAGE_GEN_COMBINED_TEXT_CHARS) {
    text =
      `${text.slice(0, MAX_IMAGE_GEN_COMBINED_TEXT_CHARS)}\n\n[Prompt truncated for model request size]`;
  }

  const parts: ImageGenUserContentPart[] = [{ type: 'text', text }];
  for (const url of anchors) {
    parts.push({ type: 'image_url', imageUrl: { url, detail: 'low' } });
  }
  return parts;
}

export function aspectToOpenRouterImageConfig(
  aspect: string | undefined
): Record<string, string | number> | undefined {
  const a = String(aspect ?? '').trim();
  if (!a || a === 'custom') return undefined;
  if (!ALLOWED_ASPECT_RATIOS.has(a)) return undefined;
  return { aspect_ratio: a };
}
