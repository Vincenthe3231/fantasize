#!/usr/bin/env bash
# Deploy `scout-execute` and set OPENROUTER_API_KEY on the target Supabase project.
# Edge Functions cannot be migrated via SQL; this uses the Supabase CLI.
#
# Usage:
#   1) cp scripts/supabase-migrate/env.edge.example scripts/supabase-migrate/env.edge.local
#   2) Edit env.edge.local — set OPENROUTER_API_KEY=sk-or-v1-...
#   3) ./scripts/supabase-migrate/deploy-scout-execute-target.sh
#
# Optional: SUPABASE_PROJECT_REF=your_ref (defaults to nkijmkgdazikhyjpwcsl)

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REF="${SUPABASE_PROJECT_REF:-nkijmkgdazikhyjpwcsl}"
ENV_FILE="${ENV_FILE:-$ROOT/scripts/supabase-migrate/env.edge.local}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy env.edge.example to env.edge.local and set OPENROUTER_API_KEY." >&2
  exit 1
fi

# Extract OPENROUTER_API_KEY=... (value may contain '=')
OPENROUTER_API_KEY=""
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// }" ]] && continue
  if [[ "$line" =~ ^OPENROUTER_API_KEY= ]]; then
    OPENROUTER_API_KEY="${line#OPENROUTER_API_KEY=}"
    OPENROUTER_API_KEY="${OPENROUTER_API_KEY%\"}"
    OPENROUTER_API_KEY="${OPENROUTER_API_KEY#\"}"
    OPENROUTER_API_KEY="${OPENROUTER_API_KEY%\'}"
    OPENROUTER_API_KEY="${OPENROUTER_API_KEY#\'}"
  fi
done < "$ENV_FILE"

if [[ -z "${OPENROUTER_API_KEY// }" ]]; then
  echo "OPENROUTER_API_KEY is empty in $ENV_FILE" >&2
  exit 1
fi

echo "Setting secret OPENROUTER_API_KEY on project $REF …"
pnpx supabase secrets set "OPENROUTER_API_KEY=$OPENROUTER_API_KEY" --project-ref "$REF"

echo "Deploying scout-execute …"
pnpx supabase functions deploy scout-execute --no-verify-jwt --project-ref "$REF"

echo "Done. Verify: POST https://${REF}.supabase.co/functions/v1/scout-execute (should not return NOT_FOUND)."
