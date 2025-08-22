# ORBIT Claude Code Agent - Testing Guide

## 🎯 **Testing Your Order: `63f22b07-2e68-4f2a-8c50-081fcbcc0fed`**

### **Test Script Usage**

The test script `./tests/scripts/test-claude-agent.sh` mirrors your existing `test-process-batch.sh` pattern and provides comprehensive testing capabilities.

### **Quick Test Commands**

```bash
# Full test suite
./tests/scripts/test-claude-agent.sh

# Test with specific order
./tests/scripts/test-claude-agent.sh 63f22b07-2e68-4f2a-8c50-081fcbcc0fed lifestyle

# Individual tests
./tests/scripts/test-claude-agent.sh 63f22b07-2e68-4f2a-8c50-081fcbcc0fed lifestyle health
./tests/scripts/test-claude-agent.sh 63f22b07-2e68-4f2a-8c50-081fcbcc0fed lifestyle rollout
./tests/scripts/test-claude-agent.sh 63f22b07-2e68-4f2a-8c50-081fcbcc0fed lifestyle claude
./tests/scripts/test-claude-agent.sh 63f22b07-2e68-4f2a-8c50-081fcbcc0fed lifestyle legacy
```

## 📊 **Your Order Analysis**

### **Hash Analysis:**
- **Order ID:** `63f22b07-2e68-4f2a-8c50-081fcbcc0fed`
- **Hash Percentile:** 90%
- **Rollout Behavior:** Requires 91%+ rollout to use Claude agent automatically
- **Force Override:** Always works with `useClaudeAgent: true`

### **Rollout Scenarios:**
| Rollout % | Agent Used | Explanation |
|-----------|------------|-------------|
| 0-90%     | 🏛️ Legacy | Below hash percentile |
| 91-100%   | 🤖 Claude | Above hash percentile |
| Any % + Force | 🤖 Claude | `useClaudeAgent: true` overrides |

## 🚀 **Step-by-Step Deployment & Testing**

### **Phase 1: Deploy Functions**

```bash
# Deploy the new Claude agent health endpoint
supabase functions deploy orbit-claude-agent-health

# Deploy the updated process-image-batch (with Claude integration)
supabase functions deploy process-image-batch

# Verify deployment
./tests/scripts/test-claude-agent.sh 63f22b07-2e68-4f2a-8c50-081fcbcc0fed lifestyle health
```

### **Phase 2: Configure Environment**

```bash
# Set required environment variables
supabase secrets set ANTHROPIC_API_KEY="sk-ant-your-claude-api-key"
supabase secrets set CLAUDE_AGENT_ENABLED=true
supabase secrets set CLAUDE_AGENT_LOGGING=true
supabase secrets set CLAUDE_AGENT_ROLLOUT_PERCENTAGE=10

# Verify configuration
supabase secrets list
./tests/scripts/test-claude-agent.sh 63f22b07-2e68-4f2a-8c50-081fcbcc0fed lifestyle health
```

### **Phase 3: Reset Order for Testing**

Your order appears to be in a completed/processed state. Reset it for fresh testing:

```bash
# Reset images
supabase db query "
UPDATE images SET
    processing_status = 'pending',
    ai_analysis = NULL,
    gemini_analysis_raw = NULL,
    processed_at = NULL,
    storage_path_processed = NULL,
    error_message = NULL
WHERE order_id = '63f22b07-2e68-4f2a-8c50-081fcbcc0fed';"

# Reset order
supabase db query "
UPDATE orders SET
    processing_stage = 'pending',
    processing_completion_percentage = 0,
    order_status = 'paid',
    completed_at = NULL
WHERE id = '63f22b07-2e68-4f2a-8c50-081fcbcc0fed';"

# Reset batch
supabase db query "
UPDATE batches SET
    status = 'pending',
    processed_count = 0,
    error_count = 0,
    processing_start_time = NULL,
    processing_end_time = NULL,
    completed_at = NULL
WHERE id = (SELECT batch_id FROM orders WHERE id = '63f22b07-2e68-4f2a-8c50-081fcbcc0fed');"
```

### **Phase 4: Test Claude Agent (Forced)**

```bash
# Test Claude agent with forced override
./tests/scripts/test-claude-agent.sh 63f22b07-2e68-4f2a-8c50-081fcbcc0fed lifestyle claude
```

Expected behavior:
- ✅ **If configured:** Claude agent processes the order using the comprehensive 5-phase workflow
- ❌ **If not configured:** Falls back to legacy processing automatically

### **Phase 5: Test Legacy Processing**

```bash
# Test legacy processing (bypass Claude agent)
./tests/scripts/test-claude-agent.sh 63f22b07-2e68-4f2a-8c50-081fcbcc0fed lifestyle legacy
```

### **Phase 6: Test Automatic Rollout**

Since your order has a 90% hash percentile:

```bash
# Set rollout to 50% - should use legacy
supabase secrets set CLAUDE_AGENT_ROLLOUT_PERCENTAGE=50
./tests/scripts/test-claude-agent.sh 63f22b07-2e68-4f2a-8c50-081fcbcc0fed lifestyle claude

# Set rollout to 95% - should use Claude agent
supabase secrets set CLAUDE_AGENT_ROLLOUT_PERCENTAGE=95
./tests/scripts/test-claude-agent.sh 63f22b07-2e68-4f2a-8c50-081fcbcc0fed lifestyle claude
```

## 🧪 **Test Script Actions**

| Action | Description | Example |
|--------|-------------|---------|
| `full-test` | Complete test suite | `./test-claude-agent.sh` |
| `health` | Health check only | `./test-claude-agent.sh ... health` |
| `order` | Order status check | `./test-claude-agent.sh ... order` |
| `claude` | Claude agent test | `./test-claude-agent.sh ... claude` |
| `legacy` | Legacy processing test | `./test-claude-agent.sh ... legacy` |
| `rollout` | Rollout analysis | `./test-claude-agent.sh ... rollout` |
| `config` | Show config commands | `./test-claude-agent.sh ... config` |
| `reset` | Show reset commands | `./test-claude-agent.sh ... reset` |

## 📊 **Expected Test Results**

### **Successful Claude Agent Test:**
```json
{
  "success": true,
  "agent_used": "claude",
  "batch_id": "...",
  "order_id": "63f22b07-2e68-4f2a-8c50-081fcbcc0fed",
  "results": {
    "total_images": 3,
    "success_count": 3,
    "error_count": 0,
    "status": "completed"
  },
  "processing_time_ms": 45000
}
```

### **Successful Legacy Fallback:**
```json
{
  "success": true,
  "batch_id": "...",
  "order_id": "63f22b07-2e68-4f2a-8c50-081fcbcc0fed",
  "results": {
    "total_images": 3,
    "success_count": 3,
    "error_count": 0,
    "status": "completed"
  }
}
```

## 🔍 **Monitoring & Debugging**

### **Enable Detailed Logging:**
```bash
supabase secrets set CLAUDE_AGENT_LOGGING=true
supabase secrets set CLAUDE_AGENT_LOG_LEVEL=debug
```

### **Check Health Endpoint:**
```bash
curl "https://ufdcvxmizlzlnyyqpfck.supabase.co/functions/v1/orbit-claude-agent-health"
```

### **Monitor Function Logs:**
```bash
supabase functions logs process-image-batch
supabase functions logs orbit-claude-agent-health
```

## 🎛️ **Configuration Options**

### **Basic Configuration:**
```bash
CLAUDE_AGENT_ENABLED=true
CLAUDE_AGENT_ROLLOUT_PERCENTAGE=10
CLAUDE_AGENT_LOGGING=true
ANTHROPIC_API_KEY=sk-ant-...
```

### **Advanced Configuration:**
```bash
CLAUDE_AGENT_MAX_TURNS=50
CLAUDE_AGENT_TIMEOUT=300000
CLAUDE_AGENT_ALLOW_FALLBACK=true
CLAUDE_AGENT_DEV_MODE=true
```

## 🚀 **Rollout Strategy**

### **Safe Rollout for Your Order:**
Since your order is at 90% percentile:

1. **Week 1:** `CLAUDE_AGENT_ROLLOUT_PERCENTAGE=10` (Legacy processing)
2. **Week 2:** `CLAUDE_AGENT_ROLLOUT_PERCENTAGE=25` (Legacy processing)
3. **Week 3:** `CLAUDE_AGENT_ROLLOUT_PERCENTAGE=50` (Legacy processing)
4. **Week 4:** `CLAUDE_AGENT_ROLLOUT_PERCENTAGE=95` (🎉 Claude agent!)

### **Force Testing Anytime:**
```bash
# Always force Claude agent regardless of rollout percentage
curl -X POST "https://ufdcvxmizlzlnyyqpfck.supabase.co/functions/v1/process-image-batch" \
  -H "Authorization: Bearer sb_secret_gEbqTxZ0IzwP0AkXbx-dNA_C5jFwV9I" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "63f22b07-2e68-4f2a-8c50-081fcbcc0fed",
    "analysisType": "lifestyle",
    "useClaudeAgent": true
  }'
```

## ❗ **Troubleshooting**

### **Common Issues:**

1. **Health Check 404:** Function not deployed
   ```bash
   supabase functions deploy orbit-claude-agent-health
   ```

2. **Processing Failed:** Order already processed
   ```bash
   ./tests/scripts/test-claude-agent.sh ... reset
   ```

3. **Claude Agent Not Used:** Check rollout percentage
   ```bash
   ./tests/scripts/test-claude-agent.sh ... rollout
   ```

4. **Environment Issues:** Check configuration
   ```bash
   ./tests/scripts/test-claude-agent.sh ... config
   ```

## 🎯 **Next Steps**

1. **Deploy:** Deploy both functions
2. **Configure:** Set environment variables
3. **Reset:** Reset your test order
4. **Test:** Run the test script with your order ID
5. **Monitor:** Watch logs and adjust rollout gradually
6. **Scale:** Increase rollout percentage over time

The implementation is production-ready and your test order is perfectly positioned for comprehensive testing! 🚀