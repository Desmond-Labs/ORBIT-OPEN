# ORBIT Image Forge - Testing Suite

This directory contains all testing utilities, scripts, and test data for the ORBIT Image Forge project.

## 📁 Directory Structure

```
tests/
├── README.md                    # This file - testing documentation
├── scripts/                     # Test scripts and utilities
│   ├── test-process-batch.sh    # Test Tier 1 fast path processing
│   ├── test-two-tier-architecture.sh # Complete Two-Tier system test
│   ├── test-email-*.cjs         # Email system validation
│   ├── test-mcp-*.js/.ts        # MCP server testing
│   └── test-remote-mcp.js       # Remote MCP integration tests
├── data/                        # Test data and fixtures
├── output/                      # Test output files and logs
└── supabase/                    # Supabase-specific tests
```

## 🧪 Available Test Scripts

### **Two-Tier Architecture Testing**

#### **Complete System Test**
```bash
./tests/scripts/test-two-tier-architecture.sh [ORDER_ID]
```
- Tests complete Two-Tier system (Tier 1 + Tier 2 + Smart Routing)
- Validates system health, performance metrics, escalation triggers
- Comprehensive success/failure reporting

#### **Tier 1 Fast Path Test**
```bash
./tests/scripts/test-process-batch.sh [ORDER_ID]
```
- Tests enhanced Tier 1 fast path processing
- Validates storage verification, atomic processing, error handling
- Direct MCP server integration testing

### **Email System Testing**

#### **Email Trigger Test**
```bash
node tests/scripts/test-email-trigger.cjs [ORDER_ID]
```
- Tests order completion email system
- Validates secure token generation
- Email template and delivery verification

#### **Email Tracking Validation**
```bash
node tests/scripts/test-email-tracking-validation.cjs
```
- Validates email tracking and audit systems
- Token usage verification
- Security compliance checks

### **MCP Server Testing**

#### **MCP Functionality Test**
```bash
node tests/scripts/test-mcp-servers-functionality.cjs
```
- Comprehensive MCP server functionality testing
- AI analysis, metadata embedding, storage operations
- Error handling and retry logic validation

#### **Remote MCP Integration**
```bash
node tests/scripts/test-remote-mcp.js
```
- Tests remote MCP server integration
- Network connectivity and authentication
- Performance and reliability testing

## 🔧 Environment Setup for Testing

### **Required Environment Variables**
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
sb_secret_key=your-secret-key

# API Keys
GOOGLE_API_KEY=your-gemini-api-key
RESEND_API_KEY=your-email-api-key

# Test Configuration
TEST_ORDER_ID=43a14341-28e4-4632-962b-322e9d387db6  # Default test order
```

### **Prerequisites**
- Node.js & npm installed
- Supabase CLI configured
- Valid test order with images uploaded
- API keys configured in Supabase project

## 📋 Test Order Requirements

For comprehensive testing, ensure your test order has:
- ✅ Valid payment completed (`payment_status: 'completed'`)
- ✅ Images uploaded to storage (`/original/` folder)
- ✅ Order status ready for processing (`order_status: 'paid'`)
- ✅ User authentication valid

## 🎯 Testing Scenarios

### **Happy Path Testing**
1. **Standard Processing**: Test Tier 1 fast path with simple order
2. **Complex Processing**: Test Tier 2 orchestration with complex scenarios
3. **Smart Routing**: Test intelligent routing decisions
4. **Email Delivery**: Test completion notifications and token access

### **Edge Case Testing**
1. **System Overload**: Test escalation triggers
2. **Partial Failures**: Test error recovery and self-healing
3. **Network Issues**: Test retry logic and fallback systems
4. **Security Validation**: Test token validation and access controls

### **Performance Testing**
1. **Tier 1 Speed**: Validate <6 second processing
2. **Tier 2 Orchestration**: Validate <15 second comprehensive processing
3. **Smart Routing**: Validate <100ms routing decisions
4. **System Health**: Validate 99%+ availability

## 📊 Test Result Interpretation

### **Success Indicators**
- ✅ **HTTP 200 responses** from all endpoints
- ✅ **Database updates** completed successfully
- ✅ **Files created** in storage (processed images, XMP, reports)
- ✅ **Email sent** with valid tokens
- ✅ **Processing times** within target ranges

### **Failure Indicators**
- ❌ **HTTP 4xx/5xx responses**
- ❌ **Database errors** or inconsistent states
- ❌ **Missing files** in storage
- ❌ **Email delivery failures**
- ❌ **Timeout errors** or performance issues

## 🔍 Debugging Failed Tests

### **Common Issues & Solutions**

1. **Authentication Errors**
   - Verify service role key in environment
   - Check Supabase project permissions
   - Validate function configuration

2. **Storage Access Issues**
   - Verify bucket permissions and RLS policies
   - Check file paths and storage organization
   - Validate service role storage access

3. **API Rate Limits**
   - Check Google Gemini API quota
   - Monitor Supabase function invocations
   - Implement appropriate delays between tests

4. **Order State Issues**
   - Ensure test order has correct payment status
   - Verify images are uploaded and accessible
   - Check order processing stage

### **Debug Commands**
```bash
# Check order status
supabase sql --execute "SELECT * FROM orders WHERE id = 'ORDER_ID';"

# Verify images
supabase sql --execute "SELECT * FROM images WHERE order_id = 'ORDER_ID';"

# Check function logs
supabase functions logs smart-router
supabase functions logs claude-tier2-orchestrator
```

## 🛡️ Security Considerations

- **Never commit** test scripts with hardcoded API keys
- **Use environment variables** for all sensitive configuration
- **Rotate test API keys** regularly
- **Monitor test usage** to avoid unexpected charges
- **Clean up test data** after testing sessions

## 📈 Continuous Testing

### **Automated Testing Schedule**
- **Daily**: Run Two-Tier architecture test with real order
- **Weekly**: Complete MCP server functionality validation
- **Monthly**: Performance benchmarking and optimization

### **Test Reporting**
- All test results logged to `tests/output/` directory
- Performance metrics tracked over time
- Failure patterns analyzed for system improvements

## 🚀 Adding New Tests

### **Test Script Template**
```bash
#!/bin/bash
# Test Description: [Brief description of what this tests]

set -e # Exit on any error

# Configuration
SUPABASE_URL="https://your-project.supabase.co"
SB_SECRET_KEY="your-secret-key"
ORDER_ID="${1:-default-order-id}"

echo "🧪 Starting [Test Name]"
echo "Order ID: $ORDER_ID"
echo "Timestamp: $(date)"

# Test implementation
# ... your test logic here ...

echo "✅ Test completed successfully"
```

### **Adding to Test Suite**
1. Create test script in `tests/scripts/`
2. Make executable: `chmod +x tests/scripts/your-test.sh`
3. Document in this README
4. Add to `.gitignore` if containing sensitive data
5. Include in automated testing schedule

---

**Happy Testing! 🎉**

*For questions or issues with testing, check the main project documentation or create an issue in the repository.*