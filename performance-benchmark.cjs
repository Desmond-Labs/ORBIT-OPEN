#!/usr/bin/env node

/**
 * Performance Benchmarking Suite for MCP Servers
 * Tests response times, throughput, and concurrent request handling
 */

const https = require('https');

const BENCHMARK_CONFIG = {
  BASE_URL: 'https://ufdcvxmizlzlnyyqpfck.supabase.co/functions/v1',
  MCP_SERVERS: ['mcp-ai-analysis', 'mcp-metadata', 'mcp-storage'],
  CONCURRENT_REQUESTS: 5,
  TOTAL_REQUESTS: 20,
  TIMEOUT: 5000
};

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const endTime = Date.now();
        resolve({
          statusCode: res.statusCode,
          responseTime: endTime - startTime,
          body: body
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(BENCHMARK_CONFIG.TIMEOUT, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Benchmark single request
async function benchmarkSingleRequest(serverName) {
  const options = {
    hostname: 'ufdcvxmizlzlnyyqpfck.supabase.co',
    port: 443,
    path: `/functions/v1/${serverName}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const requestData = {
    jsonrpc: '2.0',
    method: 'ping',
    id: `benchmark-${Date.now()}`
  };

  try {
    const result = await makeRequest(options, requestData);
    return {
      success: true,
      responseTime: result.responseTime,
      statusCode: result.statusCode
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      responseTime: BENCHMARK_CONFIG.TIMEOUT
    };
  }
}

// Benchmark concurrent requests
async function benchmarkConcurrentRequests(serverName, concurrency = 5) {
  console.log(`  🚀 Testing ${concurrency} concurrent requests...`);
  
  const requests = [];
  for (let i = 0; i < concurrency; i++) {
    requests.push(benchmarkSingleRequest(serverName));
  }

  const startTime = Date.now();
  const results = await Promise.all(requests);
  const totalTime = Date.now() - startTime;

  const successfulRequests = results.filter(r => r.success);
  const avgResponseTime = successfulRequests.length > 0 
    ? successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) / successfulRequests.length
    : 0;

  return {
    totalTime,
    successCount: successfulRequests.length,
    failureCount: results.length - successfulRequests.length,
    avgResponseTime,
    throughput: (successfulRequests.length / totalTime) * 1000 // requests per second
  };
}

// Benchmark sustained load
async function benchmarkSustainedLoad(serverName, totalRequests = 20) {
  console.log(`  📈 Testing sustained load (${totalRequests} requests)...`);
  
  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < totalRequests; i++) {
    const result = await benchmarkSingleRequest(serverName);
    results.push(result);
    
    // Small delay between requests to simulate realistic usage
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  const successfulRequests = results.filter(r => r.success);
  const responseTimes = successfulRequests.map(r => r.responseTime);
  
  return {
    totalTime,
    successCount: successfulRequests.length,
    failureCount: results.length - successfulRequests.length,
    avgResponseTime: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
    minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
    maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
    p95ResponseTime: responseTimes.length > 0 ? responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)] : 0,
    throughput: (successfulRequests.length / totalTime) * 1000
  };
}

// Main benchmarking function
async function runPerformanceBenchmarks() {
  console.log('🏁 MCP Server Performance Benchmarking Suite');
  console.log('='.repeat(60));
  console.log(`Testing ${BENCHMARK_CONFIG.MCP_SERVERS.length} MCP servers with performance metrics`);

  const allResults = {};

  for (const serverName of BENCHMARK_CONFIG.MCP_SERVERS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`⚡ BENCHMARKING: ${serverName.toUpperCase()}`);
    console.log(`${'='.repeat(60)}`);

    allResults[serverName] = {
      singleRequest: await benchmarkSingleRequest(serverName),
      concurrentRequests: await benchmarkConcurrentRequests(serverName, BENCHMARK_CONFIG.CONCURRENT_REQUESTS),
      sustainedLoad: await benchmarkSustainedLoad(serverName, BENCHMARK_CONFIG.TOTAL_REQUESTS)
    };

    // Display results for this server
    const results = allResults[serverName];
    
    console.log(`\n📊 ${serverName.toUpperCase()} Performance Results:`);
    console.log(`  🔄 Single Request: ${results.singleRequest.responseTime}ms (${results.singleRequest.statusCode})`);
    console.log(`  🚀 Concurrent (${BENCHMARK_CONFIG.CONCURRENT_REQUESTS}): ${Math.round(results.concurrentRequests.avgResponseTime)}ms avg, ${results.concurrentRequests.throughput.toFixed(2)} req/s`);
    console.log(`  📈 Sustained Load: ${Math.round(results.sustainedLoad.avgResponseTime)}ms avg, P95: ${results.sustainedLoad.p95ResponseTime}ms`);
    console.log(`  📊 Throughput: ${results.sustainedLoad.throughput.toFixed(2)} req/s sustained`);
  }

  // Generate performance summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📈 PERFORMANCE SUMMARY');
  console.log(`${'='.repeat(60)}`);

  let totalBenchmarks = 0;
  let passedBenchmarks = 0;

  for (const [serverName, results] of Object.entries(allResults)) {
    console.log(`\n⚡ ${serverName.toUpperCase()} Performance Score:`);
    
    // Performance criteria
    const singleReqPass = results.singleRequest.responseTime < 200;
    const concurrentPass = results.concurrentRequests.avgResponseTime < 300;
    const sustainedPass = results.sustainedLoad.p95ResponseTime < 500;
    const throughputPass = results.sustainedLoad.throughput > 5; // 5 req/s minimum
    
    totalBenchmarks += 4;
    if (singleReqPass) passedBenchmarks++;
    if (concurrentPass) passedBenchmarks++;
    if (sustainedPass) passedBenchmarks++;
    if (throughputPass) passedBenchmarks++;

    console.log(`  🔄 Single Request: ${singleReqPass ? '✅' : '❌'} ${results.singleRequest.responseTime}ms (target: <200ms)`);
    console.log(`  🚀 Concurrent Load: ${concurrentPass ? '✅' : '❌'} ${Math.round(results.concurrentRequests.avgResponseTime)}ms (target: <300ms)`);
    console.log(`  📈 Sustained P95: ${sustainedPass ? '✅' : '❌'} ${results.sustainedLoad.p95ResponseTime}ms (target: <500ms)`);
    console.log(`  📊 Throughput: ${throughputPass ? '✅' : '❌'} ${results.sustainedLoad.throughput.toFixed(2)} req/s (target: >5 req/s)`);
  }

  const performanceScore = Math.round((passedBenchmarks / totalBenchmarks) * 100);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎯 OVERALL PERFORMANCE: ${passedBenchmarks}/${totalBenchmarks} (${performanceScore}%)`);

  if (performanceScore >= 90) {
    console.log('🏆 EXCELLENT PERFORMANCE - Ready for production!');
  } else if (performanceScore >= 75) {
    console.log('🟢 GOOD PERFORMANCE - Production ready with monitoring');
  } else if (performanceScore >= 60) {
    console.log('🟡 ADEQUATE PERFORMANCE - Monitor closely in production');
  } else {
    console.log('🔴 PERFORMANCE ISSUES - Optimization needed before production');
  }

  console.log('\n🔄 Performance benchmarking completed');
  
  return {
    performanceScore,
    results: allResults,
    ready: performanceScore >= 75
  };
}

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runPerformanceBenchmarks, BENCHMARK_CONFIG };
}

// Run if executed directly
if (require.main === module) {
  runPerformanceBenchmarks().then(result => {
    console.log(`\n✅ Benchmarking completed with ${result.performanceScore}% performance score`);
    process.exit(result.ready ? 0 : 1);
  }).catch(error => {
    console.error('💥 Benchmark execution failed:', error);
    process.exit(1);
  });
}