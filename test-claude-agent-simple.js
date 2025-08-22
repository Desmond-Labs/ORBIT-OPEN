// ORBIT Claude Code Agent - Simple Test Script
// Test the Claude agent integration with specific order

const ORDER_ID = '63f22b07-2e68-4f2a-8c50-081fcbcc0fed';

console.log('\n' + '='.repeat(80));
console.log('🧪 TESTING ORBIT CLAUDE CODE AGENT');
console.log('='.repeat(80));

console.log(`\n🎯 Testing with Order ID: ${ORDER_ID}`);

// Test 1: Environment Variables Check
console.log('\n🔍 1. Environment Variables Check:');
const requiredEnvVars = {
  'ANTHROPIC_API_KEY': process.env.ANTHROPIC_API_KEY,
  'SUPABASE_URL': process.env.SUPABASE_URL,
  'sb_secret_key': process.env.sb_secret_key || process.env.SUPABASE_SERVICE_ROLE_KEY,
  'CLAUDE_AGENT_ENABLED': process.env.CLAUDE_AGENT_ENABLED
};

let envReady = true;
for (const [key, value] of Object.entries(requiredEnvVars)) {
  const status = value ? '✅' : '❌';
  const displayValue = value ? (key.includes('KEY') ? '***hidden***' : value.substring(0, 50) + '...') : 'NOT SET';
  console.log(`  ${status} ${key}: ${displayValue}`);
  if (!value && key !== 'CLAUDE_AGENT_ENABLED') {
    envReady = false;
  }
}

// Test 2: Configuration Validation
console.log('\n🔍 2. Agent Configuration:');
const config = {
  enabled: process.env.CLAUDE_AGENT_ENABLED === 'true',
  rollout_percentage: parseInt(process.env.CLAUDE_AGENT_ROLLOUT_PERCENTAGE || '0'),
  allow_fallback: process.env.CLAUDE_AGENT_ALLOW_FALLBACK !== 'false',
  dev_mode: process.env.CLAUDE_AGENT_DEV_MODE === 'true',
  logging: process.env.CLAUDE_AGENT_LOGGING === 'true',
  max_turns: parseInt(process.env.CLAUDE_AGENT_MAX_TURNS || '50'),
  timeout: parseInt(process.env.CLAUDE_AGENT_TIMEOUT || '300000')
};

console.log(`  🤖 Agent Enabled: ${config.enabled ? '✅ YES' : '❌ NO'}`);
console.log(`  📊 Rollout Percentage: ${config.rollout_percentage}%`);
console.log(`  🔄 Fallback Allowed: ${config.allow_fallback ? '✅ YES' : '❌ NO'}`);
console.log(`  🧪 Development Mode: ${config.dev_mode ? '✅ YES' : '❌ NO'}`);
console.log(`  📝 Logging Enabled: ${config.logging ? '✅ YES' : '❌ NO'}`);
console.log(`  🎯 Max Turns: ${config.max_turns}`);
console.log(`  ⏱️  Timeout: ${config.timeout}ms`);

// Test 3: Order ID Hash Check (for rollout)
console.log('\n🔍 3. Order ID Rollout Check:');
function hashOrderId(orderId) {
  let hash = 0;
  for (let i = 0; i < orderId.length; i++) {
    const char = orderId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

const orderHash = hashOrderId(ORDER_ID);
const hashPercentile = orderHash % 100;
const wouldUseClaudeAgent = hashPercentile < config.rollout_percentage;

console.log(`  🔢 Order Hash: ${orderHash}`);
console.log(`  📊 Hash Percentile: ${hashPercentile}%`);
console.log(`  🎯 Would Use Claude Agent: ${wouldUseClaudeAgent ? '✅ YES' : '❌ NO'} (rollout: ${config.rollout_percentage}%)`);

// Test 4: API Endpoints
console.log('\n🔍 4. API Endpoint Configuration:');
const supabaseUrl = process.env.SUPABASE_URL;
if (supabaseUrl) {
  const endpoints = {
    'process-image-batch': `${supabaseUrl}/functions/v1/process-image-batch`,
    'claude-agent-health': `${supabaseUrl}/functions/v1/orbit-claude-agent-health`,
    'mcp-ai-analysis': `${supabaseUrl}/functions/v1/mcp-ai-analysis`,
    'mcp-metadata': `${supabaseUrl}/functions/v1/mcp-metadata`,
    'mcp-storage': `${supabaseUrl}/functions/v1/mcp-storage`
  };
  
  for (const [name, url] of Object.entries(endpoints)) {
    console.log(`  🔗 ${name}: ${url}`);
  }
} else {
  console.log('  ❌ SUPABASE_URL not set - cannot determine endpoints');
}

// Test 5: Simulate Agent Decision Logic
console.log('\n🔍 5. Agent Decision Simulation:');
function shouldUseClaudeAgent(orderId, requestUseAgent = undefined) {
  // 1. Check explicit disable
  if (requestUseAgent === false) {
    return { use: false, reason: 'Explicitly disabled by request' };
  }
  
  // 2. Check if enabled in environment
  if (!config.enabled) {
    return { use: false, reason: 'Agent disabled in environment (CLAUDE_AGENT_ENABLED != true)' };
  }
  
  // 3. Check explicit request
  if (requestUseAgent === true) {
    return { use: true, reason: 'Explicitly requested' };
  }
  
  // 4. Check rollout percentage
  if (config.rollout_percentage > 0) {
    const hash = hashOrderId(orderId);
    const shouldUse = (hash % 100) < config.rollout_percentage;
    return { 
      use: shouldUse, 
      reason: shouldUse ? 
        `Included in ${config.rollout_percentage}% rollout (hash: ${hash % 100})` :
        `Excluded from ${config.rollout_percentage}% rollout (hash: ${hash % 100})`
    };
  }
  
  // 5. Default to false
  return { use: false, reason: 'No rollout configured and not explicitly requested' };
}

const scenarios = [
  { name: 'Default Request', params: {} },
  { name: 'Explicit Claude Agent', params: { useClaudeAgent: true } },
  { name: 'Explicit Legacy', params: { useClaudeAgent: false } }
];

for (const scenario of scenarios) {
  const decision = shouldUseClaudeAgent(ORDER_ID, scenario.params.useClaudeAgent);
  console.log(`  📋 ${scenario.name}: ${decision.use ? '🤖 Claude Agent' : '🏛️ Legacy'}`);
  console.log(`     Reason: ${decision.reason}`);
}

// Test 6: Generate Test Request
console.log('\n🔍 6. Test Request Generation:');
if (supabaseUrl && process.env.sb_secret_key) {
  const testRequest = {
    method: 'POST',
    url: `${supabaseUrl}/functions/v1/process-image-batch`,
    headers: {
      'Authorization': `Bearer ${process.env.sb_secret_key}`,
      'Content-Type': 'application/json'
    },
    body: {
      orderId: ORDER_ID,
      analysisType: 'lifestyle',
      useClaudeAgent: true
    }
  };
  
  console.log('  🧪 Test with Claude Agent:');
  console.log(`     curl -X POST "${testRequest.url}" \\`);
  console.log(`       -H "Authorization: Bearer ${process.env.sb_secret_key.substring(0, 20)}..." \\`);
  console.log(`       -H "Content-Type: application/json" \\`);
  console.log(`       -d '${JSON.stringify(testRequest.body, null, 2).replace(/\n/g, '\n           ')}'`);
  
  console.log('\n  🏛️ Test with Legacy Processing:');
  const legacyBody = { ...testRequest.body, useClaudeAgent: false };
  console.log(`     curl -X POST "${testRequest.url}" \\`);
  console.log(`       -H "Authorization: Bearer ${process.env.sb_secret_key.substring(0, 20)}..." \\`);
  console.log(`       -H "Content-Type: application/json" \\`);
  console.log(`       -d '${JSON.stringify(legacyBody, null, 2).replace(/\n/g, '\n           ')}'`);
} else {
  console.log('  ❌ Cannot generate test requests - missing SUPABASE_URL or sb_secret_key');
}

// Summary and Recommendations
console.log('\n' + '='.repeat(80));
console.log('📊 SUMMARY & RECOMMENDATIONS');
console.log('='.repeat(80));

if (!envReady) {
  console.log('\n❌ SETUP REQUIRED:');
  console.log('   1. Set missing environment variables');
  console.log('   2. Obtain Anthropic API key if needed');
  console.log('   3. Verify Supabase configuration');
} else if (!config.enabled) {
  console.log('\n🔧 READY TO ENABLE:');
  console.log('   1. Set CLAUDE_AGENT_ENABLED=true to enable');
  console.log('   2. Start with CLAUDE_AGENT_ROLLOUT_PERCENTAGE=10 for testing');
  console.log('   3. Enable CLAUDE_AGENT_LOGGING=true for debugging');
} else {
  console.log('\n✅ CLAUDE AGENT CONFIGURED:');
  if (config.rollout_percentage === 0) {
    console.log('   📊 Agent is enabled but rollout is 0% - no orders will use it automatically');
    console.log('   💡 Set CLAUDE_AGENT_ROLLOUT_PERCENTAGE=10 to test with 10% of orders');
    console.log('   🎯 Or use useClaudeAgent: true in requests to force Claude agent usage');
  } else {
    console.log(`   📊 Agent will process ~${config.rollout_percentage}% of orders automatically`);
    console.log(`   🎯 Your test order (${ORDER_ID}) would ${wouldUseClaudeAgent ? 'USE' : 'NOT use'} Claude agent`);
  }
}

console.log('\n🔍 NEXT STEPS:');
console.log('   1. Check health endpoint: GET /functions/v1/orbit-claude-agent-health');
console.log('   2. Test with your order using the generated curl commands above');
console.log('   3. Monitor logs for detailed processing information');
console.log('   4. Adjust rollout percentage based on results');

console.log('\n' + '='.repeat(80) + '\n');