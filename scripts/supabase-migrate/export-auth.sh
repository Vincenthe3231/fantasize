#!/usr/bin/env bash
set -euo pipefail
_MIGRATE_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib-env.sh
source "$_MIGRATE_DIR/lib-env.sh"
ROOT="$(cd "$_MIGRATE_DIR/../.." && pwd)"
OUT="$ROOT/scripts/supabase-migrate/out"
: "${DATABASE_URL_SOURCE:?Set DATABASE_URL_SOURCE or SOURCE_DATABASE_SESSION_POOLER_URL (see scripts/supabase-migrate/env.example)}"

mkdir -p "$OUT"

echo "Exporting auth.users from SOURCE → $OUT/auth_users.sql"
pg_dump "$DATABASE_URL_SOURCE" \
  --data-only \
  --no-owner \
  --no-privileges \
  -t auth.users \
  -f "$OUT/auth_users.sql"

echo "Exporting auth.identities from SOURCE → $OUT/auth_identities.sql"
pg_dump "$DATABASE_URL_SOURCE" \
  --data-only \
  --no-owner \
  --no-privileges \
  -t auth.identities \
  -f "$OUT/auth_identities.sql"

echo "Done. Import on target: auth_users.sql first, then auth_identities.sql (after disabling on_auth_user_created)."
