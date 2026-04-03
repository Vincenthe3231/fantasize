#!/usr/bin/env bash
set -euo pipefail
_MIGRATE_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib-env.sh
source "$_MIGRATE_DIR/lib-env.sh"
ROOT="$(cd "$_MIGRATE_DIR/../.." && pwd)"
OUT="$ROOT/scripts/supabase-migrate/out"
: "${DATABASE_URL_SOURCE:?Set DATABASE_URL_SOURCE or SOURCE_DATABASE_SESSION_POOLER_URL (see scripts/supabase-migrate/env.example)}"

mkdir -p "$OUT"

echo "Exporting public app tables from SOURCE → $OUT/public_data.sql"
pg_dump "$DATABASE_URL_SOURCE" \
  --data-only \
  --no-owner \
  --no-privileges \
  -t public.profiles \
  -t public.spaces \
  -t public.space_node_versions \
  -t public.space_comment_versions \
  -f "$OUT/public_data.sql"

echo "Done."
