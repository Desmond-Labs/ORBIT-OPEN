#!/bin/bash

# ORBIT Email Trigger Script
# Usage: ./trigger-email.sh [ORDER_ID]

ORDER_ID="${1:-620f0e46-d0ed-4eac-a14e-21f09e681f02}"
SUPABASE_URL="https://ufdcvxmizlzlnyyqpfck.supabase.co"
FUNCTION_URL="${SUPABASE_URL}/functions/v1/send-order-completion-email"

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "📁 Loading environment variables from .env file..."
    export $(grep -v '^#' .env | xargs)
elif [ -f .env.example ]; then
    echo "⚠️  .env file not found, but .env.example exists"
    echo "💡 Copy .env.example to .env and fill in your actual values:"
    echo "   cp .env.example .env"
    echo ""
fi

# Get service role key from environment
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set"
    echo ""
    echo "📝 Set it using one of these methods:"
    echo "   1. Create .env file: cp .env.example .env (then edit .env with your key)"
    echo "   2. Export directly: export SUPABASE_SERVICE_ROLE_KEY=your_key_here"
    echo "   3. Use with command: SUPABASE_SERVICE_ROLE_KEY=your_key ./trigger-email.sh ORDER_ID"
    exit 1
fi

echo "🚀 Triggering email for order: $ORDER_ID"
echo "📍 Function URL: $FUNCTION_URL"
echo "⏳ Sending request..."
echo ""

# Make the HTTP request
response=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\": \"$ORDER_ID\"}" \
  -w "HTTPSTATUS:%{http_code}")

# Extract HTTP status code
http_code=$(echo "$response" | grep -o "HTTPSTATUS:.*" | cut -d: -f2)
response_body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]+$//')

echo "📊 HTTP Status: $http_code"
echo "📧 Response:"
echo "$(echo "$response_body" | jq . 2>/dev/null || echo "$response_body")"
echo ""

if [ "$http_code" = "200" ]; then
    echo "✅ Email trigger completed successfully!"
else
    echo "❌ Email trigger failed with status: $http_code"
fi