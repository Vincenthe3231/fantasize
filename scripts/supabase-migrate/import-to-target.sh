#!/usr/bin/env bash
# Run against a TARGET that already has repo migrations applied and empty app/auth data you are replacing.
# Requires export outputs in out/. See docs/supabase-migrate-between-projects.md
set -euo pipefail
_MIGRATE_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib-env.sh
source "$_MIGRATE_DIR/lib-env.sh"
ROOT="$(cd "$_MIGRATE_DIR/../.." && pwd)"
OUT="$ROOT/scripts/supabase-migrate/out"
: "${DATABASE_URL_TARGET:?Set DATABASE_URL_TARGET or TARGET_DATABASE_SESSION_POOLER_URL (see scripts/supabase-migrate/env.example)}"

for f in auth_users.sql auth_identities.sql public_data.sql; do
  if [[ ! -s "$OUT/$f" ]]; then
    echo "Missing or empty $OUT/$f — run export-auth.sh and export-public.sh on SOURCE first."
    exit 1
  fi
done

echo "Disabling on_auth_user_created on TARGET…"
psql "$DATABASE_URL_TARGET" -v ON_ERROR_STOP=1 \
  -f "$ROOT/scripts/supabase-migrate/sql/disable-on-auth-user-created.sql"

echo "Importing auth.users…"
psql "$DATABASE_URL_TARGET" -v ON_ERROR_STOP=1 -f "$OUT/auth_users.sql"

echo "Importing auth.identities…"
psql "$DATABASE_URL_TARGET" -v ON_ERROR_STOP=1 -f "$OUT/auth_identities.sql"

INST="$(psql "$DATABASE_URL_TARGET" -t -A -c "select id from auth.instances limit 1;")"
INST="$(echo "$INST" | tr -d '[:space:]')"
if [[ -z "$INST" ]]; then
  echo "Could not read auth.instances id from target."
  exit 1
fi
echo "Setting auth.users.instance_id to target instance $INST …"
psql "$DATABASE_URL_TARGET" -v ON_ERROR_STOP=1 -v new_instance_id="$INST" \
  -f "$ROOT/scripts/supabase-migrate/sql/update-auth-users-instance-id.sql"

echo "Importing public tables…"
psql "$DATABASE_URL_TARGET" -v ON_ERROR_STOP=1 -f "$OUT/public_data.sql"

echo "Re-enabling on_auth_user_created…"
psql "$DATABASE_URL_TARGET" -v ON_ERROR_STOP=1 \
  -f "$ROOT/scripts/supabase-migrate/sql/enable-on-auth-user-created.sql"

if [[ -s "$OUT/storage_objects.sql" ]]; then
  read -r -p "Import storage.objects from $OUT/storage_objects.sql? [y/N] " ans
  if [[ "${ans:-}" =~ ^[yY] ]]; then
    psql "$DATABASE_URL_TARGET" -v ON_ERROR_STOP=1 -f "$OUT/storage_objects.sql"
  fi
else
  echo "No $OUT/storage_objects.sql — skip storage metadata (optional: export-storage-objects.sh)."
fi

echo "Done. Run verify-counts.sql on SOURCE and TARGET; sync bucket binaries if needed."
