-- Vision Forge: allow authenticated users (incl. anonymous) to delete objects they can reach via public URL cleanup (e.g. List node remove).

drop policy if exists "vf_storage_delete_authenticated" on storage.objects;

create policy "vf_storage_delete_authenticated"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = any (array['uploads', 'canvas', 'workflow-media']::text[])
  );
