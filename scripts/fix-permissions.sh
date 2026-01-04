#!/bin/bash

# Fix file permissions for OptimX project
# Run this if you encounter "permission denied" or "cannot find module" errors
# Usage: ./scripts/fix-permissions.sh

echo "🔧 Fixing file permissions for OptimX..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Get the project root directory (parent of scripts/)
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Change to project root
cd "$PROJECT_ROOT"

# Fix ownership for key directories
echo "📁 Fixing ownership of key directories..."

sudo chown -R bharath.kumart:staff lib/
sudo chown -R bharath.kumart:staff database/
sudo chown -R bharath.kumart:staff auth/
sudo chown -R bharath.kumart:staff pages/
sudo chown -R bharath.kumart:staff app/
sudo chown -R bharath.kumart:staff components/
sudo chown -R bharath.kumart:staff api/
sudo chown -R bharath.kumart:staff scripts/
sudo chown -R bharath.kumart:staff docs/

# Fix ownership for config files
echo "⚙️  Fixing ownership of configuration files..."

sudo chown bharath.kumart:staff .env* 2>/dev/null || true
sudo chown bharath.kumart:staff *.json 2>/dev/null || true
sudo chown bharath.kumart:staff *.md 2>/dev/null || true
sudo chown bharath.kumart:staff *.js 2>/dev/null || true
sudo chown bharath.kumart:staff *.ts 2>/dev/null || true

# Make scripts executable
echo "🔐 Making scripts executable..."
chmod +x scripts/*.sh

# Fix Prisma schema
echo "💾 Fixing Prisma schema permissions..."
sudo chown bharath.kumart:staff prisma/ 2>/dev/null || true
sudo chown bharath.kumart:staff prisma/*.prisma 2>/dev/null || true

echo ""
echo "✅ Permissions fixed!"
echo ""
echo "Next steps:"
echo "1. Restart your IDE/editor (VS Code, etc.)"
echo "2. Run: npm install"
echo "3. Run: npm run dev"
echo ""
