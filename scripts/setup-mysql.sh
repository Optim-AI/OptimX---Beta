#!/bin/bash

# Setup script for MySQL local development

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Get the project root directory (parent of scripts/)
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Change to project root
cd "$PROJECT_ROOT"

echo "🚀 Setting up MySQL for OptimX local development..."
echo "📁 Working directory: $PROJECT_ROOT"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

echo "✅ Docker is running"

# Check if mysql2 package is installed
if ! npm list mysql2 > /dev/null 2>&1; then
    echo "📦 Installing mysql2 package..."
    npm install mysql2
    echo "✅ mysql2 installed"
else
    echo "✅ mysql2 already installed"
fi

# Check if uuid package is installed
if ! npm list uuid > /dev/null 2>&1; then
    echo "📦 Installing uuid package..."
    npm install uuid
    npm install --save-dev @types/uuid
    echo "✅ uuid installed"
else
    echo "✅ uuid already installed"
fi

# Start Docker Compose
echo ""
echo "🐳 Starting MySQL with Docker Compose..."
docker-compose up -d

# Wait for MySQL to be ready
echo "⏳ Waiting for MySQL to be ready..."
sleep 10

# Check if MySQL is ready
MAX_TRIES=30
TRIES=0
until docker exec optimx-mysql mysqladmin ping -h localhost -u optimx_user -poptimx_password --silent > /dev/null 2>&1; do
    TRIES=$((TRIES+1))
    if [ $TRIES -eq $MAX_TRIES ]; then
        echo "❌ MySQL failed to start after 30 seconds"
        echo "Check logs: docker logs optimx-mysql"
        exit 1
    fi
    echo "   Still waiting... ($TRIES/$MAX_TRIES)"
    sleep 1
done

echo "✅ MySQL is ready!"

# Verify tables exist
echo ""
echo "🔍 Verifying database tables..."
TABLES=$(docker exec optimx-mysql mysql -u optimx_user -poptimx_password optimx -e "SHOW TABLES;" 2>/dev/null | wc -l)

if [ $TABLES -gt 1 ]; then
    echo "✅ Database tables created successfully"
    docker exec optimx-mysql mysql -u optimx_user -poptimx_password optimx -e "SHOW TABLES;"
else
    echo "⚠️  No tables found. Schema may not have loaded."
    echo "   Check: mysql/init/01_schema.sql"
fi

# Check .env.local
echo ""
if [ -f .env.local ]; then
    if grep -q "DB_TYPE=mysql" .env.local; then
        echo "✅ .env.local already configured for MySQL"
    else
        echo "⚠️  Add these to your .env.local:"
        echo ""
        echo "DB_TYPE=mysql"
        echo "MYSQL_HOST=localhost"
        echo "MYSQL_PORT=3306"
        echo "MYSQL_USER=optimx_user"
        echo "MYSQL_PASSWORD=optimx_password"
        echo "MYSQL_DATABASE=optimx"
    fi
else
    echo "⚠️  .env.local not found. Copy from .env.example:"
    echo "   cp .env.example .env.local"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ MySQL setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 phpMyAdmin: http://localhost:8080"
echo "   Username: optimx_user"
echo "   Password: optimx_password"
echo ""
echo "🗄️  MySQL: localhost:3306"
echo "   Database: optimx"
echo ""
echo "🛠️  Useful commands:"
echo "   docker-compose down     # Stop MySQL"
echo "   docker-compose up -d    # Start MySQL"
echo "   docker logs optimx-mysql # View logs"
echo ""
echo "📚 Full guide: docs/MYSQL_SETUP.md"
echo ""

# Ask user if they want to start the dev server
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -p "🚀 Do you want to start the development server now? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Starting Next.js development server..."
    echo "   Press Ctrl+C to stop the server"
    echo ""
    sleep 2
    npm run dev
else
    echo ""
    echo "✅ Setup complete! Start development server manually with:"
    echo "   npm run dev"
    echo ""
fi
