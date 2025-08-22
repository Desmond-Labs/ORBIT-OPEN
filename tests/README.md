# ORBIT Image Forge - Testing Suite

This directory contains all testing utilities, scripts, and test data for the ORBIT Image Forge project.

## 📁 Directory Structure

```
tests/
├── README.md                    # This file - testing documentation
├── scripts/                     # Test scripts and utilities
│   ├── test-process-batch.sh    # Test image processing pipeline
│   ├── test-email-*.cjs         # Email system validation
│   └── test-mcp-*.js/.ts        # MCP server testing
├── data/                        # Test data and fixtures
├── output/                      # Test output files and logs
└── supabase/                    # Supabase-specific tests
```

## 🧪 Available Test Scripts

### **Image Processing Testing**

#### **Core Processing Test**
```bash
./tests/scripts/test-process-batch.sh [ORDER_ID]
```
- Tests core image processing pipeline
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
# Test individual MCP services
curl -X POST "https://your-project.supabase.co/functions/v1/mcp-ai-analysis"
curl -X POST "https://your-project.supabase.co/functions/v1/mcp-metadata"
curl -X POST "https://your-project.supabase.co/functions/v1/mcp-storage"
```
- Individual MCP server functionality testing
- AI analysis, metadata embedding, storage operations
- Error handling and retry logic validation

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
1. **Standard Processing**: Test core image processing pipeline
2. **MCP Integration**: Test AI analysis and metadata embedding
3. **Email Delivery**: Test completion notifications and token access
4. **Storage Operations**: Test file organization and access

### **Edge Case Testing**
1. **Partial Failures**: Test error recovery and self-healing
2. **Network Issues**: Test retry logic and fallback systems
3. **Security Validation**: Test token validation and access controls
4. **API Limits**: Test rate limiting and quota management

### **Performance Testing**
1. **Processing Speed**: Validate processing time targets
2. **MCP Response**: Validate service response times
3. **System Health**: Validate availability and reliability

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
supabase functions logs process-image-batch
supabase functions logs mcp-ai-analysis
```

## 🛡️ Security Considerations

- **Never commit** test scripts with hardcoded API keys
- **Use environment variables** for all sensitive configuration
- **Rotate test API keys** regularly
- **Monitor test usage** to avoid unexpected charges
- **Clean up test data** after testing sessions

## 📈 Continuous Testing

### **Automated Testing Schedule**
- **Daily**: Run core processing test with real order
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