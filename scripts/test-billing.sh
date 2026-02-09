#!/bin/bash

# test-billing.sh
# CLI script for testing billing system locally
# DEVELOPMENT ONLY

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE=".test-cookie.txt"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  OptimX Billing Test CLI                       ${NC}"
echo -e "${BLUE}  Base URL: $BASE_URL                          ${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed.${NC}"
    echo "Install with: brew install jq"
    exit 1
fi

# Function to make authenticated requests
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -n "$data" ]; then
        curl -s -X "$method" "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -b "$COOKIE_FILE" \
            -d "$data"
    else
        curl -s -X "$method" "$BASE_URL$endpoint" \
            -b "$COOKIE_FILE"
    fi
}

# Function to pretty print JSON
pretty_print() {
    echo "$1" | jq '.' 2>/dev/null || echo "$1"
}

# Show help
show_help() {
    echo -e "${YELLOW}Available commands:${NC}"
    echo ""
    echo "  status           - Show current subscription and credits"
    echo "  plans            - List all available plans"
    echo "  subscribe <plan> - Create test subscription"
    echo "                     Plans: free_trial, basic_monthly, starter_monthly,"
    echo "                            lite_growth_monthly, growth_pro_monthly"
    echo "  add-credits <type> <amount> - Add test credits"
    echo "                     Types: image, video"
    echo "  reset-credits    - Reset subscription credits"
    echo "  cancel           - Cancel subscription"
    echo "  webhook <event>  - Simulate webhook event"
    echo "                     Events: payment.captured, subscription.charged,"
    echo "                             subscription.cancelled, payment.failed"
    echo "  help             - Show this help"
    echo ""
    echo -e "${YELLOW}Note:${NC} You need to be logged in. Visit $BASE_URL/auth/signin"
    echo "      and copy your session cookie to $COOKIE_FILE"
    echo ""
    echo -e "${YELLOW}Example:${NC}"
    echo "  ./scripts/test-billing.sh status"
    echo "  ./scripts/test-billing.sh subscribe starter_monthly"
    echo "  ./scripts/test-billing.sh add-credits image 25"
    echo ""
}

# Check cookie file
check_auth() {
    if [ ! -f "$COOKIE_FILE" ]; then
        echo -e "${YELLOW}Warning: No cookie file found.${NC}"
        echo "Create $COOKIE_FILE with your session cookie:"
        echo "  echo 'sb-xxx=your-session-token' > $COOKIE_FILE"
        echo ""
        echo "Or visit the test dashboard at: $BASE_URL/test-billing"
        echo ""
    fi
}

# Commands
cmd_status() {
    echo -e "${BLUE}Fetching current status...${NC}"
    local response=$(make_request GET "/api/billing/subscriptions/current")
    pretty_print "$response"
}

cmd_plans() {
    echo -e "${BLUE}Fetching available plans...${NC}"
    local response=$(make_request GET "/api/billing/plans")
    pretty_print "$response"
}

cmd_subscribe() {
    local plan=${1:-starter_monthly}
    echo -e "${BLUE}Creating test subscription for plan: $plan${NC}"
    local response=$(make_request POST "/api/testing/create-test-subscription" "{\"planId\": \"$plan\"}")
    pretty_print "$response"
}

cmd_add_credits() {
    local type=${1:-image}
    local amount=${2:-10}
    echo -e "${BLUE}Adding $amount $type credits...${NC}"
    local response=$(make_request POST "/api/testing/add-test-credits" "{\"type\": \"$type\", \"amount\": $amount}")
    pretty_print "$response"
}

cmd_reset_credits() {
    echo -e "${BLUE}Resetting subscription credits...${NC}"
    local response=$(make_request POST "/api/testing/reset-test-credits")
    pretty_print "$response"
}

cmd_cancel() {
    echo -e "${BLUE}Cancelling subscription...${NC}"
    local response=$(make_request POST "/api/testing/cancel-test-subscription")
    pretty_print "$response"
}

cmd_webhook() {
    local event=$1
    if [ -z "$event" ]; then
        echo -e "${RED}Error: Event type required${NC}"
        echo "Available events: payment.captured, subscription.charged, subscription.cancelled, payment.failed"
        exit 1
    fi
    
    echo -e "${BLUE}Simulating webhook: $event${NC}"
    
    # Get subscription ID for subscription events
    local sub_id=""
    if [[ "$event" == subscription.* ]]; then
        local status=$(make_request GET "/api/billing/subscriptions/current")
        sub_id=$(echo "$status" | jq -r '.subscription.razorpaySubscriptionId // empty')
        if [ -z "$sub_id" ]; then
            echo -e "${RED}Error: No active subscription found for webhook simulation${NC}"
            exit 1
        fi
    fi
    
    local data
    case $event in
        "payment.captured")
            data="{\"event\": \"$event\", \"data\": {\"orderId\": \"order_test_$(date +%s)\", \"amount\": 199}}"
            ;;
        "subscription.charged")
            data="{\"event\": \"$event\", \"data\": {\"razorpaySubscriptionId\": \"$sub_id\", \"amount\": 1499}}"
            ;;
        "subscription.cancelled")
            data="{\"event\": \"$event\", \"data\": {\"razorpaySubscriptionId\": \"$sub_id\"}}"
            ;;
        "payment.failed")
            data="{\"event\": \"$event\", \"data\": {\"orderId\": \"order_test_$(date +%s)\", \"amount\": 199}}"
            ;;
        *)
            echo -e "${RED}Unknown event: $event${NC}"
            exit 1
            ;;
    esac
    
    local response=$(make_request POST "/api/testing/simulate-webhook" "$data")
    pretty_print "$response"
}

# Main
check_auth

case ${1:-help} in
    status)
        cmd_status
        ;;
    plans)
        cmd_plans
        ;;
    subscribe)
        cmd_subscribe "$2"
        ;;
    add-credits)
        cmd_add_credits "$2" "$3"
        ;;
    reset-credits)
        cmd_reset_credits
        ;;
    cancel)
        cmd_cancel
        ;;
    webhook)
        cmd_webhook "$2"
        ;;
    help|*)
        show_help
        ;;
esac
