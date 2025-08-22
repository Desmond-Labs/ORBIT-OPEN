#!/bin/bash

# ORBIT Claude Code Agent Testing Script
# Tests the Claude Code SDK integration with the ORBIT image processing workflow

set -e # Exit on any error

# Configuration
SUPABASE_URL="https://ufdcvxmizlzlnyyqpfck.supabase.co"
SB_SECRET_KEY="sb_secret_gEbqTxZ0IzwP0AkXbx-dNA_C5jFwV9I"

# Default test order (the specific order you want to test)
ORDER_ID="${1:-63f22b07-2e68-4f2a-8c50-081fcbcc0fed}"
ANALYSIS_TYPE="${2:-lifestyle}"

# --- Test State Variables ---
HEALTH_CHECK_RESULT=""
PROCESS_BATCH_RESULT=""
ORDER_STATUS=""

# --- Test Functions ---

# Function to test Claude agent health check
test_health_check() {
    echo "🔍 Testing Claude Agent Health Check..."
    echo "======================================="
    
    health_response=$(curl -s -L -X GET "$SUPABASE_URL/functions/v1/orbit-claude-agent-health" \
        -w "HTTPSTATUS:%{http_code}")
    
    # Extract HTTP status and body
    health_http_code=$(echo "$health_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    health_body=$(echo "$health_response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    echo "Health Check HTTP Status: $health_http_code"
    echo ""
    
    if [ "$health_http_code" -eq 200 ]; then
        echo "✅ HEALTH CHECK SUCCESS"
        echo "🤖 Health Check Output:"
        echo "======================="
        echo "$health_body" | jq '.'
        echo ""
        
        # Store the health result for analysis
        HEALTH_CHECK_RESULT="$health_body"
        
        # Check if Claude agent is enabled
        agent_enabled=$(echo "$health_body" | jq -r '.deployment.enabled // false')
        rollout_percentage=$(echo "$health_body" | jq -r '.deployment.rollout_percentage // 0')
        
        echo "📊 Agent Status:"
        echo "   Enabled: $agent_enabled"
        echo "   Rollout Percentage: $rollout_percentage%"
        echo ""
        
        return 0
    else
        echo "❌ HEALTH CHECK FAILED: HTTP $health_http_code"
        if [ "$health_http_code" -eq 404 ]; then
            echo "💡 The Claude agent health endpoint is not deployed yet."
            echo "   Deploy it with: supabase functions deploy orbit-claude-agent-health"
        else
            echo "Error Response:"
            echo "$health_body" | jq '.' 2>/dev/null || echo "$health_body"
        fi
        return 1
    fi
}

# Function to get order status from database
check_order_status() {
    echo "🔍 Checking Order Status in Database..."
    echo "======================================="
    
    echo "🗃️ Getting order details for: $ORDER_ID"
    
    sql_query="SELECT o.id, o.order_number, o.processing_stage, o.payment_status, o.order_status,
                      b.status as batch_status, b.processed_count, b.error_count,
                      COUNT(i.id) as total_images,
                      COUNT(CASE WHEN i.processing_status = 'pending' THEN 1 END) as pending_images,
                      COUNT(CASE WHEN i.processing_status = 'complete' THEN 1 END) as completed_images
               FROM orders o
               LEFT JOIN batches b ON o.batch_id = b.id
               LEFT JOIN images i ON o.id = i.order_id
               WHERE o.id = '$ORDER_ID'
               GROUP BY o.id, b.id;"
    
    echo "📋 SQL Query:"
    echo "$sql_query"
    echo ""
    
    echo "🔄 Executing query..."
    output=$(supabase db query "$sql_query" 2>&1)
    exit_code=$?

    if [ $exit_code -eq 0 ]; then
        echo "✅ Order query successful"
        echo "$output"
        echo ""
        ORDER_STATUS="found"
        return 0
    else
        echo "❌ Order query failed"
        echo "Error: $output"
        ORDER_STATUS="not_found"
        return 1
    fi
}

# Function to test Claude agent processing (forced)
test_claude_agent_processing() {
    echo "🤖 Testing Claude Agent Processing (Forced)..."
    echo "==============================================="
    
    echo "🎯 Processing Order: $ORDER_ID with Claude Agent"
    echo "📋 Analysis Type: $ANALYSIS_TYPE"
    echo ""
    
    # Create the request payload
    request_payload=$(jq -n \
        --arg orderId "$ORDER_ID" \
        --arg analysisType "$ANALYSIS_TYPE" \
        '{
            orderId: $orderId,
            analysisType: $analysisType,
            useClaudeAgent: true
        }')
    
    echo "📤 Request Payload:"
    echo "$request_payload" | jq '.'
    echo ""
    
    echo "🚀 Sending request to process-image-batch..."
    
    process_response=$(curl -s -L -X POST "$SUPABASE_URL/functions/v1/process-image-batch" \
        -H "Authorization: Bearer $SB_SECRET_KEY" \
        -H "apikey: $SB_SECRET_KEY" \
        -H "Content-Type: application/json" \
        -w "HTTPSTATUS:%{http_code}" \
        --data "$request_payload")
    
    # Extract HTTP status and body
    process_http_code=$(echo "$process_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    process_body=$(echo "$process_response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    echo "Process Batch HTTP Status: $process_http_code"
    echo ""
    
    if [ "$process_http_code" -eq 200 ]; then
        echo "✅ CLAUDE AGENT PROCESSING SUCCESS"
        echo "🤖 Processing Output:"
        echo "===================="
        echo "$process_body" | jq '.'
        echo ""
        
        # Check if Claude agent was actually used
        agent_used=$(echo "$process_body" | jq -r '.agent_used // "unknown"')
        
        if [ "$agent_used" = "claude" ]; then
            echo "🎉 SUCCESS: Claude Agent processed the order!"
            echo "📊 Results:"
            success_count=$(echo "$process_body" | jq -r '.results.success_count // 0')
            error_count=$(echo "$process_body" | jq -r '.results.error_count // 0')
            total_images=$(echo "$process_body" | jq -r '.results.total_images // 0')
            echo "   Total Images: $total_images"
            echo "   Success Count: $success_count"
            echo "   Error Count: $error_count"
        else
            echo "⚠️  Claude Agent was not used. Agent used: $agent_used"
            fallback_reason=$(echo "$process_body" | jq -r '.fallback_reason // "unknown"')
            echo "   Reason: $fallback_reason"
        fi
        
        PROCESS_BATCH_RESULT="success"
        return 0
    else
        echo "❌ CLAUDE AGENT PROCESSING FAILED: HTTP $process_http_code"
        echo "Error Response:"
        echo "$process_body" | jq '.' 2>/dev/null || echo "$process_body"
        
        PROCESS_BATCH_RESULT="failed"
        return 1
    fi
}

# Function to test legacy processing (fallback)
test_legacy_processing() {
    echo "🏛️ Testing Legacy Processing (Fallback)..."
    echo "==========================================="
    
    echo "🎯 Processing Order: $ORDER_ID with Legacy Processing"
    echo ""
    
    # Create the request payload with Claude agent disabled
    request_payload=$(jq -n \
        --arg orderId "$ORDER_ID" \
        --arg analysisType "$ANALYSIS_TYPE" \
        '{
            orderId: $orderId,
            analysisType: $analysisType,
            useClaudeAgent: false
        }')
    
    echo "📤 Request Payload:"
    echo "$request_payload" | jq '.'
    echo ""
    
    echo "🚀 Sending request to process-image-batch..."
    
    legacy_response=$(curl -s -L -X POST "$SUPABASE_URL/functions/v1/process-image-batch" \
        -H "Authorization: Bearer $SB_SECRET_KEY" \
        -H "apikey: $SB_SECRET_KEY" \
        -H "Content-Type: application/json" \
        -w "HTTPSTATUS:%{http_code}" \
        --data "$request_payload")
    
    # Extract HTTP status and body
    legacy_http_code=$(echo "$legacy_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    legacy_body=$(echo "$legacy_response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    echo "Legacy Processing HTTP Status: $legacy_http_code"
    echo ""
    
    if [ "$legacy_http_code" -eq 200 ]; then
        echo "✅ LEGACY PROCESSING SUCCESS"
        echo "🏛️ Legacy Processing Output:"
        echo "============================"
        echo "$legacy_body" | jq '.' | head -20  # Limit output since legacy can be verbose
        echo "... (output truncated for readability)"
        echo ""
        return 0
    else
        echo "❌ LEGACY PROCESSING FAILED: HTTP $legacy_http_code"
        echo "Error Response:"
        echo "$legacy_body" | jq '.' 2>/dev/null || echo "$legacy_body"
        return 1
    fi
}

# Function to analyze order hash and rollout behavior
analyze_order_rollout() {
    echo "📊 Analyzing Order Rollout Behavior..."
    echo "======================================"
    
    echo "🔢 Order ID: $ORDER_ID"
    
    # Calculate order hash (same logic as in the agent)
    order_hash=$(echo -n "$ORDER_ID" | od -An -tu1 | tr -d ' \n' | \
        awk '{hash=0; for(i=1;i<=length($0)/3;i++) {char=substr($0,i*3-2,3)+0; hash=(hash*31+char)%2147483647} print hash}')
    
    hash_percentile=$((order_hash % 100))
    
    echo "   Hash Value: $order_hash"
    echo "   Percentile: $hash_percentile%"
    echo ""
    
    echo "📈 Rollout Scenarios for this Order:"
    rollout_percentages=(0 10 25 50 75 100)
    
    for percentage in "${rollout_percentages[@]}"; do
        if [ "$hash_percentile" -lt "$percentage" ]; then
            echo "   ${percentage}% rollout: 🤖 Claude Agent"
        else
            echo "   ${percentage}% rollout: 🏛️ Legacy Processing"
        fi
    done
    
    echo ""
    echo "💡 This order would use Claude Agent starting at $(($hash_percentile + 1))% rollout"
    echo ""
}

# Function to show configuration commands
show_configuration_commands() {
    echo "⚙️  Configuration Commands..."
    echo "============================"
    
    echo "🚀 To Enable Claude Agent:"
    echo "export CLAUDE_AGENT_ENABLED=true"
    echo "export CLAUDE_AGENT_ROLLOUT_PERCENTAGE=10"
    echo "export CLAUDE_AGENT_LOGGING=true"
    echo "export ANTHROPIC_API_KEY=\"sk-ant-your-key-here\""
    echo ""
    
    echo "🔧 To Deploy Functions:"
    echo "supabase functions deploy orbit-claude-agent-health"
    echo "supabase functions deploy process-image-batch"
    echo ""
    
    echo "📋 To Check Environment Variables:"
    echo "supabase secrets list"
    echo ""
    
    echo "🔑 To Set Environment Variables:"
    echo "supabase secrets set CLAUDE_AGENT_ENABLED=true"
    echo "supabase secrets set CLAUDE_AGENT_ROLLOUT_PERCENTAGE=10"
    echo "supabase secrets set CLAUDE_AGENT_LOGGING=true"
    echo "supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here"
    echo ""
}

# Function to reset order for testing
reset_order_for_testing() {
    echo "🔄 Resetting Order for Testing..."
    echo "================================="
    
    echo "To reset all images in the order back to pending status:"
    echo ""
    echo "supabase db query \""
    echo "UPDATE images SET"
    echo "    processing_status = 'pending',"
    echo "    ai_analysis = NULL,"
    echo "    gemini_analysis_raw = NULL,"
    echo "    processed_at = NULL,"
    echo "    storage_path_processed = NULL,"
    echo "    error_message = NULL"
    echo "WHERE order_id = '$ORDER_ID';\""
    echo ""
    
    echo "To reset the order status:"
    echo ""
    echo "supabase db query \""
    echo "UPDATE orders SET"
    echo "    processing_stage = 'pending',"
    echo "    processing_completion_percentage = 0,"
    echo "    order_status = 'paid',"
    echo "    completed_at = NULL"
    echo "WHERE id = '$ORDER_ID';\""
    echo ""
    
    echo "To reset the batch status:"
    echo ""
    echo "supabase db query \""
    echo "UPDATE batches SET"
    echo "    status = 'pending',"
    echo "    processed_count = 0,"
    echo "    error_count = 0,"
    echo "    processing_start_time = NULL,"
    echo "    processing_end_time = NULL,"
    echo "    completed_at = NULL"
    echo "WHERE id = (SELECT batch_id FROM orders WHERE id = '$ORDER_ID');\""
    echo ""
}

# --- Main Execution ---

main() {
    echo "🤖 ORBIT Claude Code Agent Test"
    echo "==============================="
    echo "Order ID: $ORDER_ID"
    echo "Analysis Type: $ANALYSIS_TYPE"
    echo "Action: ${3:-full-test}"
    echo "Timestamp: $(date)"
    echo ""

    case "${3:-full-test}" in
        "health")
            test_health_check
            ;;
        "order")
            check_order_status
            ;;
        "claude")
            analyze_order_rollout
            test_claude_agent_processing
            ;;
        "legacy")
            test_legacy_processing
            ;;
        "config")
            show_configuration_commands
            ;;
        "reset")
            reset_order_for_testing
            ;;
        "rollout")
            analyze_order_rollout
            ;;
        "full-test"|*)
            echo "🧪 Running Full Claude Agent Test Suite"
            echo "======================================="
            echo ""
            
            # Step 1: Health Check
            echo "Step 1/6: Health Check"
            if test_health_check; then
                echo "✅ Health check passed"
            else
                echo "⚠️  Health check failed - continuing with other tests"
            fi
            echo ""
            
            # Step 2: Order Status
            echo "Step 2/6: Order Status Check"
            if check_order_status; then
                echo "✅ Order found in database"
            else
                echo "❌ Order not found - check ORDER_ID"
                exit 1
            fi
            echo ""
            
            # Step 3: Rollout Analysis
            echo "Step 3/6: Rollout Analysis"
            analyze_order_rollout
            
            # Step 4: Configuration Info
            echo "Step 4/6: Configuration Commands"
            show_configuration_commands
            
            # Step 5: Claude Agent Test
            echo "Step 5/6: Claude Agent Processing Test"
            if test_claude_agent_processing; then
                echo "✅ Claude agent test completed"
            else
                echo "⚠️  Claude agent test failed - this may be expected if not configured"
            fi
            echo ""
            
            # Step 6: Legacy Test
            echo "Step 6/6: Legacy Processing Test"
            if test_legacy_processing; then
                echo "✅ Legacy processing test completed"
            else
                echo "❌ Legacy processing failed"
            fi
            echo ""
            
            # Summary
            echo "📊 TEST SUMMARY"
            echo "==============="
            echo "Health Check: $([ -n "$HEALTH_CHECK_RESULT" ] && echo "✅ PASSED" || echo "❌ FAILED")"
            echo "Order Status: $([ "$ORDER_STATUS" = "found" ] && echo "✅ FOUND" || echo "❌ NOT FOUND")"
            echo "Claude Agent: $([ "$PROCESS_BATCH_RESULT" = "success" ] && echo "✅ SUCCESS" || echo "❌ FAILED/NOT CONFIGURED")"
            echo ""
            ;;
        *)
            echo "Unknown action: $3"
            show_help
            exit 1
            ;;
    esac
}

# Help function
show_help() {
    echo "Usage: $0 [ORDER_ID] [ANALYSIS_TYPE] [ACTION]"
    echo ""
    echo "Parameters:"
    echo "  ORDER_ID      - Order ID to test (default: 63f22b07-2e68-4f2a-8c50-081fcbcc0fed)"
    echo "  ANALYSIS_TYPE - Analysis type: 'product' or 'lifestyle' (default: lifestyle)"
    echo "  ACTION        - Action to perform (default: full-test)"
    echo ""
    echo "Actions:"
    echo "  full-test     - (Default) Complete test suite: health, order, claude, legacy"
    echo "  health        - Test Claude agent health endpoint only"
    echo "  order         - Check order status in database only"
    echo "  claude        - Test Claude agent processing (forced) only"
    echo "  legacy        - Test legacy processing only"
    echo "  rollout       - Analyze order rollout behavior only"
    echo "  config        - Show configuration commands"
    echo "  reset         - Show commands to reset order for re-testing"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Full test with default order"
    echo "  $0 my-order-id lifestyle full-test   # Full test with specific order"
    echo "  $0 my-order-id product claude        # Test Claude agent only"
    echo "  $0 my-order-id lifestyle health      # Health check only"
    echo ""
    echo "Prerequisites:"
    echo "  - Supabase CLI installed and logged in ('supabase login')"
    echo "  - Project linked ('supabase link --project-ref ufdcvxmizlzlnyyqpfck')"
    echo "  - Functions deployed ('supabase functions deploy')"
    echo ""
    echo "Environment Variables:"
    echo "  SB_SECRET_KEY_OVERRIDE - Override the secret key"
}

# --- Script Start ---

# Check for help flag
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_help
    exit 0
fi

# Override secret key if provided via environment
if [[ -n "$SB_SECRET_KEY_OVERRIDE" ]]; then
    SB_SECRET_KEY="$SB_SECRET_KEY_OVERRIDE"
fi

# Execute main function
main "$@"

echo ""
echo "🏁 Test completed at $(date)"