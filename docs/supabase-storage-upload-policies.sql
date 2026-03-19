-- Fix: "new row violates row-level security policy" on storage upload
--
-- Preferred: apply repo migration `supabase/migrations/20260321120000_storage_upload_policies.sql`
-- via `pnpm db:push-sync` — it allows buckets uploads, canvas, workflow-media.
--
-- Use this file in SQL Editor if you use a different bucket id: replace YOUR_BUCKET_NAME below
-- (and consider adding that id to the migration array so teammates get the same policies).

-- Idempotent: safe to re-run after editing YOUR_BUCKET_NAME
DROP POLICY IF EXISTS "workflow_allow_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "workflow_allow_select_public" ON storage.objects;
DROP POLICY IF EXISTS "workflow_allow_insert_anon" ON storage.objects;

-- Allow signed-in users (including Anonymous Auth) to upload into this bucket.
-- Prerequisite: Authentication → Providers → Anonymous sign-in enabled (this app uses signInAnonymously).
CREATE POLICY "workflow_allow_insert_authenticated"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'YOUR_BUCKET_NAME');

-- Allow anyone to read objects (needed for public URLs / previews).
-- If the bucket is set to "Public" in the dashboard, you may already have equivalent policies.
CREATE POLICY "workflow_allow_select_public"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'YOUR_BUCKET_NAME');

-- Optional: only if uploads must work with zero session (not recommended for production).
-- Uncomment if anonymous sign-in is disabled and you accept open uploads from anon key holders.
-- CREATE POLICY "workflow_allow_insert_anon"
-- ON storage.objects
-- FOR INSERT
-- TO anon
-- WITH CHECK (bucket_id = 'YOUR_BUCKET_NAME');
