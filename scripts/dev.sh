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

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running.${NC}"
    echo ""
    echo "Please start Docker Desktop and try again."
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found.${NC}"
    echo ""
    echo "Install with Homebrew (macOS):"
    echo "  ${BLUE}brew install supabase/tap/supabase${NC}"
    echo ""
    echo "Or with npm:"
    echo "  ${BLUE}npm install -g supabase${NC}"
    echo ""
    exit 1
fi
echo -e "${GREEN}✓ Supabase CLI installed${NC}"

echo ""

# ============================================================
# 2. Start or Check Supabase
# ============================================================
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
# Run Next.js directly (not npm run dev to avoid recursion)
npx next dev
