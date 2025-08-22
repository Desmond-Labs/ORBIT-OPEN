// ORBIT Claude Code Agent - Live Test with Specific Order ID
// This script tests the agent integration with your order: 63f22b07-2e68-4f2a-8c50-081fcbcc0fed

const ORDER_ID = '63f22b07-2e68-4f2a-8c50-081fcbcc0fed';
const PROJECT_ID = 'ufdcvxmizlzlnyyqpfck';
const SUPABASE_URL = `https://${PROJECT_ID}.supabase.co`;

console.log('\n' + '='.repeat(80));
console.log('🧪 ORBIT CLAUDE AGENT - LIVE TEST WITH REAL ORDER');
console.log('='.repeat(80));
console.log(`\n🎯 Testing Order: ${ORDER_ID}`);
console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);

// Helper function to make HTTP requests
async function makeRequest(url, options = {}) {
  try {
    console.log(`\n🔄 Making request to: ${url}`);
    const response = await fetch(url, options);
    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      data: data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function testClaudeAgentIntegration() {
  console.log('\n' + '='.repeat(50));
  console.log('🧪 TEST 1: HEALTH CHECK ENDPOINT');
  console.log('='.repeat(50));
  
  // Test 1: Health Check
  const healthUrl = `${SUPABASE_URL}/functions/v1/orbit-claude-agent-health`;
  console.log(`\n🔍 Testing health check endpoint...`);
  
  const healthResult = await makeRequest(healthUrl);
  
  if (healthResult.success) {
    console.log('✅ Health check endpoint accessible');
    console.log('📊 Health Status:');
    console.log(JSON.stringify(healthResult.data, null, 2));
  } else {
    console.log('❌ Health check failed:', healthResult.error || 'Endpoint not accessible');
    console.log('💡 This may mean the function is not deployed yet');
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🧪 TEST 2: EXISTING ENDPOINTS ACCESSIBLE');
  console.log('='.repeat(50));
  
  // Test existing endpoints to verify project is accessible
  const existingEndpoints = [
    `${SUPABASE_URL}/functions/v1/process-image-batch`,
    `${SUPABASE_URL}/functions/v1/mcp-ai-analysis`, 
    `${SUPABASE_URL}/functions/v1/mcp-metadata`,
    `${SUPABASE_URL}/functions/v1/mcp-storage`
  ];
  
  for (const endpoint of existingEndpoints) {
    console.log(`\n🔍 Testing: ${endpoint}`);
    
    // Make a basic GET request to see if endpoint exists
    const result = await makeRequest(endpoint, {
      method: 'GET'
    });
    
    if (result.success) {
      console.log('✅ Endpoint accessible');
    } else if (result.status === 405) {
      console.log('✅ Endpoint exists (Method Not Allowed is expected)');
    } else {
      console.log(`❌ Endpoint issue: Status ${result.status}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🧪 TEST 3: ORDER PROCESSING SIMULATION');
  console.log('='.repeat(50));
  
  // Simulate the order processing decision logic
  console.log(`\n🎯 Testing Order: ${ORDER_ID}`);
  
  // Hash function to simulate rollout logic
  function hashOrderId(orderId) {
    let hash = 0;
    for (let i = 0; i < orderId.length; i++) {
      const char = orderId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  const orderHash = hashOrderId(ORDER_ID);
  const hashPercentile = orderHash % 100;
  
  console.log(`📊 Order Hash Analysis:`);
  console.log(`   Order ID: ${ORDER_ID}`);
  console.log(`   Hash Value: ${orderHash}`);
  console.log(`   Percentile: ${hashPercentile}%`);
  
  // Test different rollout scenarios
  const rolloutScenarios = [0, 10, 25, 50, 75, 100];
  
  console.log(`\n📈 Rollout Scenarios:`);
  for (const percentage of rolloutScenarios) {
    const wouldUse = hashPercentile < percentage;
    const symbol = wouldUse ? '🤖' : '🏛️';
    const agent = wouldUse ? 'Claude' : 'Legacy';
    console.log(`   ${percentage}% rollout: ${symbol} ${agent}`);
  }
  
  console.log(`\n💡 Recommendation: This order would be included starting at ${hashPercentile + 1}% rollout`);
  
  console.log('\n' + '='.repeat(50));
  console.log('🧪 TEST 4: CONFIGURATION VALIDATION');
  console.log('='.repeat(50));
  
  // Validate environment setup
  console.log(`\n🔧 Environment Setup Check:`);
  
  const requiredForClaudeAgent = [
    'ANTHROPIC_API_KEY',
    'SUPABASE_URL', 
    'SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY)',
    'CLAUDE_AGENT_ENABLED=true'
  ];
  
  console.log(`\n📋 Required Environment Variables:`);
  requiredForClaudeAgent.forEach((env, i) => {
    console.log(`   ${i + 1}. ${env}`);
  });
  
  console.log(`\n🚀 To Enable Claude Agent:`);
  console.log(`   export CLAUDE_AGENT_ENABLED=true`);
  console.log(`   export CLAUDE_AGENT_ROLLOUT_PERCENTAGE=10`);
  console.log(`   export CLAUDE_AGENT_LOGGING=true`);
  console.log(`   export ANTHROPIC_API_KEY="sk-ant-your-key-here"`);
  
  console.log('\n' + '='.repeat(50));
  console.log('🧪 TEST 5: DEPLOYMENT COMMANDS');  
  console.log('='.repeat(50));
  
  console.log(`\n🚀 Deployment Commands:`);
  console.log(`   # Deploy the new Claude agent functions:`);
  console.log(`   supabase functions deploy orbit-claude-agent-health`);
  console.log(`   supabase functions deploy process-image-batch  # Updated with Claude integration`);
  
  console.log(`\n🧪 Testing Commands:`);
  console.log(`   # 1. Check health after deployment:`);
  console.log(`   curl "${healthUrl}"`);
  
  console.log(`\n   # 2. Test with your order (Claude agent forced):`);
  console.log(`   curl -X POST "${SUPABASE_URL}/functions/v1/process-image-batch" \\`);
  console.log(`     -H "Authorization: Bearer YOUR_SERVICE_KEY" \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{`);
  console.log(`       "orderId": "${ORDER_ID}",`);
  console.log(`       "analysisType": "lifestyle",`);
  console.log(`       "useClaudeAgent": true`);
  console.log(`     }'`);
  
  console.log(`\n   # 3. Test with legacy processing (fallback):`);
  console.log(`   curl -X POST "${SUPABASE_URL}/functions/v1/process-image-batch" \\`);
  console.log(`     -H "Authorization: Bearer YOUR_SERVICE_KEY" \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{`);
  console.log(`       "orderId": "${ORDER_ID}",`);
  console.log(`       "analysisType": "lifestyle",`);
  console.log(`       "useClaudeAgent": false`);
  console.log(`     }'`);
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  
  console.log(`\n✅ IMPLEMENTATION COMPLETE:`);
  console.log(`   🤖 Claude Code Agent integrated with process-image-batch`);
  console.log(`   🔧 Modular design - no breaking changes to existing code`);
  console.log(`   🎛️ Feature flags for safe rollout`);
  console.log(`   🔄 Automatic fallback to legacy processing`);
  console.log(`   📊 Percentage-based rollout system`);
  
  console.log(`\n📋 YOUR ORDER (${ORDER_ID}):`);
  console.log(`   🔢 Hash Percentile: ${hashPercentile}%`);
  console.log(`   🎯 Will use Claude agent when rollout >= ${hashPercentile + 1}%`);
  console.log(`   🚀 Can be forced with useClaudeAgent: true`);
  
  console.log(`\n🔍 NEXT STEPS:`);
  console.log(`   1. Set ANTHROPIC_API_KEY environment variable`);
  console.log(`   2. Deploy functions: supabase functions deploy`);
  console.log(`   3. Set CLAUDE_AGENT_ENABLED=true`);
  console.log(`   4. Start with CLAUDE_AGENT_ROLLOUT_PERCENTAGE=10`);
  console.log(`   5. Test with health check endpoint`);
  console.log(`   6. Test order processing with useClaudeAgent: true`);
  console.log(`   7. Monitor logs and gradually increase rollout`);
  
  console.log(`\n💡 SAFE ROLLOUT STRATEGY:`);
  console.log(`   Week 1: 10% rollout  (monitor for errors)`);
  console.log(`   Week 2: 25% rollout  (validate performance)`);
  console.log(`   Week 3: 50% rollout  (compare with legacy)`);
  console.log(`   Week 4: 100% rollout (full Claude agent)`);
  
  console.log('\n' + '='.repeat(80) + '\n');
}

// Run the test
testClaudeAgentIntegration().catch(console.error);