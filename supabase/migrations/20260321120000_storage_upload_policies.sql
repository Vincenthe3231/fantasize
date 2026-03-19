-- Vision Forge: Storage RLS for Upload node (Supabase JS client uploads to storage.objects)
-- Apply with: pnpm db:push-sync  (or supabase db push)
--
-- Buckets: ensures common ids exist as public buckets (skip if you manage buckets only in UI).
-- Policies: authenticated INSERT + public SELECT for the same bucket ids.
-- Add your bucket name to both arrays below if it is not listed.

-- Buckets (id must match VITE_SUPABASE_STORAGE_BUCKET)
insert into storage.buckets (id, name, public)
values
  ('uploads', 'uploads', true),
  ('canvas', 'canvas', true),
  ('workflow-media', 'workflow-media', true)
on conflict (id) do nothing;

drop policy if exists "vf_storage_insert_authenticated" on storage.objects;
drop policy if exists "vf_storage_select_public" on storage.objects;

create policy "vf_storage_insert_authenticated"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = any (array['uploads', 'canvas', 'workflow-media']::text[])
  );

create policy "vf_storage_select_public"
  on storage.objects
  for select
  to public
  using (
    bucket_id = any (array['uploads', 'canvas', 'workflow-media']::text[])
  );
