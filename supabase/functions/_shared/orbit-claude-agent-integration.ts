// ORBIT Claude Code Agent - Integration with process-image-batch
// Modular integration to enable Claude Code agent processing

import { ORBITClaudeAgent, performORBITAgentHealthCheck } from './orbit-claude-agent.ts';
import { ORBITAgentConfigManager } from './orbit-claude-agent-config.ts';

export interface ProcessImageBatchRequest {
  orderId: string;
  analysisType?: 'product' | 'lifestyle';
  manualTest?: boolean;
  useClaudeAgent?: boolean;
}

export interface ProcessingResponse {
  success: boolean;
  agent_used: 'claude' | 'legacy';
  results: any;
  error?: string;
  processing_time_ms: number;
  fallback_reason?: string;
}

export class ORBITAgentIntegration {
  private configManager: ORBITAgentConfigManager;
  private claudeAgent?: ORBITClaudeAgent;

  constructor() {
    this.configManager = new ORBITAgentConfigManager();
    
    // Only initialize Claude agent if enabled
    if (this.configManager.isEnabled()) {
      try {
        this.claudeAgent = new ORBITClaudeAgent();
      } catch (error) {
        console.error('Failed to initialize Claude agent:', error.message);
        this.claudeAgent = undefined;
      }
    }
  }

  // Check if Claude agent should be used based on environment and request
  shouldUseClaudeAgent(request: ProcessImageBatchRequest): boolean {
    // 1. Check if explicitly disabled by request
    if (request.useClaudeAgent === false) {
      console.log('Claude agent explicitly disabled by request');
      return false;
    }

    // 2. Check if enabled in environment
    if (!this.configManager.isEnabled()) {
      console.log('Claude agent disabled in environment (CLAUDE_AGENT_ENABLED != true)');
      return false;
    }

    // 3. Check if Claude agent is initialized
    if (!this.claudeAgent) {
      console.log('Claude agent not properly initialized');
      return false;
    }

    // 4. Check explicit request for Claude agent
    if (request.useClaudeAgent === true) {
      console.log('Claude agent explicitly requested');
      return true;
    }

    // 5. Check percentage rollout (optional feature flag)
    const rolloutPercentage = parseInt(Deno.env.get('CLAUDE_AGENT_ROLLOUT_PERCENTAGE') || '0');
    if (rolloutPercentage > 0) {
      const hash = this.hashOrderId(request.orderId);
      const shouldUse = (hash % 100) < rolloutPercentage;
      console.log(`Claude agent rollout check: ${rolloutPercentage}%, orderId hash: ${hash % 100}, use: ${shouldUse}`);
      return shouldUse;
    }

    // 6. Default to false for safety
    console.log('Claude agent not enabled by default');
    return false;
  }

  // Simple hash function for consistent rollout based on order ID
  private hashOrderId(orderId: string): number {
    let hash = 0;
    for (let i = 0; i < orderId.length; i++) {
      const char = orderId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Main processing method that delegates to appropriate processor
  async processOrder(request: ProcessImageBatchRequest): Promise<ProcessingResponse> {
    const startTime = Date.now();
    
    console.log('🔄 ORBIT Agent Integration - Processing Order', {
      orderId: request.orderId,
      claudeAgentEnabled: this.configManager.isEnabled(),
      requestUseClaudeAgent: request.useClaudeAgent
    });

    // Determine which processor to use
    const useClaudeAgent = this.shouldUseClaudeAgent(request);
    
    if (useClaudeAgent && this.claudeAgent) {
      console.log('🤖 Using Claude Code Agent for processing');
      try {
        // Process with Claude agent
        const claudeResult = await this.claudeAgent.processOrder(request.orderId);
        
        const processingTime = Date.now() - startTime;
        
        return {
          success: claudeResult.success,
          agent_used: 'claude',
          results: claudeResult,
          processing_time_ms: processingTime
        };

      } catch (claudeError) {
        console.error('🚨 Claude agent processing failed:', claudeError.message);
        
        // Check if fallback is enabled
        const allowFallback = Deno.env.get('CLAUDE_AGENT_ALLOW_FALLBACK') !== 'false';
        
        if (allowFallback) {
          console.log('🔄 Falling back to legacy processing');
          const processingTime = Date.now() - startTime;
          
          return {
            success: false,
            agent_used: 'claude',
            results: {},
            error: claudeError.message,
            processing_time_ms: processingTime,
            fallback_reason: 'Claude agent failed, fallback disabled'
          };
        } else {
          // Return error without fallback
          const processingTime = Date.now() - startTime;
          
          return {
            success: false,
            agent_used: 'claude',
            results: {},
            error: claudeError.message,
            processing_time_ms: processingTime
          };
        }
      }
    } else {
      // Use legacy processing (return indication that legacy should be used)
      console.log('🏛️ Using legacy processing');
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        agent_used: 'legacy',
        results: { use_legacy: true },
        processing_time_ms: processingTime
      };
    }
  }

  // Health check for Claude agent
  async performHealthCheck(): Promise<{ healthy: boolean; details: any }> {
    if (!this.configManager.isEnabled()) {
      return {
        healthy: false,
        details: { message: 'Claude agent disabled in environment' }
      };
    }

    if (!this.claudeAgent) {
      return {
        healthy: false,
        details: { message: 'Claude agent not initialized' }
      };
    }

    try {
      const healthResult = await performORBITAgentHealthCheck();
      return {
        healthy: healthResult.status === 'healthy',
        details: healthResult
      };
    } catch (error) {
      return {
        healthy: false,
        details: { error: error.message }
      };
    }
  }

  // Get configuration info for debugging
  getConfigurationInfo(): any {
    return {
      enabled: this.configManager.isEnabled(),
      agent_initialized: !!this.claudeAgent,
      rollout_percentage: parseInt(Deno.env.get('CLAUDE_AGENT_ROLLOUT_PERCENTAGE') || '0'),
      fallback_enabled: Deno.env.get('CLAUDE_AGENT_ALLOW_FALLBACK') !== 'false',
      development_mode: this.configManager.isDevelopmentMode(),
      log_level: this.configManager.getLogLevel()
    };
  }

  // Test method for development
  async testClaudeAgent(orderId: string): Promise<any> {
    if (!this.claudeAgent) {
      throw new Error('Claude agent not initialized');
    }

    console.log('🧪 Testing Claude agent with order:', orderId);
    return await this.claudeAgent.processOrder(orderId);
  }
}

// Factory function for easy integration
export function createORBITAgentIntegration(): ORBITAgentIntegration {
  return new ORBITAgentIntegration();
}

// Helper function to check if Claude agent is available
export function isClaudeAgentAvailable(): boolean {
  try {
    const configManager = new ORBITAgentConfigManager();
    return configManager.isEnabled();
  } catch (error) {
    return false;
  }
}