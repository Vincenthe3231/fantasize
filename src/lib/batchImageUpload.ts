import { uploadWorkflowMedia } from '@/lib/uploadStorage';

function parseDataImageUrl(url: string): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i.exec(url.trim());
  if (!match) return null;
  const mime = match[1]!;
  const b64 = match[2]!;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime, bytes };
}

function extFromMime(mime: string): string {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'bin';
}

export type GeneratedImageMeta = {
  referer?: string;
  generatedBy?: string;
  timestamp?: number;
  supabaseUrl?: string;
};

export async function uploadGeneratedImagesWithMetadata(
  urls: string[],
  metadata: { referer?: string; generatedBy?: string }
): Promise<Record<string, GeneratedImageMeta>> {
  const out: Record<string, GeneratedImageMeta> = {};
  for (const url of urls) {
    const trimmed = String(url ?? '').trim();
    if (!trimmed) continue;
    const base: GeneratedImageMeta = {
      referer: metadata.referer,
      generatedBy: metadata.generatedBy,
      timestamp: Date.now(),
    };
    if (/^https?:\/\//i.test(trimmed)) {
      out[trimmed] = base;
      continue;
    }
    const parsed = parseDataImageUrl(trimmed);
    if (!parsed) continue;
    const file = new File(
      [parsed.bytes],
      `generated-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extFromMime(parsed.mime)}`,
      { type: parsed.mime }
    );
    const uploaded = await uploadWorkflowMedia(file, {
      referer: metadata.referer ?? '',
      generatedBy: metadata.generatedBy ?? '',
    });
    out[trimmed] = { ...base, supabaseUrl: uploaded.url };
  }
  return out;
}
