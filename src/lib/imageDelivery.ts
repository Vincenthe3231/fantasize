const SUPABASE_PUBLIC_OBJECT_MARKER = '/storage/v1/object/public/';

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function shouldTransform(url: string): boolean {
  if (!isHttpUrl(url)) return false;
  return url.includes(SUPABASE_PUBLIC_OBJECT_MARKER);
}

type ImageVariantOptions = {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'origin' | 'webp';
  resize?: 'cover' | 'contain' | 'fill';
};

function withTransformParams(url: string, opts: ImageVariantOptions): string {
  try {
    const u = new URL(url);
    if (opts.width && opts.width > 0) u.searchParams.set('width', String(Math.round(opts.width)));
    if (opts.height && opts.height > 0) u.searchParams.set('height', String(Math.round(opts.height)));
    if (opts.quality && opts.quality > 0) u.searchParams.set('quality', String(Math.round(opts.quality)));
    if (opts.resize) u.searchParams.set('resize', opts.resize);
    if (opts.format && opts.format !== 'origin') u.searchParams.set('format', opts.format);
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Return a light-weight preview variant for canvas surfaces.
 * Falls back to original URL for non-http, blob:, data:, or non-Supabase URLs.
 */
export function canvasPreviewImageUrl(
  src: string,
  {
    width = 320,
    height,
    quality = 60,
    format = 'webp',
    resize = 'cover',
  }: ImageVariantOptions = {}
): string {
  const trimmed = src.trim();
  if (!shouldTransform(trimmed)) return trimmed;
  return withTransformParams(trimmed, { width, height, quality, format, resize });
}

export type StableImageOptions = {
  /** Supabase transform `width` (no height; client scales via CSS). */
  maxWidth?: number;
  quality?: number;
  format?: 'origin' | 'webp';
  resize?: 'cover' | 'contain' | 'fill';
};

/**
 * Single stable URL per asset for canvas nodes: fixed `width` transform params only.
 * Does not vary with zoom or measured layout — browser GPU scales the bitmap.
 * Non-HTTP / non-Supabase URLs pass through unchanged.
 */
export function canvasStableImageUrl(
  src: string,
  {
    maxWidth = 1280,
    quality = 70,
    format = 'webp',
    resize = 'cover',
  }: StableImageOptions = {}
): string {
  const trimmed = src.trim();
  const w = Math.min(4096, Math.max(48, Math.round(maxWidth)));
  if (!shouldTransform(trimmed)) return trimmed;
  return withTransformParams(trimmed, { width: w, quality, format, resize });
}

/**
 * Build responsive sources for larger media previews.
 */
export function canvasResponsiveSrcSet(
  src: string,
  widths: number[],
  {
    quality = 62,
    format = 'webp',
    resize = 'cover',
    height,
  }: ImageVariantOptions = {}
): string | undefined {
  const trimmed = src.trim();
  if (!shouldTransform(trimmed)) return undefined;
  const entries = widths
    .filter((w) => Number.isFinite(w) && w > 0)
    .map(
      (w) =>
        `${withTransformParams(trimmed, { width: w, height, quality, format, resize })} ${Math.round(w)}w`
    );
  return entries.length > 0 ? entries.join(', ') : undefined;
}

function uniqueSortedPositiveWidths(values: number[]): number[] {
  const seen = new Set<number>();
  for (const v of values) {
    const n = Math.round(v);
    if (Number.isFinite(n) && n >= 48) seen.add(Math.min(4096, n));
  }
  return [...seen].sort((a, b) => a - b);
}

/**
 * Build `src` / `srcSet` / `sizes` from the **CSS box** the image occupies (post-zoom, in layout px),
 * scaled by devicePixelRatio for Supabase transform widths. Non-HTTP / non-Supabase URLs pass through.
 */
export function canvasImagePlanForBox(
  src: string,
  cssWidthPx: number,
  cssHeightPx: number | undefined,
  {
    quality = 62,
    format = 'webp',
    resize = 'cover',
  }: ImageVariantOptions = {}
): { src: string; srcSet: string | undefined; sizes: string } {
  const trimmed = src.trim();
  const safeW = Math.max(1, cssWidthPx);
  const sizes = `${Math.ceil(safeW)}px`;

  if (!shouldTransform(trimmed)) {
    return { src: trimmed, srcSet: undefined, sizes };
  }

  const dpr =
    typeof window !== 'undefined' ? Math.min(2.25, window.devicePixelRatio || 1) : 1.5;
  const targetW = Math.min(4096, Math.max(48, Math.ceil(safeW * dpr)));
  const targetH =
    cssHeightPx != null && cssHeightPx > 0
      ? Math.min(4096, Math.max(48, Math.ceil(cssHeightPx * dpr)))
      : undefined;

  let tiers = uniqueSortedPositiveWidths([
    targetW * 0.45,
    targetW * 0.7,
    targetW,
    targetW * 1.15,
    targetW * 1.35,
  ]);
  if (tiers.length === 0) tiers = [Math.max(48, Math.min(4096, targetW))];

  const srcSet = canvasResponsiveSrcSet(trimmed, tiers, {
    quality,
    format,
    resize,
    height: targetH,
  });

  const fallbackW = tiers[Math.min(1, tiers.length - 1)] ?? targetW;
  const srcOut = canvasPreviewImageUrl(trimmed, {
    width: fallbackW,
    height: targetH,
    quality,
    format,
    resize,
  });

  return { src: srcOut, srcSet, sizes };
}
