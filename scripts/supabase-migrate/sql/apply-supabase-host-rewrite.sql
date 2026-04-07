-- Rewrite stored Supabase URLs from old project → new project (TARGET DB only).
-- Safe to re-run: replace on text without old host is a no-op.
-- Run inside a single transaction; rolls back on any invalid JSON.
--
-- Before: pg_dump the spaces table or full DB backup (Dashboard → Database → Backups).
--
BEGIN;

UPDATE public.spaces
SET
  nodes = replace(
    replace(nodes::text,
      'https://wtwyksfmffxgtbzwwfnq.supabase.co',
      'https://nkijmkgdazikhyjpwcsl.supabase.co'),
    'https://wtwyksfmffxgtbzwwfnq.storage.supabase.co',
    'https://nkijmkgdazikhyjpwcsl.storage.supabase.co'
  )::jsonb,
  edges = replace(
    replace(edges::text,
      'https://wtwyksfmffxgtbzwwfnq.supabase.co',
      'https://nkijmkgdazikhyjpwcsl.supabase.co'),
    'https://wtwyksfmffxgtbzwwfnq.storage.supabase.co',
    'https://nkijmkgdazikhyjpwcsl.storage.supabase.co'
  )::jsonb,
  comments = replace(
    replace(comments::text,
      'https://wtwyksfmffxgtbzwwfnq.supabase.co',
      'https://nkijmkgdazikhyjpwcsl.supabase.co'),
    'https://wtwyksfmffxgtbzwwfnq.storage.supabase.co',
    'https://nkijmkgdazikhyjpwcsl.storage.supabase.co'
  )::jsonb,
  settings = CASE
    WHEN settings IS NULL THEN NULL
    ELSE replace(
      replace(settings::text,
        'https://wtwyksfmffxgtbzwwfnq.supabase.co',
        'https://nkijmkgdazikhyjpwcsl.supabase.co'),
      'https://wtwyksfmffxgtbzwwfnq.storage.supabase.co',
      'https://nkijmkgdazikhyjpwcsl.storage.supabase.co'
    )::jsonb
  END,
  node_grid_layouts = replace(
    replace(node_grid_layouts::text,
      'https://wtwyksfmffxgtbzwwfnq.supabase.co',
      'https://nkijmkgdazikhyjpwcsl.supabase.co'),
    'https://wtwyksfmffxgtbzwwfnq.storage.supabase.co',
    'https://nkijmkgdazikhyjpwcsl.storage.supabase.co'
  )::jsonb,
  viewport = CASE
    WHEN viewport IS NULL THEN NULL
    ELSE replace(
      replace(viewport::text,
        'https://wtwyksfmffxgtbzwwfnq.supabase.co',
        'https://nkijmkgdazikhyjpwcsl.supabase.co'),
      'https://wtwyksfmffxgtbzwwfnq.storage.supabase.co',
      'https://nkijmkgdazikhyjpwcsl.storage.supabase.co'
    )::jsonb
  END
WHERE
  nodes::text LIKE '%wtwyksfmffxgtbzwwfnq%'
  OR edges::text LIKE '%wtwyksfmffxgtbzwwfnq%'
  OR comments::text LIKE '%wtwyksfmffxgtbzwwfnq%'
  OR coalesce(settings, '{}'::jsonb)::text LIKE '%wtwyksfmffxgtbzwwfnq%'
  OR node_grid_layouts::text LIKE '%wtwyksfmffxgtbzwwfnq%'
  OR coalesce(viewport, '{}'::jsonb)::text LIKE '%wtwyksfmffxgtbzwwfnq%';

UPDATE public.space_node_versions
SET data = replace(
  replace(data::text,
    'https://wtwyksfmffxgtbzwwfnq.supabase.co',
    'https://nkijmkgdazikhyjpwcsl.supabase.co'),
  'https://wtwyksfmffxgtbzwwfnq.storage.supabase.co',
  'https://nkijmkgdazikhyjpwcsl.storage.supabase.co'
)::jsonb
WHERE data::text LIKE '%wtwyksfmffxgtbzwwfnq%';

UPDATE public.space_comment_versions
SET text = replace(
  replace(text,
    'https://wtwyksfmffxgtbzwwfnq.supabase.co',
    'https://nkijmkgdazikhyjpwcsl.supabase.co'),
  'https://wtwyksfmffxgtbzwwfnq.storage.supabase.co',
  'https://nkijmkgdazikhyjpwcsl.storage.supabase.co'
)
WHERE text LIKE '%wtwyksfmffxgtbzwwfnq%';

COMMIT;

\echo '=== Post-check (should be 0 for all) ==='
SELECT
  (SELECT count(*) FROM public.spaces WHERE nodes::text LIKE '%wtwyksfmffxgtbzwwfnq%' OR edges::text LIKE '%wtwyksfmffxgtbzwwfnq%' OR comments::text LIKE '%wtwyksfmffxgtbzwwfnq%' OR coalesce(settings, '{}'::jsonb)::text LIKE '%wtwyksfmffxgtbzwwfnq%' OR node_grid_layouts::text LIKE '%wtwyksfmffxgtbzwwfnq%' OR coalesce(viewport, '{}'::jsonb)::text LIKE '%wtwyksfmffxgtbzwwfnq%') AS spaces_still_old,
  (SELECT count(*) FROM public.space_node_versions WHERE data::text LIKE '%wtwyksfmffxgtbzwwfnq%') AS node_versions_still_old,
  (SELECT count(*) FROM public.space_comment_versions WHERE text LIKE '%wtwyksfmffxgtbzwwfnq%') AS comment_versions_still_old;
