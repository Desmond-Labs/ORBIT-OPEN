// Claude Code SDK Tier 2 Orchestrator - Edge Function Wrapper
// Provides HTTP interface to the Claude Code SDK orchestration system

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { ClaudeCodeOrchestrator, type OrchestrationRequest } from '../_shared/claude-orchestrator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Main Claude Code SDK Tier 2 Function
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🤖 CLAUDE CODE SDK TIER 2 ORCHESTRATOR - Starting');
    
    const requestBody = await req.json();
    const orchestrationRequest: OrchestrationRequest = requestBody;
    
    if (!orchestrationRequest.orderId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Order ID is required for Claude Code SDK orchestration',
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`🎯 Claude Code SDK orchestrating order: ${orchestrationRequest.orderId}`);
    console.log(`🔧 Request parameters:`, orchestrationRequest);
    
    // Initialize Claude Code SDK Orchestrator
    const orchestrator = new ClaudeCodeOrchestrator(orchestrationRequest);
    
    // Execute full Claude Code SDK workflow
    const orchestrationResult = await orchestrator.orchestrate(orchestrationRequest);
    
    // Get final context for detailed reporting
    const finalContext = orchestrator.getContext();
    
    return new Response(JSON.stringify({
      success: orchestrationResult.success,
      message: orchestrationResult.success 
        ? 'Claude Code SDK orchestration completed successfully'
        : 'Claude Code SDK orchestration encountered errors',
      orchestration: {
        type: 'claude-code-sdk',
        correlationId: finalContext.correlationId,
        totalDuration: finalContext.startTime ? Date.now() - finalContext.startTime : 0,
        phases: orchestrationResult.phases,
        results: orchestrationResult.results
      },
      context: {
        orderId: finalContext.orderId,
        totalImages: finalContext.totalImages,
        processedImages: finalContext.processedImages,
        failedImages: finalContext.failedImages,
        currentPhase: finalContext.currentPhase,
        errorCount: finalContext.errors.length
      },
      execution: {
        result: orchestrationResult,
        agents: Array.from(finalContext.agentResults.keys()),
        selfHealingActivated: orchestrationResult.results.selfHealingActivated
      },
      errors: finalContext.errors,
      timestamp: new Date().toISOString()
    }), {
      status: orchestrationResult.success ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('🚨 Claude Code SDK Tier 2 Orchestrator Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      errorName: error.name,
      orchestrationType: 'claude-code-sdk',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

console.log('🤖 Claude Code SDK Tier 2 Orchestrator ready - Using Task tool for intelligent workflow management');