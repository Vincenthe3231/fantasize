# Supabase: migrate schema + data between projects (org move)

Use this when copying **Vision Forge** data from a **source** Supabase project (old org) to a **target** project (new org). Schema in this repo is defined by [`supabase/migrations/`](../supabase/migrations/).

## Prerequisites

- **Target** project: apply all repo migrations first:

  ```sh
  pnpx supabase link --project-ref YOUR_TARGET_REF
  pnpm db:push-sync
  ```

  Migration [`20260403120000_storage_bucket_1_policies.sql`](../supabase/migrations/20260403120000_storage_bucket_1_policies.sql) adds **`bucket-1`** to `storage.buckets` and RLS (aligned with `VITE_SUPABASE_STORAGE_BUCKET=bucket-1`).

- **Postgres URLs** (not the anon API key): each project → **Settings → Database** → URI (use **Session mode** pooler or direct; migration bulk loads need a role that can write `auth` — typically `postgres` with the database password).

- Local tools: `psql`, `pg_dump` (PostgreSQL client 15+ recommended to match Supabase).

- Optional: [AWS CLI v2](https://aws.amazon.com/cli/) configured with **S3-compatible** credentials for Storage sync (see Storage section).

## Environment variables (local only; never commit)

Set in your shell or **`.env`** (load with bash before running scripts — see below):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL_SOURCE` | Old project Postgres URI (`pg_dump`) |
| `DATABASE_URL_TARGET` | New project Postgres URI (`psql` import) |
| `SOURCE_DATABASE_SESSION_POOLER_URL` | Optional; used if `DATABASE_URL_SOURCE` is unset or empty |
| `TARGET_DATABASE_SESSION_POOLER_URL` | Optional; used if `DATABASE_URL_TARGET` is unset or empty |

Scripts source [`scripts/supabase-migrate/lib-env.sh`](../scripts/supabase-migrate/lib-env.sh) to resolve the above. **Fish:** `.env` is not applied to bash children — run e.g. `bash -lc 'set -a && source .env && set +a && ./scripts/supabase-migrate/export-auth.sh'`.

Example shape (password URL-encoded if it contains special characters):

```bash
export DATABASE_URL_SOURCE='postgresql://postgres:OLD_PASSWORD@db.OLD_REF.supabase.co:5432/postgres'
export DATABASE_URL_TARGET='postgresql://postgres:NEW_PASSWORD@db.NEW_REF.supabase.co:5432/postgres'
```

See also [`scripts/supabase-migrate/env.example`](../scripts/supabase-migrate/env.example).

---

## Phase A — Export from source

Run from repo root after exporting the variables above.

### A1. Auth: `auth.users` + `auth.identities`

```bash
./scripts/supabase-migrate/export-auth.sh
```

This writes `scripts/supabase-migrate/out/auth_users.sql` and `auth_identities.sql` (data-only dumps).

If your Supabase version includes extra auth tables you need (unusual for a simple move), add `-t auth.TABLE` to the script.

### A2. Public app tables

```bash
./scripts/supabase-migrate/export-public.sh
```

Writes `out/public_data.sql` for `profiles`, `spaces`, `space_node_versions`, `space_comment_versions`.

### A3. Storage metadata (optional)

```bash
./scripts/supabase-migrate/export-storage-objects.sh
```

Writes `out/storage_objects.sql`. You still must **copy file binaries** (Phase D).

---

## Phase B — Prepare target database

**Option: one script** (after Phase A exports exist in `scripts/supabase-migrate/out/`):

```bash
export DATABASE_URL_TARGET='postgresql://...'
./scripts/supabase-migrate/import-to-target.sh
```

It disables the profile trigger, imports `auth_users.sql` + `auth_identities.sql`, sets `instance_id` from `auth.instances` on the target, imports `public_data.sql`, re-enables the trigger, and optionally prompts for `storage_objects.sql`.

**Option: manual steps** (same logic, for transparency or recovery):

### B1. Disable `handle_new_user` trigger (avoid duplicate `profiles` on `auth.users` insert)

On **target**, run:

```bash
psql "$DATABASE_URL_TARGET" -v ON_ERROR_STOP=1 -f scripts/supabase-migrate/sql/disable-on-auth-user-created.sql
```

### B2. Import auth, then fix `instance_id`

1. Import auth dumps **in order**:

   ```bash
   psql "$DATABASE_URL_TARGET" -v ON_ERROR_STOP=1 -f scripts/supabase-migrate/out/auth_users.sql
   psql "$DATABASE_URL_TARGET" -v ON_ERROR_STOP=1 -f scripts/supabase-migrate/out/auth_identities.sql
   ```

2. On **target**, get the new instance id:

   ```sql
   select id from auth.instances limit 1;
   ```

3. Point **all** imported users at the target instance:

   ```bash
   psql "$DATABASE_URL_TARGET" -v ON_ERROR_STOP=1 \
     -v new_instance_id='PASTE_UUID_FROM_STEP_2' \
     -f scripts/supabase-migrate/sql/update-auth-users-instance-id.sql
   ```

### B3. Import public tables

```bash
psql "$DATABASE_URL_TARGET" -v ON_ERROR_STOP=1 -f scripts/supabase-migrate/out/public_data.sql
```

### B4. Re-enable trigger

```bash
psql "$DATABASE_URL_TARGET" -v ON_ERROR_STOP=1 -f scripts/supabase-migrate/sql/enable-on-auth-user-created.sql
```

New sign-ups after migration will get profiles automatically again.

### B5. Storage metadata (if you exported it)

```bash
psql "$DATABASE_URL_TARGET" -v ON_ERROR_STOP=1 -f scripts/supabase-migrate/out/storage_objects.sql
```

Ensure **`bucket_id`** values on the target match buckets that exist (`bucket-1`, `canvas`, etc.). If you renamed buckets, run SQL `UPDATE storage.objects SET bucket_id = 'bucket-1' WHERE bucket_id = 'canvas'` (example) **after** binaries are in the destination bucket.

---

## Phase D — Storage binaries (S3-compatible)

Supabase Storage is S3-compatible. Use **Project Settings → Storage** (or legacy S3 keys) for **source** and **target**.

Typical layout:

- Endpoint: `https://<project-ref>.supabase.co/storage/v1/s3`
- Region: often `us-east-1` for SigV4
- Bucket: dashboard bucket id (e.g. `canvas` on old, `bucket-1` on new)

Example with AWS CLI (adjust keys, endpoints, and bucket names):

```bash
# List source (sanity check)
aws s3 ls s3://canvas --endpoint-url https://OLD_REF.supabase.co/storage/v1/s3

# Sync into new bucket (copies objects; does not rewrite DB paths by itself)
aws s3 sync s3://canvas s3://bucket-1 \
  --endpoint-url https://NEW_REF.supabase.co/storage/v1/s3 \
  --source-region us-east-1 --region us-east-1
```

You may need **separate** configure profiles or env vars for source vs target endpoints. If sync is one-way from old → new, run two commands with different `--endpoint-url` and credentials (see Supabase docs: [S3 compatibility](https://supabase.com/docs/guides/storage/s3-compatibility)).

After sync, if `bucket_id` or path prefixes changed, update `storage.objects` accordingly or re-import metadata (Phase A3/B5).

---

## Phase E — Verification

Run on **both** databases and compare counts:

```bash
psql "$DATABASE_URL_SOURCE" -f scripts/supabase-migrate/verify-counts.sql
psql "$DATABASE_URL_TARGET" -f scripts/supabase-migrate/verify-counts.sql
```

Then in the app (target keys only): sign in, open `/w/{space_id}`, confirm canvas and media URLs load.

---

## Do not migrate

- **`supabase_migrations.schema_migrations`** from the old project — the target should only reflect migrations applied from **this repo**.
- **`auth.sessions` / `auth.refresh_tokens`** — optional to skip; users sign in again.

---

## Seed migration conflict

[`20260322200000_seed_superadmin_bind_space.sql`](../supabase/migrations/20260322200000_seed_superadmin_bind_space.sql) expects a fixed `spaces` id. If you already imported real spaces, **do not** re-run that seed against production data unless you intend to overwrite that row; run it only on empty DBs or adapt the UUID.

---

## README / app env

- Keep `VITE_SUPABASE_URL` and keys pointed at the **target** project only after cutover.
- Align `VITE_SUPABASE_PROJECT_ID` with the **target** ref if you use it in tooling.
- Remove stray spaces in `.env` values (e.g. `VITE_SUPABASE_URL=https://...` with no space after `=`).
