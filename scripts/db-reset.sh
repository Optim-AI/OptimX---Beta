#!/bin/bash
# Reset database for a given environment
# Usage: ./scripts/db-reset.sh [local|staging|production]

set -e

ENV="${1:-local}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$PROJECT_DIR/supabase/migrations"
PSQL="/opt/homebrew/opt/libpq/bin/psql"

STORAGE_BUCKET="campaign-assets"

# Function to clear all files from a Supabase storage bucket via REST API
# Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in env
clear_storage_bucket() {
  local SB_URL="${SUPABASE_URL:-$NEXT_PUBLIC_SUPABASE_URL}"
  local SB_KEY="$SUPABASE_SERVICE_ROLE_KEY"

  if [ -z "$SB_URL" ] || [ -z "$SB_KEY" ]; then
    echo "  Skipping storage cleanup (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set)"
    return 0
  fi

  echo "Clearing storage bucket '$STORAGE_BUCKET'..."

  # List all top-level folders/files in the bucket
  local PREFIXES=("generated" "campaigns" "temp")

  for prefix in "${PREFIXES[@]}"; do
    echo "  Listing objects under '$prefix/'..."

    local LIST_RESP
    LIST_RESP=$(curl -s -X POST \
      "${SB_URL}/storage/v1/object/list/${STORAGE_BUCKET}" \
      -H "Authorization: Bearer ${SB_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"prefix\":\"${prefix}\",\"limit\":1000}" 2>/dev/null || echo "[]")

    # Extract file names from the JSON array
    local FILES
    FILES=$(echo "$LIST_RESP" | python3 -c "
import sys, json
try:
    items = json.load(sys.stdin)
    if not isinstance(items, list):
        sys.exit(0)
    for item in items:
        name = item.get('name', '')
        if name:
            print('${prefix}/' + name)
except:
    pass
" 2>/dev/null || true)

    if [ -z "$FILES" ]; then
      echo "    No files found under '$prefix/'"
      continue
    fi

    # Build JSON array of file paths for deletion
    local JSON_ARRAY
    JSON_ARRAY=$(echo "$FILES" | python3 -c "
import sys, json
paths = [line.strip() for line in sys.stdin if line.strip()]
print(json.dumps(paths))
" 2>/dev/null)

    if [ "$JSON_ARRAY" = "[]" ] || [ -z "$JSON_ARRAY" ]; then
      continue
    fi

    local COUNT
    COUNT=$(echo "$FILES" | wc -l | tr -d ' ')
    echo "    Deleting $COUNT files under '$prefix/'..."

    curl -s -X DELETE \
      "${SB_URL}/storage/v1/object/${STORAGE_BUCKET}" \
      -H "Authorization: Bearer ${SB_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"prefixes\":${JSON_ARRAY}}" > /dev/null 2>&1 || echo "    (warning: delete request may have partially failed)"
  done

  echo "  Storage cleanup complete."
}

# Function to drop all public tables, clear auth.users, and reapply migrations
reset_remote_db() {
  local DB_URL="$1"

  echo "Dropping all public tables..."
  "$PSQL" "$DB_URL" <<'SQL'
DO $$
DECLARE
  tbl TEXT;
BEGIN
  -- Drop all tables in public schema
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', tbl);
    RAISE NOTICE 'Dropped: %', tbl;
  END LOOP;

  -- Drop supabase_migrations tracking table so migrations can be reapplied
  DROP TABLE IF EXISTS supabase_migrations.schema_migrations CASCADE;
END $$;
SQL

  echo "Clearing auth.users..."
  "$PSQL" "$DB_URL" -c "TRUNCATE auth.users CASCADE;" 2>/dev/null || echo "(auth.users truncate skipped - may not have permission)"

  # Clear storage bucket
  clear_storage_bucket

  echo "Reapplying migrations..."
  for migration in "$MIGRATIONS_DIR"/*.sql; do
    filename=$(basename "$migration")
    echo "  Applying $filename..."
    "$PSQL" "$DB_URL" -f "$migration" 2>&1 | grep -v "^$" || true
  done

  echo "Done."
}

case "$ENV" in
  local)
    echo "Resetting LOCAL database (supabase db reset)..."
    # supabase db reset drops everything including storage.objects, so bucket files are cleared
    npx supabase db reset
    echo "Local database reset complete."
    ;;

  staging)
    source "$PROJECT_DIR/.env.staging"
    if [ -z "$DATABASE_URL" ]; then
      echo "ERROR: DATABASE_URL not found in .env.staging"
      exit 1
    fi
    echo "WARNING: This will DROP all tables, clear auth.users, clear storage files, and reapply migrations in STAGING."
    read -p "Are you sure? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
      echo "Aborted."
      exit 0
    fi
    reset_remote_db "$DATABASE_URL"
    echo "Staging database reset complete."
    ;;

  production)
    source "$PROJECT_DIR/.env.production"
    if [ -z "$DATABASE_URL" ]; then
      echo "ERROR: DATABASE_URL not found in .env.production"
      exit 1
    fi
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    echo "  WARNING: This will DROP all tables in PRODUCTION,"
    echo "  clear all storage files, and reapply all"
    echo "  migrations from scratch!"
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    read -p "Type 'DELETE PRODUCTION' to confirm: " CONFIRM
    if [ "$CONFIRM" != "DELETE PRODUCTION" ]; then
      echo "Aborted."
      exit 0
    fi
    reset_remote_db "$DATABASE_URL"
    echo "Production database reset complete."
    ;;

  *)
    echo "Usage: ./scripts/db-reset.sh [local|staging|production]"
    echo "  local       - runs 'supabase db reset' (default)"
    echo "  staging     - drops tables, clears storage, reapplies migrations in staging DB"
    echo "  production  - drops tables, clears storage, reapplies migrations in production DB"
    exit 1
    ;;
esac
