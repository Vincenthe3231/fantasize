#!/usr/bin/env bash
# Preview or apply URL host rewrite on the TARGET database (new Supabase project).
# Uses TARGET_DATABASE_SESSION_POOLER_URL from repo-root .env.
#
# Usage:
#   ./scripts/supabase-migrate/rewrite-supabase-host-in-db.sh           # preview only
#   APPLY=1 ./scripts/supabase-migrate/rewrite-supabase-host-in-db.sh # run transaction
#
# Requires: psql. Review sql/preview-*.sql and sql/apply-*.sql before APPLY=1.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV="$ROOT/.env"
SQL="$ROOT/scripts/supabase-migrate/sql"

TARGET=$(grep "^TARGET_DATABASE_SESSION_POOLER_URL=" "$ENV" | head -1 | sed "s/^TARGET_DATABASE_SESSION_POOLER_URL=//; s/^'//; s/'$//")
if [[ -z "$TARGET" ]]; then
  echo "Missing TARGET_DATABASE_SESSION_POOLER_URL in .env" >&2
  exit 1
fi

echo "=== Preview (read-only) ==="
psql "$TARGET" -v ON_ERROR_STOP=1 -f "$SQL/preview-supabase-host-rewrite.sql"

if [[ "${APPLY:-0}" != "1" ]]; then
  echo ""
  echo "Preview only. To apply on this database, run:"
  echo "  APPLY=1 $0"
  exit 0
fi

echo ""
echo "=== APPLY (transaction) — Ctrl+C within 3s to abort ==="
sleep 3
psql "$TARGET" -v ON_ERROR_STOP=1 -f "$SQL/apply-supabase-host-rewrite.sql"
echo "Done. Clear browser site data / local drafts if URLs were cached offline."
