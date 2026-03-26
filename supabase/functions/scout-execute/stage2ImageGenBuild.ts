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
  const wired = String(context.wiredTextFromEdges ?? '').trim();
  const neg = String(context.negativePrompt ?? '').trim();

  if (!prompt && !wired && !neg) return '';

  const payload: Record<string, string> = { stage: 'stage2_image_generator' };
  if (prompt) payload.prompt = prompt;
  if (wired) payload.wiredFromEdges = wired;
  if (neg) payload.negative = neg;

  return `Image brief (TOON):\n${encode(payload)}`.trim();
}

export function filterAnchorImageUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of urls) {
    const s = String(u ?? '').trim();
    if (!isUsableMultimodalImageUrl(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * Multimodal user message: text first, then reference images (detail low to reduce payload).
 */
export function buildStage2ImageGenUserContentParts(context: Record<string, unknown>): ImageGenUserContentPart[] {
  const anchors = filterAnchorImageUrls(context.anchorImageUrls);
  let text = buildStage2ImageGenFinalPrompt(context);
  if (!text) text = 'Generate a single high-quality image matching the creative brief.';
  if (anchors.length > 0) {
    text =
      `Reference image(s) are provided below for layout, composition, or style. Follow the text brief and use references as appropriate.\n\n${text}`;
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
