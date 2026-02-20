#!/bin/bash
# Reset database for a given environment
# Usage: ./scripts/db-reset.sh [local|staging|production]

set -e

ENV="${1:-local}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$PROJECT_DIR/supabase/migrations"
PSQL="/opt/homebrew/opt/libpq/bin/psql"

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
    npx supabase db reset
    echo "Local database reset complete."
    ;;

  staging)
    source "$PROJECT_DIR/.env.staging"
    if [ -z "$DATABASE_URL" ]; then
      echo "ERROR: DATABASE_URL not found in .env.staging"
      exit 1
    fi
    echo "WARNING: This will DROP all tables, clear auth.users, and reapply migrations in STAGING."
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
    echo "  WARNING: This will DROP all tables in PRODUCTION"
    echo "  and reapply all migrations from scratch!"
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
    echo "  staging     - drops tables, reapplies migrations in staging DB"
    echo "  production  - drops tables, reapplies migrations in production DB"
    exit 1
    ;;
esac
