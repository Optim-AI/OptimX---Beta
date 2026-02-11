#!/bin/bash
# Migrate all Supabase to local: start local stack and apply all migrations.
# Use this to run the full schema (supabase/migrations) and seed on local PostgreSQL.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🔄 Migrating Supabase to local"
echo "==============================="

# 1. Docker
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}❌ Docker is not running. Start Docker first.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Docker running${NC}"

# 2. Supabase CLI
if ! command -v supabase &> /dev/null; then
  echo -e "${RED}❌ Supabase CLI not found. Install: brew install supabase/tap/supabase${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Supabase CLI: $(supabase --version)${NC}"

# 3. Start local Supabase (idempotent; no-op if already running)
echo -e "\n${YELLOW}Starting local Supabase...${NC}"
supabase start

# 4. Apply all migrations and seed (resets DB then runs migrations in order)
echo -e "\n${YELLOW}Applying all migrations to local DB...${NC}"
supabase db reset

# 5. Status
echo -e "\n${BLUE}Local Supabase status:${NC}"
supabase status

echo -e "\n${GREEN}✅ Supabase is fully migrated to local.${NC}"
echo ""
echo "Use these in .env.local (already set for local):"
echo "  SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL = http://localhost:54321"
echo "  DATABASE_URL = postgresql://postgres:postgres@localhost:54322/postgres"
echo ""
echo "  Supabase Studio: http://localhost:54323"
echo "  Next.js app:     http://localhost:3000"
