#!/bin/bash

# ORBIT Process Image Batch Testing Script
# Tests the complete AI Analysis â†’ Database Storage â†’ Metadata Embedding pipeline

set -e # Exit on any error

# Configuration
SUPABASE_URL="https://ufdcvxmizlzlnyyqpfck.supabase.co"
SB_SECRET_KEY="sb_secret_gEbqTxZ0IzwP0AkXbx-dNA_C5jFwV9I"

# Default test order (can be overridden)
ORDER_ID="${1:-43a14341-28e4-4632-962b-322e9d387db6}"
ANALYSIS_TYPE="${2:-lifestyle}"

# --- Test State Variables ---
IMAGE_ID=""
STORAGE_PATH=""
AI_ANALYSIS_JSON=""

# --- Test Functions ---

# Function to get image ID for the order
get_image_id() {
    echo " Getting image ID for order $ORDER_ID..."
    
    # For testing, use a known image ID and storage path.
    # In a real scenario, you might query the database for these.
    IMAGE_ID="1c996703-4235-4ca0-a24b-67ee29db124a"
    STORAGE_PATH="43a14341-28e4-4632-962b-322e9d387db6_2191eee9-780f-4f80-8bf8-1d2a6a785df2/original/Golden Hour Patio Scene.png"
    
    echo "Using test image ID: $IMAGE_ID"
    echo "Using test storage path: $STORAGE_PATH"
    echo ""
}

# Function to test AI analysis directly
test_ai_analysis() {
    echo " Testing AI Analysis directly..."
    echo "=================================="
    
    ai_response=$(curl -s -L -X POST "$SUPABASE_URL/functions/v1/mcp-ai-analysis" \
        -H "Authorization: Bearer $SB_SECRET_KEY" \
        -H "apikey: $SB_SECRET_KEY" \
        -H "Content-Type: application/json" \
        -w "HTTPSTATUS:%{http_code}" \
        --data "{
            \"image_path\": \"$STORAGE_PATH\",
            \"analysis_type\": \"$ANALYSIS_TYPE\"
        }")
    
    # Extract HTTP status and body
    ai_http_code=$(echo "$ai_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    ai_body=$(echo "$ai_response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    echo "AI Analysis HTTP Status: $ai_http_code"
    echo ""
    
    if [ "$ai_http_code" -eq 200 ]; then
        echo "✅ AI Analysis SUCCESS"
        echo " AI Analysis Output:"
        echo "======================="
        echo "$ai_body" | jq '.'
        echo ""
        
        # Store the analysis result for subsequent steps
        AI_ANALYSIS_JSON="$ai_body"
        return 0
    else
        echo "❌ AI Analysis FAILED: HTTP $ai_http_code"
        echo "Error Response:"
        echo "$ai_body" | jq '.' 2>/dev/null || echo "$ai_body"
        return 1
    fi
}

# Function to store analysis in database
store_ai_analysis() {
    if [ -z "$AI_ANALYSIS_JSON" ]; then
        echo "❌ No AI analysis data to store"
        return 1
    fi
    
    echo " Storing AI Analysis in Database via Supabase CLI..."
    echo "==================================================="
    
    # Escape single quotes for SQL insertion
    escaped_json=$(echo "$AI_ANALYSIS_JSON" | sed "s/'/''/g")
    
    # Create the SQL command
    sql_command="UPDATE images SET gemini_analysis_raw = '$escaped_json', processing_status = 'analyzing' WHERE id = '$IMAGE_ID';"
    
    echo " SQL Command to be executed:"
    echo "$sql_command"
    echo ""
    
    echo " Executing SQL..."
    output=$(supabase db query "$sql_command" 2>&1)
    exit_code=$?

    if [ $exit_code -eq 0 ]; then
        echo "✅ SQL command executed successfully."
        echo "$output"
        echo ""
        return 0
    else
        echo "❌ SQL command execution FAILED."
        echo "Please ensure your Supabase project is linked ('supabase link') and you are logged in."
        echo "Error:"
        echo "$output"
        echo ""
        return 1
    fi
}

# Function to test metadata embedding
test_metadata_embedding() {
    echo " Testing Metadata Embedding..."
    echo "=============================="

    if [ -z "$AI_ANALYSIS_JSON" ]; then
        echo "❌ No AI analysis data found to embed."
        return 1
    fi

    echo " Embedding metadata for image: $STORAGE_PATH"

    # Construct the JSON payload for the metadata function
    METADATA_PAYLOAD=$(jq -n --arg image_path "$STORAGE_PATH" --argjson analysis_result "$AI_ANALYSIS_JSON" \
        '{
            tool_name: "process_image_metadata",
            parameters: {
                image_path: $image_path,
                analysis_result: $analysis_result
            }
        }')

    echo " MCP Metadata Payload:"
    echo "$METADATA_PAYLOAD" | jq '.'
    echo ""

    metadata_response=$(curl -s -L -X POST "$SUPABASE_URL/functions/v1/mcp-metadata" \
        -H "Authorization: Bearer $SB_SECRET_KEY" \
        -H "apikey: $SB_SECRET_KEY" \
        -H "Content-Type: application/json" \
        -w "HTTPSTATUS:%{http_code}" \
        --data "$METADATA_PAYLOAD")

    # Extract HTTP status and body
    metadata_http_code=$(echo "$metadata_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    metadata_body=$(echo "$metadata_response" | sed 's/HTTPSTATUS:[0-9]*$//')

    echo "Metadata Embedding HTTP Status: $metadata_http_code"
    echo ""

    if [ "$metadata_http_code" -eq 200 ]; then
        echo "✅ Metadata Embedding SUCCESS"
        echo " Metadata Embedding Output:"
        echo "==========================="
        echo "$metadata_body" | jq '.' 2>/dev/null || echo "$metadata_body"
        echo ""
        return 0
    else
        echo "❌ Metadata Embedding FAILED: HTTP $metadata_http_code"
        echo "Error Response:"
        echo "$metadata_body" | jq '.' 2>/dev/null || echo "$metadata_body"
        return 1
    fi
}

# Function to check database status
check_database_status() {
    echo ""
    echo " Checking database status..."
    
    echo "To check database status, run:"
    echo "supabase db query \""
    echo "SELECT id, processing_status, gemini_analysis_raw IS NOT NULL as has_analysis,"
    echo "       storage_path_processed IS NOT NULL as has_processed_files, error_message"
    echo "FROM images WHERE id = '$IMAGE_ID';\""
}

# Function to reset order for testing
reset_order_for_testing() {
    echo " Resetting image for testing..."
    echo "To reset the image, run:"
    echo "supabase db query \""
    echo "UPDATE images SET processing_status = 'pending',"
    echo "       ai_analysis = NULL, gemini_analysis_raw = NULL,"
    echo "       processed_at = NULL, storage_path_processed = NULL,"
    echo "       error_message = NULL"
    echo "WHERE id = '$IMAGE_ID';\""
    echo ""
}

# --- Main Execution ---

main() {
    echo " ORBIT Process Image Batch Test"
    echo "=================================="
    echo "Order ID: $ORDER_ID"
    echo "Analysis Type: $ANALYSIS_TYPE"
    echo "Action: ${3:-ai-test}"
    echo "Timestamp: $(date)"
    echo ""

    case "${3:-ai-test}" in
        "reset")
            get_image_id
            reset_order_for_testing
            ;; 
        "check")
            get_image_id
            check_database_status
            ;; 
        "ai-test"|*) 
            get_image_id
            if test_ai_analysis; then
                if store_ai_analysis; then
                    test_metadata_embedding
                else
                    echo "❌ Storing analysis failed, skipping metadata embedding."
                fi
            else
                echo "❌ AI Analysis failed, skipping database storage and metadata embedding."
            fi
            check_database_status
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
    echo "  ORDER_ID      - Order ID to process (default: 43a14341-28e4-4632-962b-322e9d387db6)"
    echo "  ANALYSIS_TYPE - Analysis type: 'product' or 'lifestyle' (default: lifestyle)"
    echo "  ACTION        - Action to perform: 'ai-test', 'reset', 'check' (default: ai-test)"
    echo ""
    echo "Actions:"
    echo "  ai-test       - (Default) Full pipeline: AI analysis -> DB storage -> Metadata embedding"
    echo "  reset         - Show commands to reset image state for re-testing"
    echo "  check         - Show commands to check image status in the database"
    echo ""
    echo "Prerequisites:"
    echo "  - Supabase CLI installed and you are logged in ('supabase login')."
    echo "  - Your project is linked ('supabase link --project-ref YOUR_REF')."
    echo ""
    echo "Environment Variables:"
    echo "  SB_SECRET_KEY_OVERRIDE - sb_secret_key (overrides default)"
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
echo " Test completed at $(date)"