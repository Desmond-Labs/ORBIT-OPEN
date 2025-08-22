// ORBIT Claude Code Agent - Health Check Endpoint
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { ORBITAgentIntegration } from '../_shared/orbit-claude-agent-integration.ts';
import { ORBITAgentEnvironmentHelper } from '../_shared/orbit-claude-agent-env-template.ts';
import { validateORBITAgentEnvironment } from '../_shared/orbit-claude-agent-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 ORBIT Claude Agent Health Check requested');

    // 1. Environment validation
    const envValidation = validateORBITAgentEnvironment();
    const envStatus = ORBITAgentEnvironmentHelper.getEnvironmentStatus();

    // 2. Agent integration check
    let agentHealthy = false;
    let agentDetails = {};
    let configInfo = {};

    try {
      const agentIntegration = new ORBITAgentIntegration();
      configInfo = agentIntegration.getConfigurationInfo();
      
      const healthResult = await agentIntegration.performHealthCheck();
      agentHealthy = healthResult.healthy;
      agentDetails = healthResult.details;
    } catch (agentError) {
      agentDetails = { error: agentError.message };
    }

    // 3. Overall status determination
    const overallHealthy = envValidation.valid && agentHealthy;

    const healthCheckResult = {
      status: overallHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      
      environment: {
        valid: envValidation.valid,
        errors: envValidation.errors,
        warnings: ORBITAgentEnvironmentHelper.validateEnvironment().warnings,
        status: envStatus
      },
      
      agent: {
        healthy: agentHealthy,
        details: agentDetails,
        configuration: configInfo
      },
      
      deployment: {
        enabled: envStatus.enabled,
        rollout_percentage: envStatus.rollout_percentage,
        fallback_enabled: envStatus.allow_fallback,
        development_mode: envStatus.dev_mode
      },
      
      mcp_services: {
        ai_analysis_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mcp-ai-analysis`,
        metadata_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mcp-metadata`,
        storage_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mcp-storage`
      }
    };

    console.log('🔍 Health check completed:', {
      status: healthCheckResult.status,
      envValid: envValidation.valid,
      agentHealthy,
      enabled: envStatus.enabled
    });

    return new Response(JSON.stringify(healthCheckResult, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: overallHealthy ? 200 : 503,
    });

  } catch (error) {
    console.error('❌ Health check error:', error);

    return new Response(JSON.stringify({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

console.log('🔍 ORBIT Claude Agent Health Check endpoint ready');