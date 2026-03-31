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
  }: ImageVariantOptions = {}
): string | undefined {
  const trimmed = src.trim();
  if (!shouldTransform(trimmed)) return undefined;
  const entries = widths
    .filter((w) => Number.isFinite(w) && w > 0)
    .map((w) => `${withTransformParams(trimmed, { width: w, quality, format, resize })} ${Math.round(w)}w`);
  return entries.length > 0 ? entries.join(', ') : undefined;
}
