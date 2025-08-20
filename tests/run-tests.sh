#!/bin/bash
# ORBIT Image Forge - Test Runner
# Centralized script for running various test suites

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEFAULT_ORDER_ID="43a14341-28e4-4632-962b-322e9d387db6"
TEST_ORDER_ID="${1:-$DEFAULT_ORDER_ID}"

echo -e "${BLUE}🧪 ORBIT Image Forge Test Runner${NC}"
echo "=================================="
echo "Test Order ID: $TEST_ORDER_ID"
echo "Timestamp: $(date)"
echo ""

# Function to run a test with error handling
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "${YELLOW}📋 Running: $test_name${NC}"
    echo "Command: $test_command"
    echo ""
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ $test_name: PASSED${NC}"
    else
        echo -e "${RED}❌ $test_name: FAILED${NC}"
        return 1
    fi
    echo ""
}

# Test menu
show_menu() {
    echo -e "${BLUE}Available Test Suites:${NC}"
    echo "1. Two-Tier Architecture (Complete System Test)"
    echo "2. Tier 1 Fast Path (process-image-batch)"
    echo "3. MCP Server Functionality"
    echo "4. Email System Testing"
    echo "5. All Tests (Sequential)"
    echo "6. Quick Health Check"
    echo ""
    echo "0. Exit"
    echo ""
}

# Individual test functions
test_two_tier() {
    run_test "Two-Tier Architecture Test" "./tests/scripts/test-two-tier-architecture.sh $TEST_ORDER_ID"
}

test_tier1() {
    run_test "Tier 1 Fast Path Test" "./tests/scripts/test-process-batch.sh $TEST_ORDER_ID"
}

test_mcp() {
    run_test "MCP Server Functionality" "node tests/scripts/test-mcp-servers-functionality.cjs"
}

test_email() {
    run_test "Email System Test" "node tests/scripts/test-email-trigger.cjs $TEST_ORDER_ID"
}

test_health_check() {
    echo -e "${YELLOW}📊 Quick Health Check${NC}"
    
    # Check if required environment variables are set
    local env_vars=("SUPABASE_URL" "sb_secret_key" "GOOGLE_API_KEY")
    local missing_vars=0
    
    for var in "${env_vars[@]}"; do
        if [ -z "${!var}" ]; then
            echo -e "${RED}❌ Missing environment variable: $var${NC}"
            ((missing_vars++))
        else
            echo -e "${GREEN}✅ $var is set${NC}"
        fi
    done
    
    if [ $missing_vars -eq 0 ]; then
        echo -e "${GREEN}✅ Environment configuration: GOOD${NC}"
        
        # Test basic connectivity
        echo -e "${YELLOW}🔗 Testing Supabase connectivity...${NC}"
        if curl -s "$SUPABASE_URL/rest/v1/orders?select=count" \
           -H "apikey: $sb_secret_key" \
           -H "Authorization: Bearer $sb_secret_key" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Supabase connectivity: GOOD${NC}"
        else
            echo -e "${RED}❌ Supabase connectivity: FAILED${NC}"
        fi
    else
        echo -e "${RED}❌ Environment configuration: INCOMPLETE${NC}"
        echo "Please set missing environment variables before running tests."
    fi
    echo ""
}

run_all_tests() {
    echo -e "${BLUE}🚀 Running All Tests Sequentially${NC}"
    echo "=================================="
    
    local total_tests=4
    local passed_tests=0
    
    test_health_check
    
    if test_two_tier; then ((passed_tests++)); fi
    if test_tier1; then ((passed_tests++)); fi
    if test_mcp; then ((passed_tests++)); fi
    if test_email; then ((passed_tests++)); fi
    
    echo -e "${BLUE}📊 Test Summary${NC}"
    echo "==============="
    echo "Passed: $passed_tests/$total_tests tests"
    
    if [ $passed_tests -eq $total_tests ]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
        return 0
    else
        echo -e "${RED}⚠️  Some tests failed. Check output above for details.${NC}"
        return 1
    fi
}

# Main execution
if [ $# -eq 0 ]; then
    # Interactive mode
    while true; do
        show_menu
        read -p "Select test suite (0-6): " choice
        
        case $choice in
            1) test_two_tier ;;
            2) test_tier1 ;;
            3) test_mcp ;;
            4) test_email ;;
            5) run_all_tests ;;
            6) test_health_check ;;
            0) echo "Goodbye!"; exit 0 ;;
            *) echo -e "${RED}Invalid option. Please try again.${NC}" ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
        clear
    done
else
    # Non-interactive mode with specific test
    case "$2" in
        "two-tier") test_two_tier ;;
        "tier1") test_tier1 ;;
        "mcp") test_mcp ;;
        "email") test_email ;;
        "all") run_all_tests ;;
        "health") test_health_check ;;
        *)
            echo "Usage: $0 [ORDER_ID] [test_type]"
            echo "Test types: two-tier, tier1, mcp, email, all, health"
            echo "Or run without arguments for interactive mode"
            exit 1
            ;;
    esac
fi