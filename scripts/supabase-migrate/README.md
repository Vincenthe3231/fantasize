# Supabase migrate helpers

Scripts and SQL for copying Vision Forge data between Supabase projects.

**Full procedure:** [docs/supabase-migrate-between-projects.md](../../docs/supabase-migrate-between-projects.md)

**Quick start:**

1. Put pooler URIs in `.env` as `SOURCE_DATABASE_SESSION_POOLER_URL` / `TARGET_DATABASE_SESSION_POOLER_URL` (or set `DATABASE_URL_SOURCE` / `DATABASE_URL_TARGET`). Load **in bash** (Fish does not load `.env` for child scripts):

   ```sh
   bash -lc 'set -a && source .env && set +a && ./scripts/supabase-migrate/export-auth.sh'
   ```

2. Export from old project: `./scripts/supabase-migrate/export-auth.sh` (and `export-public.sh`, etc.).

3. Import on target: `./scripts/supabase-migrate/import-to-target.sh` (or follow Phase B manually in the doc).

Generated files land in `out/` (add `out/` to gitignore).
