/**
 * Pure helpers for Stage 2 image generator — safe to unit-test from Vitest (no Deno / OpenRouter).
 */

export const MAX_STAGE2_IMAGE_GEN_ANCHORS = 4;

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

export function buildStage2ImageGenFinalPrompt(context: Record<string, unknown>): string {
  const prompt = String(context.prompt ?? '').trim();
  const wired = String(context.wiredTextFromEdges ?? '').trim();
  const neg = String(context.negativePrompt ?? '').trim();

  const blocks: string[] = [];
  if (prompt) blocks.push(prompt);
  if (wired) blocks.push(wired);
  let out = blocks.join('\n\n');
  if (neg) {
    out = out ? `${out}\n\nNegative prompt / avoid: ${neg}` : `Negative prompt / avoid: ${neg}`;
  }
  return out.trim();
}

export function filterAnchorImageUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of urls) {
    const s = String(u ?? '').trim();
    if (!isUsableHttpImageUrl(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= MAX_STAGE2_IMAGE_GEN_ANCHORS) break;
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
