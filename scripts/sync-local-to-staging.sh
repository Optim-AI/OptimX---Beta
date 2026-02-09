#!/bin/bash
# Sync local development database (public schema only) to staging
# This will overwrite the staging database public schema with local dev data

set -e

echo "🚀 Starting sync from local to staging database (public schema only)..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Staging database connection details
STAGING_HOST="aws-1-ap-south-1.pooler.supabase.com"
STAGING_PORT="6543"
STAGING_DB="postgres"
STAGING_USER="postgres.lgwobyuucvlvsfxapnwf"
STAGING_PASSWORD="xc2z6UW4mbsCxZQa"

# Temporary files
SCHEMA_DUMP="/tmp/local_schema_public.sql"
DATA_DUMP="/tmp/local_data_public.sql"

echo "📦 Step 1: Dumping public schema from local database..."
supabase db dump --local --schema public --file "$SCHEMA_DUMP" --keep-comments
echo -e "${GREEN}✅ Schema dumped to $SCHEMA_DUMP${NC}"
echo ""

echo "📦 Step 2: Dumping public schema data from local database..."
supabase db dump --local --schema public --data-only --file "$DATA_DUMP"
echo -e "${GREEN}✅ Data dumped to $DATA_DUMP${NC}"
echo ""

echo "⚠️  WARNING: This will DROP all tables in public schema on staging and recreate them!"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read -r

echo ""
echo "🗑️  Step 3: Dropping existing public schema tables in staging..."
# Create a script to drop all tables in public schema only
cat > /tmp/drop_public.sql << 'EOF'
-- Drop all tables in public schema only
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Disable triggers temporarily
    SET session_replication_role = replica;

    -- Drop all tables
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;

    -- Drop all sequences
    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequence_name) || ' CASCADE';
    END LOOP;

    -- Re-enable triggers
    SET session_replication_role = DEFAULT;
END $$;
EOF

node -e "
const { Client } = require('pg');
const fs = require('fs');

async function dropAll() {
  const client = new Client({
    host: '$STAGING_HOST',
    port: $STAGING_PORT,
    database: '$STAGING_DB',
    user: '$STAGING_USER',
    password: '$STAGING_PASSWORD',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const sql = fs.readFileSync('/tmp/drop_public.sql', 'utf8');
    await client.query(sql);
    await client.end();
    console.log('✅ Dropped all existing tables in public schema');
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

dropAll();
"
echo ""

echo "📥 Step 4: Applying public schema to staging..."
node -e "
const { Client } = require('pg');
const fs = require('fs');

async function applySchema() {
  const client = new Client({
    host: '$STAGING_HOST',
    port: $STAGING_PORT,
    database: '$STAGING_DB',
    user: '$STAGING_USER',
    password: '$STAGING_PASSWORD',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const sql = fs.readFileSync('$SCHEMA_DUMP', 'utf8');
    await client.query(sql);
    await client.end();
    console.log('✅ Schema applied to staging');
  } catch (e) {
    console.error('❌ Error applying schema:', e.message);
    console.error('Full error:', e);
    process.exit(1);
  }
}

applySchema();
"
echo ""

echo "📥 Step 5: Loading data into staging..."
node -e "
const { Client } = require('pg');
const fs = require('fs');

async function applyData() {
  const client = new Client({
    host: '$STAGING_HOST',
    port: $STAGING_PORT,
    database: '$STAGING_DB',
    user: '$STAGING_USER',
    password: '$STAGING_PASSWORD',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Set session_replication_role to replica to disable triggers during import
    await client.query('SET session_replication_role = replica;');

    const sql = fs.readFileSync('$DATA_DUMP', 'utf8');
    await client.query(sql);

    // Re-enable triggers
    await client.query('SET session_replication_role = DEFAULT;');

    await client.end();
    console.log('✅ Data loaded into staging');
  } catch (e) {
    console.error('❌ Error loading data:', e.message);
    console.error('Full error:', e);
    process.exit(1);
  }
}

applyData();
"
echo ""

echo "🧹 Cleaning up temporary files..."
rm -f "$SCHEMA_DUMP" "$DATA_DUMP" /tmp/drop_public.sql
echo ""

echo -e "${GREEN}✨ Sync complete! Staging public schema now matches local dev.${NC}"
