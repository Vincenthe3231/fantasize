import { uploadWorkflowMedia } from '@/lib/uploadStorage';

function isHttpUrl(url: string): boolean {
  const t = url.trim();
  return t.startsWith('https://') || t.startsWith('http://');
}

function isDataImageUrl(url: string): boolean {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(url.trim());
}

function isBlobUrl(url: string): boolean {
  return url.trim().startsWith('blob:');
}

function extensionFromMime(mime: string): string {
  const lower = mime.toLowerCase();
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg';
  if (lower.includes('png')) return 'png';
  if (lower.includes('webp')) return 'webp';
  if (lower.includes('gif')) return 'gif';
  return 'bin';
}

function fileNameFor(kind: 'blob' | 'data', mime: string): string {
  const ext = extensionFromMime(mime);
  return `scout-${kind}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
}

function dataImageUrlToFile(url: string): File {
  const trimmed = url.trim();
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i.exec(trimmed);
  if (!match) {
    throw new Error('Invalid data:image URL format');
  }
  const mime = match[1]!;
  const b64 = match[2]!;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], fileNameFor('data', mime), { type: mime });
}

async function blobUrlToFile(url: string): Promise<File> {
  const res = await fetch(url.trim());
  if (!res.ok) {
    throw new Error(`Failed to read blob URL: HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const mime = blob.type || 'application/octet-stream';
  return new File([blob], fileNameFor('blob', mime), { type: mime });
}

export async function normalizeImageReferenceUrl(url: string): Promise<string> {
  const trimmed = String(url ?? '').trim();
  if (!trimmed) throw new Error('Image URL is empty');
  if (isHttpUrl(trimmed)) return trimmed;

  let file: File;
  if (isDataImageUrl(trimmed)) {
    file = dataImageUrlToFile(trimmed);
  } else if (isBlobUrl(trimmed)) {
    file = await blobUrlToFile(trimmed);
  } else {
    throw new Error('Unsupported image URL. Expected http(s), data:image, or blob URL.');
  }

  const { url: uploadedUrl } = await uploadWorkflowMedia(file);
  if (!isHttpUrl(uploadedUrl)) {
    throw new Error('Uploaded image URL is not HTTP(S)');
  }
  return uploadedUrl;
}

export async function normalizeImageReferenceUrls(urls: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const u of urls) {
    out.push(await normalizeImageReferenceUrl(u));
  }
  return out;
}
