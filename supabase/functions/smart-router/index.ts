// Smart Router - Intelligent Tier Selection for ORBIT Processing
// Routes orders to Tier 1 (fast path) or Tier 2 (comprehensive orchestration)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { 
  checkEscalationTriggers, 
  getPerformanceMetrics,
  calculateSystemLoad,
  type EscalationContext,
  type EscalationResult,
  type PerformanceMetrics
} from './escalation-triggers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RouterRequest {
  orderId: string;
  action?: 'process' | 'recover' | 'validate';
  analysisType?: 'product' | 'lifestyle';
  priority?: 'standard' | 'high' | 'critical';
  forceRoute?: 'tier1' | 'tier2';
}

interface SystemHealth {
  tier1Available: boolean;
  tier2Available: boolean;
  databaseResponsive: boolean;
  storageAccessible: boolean;
  mcpServersOnline: boolean;
}

interface OrderComplexity {
  imageCount: number;
  totalSizeMB: number;
  hasFailureHistory: boolean;
  requiresCustomAnalysis: boolean;
  isReprocessing: boolean;
  userTier: 'free' | 'premium' | 'enterprise';
}

interface RoutingDecision {
  selectedTier: 'tier1' | 'tier2';
  reason: string;
  confidence: number;
  fallbackTier?: 'tier1' | 'tier2';
  estimatedDuration: number;
  riskLevel: 'low' | 'medium' | 'high';
}

// Initialize Supabase client
function initializeSupabase() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('sb_secret_key') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// System Health Assessment
async function assessSystemHealth(supabase: any): Promise<SystemHealth> {
  console.log('🏥 Assessing system health for routing decision');
  
  const health: SystemHealth = {
    tier1Available: false,
    tier2Available: false,
    databaseResponsive: false,
    storageAccessible: false,
    mcpServersOnline: false
  };
  
  try {
    // Test database responsiveness
    const { data: dbTest, error: dbError } = await supabase
      .from('orders')
      .select('count')
      .limit(1);
    
    health.databaseResponsive = !dbError;
    
    // Test storage accessibility
    const { data: storageTest, error: storageError } = await supabase.storage.listBuckets();
    health.storageAccessible = !storageError;
    
    // Test Tier 1 availability (process-image-batch)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const authToken = Deno.env.get('sb_secret_key') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    try {
      const tier1Response = await fetch(`${supabaseUrl}/functions/v1/process-image-batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'apikey': authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: 'health_check' })
      });
      
      // Accept both 200 (success) and 400 (bad request) as function is responding
      health.tier1Available = tier1Response.ok || tier1Response.status === 400;
    } catch {
      health.tier1Available = false;
    }
    
    // Test Tier 2 availability (claude-tier2-orchestrator)
    try {
      const tier2Response = await fetch(`${supabaseUrl}/functions/v1/claude-tier2-orchestrator`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'apikey': authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: 'health_check' })
      });
      
      health.tier2Available = tier2Response.ok || tier2Response.status === 400;
    } catch {
      health.tier2Available = false;
    }
    
    // Test MCP servers availability
    try {
      const mcpResponse = await fetch(`${supabaseUrl}/functions/v1/mcp-ai-analysis`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'apikey': authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: 'health_check' })
      });
      
      health.mcpServersOnline = mcpResponse.ok || mcpResponse.status === 400;
    } catch {
      health.mcpServersOnline = false;
    }
    
  } catch (error) {
    console.error('🚨 Health assessment failed:', error.message);
  }
  
  console.log('🏥 System Health:', health);
  return health;
}

// Order Complexity Analysis
async function analyzeOrderComplexity(supabase: any, orderId: string): Promise<OrderComplexity> {
  console.log(`📊 Analyzing order complexity for ${orderId}`);
  
  // Get order details
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();
  
  if (orderError || !order) {
    throw new Error(`Order not found: ${orderError?.message}`);
  }
  
  // Get images for this order
  const { data: images, error: imagesError } = await supabase
    .from('images')
    .select('*')
    .eq('order_id', orderId);
  
  if (imagesError) {
    throw new Error(`Failed to get images: ${imagesError.message}`);
  }
  
  // Check for failure history
  const hasFailures = images.some(img => img.processing_status === 'error' || img.retry_count > 0);
  
  // Calculate total size
  const totalSize = images.reduce((sum, img) => sum + (img.file_size || 0), 0);
  const totalSizeMB = totalSize / (1024 * 1024);
  
  // Check if this is reprocessing
  const isReprocessing = images.some(img => img.processing_status !== 'pending');
  
  const complexity: OrderComplexity = {
    imageCount: images.length,
    totalSizeMB: Math.round(totalSizeMB * 100) / 100,
    hasFailureHistory: hasFailures,
    requiresCustomAnalysis: false, // Could be determined by order metadata
    isReprocessing,
    userTier: 'premium' // Could be determined from user data
  };
  
  console.log(`📊 Order Complexity:`, complexity);
  return complexity;
}

// Enhanced Smart Routing Decision Engine with Escalation Support
function makeRoutingDecision(
  health: SystemHealth, 
  complexity: OrderComplexity, 
  request: RouterRequest,
  metrics?: PerformanceMetrics,
  escalation?: EscalationResult
): RoutingDecision {
  console.log('🧠 Making smart routing decision');
  
  // Check escalation triggers first
  if (escalation?.shouldEscalate) {
    return {
      selectedTier: 'tier2',
      reason: `Escalation triggered: ${escalation.reason}`,
      confidence: 0.95,
      estimatedDuration: 15000,
      riskLevel: escalation.severity === 'critical' ? 'high' : 'medium'
    };
  }
  
  // Force routing if specified
  if (request.forceRoute) {
    return {
      selectedTier: request.forceRoute,
      reason: `Force routed to ${request.forceRoute}`,
      confidence: 1.0,
      estimatedDuration: request.forceRoute === 'tier1' ? 6000 : 15000,
      riskLevel: 'low'
    };
  }
  
  // Critical priority always goes to Tier 2
  if (request.priority === 'critical') {
    return {
      selectedTier: 'tier2',
      reason: 'Critical priority requires comprehensive orchestration',
      confidence: 0.95,
      fallbackTier: 'tier1',
      estimatedDuration: 15000,
      riskLevel: 'high'
    };
  }
  
  // System health checks
  if (!health.tier1Available && !health.tier2Available) {
    throw new Error('Both tiers unavailable - system maintenance required');
  }
  
  if (!health.tier1Available) {
    return {
      selectedTier: 'tier2',
      reason: 'Tier 1 unavailable - using Tier 2',
      confidence: 0.8,
      estimatedDuration: 15000,
      riskLevel: 'medium'
    };
  }
  
  if (!health.tier2Available) {
    return {
      selectedTier: 'tier1',
      reason: 'Tier 2 unavailable - using Tier 1',
      confidence: 0.7,
      estimatedDuration: 6000,
      riskLevel: 'medium'
    };
  }
  
  // Complexity-based routing
  let score = 0;
  const factors: string[] = [];
  
  // Image count factor
  if (complexity.imageCount > 5) {
    score += 2;
    factors.push(`${complexity.imageCount} images (complex)`);
  } else if (complexity.imageCount > 1) {
    score += 1;
    factors.push(`${complexity.imageCount} images (moderate)`);
  }
  
  // File size factor
  if (complexity.totalSizeMB > 50) {
    score += 2;
    factors.push(`${complexity.totalSizeMB}MB (large)`);
  } else if (complexity.totalSizeMB > 20) {
    score += 1;
    factors.push(`${complexity.totalSizeMB}MB (moderate)`);
  }
  
  // History factor
  if (complexity.hasFailureHistory) {
    score += 3;
    factors.push('has failure history');
  }
  
  // Reprocessing factor
  if (complexity.isReprocessing) {
    score += 2;
    factors.push('reprocessing order');
  }
  
  // Custom analysis factor
  if (complexity.requiresCustomAnalysis) {
    score += 2;
    factors.push('requires custom analysis');
  }
  
  // User tier factor
  if (complexity.userTier === 'enterprise') {
    score += 1;
    factors.push('enterprise user');
  }
  
  // Performance metrics factor
  if (metrics) {
    if (metrics.tier1SuccessRate < 0.8) {
      score += 2;
      factors.push(`Tier 1 low success rate (${(metrics.tier1SuccessRate * 100).toFixed(1)}%)`);
    }
    
    if (metrics.systemLoad > 0.7) {
      score += 1;
      factors.push(`High system load (${(metrics.systemLoad * 100).toFixed(1)}%)`);
    }
    
    if (metrics.errorRate > 0.2) {
      score += 2;
      factors.push(`High error rate (${(metrics.errorRate * 100).toFixed(1)}%)`);
    }
  }
  
  // MCP availability factor
  if (!health.mcpServersOnline) {
    score -= 3;
    factors.push('MCP servers offline');
  }
  
  // Decision logic based on score
  const confidence = Math.max(0.6, Math.min(0.95, 0.8 - (Math.abs(score - 3) * 0.05)));
  
  if (score >= 4) {
    // High complexity - use Tier 2
    return {
      selectedTier: 'tier2',
      reason: `High complexity (score: ${score}) - factors: ${factors.join(', ')}`,
      confidence,
      fallbackTier: 'tier1',
      estimatedDuration: 15000 + (complexity.imageCount * 3000),
      riskLevel: score >= 6 ? 'high' : 'medium'
    };
  } else if (score <= 1) {
    // Low complexity - use Tier 1
    return {
      selectedTier: 'tier1',
      reason: `Low complexity (score: ${score}) - simple processing sufficient`,
      confidence,
      fallbackTier: 'tier2',
      estimatedDuration: 6000 + (complexity.imageCount * 1000),
      riskLevel: 'low'
    };
  } else {
    // Medium complexity - prefer Tier 1 with fallback
    return {
      selectedTier: 'tier1',
      reason: `Medium complexity (score: ${score}) - trying fast path first`,
      confidence: confidence * 0.8,
      fallbackTier: 'tier2',
      estimatedDuration: 6000 + (complexity.imageCount * 1500),
      riskLevel: 'medium'
    };
  }
}

// Execute routing decision
async function executeRouting(decision: RoutingDecision, request: RouterRequest): Promise<any> {
  console.log(`🚀 Executing ${decision.selectedTier} for order ${request.orderId}`);
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const authToken = Deno.env.get('sb_secret_key') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  const functionName = decision.selectedTier === 'tier1' ? 'process-image-batch' : 'claude-tier2-orchestrator';
  const payload = decision.selectedTier === 'tier1' 
    ? { orderId: request.orderId, analysisType: request.analysisType || 'lifestyle' }
    : { 
        orderId: request.orderId, 
        action: request.action || 'process',
        analysisType: request.analysisType || 'lifestyle',
        escalationReason: `Smart router selected ${decision.selectedTier}: ${decision.reason}`
      };
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'apikey': authToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      // If primary tier fails and we have a fallback, try it
      if (decision.fallbackTier && decision.selectedTier !== decision.fallbackTier) {
        console.log(`⚠️ ${decision.selectedTier} failed, trying fallback ${decision.fallbackTier}`);
        
        const fallbackDecision = {
          ...decision,
          selectedTier: decision.fallbackTier,
          reason: `Fallback from failed ${decision.selectedTier}: ${decision.reason}`
        };
        
        return await executeRouting(fallbackDecision, request);
      }
      
      throw new Error(`${functionName} failed: ${response.status} - ${JSON.stringify(result)}`);
    }
    
    return {
      success: true,
      tier: decision.selectedTier,
      function: functionName,
      decision,
      result
    };
    
  } catch (error) {
    console.error(`🚨 Routing execution failed:`, error.message);
    throw error;
  }
}

// Main Smart Router Function
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🤖 Smart Router - Intelligent Tier Selection');
    
    const requestBody = await req.json();
    const routerRequest: RouterRequest = requestBody;
    
    if (!routerRequest.orderId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Order ID is required',
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`🎯 Processing routing request for order: ${routerRequest.orderId}`);
    console.log(`🎯 Request parameters:`, routerRequest);
    
    // Initialize systems
    const supabase = initializeSupabase();
    const startTime = Date.now();
    
    // Step 1: Assess system health
    const health = await assessSystemHealth(supabase);
    
    // Step 2: Analyze order complexity
    const complexity = await analyzeOrderComplexity(supabase, routerRequest.orderId);
    
    // Step 3: Get performance metrics
    const metrics = getPerformanceMetrics();
    
    // Step 4: Check escalation triggers
    const escalationContext: EscalationContext = {
      orderId: routerRequest.orderId,
      tier1Attempts: 0, // Would be tracked in production
      tier1Failures: 0, // Would be tracked in production  
      totalDuration: 0, // Would be tracked in production
      errorTypes: [], // Would be tracked in production
      systemLoad: metrics.systemLoad,
      isRetry: complexity.isReprocessing,
      userTier: complexity.userTier
    };
    
    const escalation = checkEscalationTriggers(escalationContext);
    console.log('⚡ Escalation Check:', escalation);
    
    // Step 5: Make routing decision
    const decision = makeRoutingDecision(health, complexity, routerRequest, metrics, escalation);
    
    console.log('🧠 Routing Decision:', decision);
    
    // Step 4: Execute routing
    const executionResult = await executeRouting(decision, routerRequest);
    
    const totalDuration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Smart routing completed successfully',
      routing: {
        selectedTier: decision.selectedTier,
        reason: decision.reason,
        confidence: decision.confidence,
        riskLevel: decision.riskLevel,
        estimatedDuration: decision.estimatedDuration,
        actualDuration: totalDuration
      },
      systemHealth: health,
      orderComplexity: complexity,
      performanceMetrics: metrics,
      escalation: escalation,
      execution: executionResult,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('🚨 Smart Router Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      errorName: error.name,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

console.log('🤖 Smart Router - Intelligent Tier Selection ready');