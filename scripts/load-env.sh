#!/bin/bash

# ============================================================
# Environment Loader Script
# ============================================================
# Loads the correct .env file based on APP_ENV variable
# Usage:
#   source ./scripts/load-env.sh
#   APP_ENV=staging source ./scripts/load-env.sh
#
# Supported environments:
#   - local (default) - loads .env.local
#   - staging - loads .env.staging
#   - production - loads .env.production
# ============================================================

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Get the project root directory (parent of scripts/)
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Determine which environment to load
APP_ENV="${APP_ENV:-local}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Determine which .env file to load
case "$APP_ENV" in
  local)
    ENV_FILE=".env.local"
    ;;
  staging)
    ENV_FILE=".env.staging"
    ;;
  production)
    ENV_FILE=".env.production"
    ;;
  *)
    echo -e "${RED}Error: Unknown environment '$APP_ENV'${NC}"
    echo "Supported environments: local, staging, production"
    exit 1
    ;;
esac

ENV_PATH="$PROJECT_ROOT/$ENV_FILE"

# Check if the environment file exists
if [ ! -f "$ENV_PATH" ]; then
  echo -e "${RED}Error: Environment file not found: $ENV_PATH${NC}"
  echo ""
  echo "Please create $ENV_FILE by copying from .env.example:"
  echo "  cp .env.example $ENV_FILE"
  exit 1
fi

echo -e "${GREEN}✓ Loading environment: $APP_ENV${NC}"
echo -e "${YELLOW}  Using file: $ENV_FILE${NC}"

# Export the environment file path for Node.js tools to use
export ENV_FILE="$ENV_FILE"
export APP_ENV="$APP_ENV"

echo -e "${GREEN}✓ Environment loaded successfully${NC}"
