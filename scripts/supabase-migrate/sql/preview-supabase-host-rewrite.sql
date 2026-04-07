-- Preview only: counts rows that still reference the old Supabase project.
-- Old ref: wtwyksfmffxgtbzwwfnq (API + storage subdomains)

\echo '=== public.spaces ==='
SELECT count(*) AS spaces_rows
FROM public.spaces
WHERE
  nodes::text LIKE '%wtwyksfmffxgtbzwwfnq%'
  OR edges::text LIKE '%wtwyksfmffxgtbzwwfnq%'
  OR comments::text LIKE '%wtwyksfmffxgtbzwwfnq%'
  OR coalesce(settings, '{}'::jsonb)::text LIKE '%wtwyksfmffxgtbzwwfnq%'
  OR node_grid_layouts::text LIKE '%wtwyksfmffxgtbzwwfnq%'
  OR coalesce(viewport, '{}'::jsonb)::text LIKE '%wtwyksfmffxgtbzwwfnq%';

\echo '=== public.space_node_versions ==='
SELECT count(*) AS space_node_versions_rows
FROM public.space_node_versions
WHERE data::text LIKE '%wtwyksfmffxgtbzwwfnq%';

\echo '=== public.space_comment_versions ==='
SELECT count(*) AS space_comment_versions_rows
FROM public.space_comment_versions
WHERE text LIKE '%wtwyksfmffxgtbzwwfnq%';
