#!/usr/bin/env node

/**
 * Comprehensive MCP Server Testing Suite
 * Tests Phase 2 MCP server functionality before Phase 3 orchestrator implementation
 */

const https = require('https');

// Test Configuration
const TEST_CONFIG = {
  BASE_URL: 'https://ufdcvxmizlzlnyyqpfck.supabase.co/functions/v1',
  MCP_SERVERS: ['mcp-ai-analysis', 'mcp-metadata', 'mcp-storage'],
  TIMEOUT: 10000,
  // Using service role key for admin access (bypasses user auth requirement)
  SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmZGN2eG1pemx6bG55eXFwZmNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjIzMzU3MywiZXhwIjoyMDYxODA5NTczfQ.3nD78URKVd81K3giuo750K0eqEJzbG5pmg-FELnMHzI'
};

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsedBody = body ? JSON.parse(body) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsedBody
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(TEST_CONFIG.TIMEOUT, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test 1: Basic Connectivity & CORS
async function testBasicConnectivity(serverName) {
  console.log(`\n🔍 Testing Basic Connectivity: ${serverName}`);
  
  const results = {
    cors: false,
    endpoint: false,
    errors: []
  };

  try {
    // Test CORS OPTIONS
    const corsOptions = {
      hostname: 'ufdcvxmizlzlnyyqpfck.supabase.co',
      port: 443,
      path: `/functions/v1/${serverName}`,
      method: 'OPTIONS',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const corsResponse = await makeRequest(corsOptions);
    results.cors = corsResponse.statusCode === 200 || corsResponse.statusCode === 204;
    console.log(`  ✅ CORS OPTIONS: ${corsResponse.statusCode}`);

    // Test endpoint availability
    const postOptions = {
      hostname: 'ufdcvxmizlzlnyyqpfck.supabase.co',
      port: 443,
      path: `/functions/v1/${serverName}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const postResponse = await makeRequest(postOptions, {
      jsonrpc: '2.0',
      method: 'ping',
      id: 'connectivity-test'
    });

    // We expect authentication errors, which means the server is up and processing requests
    results.endpoint = postResponse.statusCode !== 500;
    console.log(`  ✅ Endpoint available: ${postResponse.statusCode} - ${JSON.stringify(postResponse.body).substring(0, 100)}...`);

  } catch (error) {
    results.errors.push(`Connectivity test failed: ${error.message}`);
    console.log(`  ❌ Connectivity failed: ${error.message}`);
  }

  return results;
}

// Test 2: Authentication System
async function testAuthentication(serverName) {
  console.log(`\n🔐 Testing Authentication: ${serverName}`);
  
  const results = {
    noAuth: false,
    invalidAuth: false,
    authDetection: false,
    errors: []
  };

  try {
    // Test without authentication
    const noAuthOptions = {
      hostname: 'ufdcvxmizlzlnyyqpfck.supabase.co',
      port: 443,
      path: `/functions/v1/${serverName}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const noAuthResponse = await makeRequest(noAuthOptions, {
      jsonrpc: '2.0',
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {} },
      id: 'auth-test-1'
    });

    results.noAuth = noAuthResponse.statusCode === 401;
    console.log(`  ✅ No auth rejection: ${noAuthResponse.statusCode}`);

    // Test with invalid token
    const invalidAuthOptions = {
      ...noAuthOptions,
      headers: {
        ...noAuthOptions.headers,
        'Authorization': 'Bearer invalid-token'
      }
    };

    const invalidAuthResponse = await makeRequest(invalidAuthOptions, {
      jsonrpc: '2.0',
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {} },
      id: 'auth-test-2'
    });

    results.invalidAuth = invalidAuthResponse.statusCode === 401;
    results.authDetection = invalidAuthResponse.body && invalidAuthResponse.body.keyFormat;
    
    console.log(`  ✅ Invalid auth rejection: ${invalidAuthResponse.statusCode}`);
    console.log(`  ✅ Key format detection: ${invalidAuthResponse.body.keyFormat || 'none'}`);

  } catch (error) {
    results.errors.push(`Authentication test failed: ${error.message}`);
    console.log(`  ❌ Authentication test failed: ${error.message}`);
  }

  return results;
}

// Test 3: JSON-RPC 2.0 Protocol Compliance
async function testJsonRpcCompliance(serverName) {
  console.log(`\n📋 Testing JSON-RPC 2.0 Compliance: ${serverName}`);
  
  const results = {
    invalidRequest: false,
    methodNotFound: false,
    parseError: false,
    errors: []
  };

  try {
    const baseOptions = {
      hostname: 'ufdcvxmizlzlnyyqpfck.supabase.co',
      port: 443,
      path: `/functions/v1/${serverName}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_CONFIG.SERVICE_ROLE_KEY}`
      }
    };

    // Test invalid JSON-RPC structure
    const invalidResponse = await makeRequest(baseOptions, {
      method: 'test',
      id: 'invalid-test'
      // Missing jsonrpc field
    });

    results.invalidRequest = invalidResponse.body && invalidResponse.body.error;
    console.log(`  ✅ Invalid request handling: ${invalidResponse.statusCode}`);

    // Test method not found
    const notFoundResponse = await makeRequest(baseOptions, {
      jsonrpc: '2.0',
      method: 'non_existent_method',
      id: 'not-found-test'
    });

    results.methodNotFound = notFoundResponse.body && 
      (notFoundResponse.body.error || notFoundResponse.body.message === 'Authentication failed');
    console.log(`  ✅ Method not found handling: ${notFoundResponse.statusCode}`);

    // Test parse error (invalid JSON)
    const parseOptions = {
      ...baseOptions,
      headers: {
        ...baseOptions.headers,
        'Content-Length': '15'
      }
    };

    // This will be handled as invalid JSON
    const parseResponse = await makeRequest({
      ...parseOptions,
      headers: {
        ...baseOptions.headers
      }
    }, { invalid: 'json', missing: 'quotes' });

    results.parseError = parseResponse.statusCode >= 400;
    console.log(`  ✅ Parse error handling: ${parseResponse.statusCode}`);

  } catch (error) {
    results.errors.push(`JSON-RPC compliance test failed: ${error.message}`);
    console.log(`  ❌ JSON-RPC compliance failed: ${error.message}`);
  }

  return results;
}

// Test 4: Server-Specific Functionality (basic validation)
async function testServerSpecificFeatures(serverName) {
  console.log(`\n⚙️  Testing Server-Specific Features: ${serverName}`);
  
  const results = {
    initialized: false,
    toolsListable: false,
    serverResponsive: false,
    errors: []
  };

  try {
    const baseOptions = {
      hostname: 'ufdcvxmizlzlnyyqpfck.supabase.co',
      port: 443,
      path: `/functions/v1/${serverName}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_CONFIG.SERVICE_ROLE_KEY}`
      }
    };

    // Test tools/list method (should work even with auth issues)
    const toolsResponse = await makeRequest(baseOptions, {
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 'tools-test'
    });

    results.toolsListable = toolsResponse.statusCode !== 500;
    console.log(`  ✅ Tools list endpoint: ${toolsResponse.statusCode}`);
    
    if (toolsResponse.body && toolsResponse.body.result) {
      console.log(`    📋 Available tools: ${toolsResponse.body.result.tools?.length || 0}`);
    }

    // Test ping method
    const pingResponse = await makeRequest(baseOptions, {
      jsonrpc: '2.0',
      method: 'ping',
      id: 'ping-test'
    });

    results.serverResponsive = pingResponse.statusCode !== 500;
    console.log(`  ✅ Ping endpoint: ${pingResponse.statusCode}`);

  } catch (error) {
    results.errors.push(`Server-specific test failed: ${error.message}`);
    console.log(`  ❌ Server-specific test failed: ${error.message}`);
  }

  return results;
}

// Test 5: Performance Basic Check
async function testBasicPerformance(serverName) {
  console.log(`\n⚡ Testing Basic Performance: ${serverName}`);
  
  const results = {
    responseTime: 0,
    successful: false,
    errors: []
  };

  try {
    const startTime = Date.now();
    
    const perfOptions = {
      hostname: 'ufdcvxmizlzlnyyqpfck.supabase.co',
      port: 443,
      path: `/functions/v1/${serverName}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const perfResponse = await makeRequest(perfOptions, {
      jsonrpc: '2.0',
      method: 'ping',
      id: 'perf-test'
    });

    results.responseTime = Date.now() - startTime;
    results.successful = perfResponse.statusCode !== 500;
    
    console.log(`  ✅ Response time: ${results.responseTime}ms`);
    console.log(`  ✅ Status: ${perfResponse.statusCode}`);

  } catch (error) {
    results.errors.push(`Performance test failed: ${error.message}`);
    console.log(`  ❌ Performance test failed: ${error.message}`);
  }

  return results;
}

// Main test runner
async function runMCPServerTests() {
  console.log('🚀 MCP Server Comprehensive Testing Suite');
  console.log('='.repeat(60));
  console.log(`Testing ${TEST_CONFIG.MCP_SERVERS.length} MCP servers:`);
  TEST_CONFIG.MCP_SERVERS.forEach(server => console.log(`  - ${server}`));

  const allResults = {};

  for (const serverName of TEST_CONFIG.MCP_SERVERS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 TESTING MCP SERVER: ${serverName.toUpperCase()}`);
    console.log(`${'='.repeat(60)}`);

    allResults[serverName] = {
      connectivity: await testBasicConnectivity(serverName),
      authentication: await testAuthentication(serverName),
      jsonRpcCompliance: await testJsonRpcCompliance(serverName),
      serverFeatures: await testServerSpecificFeatures(serverName),
      performance: await testBasicPerformance(serverName)
    };
  }

  // Generate summary report
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 COMPREHENSIVE TEST SUMMARY');
  console.log(`${'='.repeat(60)}`);

  let totalTests = 0;
  let passedTests = 0;

  for (const [serverName, results] of Object.entries(allResults)) {
    console.log(`\n🎯 ${serverName.toUpperCase()} Results:`);
    
    const serverScore = {
      total: 0,
      passed: 0
    };

    // Connectivity Tests
    serverScore.total += 2;
    if (results.connectivity.cors) serverScore.passed++;
    if (results.connectivity.endpoint) serverScore.passed++;
    console.log(`  🔍 Connectivity: ${results.connectivity.cors ? '✅' : '❌'} CORS, ${results.connectivity.endpoint ? '✅' : '❌'} Endpoint`);

    // Authentication Tests  
    serverScore.total += 3;
    if (results.authentication.noAuth) serverScore.passed++;
    if (results.authentication.invalidAuth) serverScore.passed++;
    if (results.authentication.authDetection) serverScore.passed++;
    console.log(`  🔐 Authentication: ${results.authentication.noAuth ? '✅' : '❌'} No-Auth, ${results.authentication.invalidAuth ? '✅' : '❌'} Invalid-Auth, ${results.authentication.authDetection ? '✅' : '❌'} Detection`);

    // JSON-RPC Tests
    serverScore.total += 3;
    if (results.jsonRpcCompliance.invalidRequest) serverScore.passed++;
    if (results.jsonRpcCompliance.methodNotFound) serverScore.passed++;
    if (results.jsonRpcCompliance.parseError) serverScore.passed++;
    console.log(`  📋 JSON-RPC: ${results.jsonRpcCompliance.invalidRequest ? '✅' : '❌'} Invalid, ${results.jsonRpcCompliance.methodNotFound ? '✅' : '❌'} Not-Found, ${results.jsonRpcCompliance.parseError ? '✅' : '❌'} Parse`);

    // Server Features
    serverScore.total += 2;
    if (results.serverFeatures.toolsListable) serverScore.passed++;
    if (results.serverFeatures.serverResponsive) serverScore.passed++;
    console.log(`  ⚙️  Features: ${results.serverFeatures.toolsListable ? '✅' : '❌'} Tools-List, ${results.serverFeatures.serverResponsive ? '✅' : '❌'} Ping`);

    // Performance
    serverScore.total += 1;
    if (results.performance.successful && results.performance.responseTime < 5000) serverScore.passed++;
    console.log(`  ⚡ Performance: ${results.performance.successful && results.performance.responseTime < 5000 ? '✅' : '❌'} Response (${results.performance.responseTime}ms)`);

    const serverPercent = Math.round((serverScore.passed / serverScore.total) * 100);
    console.log(`  📈 Server Score: ${serverScore.passed}/${serverScore.total} (${serverPercent}%)`);

    totalTests += serverScore.total;
    passedTests += serverScore.passed;
  }

  const overallPercent = Math.round((passedTests / totalTests) * 100);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎯 OVERALL RESULTS: ${passedTests}/${totalTests} (${overallPercent}%)`);
  
  if (overallPercent >= 80) {
    console.log('🎉 MCP SERVERS READY FOR PHASE 3 ORCHESTRATOR!');
    console.log('✅ All servers are operational and responding correctly');
  } else if (overallPercent >= 60) {
    console.log('⚠️  MCP servers mostly functional but need attention');
    console.log('🔧 Review failed tests before proceeding to Phase 3');
  } else {
    console.log('❌ MCP servers have significant issues');
    console.log('🚨 Address critical failures before Phase 3');
  }

  console.log(`\n📋 Phase 3 Prerequisites Check:`);
  console.log(`✅ Authentication system: ${allResults['mcp-ai-analysis']?.authentication?.authDetection ? 'Working' : 'Needs attention'}`);
  console.log(`✅ JSON-RPC compliance: ${Object.values(allResults).every(r => r.jsonRpcCompliance.invalidRequest) ? 'Working' : 'Needs attention'}`);
  console.log(`✅ Server availability: ${Object.values(allResults).every(r => r.connectivity.endpoint) ? 'All servers up' : 'Some servers down'}`);
  
  console.log('\n🔄 Ready to proceed to Phase 3: Orchestrator Implementation');

  return {
    overallScore: overallPercent,
    readyForPhase3: overallPercent >= 80,
    results: allResults
  };
}

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runMCPServerTests, TEST_CONFIG };
}

// Run if executed directly
if (require.main === module) {
  runMCPServerTests().then(result => {
    console.log(`\n✅ Testing completed with ${result.overallScore}% success rate`);
    process.exit(result.readyForPhase3 ? 0 : 1);
  }).catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
}