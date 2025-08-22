// ORBIT Claude Code Agent - Configuration Management
// Handles environment variables and configuration validation

import { ORBITAgentConfig } from './orbit-claude-agent-types.ts';

export class ORBITAgentConfigManager {
  private config: ORBITAgentConfig;

  constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  private loadConfiguration(): ORBITAgentConfig {
    return {
      anthropicApiKey: Deno.env.get('ANTHROPIC_API_KEY') || '',
      supabaseUrl: Deno.env.get('SUPABASE_URL') || '',
      supabaseServiceKey: Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('sb_secret_key') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
      mcpServices: {
        aiAnalysis: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mcp-ai-analysis`,
        metadata: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mcp-metadata`,
        storage: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mcp-storage`
      },
      maxTurns: parseInt(Deno.env.get('CLAUDE_AGENT_MAX_TURNS') || '50'),
      timeoutMs: parseInt(Deno.env.get('CLAUDE_AGENT_TIMEOUT') || '300000'), // 5 minutes
      enableLogging: Deno.env.get('CLAUDE_AGENT_LOGGING') === 'true'
    };
  }

  private validateConfiguration(): void {
    const missing: string[] = [];

    if (!this.config.anthropicApiKey) missing.push('ANTHROPIC_API_KEY');
    if (!this.config.supabaseUrl) missing.push('SUPABASE_URL');
    if (!this.config.supabaseServiceKey) missing.push('SUPABASE_SECRET_KEY or sb_secret_key or SUPABASE_SERVICE_ROLE_KEY');

    if (missing.length > 0) {
      throw new Error(`ORBIT Agent Configuration Error: Missing required environment variables: ${missing.join(', ')}`);
    }

    // Validate URLs
    try {
      new URL(this.config.supabaseUrl);
    } catch {
      throw new Error('ORBIT Agent Configuration Error: Invalid SUPABASE_URL');
    }

    // Validate numeric values
    if (this.config.maxTurns <= 0 || this.config.maxTurns > 100) {
      throw new Error('ORBIT Agent Configuration Error: maxTurns must be between 1 and 100');
    }

    if (this.config.timeoutMs < 10000 || this.config.timeoutMs > 600000) {
      throw new Error('ORBIT Agent Configuration Error: timeoutMs must be between 10s and 10 minutes');
    }
  }

  getConfig(): ORBITAgentConfig {
    return { ...this.config };
  }

  isEnabled(): boolean {
    return Deno.env.get('CLAUDE_AGENT_ENABLED') === 'true';
  }

  getLogLevel(): 'debug' | 'info' | 'warn' | 'error' {
    const level = Deno.env.get('CLAUDE_AGENT_LOG_LEVEL') || 'info';
    if (['debug', 'info', 'warn', 'error'].includes(level)) {
      return level as 'debug' | 'info' | 'warn' | 'error';
    }
    return 'info';
  }

  shouldRetryOnError(errorType: string): boolean {
    const retryDisabled = Deno.env.get('CLAUDE_AGENT_DISABLE_RETRY') === 'true';
    return !retryDisabled;
  }

  getMaxRetries(errorType: string): number {
    const baseRetries = parseInt(Deno.env.get('CLAUDE_AGENT_MAX_RETRIES') || '3');
    
    // Different retry counts based on error type
    switch (errorType) {
      case 'GEMINI_API_ERROR':
        return Math.min(baseRetries, 2); // Limited retries for API errors
      case 'STORAGE_ACCESS_ERROR':
        return baseRetries;
      case 'DATABASE_ERROR':
        return Math.min(baseRetries, 1); // Quick fail for DB issues
      case 'CLAUDE_SDK_ERROR':
        return 0; // No retries for SDK errors
      default:
        return baseRetries;
    }
  }

  getRetryDelay(errorType: string, attempt: number): number {
    const baseDelay = parseInt(Deno.env.get('CLAUDE_AGENT_RETRY_DELAY') || '2000');
    
    // Exponential backoff with jitter
    const delay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // Add up to 1 second jitter
    
    return Math.min(delay + jitter, 30000); // Cap at 30 seconds
  }

  // Health check configuration
  getHealthCheckTimeout(): number {
    return parseInt(Deno.env.get('CLAUDE_AGENT_HEALTH_TIMEOUT') || '5000');
  }

  // Feature flags
  isAtomicProcessingEnabled(): boolean {
    return Deno.env.get('CLAUDE_AGENT_ATOMIC_PROCESSING') !== 'false'; // Enabled by default
  }

  isStorageVerificationEnabled(): boolean {
    return Deno.env.get('CLAUDE_AGENT_STORAGE_VERIFICATION') !== 'false'; // Enabled by default
  }

  isProgressTrackingEnabled(): boolean {
    return Deno.env.get('CLAUDE_AGENT_PROGRESS_TRACKING') !== 'false'; // Enabled by default
  }

  // Development and debugging
  isDevelopmentMode(): boolean {
    return Deno.env.get('CLAUDE_AGENT_DEV_MODE') === 'true';
  }

  shouldSimulateProcessing(): boolean {
    return Deno.env.get('CLAUDE_AGENT_SIMULATE') === 'true';
  }

  getSimulationDelay(): number {
    return parseInt(Deno.env.get('CLAUDE_AGENT_SIMULATION_DELAY') || '1000');
  }

  // Performance tuning
  getBatchSize(): number {
    return parseInt(Deno.env.get('CLAUDE_AGENT_BATCH_SIZE') || '1'); // Process images one at a time by default
  }

  getParallelProcessingLimit(): number {
    return parseInt(Deno.env.get('CLAUDE_AGENT_PARALLEL_LIMIT') || '1'); // Sequential by default
  }

  // Resource limits
  getMemoryLimitMB(): number {
    return parseInt(Deno.env.get('CLAUDE_AGENT_MEMORY_LIMIT') || '512');
  }

  getConcurrencyLimit(): number {
    return parseInt(Deno.env.get('CLAUDE_AGENT_CONCURRENCY') || '3');
  }
}

// Default configuration factory
export function createORBITAgentConfig(): ORBITAgentConfig {
  const configManager = new ORBITAgentConfigManager();
  return configManager.getConfig();
}

// Configuration validation helper
export function validateORBITAgentEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    new ORBITAgentConfigManager();
    return { valid: true, errors: [] };
  } catch (error) {
    errors.push(error.message);
    return { valid: false, errors };
  }
}

// Environment info helper for debugging
export function getORBITAgentEnvironmentInfo() {
  return {
    enabled: Deno.env.get('CLAUDE_AGENT_ENABLED') === 'true',
    hasAnthropicKey: !!Deno.env.get('ANTHROPIC_API_KEY'),
    hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
    hasServiceKey: !!(Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('sb_secret_key') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')),
    maxTurns: Deno.env.get('CLAUDE_AGENT_MAX_TURNS') || '50',
    timeout: Deno.env.get('CLAUDE_AGENT_TIMEOUT') || '300000',
    logLevel: Deno.env.get('CLAUDE_AGENT_LOG_LEVEL') || 'info',
    developmentMode: Deno.env.get('CLAUDE_AGENT_DEV_MODE') === 'true',
    timestamp: new Date().toISOString()
  };
}