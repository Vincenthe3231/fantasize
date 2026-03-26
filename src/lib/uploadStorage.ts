import { supabase } from '@/integrations/supabase/client';

const BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET as string | undefined;

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
