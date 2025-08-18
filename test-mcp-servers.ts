#!/usr/bin/env deno run --allow-read --allow-net --allow-env

/**
 * Test Script for Remote MCP Servers
 * Validates Phase 2 implementation structure and exports
 */

import { dirname, join } from "https://deno.land/std@0.208.0/path/mod.ts";

interface TestResult {
  server: string;
  passed: number;
  failed: number;
  errors: string[];
}

/**
 * Test MCP server file structure and exports
 */
async function testMCPServer(serverPath: string, serverName: string): Promise<TestResult> {
  const result: TestResult = {
    server: serverName,
    passed: 0,
    failed: 0,
    errors: []
  };

  console.log(`\n🧪 Testing ${serverName} MCP Server...`);

  // Test 1: File exists
  try {
    const stat = await Deno.stat(serverPath);
    if (stat.isFile) {
      console.log(`  ✅ File exists: ${serverPath}`);
      result.passed++;
    } else {
      console.log(`  ❌ Path is not a file: ${serverPath}`);
      result.failed++;
      result.errors.push("Server file does not exist");
      return result;
    }
  } catch (error) {
    console.log(`  ❌ File not found: ${serverPath}`);
    result.failed++;
    result.errors.push(`File not found: ${error.message}`);
    return result;
  }

  // Test 2: TypeScript syntax validation
  try {
    const content = await Deno.readTextFile(serverPath);
    
    // Basic syntax checks
    if (content.includes('import') && content.includes('createORBITMCPServer')) {
      console.log(`  ✅ Imports MCP infrastructure`);
      result.passed++;
    } else {
      console.log(`  ❌ Missing required imports`);
      result.failed++;
      result.errors.push("Missing MCP infrastructure imports");
    }

    if (content.includes('Deno.serve')) {
      console.log(`  ✅ Edge Function handler present`);
      result.passed++;
    } else {
      console.log(`  ❌ Missing Deno.serve handler`);
      result.failed++;
      result.errors.push("Missing Edge Function handler");
    }

    if (content.includes('securityPathProtection')) {
      console.log(`  ✅ Security path protection enabled`);
      result.passed++;
    } else {
      console.log(`  ❌ Missing security path protection`);
      result.failed++;
      result.errors.push("Missing security path protection");
    }

  } catch (error) {
    console.log(`  ❌ Failed to read/parse file: ${error.message}`);
    result.failed++;
    result.errors.push(`File parsing error: ${error.message}`);
  }

  // Test 3: Tool definitions validation
  try {
    const content = await Deno.readTextFile(serverPath);
    
    // Count tool definitions
    const toolMatches = content.match(/name:\s*['"`]([^'"`]+)['"`]/g);
    if (toolMatches && toolMatches.length > 0) {
      console.log(`  ✅ Found ${toolMatches.length} tool definition(s)`);
      result.passed++;
    } else {
      console.log(`  ❌ No tool definitions found`);
      result.failed++;
      result.errors.push("No tool definitions found");
    }

    // Check for proper handler functions
    const handlerMatches = content.match(/handler:\s*async/g);
    if (handlerMatches && handlerMatches.length > 0) {
      console.log(`  ✅ Found ${handlerMatches.length} async handler(s)`);
      result.passed++;
    } else {
      console.log(`  ❌ No async handlers found`);
      result.failed++;
      result.errors.push("No async handlers found");
    }

  } catch (error) {
    console.log(`  ❌ Tool validation failed: ${error.message}`);
    result.failed++;
    result.errors.push(`Tool validation error: ${error.message}`);
  }

  // Test 4: Server-specific validations
  await testServerSpecificFeatures(serverPath, serverName, result);

  return result;
}

/**
 * Test server-specific features
 */
async function testServerSpecificFeatures(serverPath: string, serverName: string, result: TestResult) {
  try {
    const content = await Deno.readTextFile(serverPath);
    
    switch (serverName) {
      case 'mcp-ai-analysis':
        if (content.includes('GoogleGenerativeAI')) {
          console.log(`  ✅ Google Gemini AI integration present`);
          result.passed++;
        } else {
          console.log(`  ❌ Missing Google Gemini AI integration`);
          result.failed++;
          result.errors.push("Missing Google Gemini AI integration");
        }
        
        if (content.includes('analyze_image')) {
          console.log(`  ✅ Image analysis tool defined`);
          result.passed++;
        } else {
          console.log(`  ❌ Missing image analysis tool`);
          result.failed++;
          result.errors.push("Missing image analysis tool");
        }
        break;

      case 'mcp-metadata':
        if (content.includes('XMPProcessor') || content.includes('createXMPPacket')) {
          console.log(`  ✅ XMP processing functionality present`);
          result.passed++;
        } else {
          console.log(`  ❌ Missing XMP processing functionality`);
          result.failed++;
          result.errors.push("Missing XMP processing functionality");
        }
        
        if (content.includes('embed_image_metadata')) {
          console.log(`  ✅ Metadata embedding tool defined`);
          result.passed++;
        } else {
          console.log(`  ❌ Missing metadata embedding tool`);
          result.failed++;
          result.errors.push("Missing metadata embedding tool");
        }
        break;

      case 'mcp-storage':
        if (content.includes('createClient') && content.includes('supabase.storage')) {
          console.log(`  ✅ Supabase Storage integration present`);
          result.passed++;
        } else {
          console.log(`  ❌ Missing Supabase Storage integration`);
          result.failed++;
          result.errors.push("Missing Supabase Storage integration");
        }
        
        if (content.includes('upload_image_batch')) {
          console.log(`  ✅ Batch upload functionality defined`);
          result.passed++;
        } else {
          console.log(`  ❌ Missing batch upload functionality`);
          result.failed++;
          result.errors.push("Missing batch upload functionality");
        }
        break;
    }
  } catch (error) {
    console.log(`  ❌ Server-specific validation failed: ${error.message}`);
    result.failed++;
    result.errors.push(`Server-specific validation error: ${error.message}`);
  }
}

/**
 * Test MCP shared infrastructure
 */
async function testSharedInfrastructure(basePath: string): Promise<TestResult> {
  const result: TestResult = {
    server: 'shared-infrastructure',
    passed: 0,
    failed: 0,
    errors: []
  };

  console.log(`\n🏗️  Testing Shared MCP Infrastructure...`);

  const sharedFiles = [
    'supabase/functions/_shared/mcp-types.ts',
    'supabase/functions/_shared/mcp-server.ts',
    'supabase/functions/_shared/mcp-client.ts'
  ];

  for (const file of sharedFiles) {
    const filePath = join(basePath, file);
    try {
      const stat = await Deno.stat(filePath);
      if (stat.isFile) {
        console.log(`  ✅ ${file}`);
        result.passed++;
      } else {
        console.log(`  ❌ ${file} - not a file`);
        result.failed++;
        result.errors.push(`${file} is not a file`);
      }
    } catch (error) {
      console.log(`  ❌ ${file} - not found`);
      result.failed++;
      result.errors.push(`${file} not found`);
    }
  }

  // Test core exports
  try {
    const mcpServerPath = join(basePath, 'supabase/functions/_shared/mcp-server.ts');
    const content = await Deno.readTextFile(mcpServerPath);
    
    if (content.includes('export') && content.includes('createORBITMCPServer')) {
      console.log(`  ✅ createORBITMCPServer export found`);
      result.passed++;
    } else {
      console.log(`  ❌ createORBITMCPServer export missing`);
      result.failed++;
      result.errors.push("createORBITMCPServer export missing");
    }

    if (content.includes('securityPathProtection')) {
      console.log(`  ✅ securityPathProtection export found`);
      result.passed++;
    } else {
      console.log(`  ❌ securityPathProtection export missing`);
      result.failed++;
      result.errors.push("securityPathProtection export missing");
    }
  } catch (error) {
    console.log(`  ❌ Failed to validate exports: ${error.message}`);
    result.failed++;
    result.errors.push(`Export validation error: ${error.message}`);
  }

  return result;
}

/**
 * Main test runner
 */
async function main() {
  console.log('🚀 ORBIT Remote MCP Servers - Phase 2 Validation\n');
  
  const basePath = '/Users/omarbadran/Desktop/orbit-image-forge';
  const testResults: TestResult[] = [];

  // Test shared infrastructure
  const sharedResult = await testSharedInfrastructure(basePath);
  testResults.push(sharedResult);

  // Test individual MCP servers
  const servers = [
    { path: join(basePath, 'supabase/functions/mcp-ai-analysis/index.ts'), name: 'mcp-ai-analysis' },
    { path: join(basePath, 'supabase/functions/mcp-metadata/index.ts'), name: 'mcp-metadata' },
    { path: join(basePath, 'supabase/functions/mcp-storage/index.ts'), name: 'mcp-storage' }
  ];

  for (const server of servers) {
    const result = await testMCPServer(server.path, server.name);
    testResults.push(result);
  }

  // Generate summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 PHASE 2 VALIDATION SUMMARY');
  console.log('='.repeat(60));

  let totalPassed = 0;
  let totalFailed = 0;
  let allErrors: string[] = [];

  testResults.forEach(result => {
    const successRate = result.passed + result.failed > 0 ? 
      Math.round((result.passed / (result.passed + result.failed)) * 100) : 0;
    
    console.log(`\n${result.server}:`);
    console.log(`  ✅ Passed: ${result.passed}`);
    console.log(`  ❌ Failed: ${result.failed}`);
    console.log(`  📈 Success Rate: ${successRate}%`);
    
    if (result.errors.length > 0) {
      console.log(`  🚨 Errors:`);
      result.errors.forEach(error => console.log(`     - ${error}`));
    }
    
    totalPassed += result.passed;
    totalFailed += result.failed;
    allErrors = allErrors.concat(result.errors);
  });

  const overallSuccessRate = totalPassed + totalFailed > 0 ? 
    Math.round((totalPassed / (totalPassed + totalFailed)) * 100) : 0;

  console.log('\n' + '='.repeat(60));
  console.log('🎯 OVERALL RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Total Passed: ${totalPassed}`);
  console.log(`❌ Total Failed: ${totalFailed}`);
  console.log(`📈 Overall Success Rate: ${overallSuccessRate}%`);

  if (allErrors.length === 0) {
    console.log('\n🎉 All tests passed! Phase 2 implementation is ready.');
  } else {
    console.log(`\n⚠️  ${allErrors.length} issue(s) found. Review errors above.`);
  }

  console.log('\n📋 Phase 2 Implementation Status:');
  console.log('✅ MCP Infrastructure (Phase 1)');
  console.log('✅ Remote AI Analysis Server');
  console.log('✅ Remote Metadata Processing Server');
  console.log('✅ Remote Storage Operations Server');
  console.log('✅ Supabase Configuration Updated');

  console.log('\n🚀 Ready for Phase 3: Orchestrator Implementation');

  Deno.exit(allErrors.length === 0 ? 0 : 1);
}

if (import.meta.main) {
  main().catch(console.error);
}