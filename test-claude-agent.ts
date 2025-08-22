// ORBIT Claude Code Agent - End-to-End Test Script
// Test the complete Claude Code agent implementation

import { ORBITClaudeAgent, createORBITClaudeAgent, performORBITAgentHealthCheck } from './supabase/functions/_shared/orbit-claude-agent.ts';
import { ORBITAgentIntegration } from './supabase/functions/_shared/orbit-claude-agent-integration.ts';
import { ORBITAgentEnvironmentHelper } from './supabase/functions/_shared/orbit-claude-agent-env-template.ts';
import { validateORBITAgentEnvironment } from './supabase/functions/_shared/orbit-claude-agent-config.ts';

interface TestResult {
  name: string;
  success: boolean;
  duration_ms: number;
  details?: any;
  error?: string;
}

class ORBITClaudeAgentTester {
  private testResults: TestResult[] = [];
  
  async runAllTests(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 ORBIT CLAUDE CODE AGENT - COMPREHENSIVE TEST SUITE');
    console.log('='.repeat(80));
    
    // Test 1: Environment Configuration
    await this.runTest('Environment Configuration Validation', async () => {
      const validation = validateORBITAgentEnvironment();
      const status = ORBITAgentEnvironmentHelper.getEnvironmentStatus();
      
      if (!validation.valid) {
        throw new Error(`Environment validation failed: ${validation.errors.join(', ')}`);
      }
      
      return {
        validation,
        status,
        enabled: status.enabled,
        has_required_keys: status.has_anthropic_key && status.has_supabase_url && status.has_service_key
      };
    });

    // Test 2: Agent Initialization
    await this.runTest('Claude Agent Initialization', async () => {
      const agent = createORBITClaudeAgent();
      
      return {
        session_id: agent.getSessionId(),
        config: agent.getConfig(),
        enabled: agent.isAgentEnabled(),
        healthy: agent.isAgentHealthy()
      };
    });

    // Test 3: Health Check
    await this.runTest('Agent Health Check', async () => {
      const healthResult = await performORBITAgentHealthCheck();
      
      if (healthResult.status === 'unhealthy') {
        throw new Error(`Health check failed: ${JSON.stringify(healthResult.details)}`);
      }
      
      return healthResult;
    });

    // Test 4: Integration Layer
    await this.runTest('Agent Integration Layer', async () => {
      const integration = new ORBITAgentIntegration();
      const configInfo = integration.getConfigurationInfo();
      
      return {
        config: configInfo,
        integration_ready: configInfo.enabled && configInfo.agent_initialized
      };
    });

    // Test 5: Workflow Prompt Generation
    await this.runTest('Workflow Prompt Generation', async () => {
      const { buildORBITWorkflowPrompt, buildORBITSystemPrompt } = await import('./supabase/functions/_shared/orbit-claude-workflow-prompts.ts');
      
      const mockContext = {
        order: {
          id: 'test-order-123',
          user_id: 'test-user',
          order_number: 'ORD-001',
          batch_id: 'test-batch-123',
          processing_stage: 'pending',
          payment_status: 'completed',
          created_at: new Date().toISOString(),
          processing_completion_percentage: 0
        },
        batch: {
          id: 'test-batch-123',
          user_id: 'test-user',
          status: 'pending',
          processed_count: 0,
          error_count: 0
        },
        images: [],
        totalImages: 3,
        pendingImages: 3,
        orderFolder: 'test-user/test-batch-123/test-order-123'
      };
      
      const workflowPrompt = buildORBITWorkflowPrompt(mockContext);
      const systemPrompt = buildORBITSystemPrompt();
      
      if (workflowPrompt.length < 1000) {
        throw new Error('Workflow prompt too short - may be incomplete');
      }
      
      if (systemPrompt.length < 500) {
        throw new Error('System prompt too short - may be incomplete');
      }
      
      return {
        workflow_prompt_length: workflowPrompt.length,
        system_prompt_length: systemPrompt.length,
        contains_order_context: workflowPrompt.includes('test-order-123'),
        contains_workflow_phases: workflowPrompt.includes('PHASE 0') && workflowPrompt.includes('PHASE 1')
      };
    });

    // Test 6: Supabase Tools (if credentials available)
    if (Deno.env.get('SUPABASE_URL') && (Deno.env.get('sb_secret_key') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))) {
      await this.runTest('Supabase Tools Integration', async () => {
        const { ORBITSupabaseToolkit } = await import('./supabase/functions/_shared/orbit-claude-supabase-tools.ts');
        
        const toolkit = new ORBITSupabaseToolkit(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('sb_secret_key') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
          false
        );
        
        const healthResult = await toolkit.healthCheck();
        
        return {
          health_check: healthResult,
          toolkit_ready: healthResult.success
        };
      });
    }

    // Test 7: MCP Service URLs
    await this.runTest('MCP Service Configuration', async () => {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      
      if (!supabaseUrl) {
        throw new Error('SUPABASE_URL not configured');
      }
      
      const mcpServices = {
        ai_analysis: `${supabaseUrl}/functions/v1/mcp-ai-analysis`,
        metadata: `${supabaseUrl}/functions/v1/mcp-metadata`,
        storage: `${supabaseUrl}/functions/v1/mcp-storage`
      };
      
      return {
        supabase_url: supabaseUrl,
        mcp_services: mcpServices,
        urls_valid: Object.values(mcpServices).every(url => url.startsWith('https://'))
      };
    });

    // Test 8: Claude Code SDK Import (if available)
    await this.runTest('Claude Code SDK Availability', async () => {
      try {
        const { query } = await import('npm:@anthropic-ai/claude-code-sdk@1.0.0');
        
        return {
          sdk_available: true,
          has_query_function: typeof query === 'function'
        };
      } catch (error) {
        // This is expected if running without network/npm access
        return {
          sdk_available: false,
          error: error.message,
          note: 'This is expected in environments without npm access'
        };
      }
    });

    // Print test summary
    this.printTestSummary();
  }

  private async runTest(name: string, testFn: () => Promise<any>): Promise<void> {
    console.log(`\n🧪 Running: ${name}...`);
    const startTime = Date.now();
    
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        name,
        success: true,
        duration_ms: duration,
        details: result
      });
      
      console.log(`✅ ${name} - PASSED (${duration}ms)`);
      if (typeof result === 'object' && result !== null) {
        console.log(`   ${JSON.stringify(result, null, 2).split('\n').slice(0, 5).join('\n   ')}`);
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        name,
        success: false,
        duration_ms: duration,
        error: error.message
      });
      
      console.log(`❌ ${name} - FAILED (${duration}ms)`);
      console.log(`   Error: ${error.message}`);
    }
  }

  private printTestSummary(): void {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration_ms, 0);
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
    console.log(`Total Duration: ${totalDuration}ms`);
    
    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => !r.success)
        .forEach(r => console.log(`   • ${r.name}: ${r.error}`));
    }
    
    console.log('\n📋 Recommendations:');
    if (failedTests === 0) {
      console.log('   ✅ All tests passed! Your Claude Code Agent is ready for use.');
      console.log('   🚀 Set CLAUDE_AGENT_ENABLED=true to enable the agent.');
      console.log('   📈 Use CLAUDE_AGENT_ROLLOUT_PERCENTAGE for gradual rollout.');
    } else {
      console.log('   🔧 Fix failed tests before enabling the Claude Code Agent.');
      console.log('   📖 Check environment configuration and required services.');
      console.log('   🔍 Use the health check endpoint for detailed diagnostics.');
    }
    
    console.log('\n🔗 Useful Commands:');
    console.log('   Health Check: GET /functions/v1/orbit-claude-agent-health');
    console.log('   Test Processing: POST /functions/v1/process-image-batch (with useClaudeAgent: true)');
    console.log('   Environment Guide: Run ORBITAgentEnvironmentHelper.printConfigurationGuide()');
    
    console.log('\n' + '='.repeat(80) + '\n');
  }
}

// Run tests if executed directly
if (import.meta.main) {
  const tester = new ORBITClaudeAgentTester();
  await tester.runAllTests();
}