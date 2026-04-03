#!/usr/bin/env bash
set -euo pipefail
_MIGRATE_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib-env.sh
source "$_MIGRATE_DIR/lib-env.sh"
ROOT="$(cd "$_MIGRATE_DIR/../.." && pwd)"
OUT="$ROOT/scripts/supabase-migrate/out"
: "${DATABASE_URL_SOURCE:?Set DATABASE_URL_SOURCE or SOURCE_DATABASE_SESSION_POOLER_URL (see scripts/supabase-migrate/env.example)}"

mkdir -p "$OUT"

echo "Exporting storage.objects metadata from SOURCE → $OUT/storage_objects.sql"
pg_dump "$DATABASE_URL_SOURCE" \
  --data-only \
  --no-owner \
  --no-privileges \
  -t storage.objects \
  -f "$OUT/storage_objects.sql"

echo "Done. Copy bucket binaries separately (see docs/supabase-migrate-between-projects.md)."
