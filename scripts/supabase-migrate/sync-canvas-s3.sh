#!/usr/bin/env bash
# Pull canvas bucket from SOURCE Supabase (S3-compatible) into a staging dir, then push to TARGET.
# Expects repo-root .env:
#   Commented lines with old S3 keys: # VITE_SUPABASE_STORAGE_ACCESS_KEY / SECRET
#   Active lines with new S3 keys:  VITE_SUPABASE_STORAGE_ACCESS_KEY / SECRET
# Env overrides: OLD_REF NEW_REF BUCKET STAGING_DIR REGION AWS

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV="$ROOT/.env"
AWS="${AWS:-$HOME/.local/bin/aws}"
export PATH="$(dirname "$AWS"):$PATH"

if [[ ! -f "$ENV" ]]; then
  echo "Missing $ENV" >&2
  exit 1
fi

OLD_KEY=$(grep '^# VITE_SUPABASE_STORAGE_ACCESS_KEY=' "$ENV" | head -1 | sed 's/^# *VITE_SUPABASE_STORAGE_ACCESS_KEY=//' | tr -d '\r"')
OLD_SECRET=$(grep '^# VITE_SUPABASE_STORAGE_SECRET_KEY=' "$ENV" | head -1 | sed 's/^# *VITE_SUPABASE_STORAGE_SECRET_KEY=//' | tr -d '\r"')
NEW_KEY=$(grep '^VITE_SUPABASE_STORAGE_ACCESS_KEY=' "$ENV" | grep -v '^#' | head -1 | sed 's/^VITE_SUPABASE_STORAGE_ACCESS_KEY=//' | tr -d '\r"')
NEW_SECRET=$(grep '^VITE_SUPABASE_STORAGE_SECRET_KEY=' "$ENV" | grep -v '^#' | head -1 | sed 's/^VITE_SUPABASE_STORAGE_SECRET_KEY=//' | tr -d '\r"')

OLD_REF="${OLD_REF:-wtwyksfmffxgtbzwwfnq}"
NEW_REF="${NEW_REF:-nkijmkgdazikhyjpwcsl}"
BUCKET="${BUCKET:-canvas}"
STAGING_DIR="${STAGING_DIR:-$(mktemp -d /tmp/vision-forge-canvas-sync.XXXXXX)}"
REGION="${REGION:-us-east-1}"

OLD_EP="https://${OLD_REF}.supabase.co/storage/v1/s3"
NEW_EP="https://${NEW_REF}.supabase.co/storage/v1/s3"

if [[ -z "$OLD_KEY" || -z "$OLD_SECRET" || -z "$NEW_KEY" || -z "$NEW_SECRET" ]]; then
  echo "Missing storage keys in .env (commented OLD + active NEW VITE_SUPABASE_STORAGE_*)." >&2
  exit 1
fi

echo "Staging: $STAGING_DIR"
echo "Source:  $OLD_EP  bucket=$BUCKET"
echo "Target:  $NEW_EP  bucket=$BUCKET"

echo "=== Step 1: sync from OLD project → staging ==="
AWS_ACCESS_KEY_ID="$OLD_KEY" AWS_SECRET_ACCESS_KEY="$OLD_SECRET" \
  "$AWS" s3 sync "s3://${BUCKET}" "$STAGING_DIR" \
  --endpoint-url "$OLD_EP" --region "$REGION" --no-progress

echo "=== Step 2: sync from staging → NEW project (S3-compatible API) ==="
AWS_ACCESS_KEY_ID="$NEW_KEY" AWS_SECRET_ACCESS_KEY="$NEW_SECRET" \
  "$AWS" s3 sync "$STAGING_DIR" "s3://${BUCKET}" \
  --endpoint-url "$NEW_EP" --region "$REGION" --no-progress

# Raw S3 uploads may not be served by the Storage REST API (public URL / download() 404).
# Re-upload the same bytes via the Storage API so getPublicUrl + download work.
if [[ "${SKIP_REST_UPLOAD:-0}" != "1" ]] && command -v node >/dev/null; then
  echo "=== Step 3: REST re-upload (upsert) so Storage gateway serves files ==="
  STAGING_DIR="$STAGING_DIR" node "$ROOT/scripts/supabase-migrate/rest-upload-canvas-from-staging.mjs" || exit 1
else
  echo "=== Skip Step 3 (set node in PATH; or SKIP_REST_UPLOAD=1 to skip). Run manually:"
  echo "    STAGING_DIR=\"$STAGING_DIR\" node \"$ROOT/scripts/supabase-migrate/rest-upload-canvas-from-staging.mjs\""
fi

echo "=== Done. Remove staging: rm -rf \"$STAGING_DIR\" ==="
