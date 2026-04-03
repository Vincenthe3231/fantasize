-- Add bucket-1 (matches common .env VITE_SUPABASE_STORAGE_BUCKET) to buckets + RLS policies.
-- Keeps uploads, canvas, workflow-media from prior migrations.

insert into storage.buckets (id, name, public)
values ('bucket-1', 'bucket-1', true)
on conflict (id) do nothing;

drop policy if exists "vf_storage_insert_authenticated" on storage.objects;
drop policy if exists "vf_storage_select_public" on storage.objects;

create policy "vf_storage_insert_authenticated"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = any (
      array['uploads', 'canvas', 'workflow-media', 'bucket-1']::text[]
    )
  );

create policy "vf_storage_select_public"
  on storage.objects
  for select
  to public
  using (
    bucket_id = any (
      array['uploads', 'canvas', 'workflow-media', 'bucket-1']::text[]
    )
  );

drop policy if exists "vf_storage_delete_authenticated" on storage.objects;

create policy "vf_storage_delete_authenticated"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = any (
      array['uploads', 'canvas', 'workflow-media', 'bucket-1']::text[]
    )
  );
