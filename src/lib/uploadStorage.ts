import { supabase } from '@/integrations/supabase/client';

const BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET as string | undefined;
const WORKFLOW_MEDIA_PREFIX = 'workflow-media/';

function supabaseProjectHost(): string | null {
  const raw = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!raw?.trim()) return null;
  try {
    return new URL(raw).host;
  } catch {
    return null;
  }
}

/** Parse `/storage/v1/object/public/{bucket}/{path}` from a public object URL. */
function parsePublicStorageObjectPath(publicUrl: string): { bucket: string; path: string } | null {
  try {
    const u = new URL(publicUrl.trim());
    const marker = '/storage/v1/object/public/';
    const i = u.pathname.indexOf(marker);
    if (i === -1) return null;
    const rest = u.pathname.slice(i + marker.length);
    const firstSlash = rest.indexOf('/');
    if (firstSlash === -1) return null;
    const bucket = rest.slice(0, firstSlash);
    const path = rest.slice(firstSlash + 1);
    if (!bucket || !path) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}

/**
 * Remove an object from the configured workflow bucket when `publicUrl` points at
 * `workflow-media/...` on this project. No-op for other URLs or missing env.
 * Best-effort: logs console warning on RLS/network errors.
 */
export async function deleteWorkflowMediaByPublicUrl(publicUrl: string): Promise<void> {
  const trimmed = String(publicUrl ?? '').trim();
  if (!trimmed) return;
  const bucketId = BUCKET?.trim();
  if (!bucketId) return;

  const host = supabaseProjectHost();
  if (host) {
    try {
      if (new URL(trimmed).host !== host) return;
    } catch {
      return;
    }
  }

  const parsed = parsePublicStorageObjectPath(trimmed);
  if (!parsed || parsed.bucket !== bucketId) return;
  if (!parsed.path.startsWith(WORKFLOW_MEDIA_PREFIX)) return;

  const { error } = await supabase.storage.from(bucketId).remove([parsed.path]);
  if (error) {
    console.warn('[uploadStorage] deleteWorkflowMediaByPublicUrl failed:', error.message);
  }
}

/** Strip path chars and collapse unsafe segments for storage object keys. */
export function sanitizeFilename(name: string): string {
  const base = name.replace(/[/\\]/g, '-').replace(/\.\./g, '');
  const trimmed = base.replace(/^\.+/, '').slice(0, 180);
  return trimmed || 'file';
}

/**
 * Upload a file to Supabase Storage and return its public URL.
 * Requires VITE_SUPABASE_STORAGE_BUCKET and bucket policies that allow insert + public read (or adjust getPublicUrl usage).
 */
export async function uploadWorkflowMedia(
  file: File,
  metadata?: Record<string, string>
): Promise<{ url: string; path: string; metadata?: Record<string, string> }> {
  if (!BUCKET?.trim()) {
    throw new Error(
      'Missing VITE_SUPABASE_STORAGE_BUCKET in .env. Set it to your Supabase Storage bucket name.'
    );
  }

  const safeName = sanitizeFilename(file.name);
  const path = `workflow-media/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });

  if (error) {
    const msg = error.message || 'Upload failed';
    const rlsHint =
      /row-level security|RLS|violates row-level security/i.test(msg) ||
      (error as { statusCode?: string }).statusCode === '403';
    throw new Error(
      rlsHint
        ? `${msg} — Add Storage INSERT/SELECT policies for your bucket (see docs/supabase-storage-upload-policies.sql) and enable Anonymous sign-in if the app uses it.`
        : msg
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = data.publicUrl;
  if (!url) {
    throw new Error('Could not resolve public URL for uploaded file');
  }

  return { url, path, metadata };
}
