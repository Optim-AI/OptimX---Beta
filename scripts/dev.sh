#!/bin/bash

# ============================================================
# SkalX AI Development Startup Script
# ============================================================
# Starts Supabase local stack and Next.js dev server
# Usage: ./scripts/dev.sh or npm run dev
#
# Prerequisites:
# - Docker must be running
# - Supabase CLI installed (brew install supabase/tap/supabase)
# ============================================================

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Get the project root directory (parent of scripts/)
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Change to project root
cd "$PROJECT_ROOT"

echo "🚀 SkalX AI Development Startup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================
# 1. Check Prerequisites
# ============================================================
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Docker + Supabase CLI are only needed for login and in-app features.
# If either is missing, warn and still start Next.js so the marketing site runs.
SKIP_SUPABASE=0
if ! docker info > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Docker is not running — skipping local Supabase.${NC}"
    echo "  Marketing pages will work. Start Docker Desktop for login and app features."
    SKIP_SUPABASE=1
elif ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}⚠ Supabase CLI not found — skipping local Supabase.${NC}"
    echo "  Install with: ${BLUE}brew install supabase/tap/supabase${NC}"
    SKIP_SUPABASE=1
else
    echo -e "${GREEN}✓ Docker is running${NC}"
    echo -e "${GREEN}✓ Supabase CLI installed${NC}"
fi

echo ""

# ============================================================
# 2. Start or Check Supabase
# ============================================================
if [ "$SKIP_SUPABASE" -eq 0 ]; then
    echo -e "${YELLOW}Checking Supabase status...${NC}"

    # Check if Supabase is already running
    if supabase status > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Supabase is already running${NC}"
    else
        echo -e "${YELLOW}Starting Supabase local stack...${NC}"
        echo "This includes: PostgreSQL, Auth, Storage, Realtime, Studio"
        echo ""

        supabase start

        echo ""
        echo -e "${GREEN}✓ Supabase started successfully${NC}"
    fi
fi

# ============================================================
# 3. Display Connection Info
# ============================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🚀 Development Environment Ready${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📍 Service URLs:"
echo "   ┌────────────────────────────────────────────────────┐"
echo "   │  Next.js App:       http://localhost:3000         │"
echo "   │  Supabase Studio:   http://localhost:54323        │"
echo "   │  PostgreSQL:        localhost:54322               │"
echo "   │  Supabase API:      http://localhost:54321        │"
echo "   │  Storage:           http://localhost:54321/storage│"
echo "   │  Auth:              http://localhost:54321/auth   │"
echo "   │  Email (Inbucket):  http://localhost:54324        │"
echo "   └────────────────────────────────────────────────────┘"
echo ""
echo "🗄️  Database:"
echo "   Connection: postgresql://postgres:postgres@localhost:54322/postgres"
echo "   Migrations: supabase/migrations/"
echo ""
echo "💾 Storage Buckets:"
echo "   • campaign-assets  - Public, images/videos"
echo "   • user-uploads     - Public, images/videos/PDFs"
echo ""
echo "🔧 Useful Commands:"
echo "   supabase status      - View service status"
echo "   supabase stop        - Stop all services"
echo "   supabase db reset    - Reset database & run migrations"
echo "   npm run db:studio    - Open Drizzle Studio"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🚀 Starting Next.js development server...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Small delay to let output be readable
sleep 1

# ============================================================
# 4. Start Next.js Dev Server
# ============================================================
# Only one dev server may run.
# Multiple instances fight over .next and can cause reload loops.
for PORT in 3000 3001; do
  if PIDS=$(lsof -ti :"$PORT" 2>/dev/null); then
    echo -e "${YELLOW}Stopping existing process on port ${PORT}...${NC}"
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
  fi
done
sleep 1

# Run Next.js directly (not npm run dev to avoid recursion)
npx next dev
