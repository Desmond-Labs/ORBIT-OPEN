// ORBIT Claude Code Agent - Environment Configuration Template
// Copy this to your .env file and configure appropriately

export const ORBIT_CLAUDE_AGENT_ENV_TEMPLATE = `
# =============================================================================
# ORBIT CLAUDE CODE AGENT CONFIGURATION
# =============================================================================

# Core Configuration (Required)
# -----------------------------------------------------------------------------
ANTHROPIC_API_KEY=sk-ant-...your-claude-api-key-here
SUPABASE_URL=https://your-project-id.supabase.co
sb_secret_key=your-supabase-service-role-key-here

# Agent Control (Required)
# -----------------------------------------------------------------------------
# Enable/disable the Claude Code Agent entirely
CLAUDE_AGENT_ENABLED=true

# Agent Behavior Configuration (Optional)
# -----------------------------------------------------------------------------
# Maximum turns Claude can take in a single workflow (default: 50)
CLAUDE_AGENT_MAX_TURNS=50

# Timeout for the entire workflow in milliseconds (default: 300000 = 5 minutes)
CLAUDE_AGENT_TIMEOUT=300000

# Enable detailed logging (default: false)
CLAUDE_AGENT_LOGGING=true

# Log level: debug, info, warn, error (default: info)
CLAUDE_AGENT_LOG_LEVEL=info

# Development & Testing (Optional)
# -----------------------------------------------------------------------------
# Enable development mode with extra debugging (default: false)
CLAUDE_AGENT_DEV_MODE=false

# Simulate processing without real actions (default: false)
CLAUDE_AGENT_SIMULATE=false

# Delay for simulated operations in ms (default: 1000)
CLAUDE_AGENT_SIMULATION_DELAY=1000

# Deployment & Rollout (Optional)
# -----------------------------------------------------------------------------
# Percentage of orders to process with Claude agent (0-100, default: 0)
# Use this for gradual rollout - orders are consistently assigned based on order ID hash
CLAUDE_AGENT_ROLLOUT_PERCENTAGE=0

# Allow fallback to legacy processing if Claude agent fails (default: true)
CLAUDE_AGENT_ALLOW_FALLBACK=true

# Retry Configuration (Optional)
# -----------------------------------------------------------------------------
# Global retry settings
CLAUDE_AGENT_MAX_RETRIES=3
CLAUDE_AGENT_RETRY_DELAY=2000
CLAUDE_AGENT_DISABLE_RETRY=false

# Health check timeout in ms (default: 5000)
CLAUDE_AGENT_HEALTH_TIMEOUT=5000

# Feature Flags (Optional)
# -----------------------------------------------------------------------------
# Enable atomic processing with rollback (default: true)
CLAUDE_AGENT_ATOMIC_PROCESSING=true

# Enable storage verification before completion (default: true)
CLAUDE_AGENT_STORAGE_VERIFICATION=true

# Enable progress tracking with todo lists (default: true)
CLAUDE_AGENT_PROGRESS_TRACKING=true

# Performance Tuning (Optional)
# -----------------------------------------------------------------------------
# Number of images to process in parallel (default: 1 - sequential)
CLAUDE_AGENT_PARALLEL_LIMIT=1

# Batch size for processing (default: 1)
CLAUDE_AGENT_BATCH_SIZE=1

# Memory limit in MB (default: 512)
CLAUDE_AGENT_MEMORY_LIMIT=512

# Concurrency limit for operations (default: 3)
CLAUDE_AGENT_CONCURRENCY=3

# =============================================================================
# EXAMPLE CONFIGURATIONS
# =============================================================================

# Development Configuration Example:
# CLAUDE_AGENT_ENABLED=true
# CLAUDE_AGENT_LOGGING=true
# CLAUDE_AGENT_DEV_MODE=true
# CLAUDE_AGENT_LOG_LEVEL=debug
# CLAUDE_AGENT_ROLLOUT_PERCENTAGE=100
# CLAUDE_AGENT_ALLOW_FALLBACK=true

# Production Staging Example:
# CLAUDE_AGENT_ENABLED=true
# CLAUDE_AGENT_LOGGING=false
# CLAUDE_AGENT_LOG_LEVEL=warn
# CLAUDE_AGENT_ROLLOUT_PERCENTAGE=10
# CLAUDE_AGENT_ALLOW_FALLBACK=true

# Full Production Example:
# CLAUDE_AGENT_ENABLED=true
# CLAUDE_AGENT_LOGGING=false
# CLAUDE_AGENT_LOG_LEVEL=error
# CLAUDE_AGENT_ROLLOUT_PERCENTAGE=50
# CLAUDE_AGENT_ALLOW_FALLBACK=true
# CLAUDE_AGENT_TIMEOUT=600000

# Disable Agent Example:
# CLAUDE_AGENT_ENABLED=false
# (All other settings ignored when disabled)

# =============================================================================
`;

// Environment validation and setup helper
export class ORBITAgentEnvironmentHelper {
  
  // Get current environment status
  static getEnvironmentStatus() {
    return {
      // Core required
      has_anthropic_key: !!Deno.env.get('ANTHROPIC_API_KEY'),
      has_supabase_url: !!Deno.env.get('SUPABASE_URL'),
      has_service_key: !!(Deno.env.get('sb_secret_key') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')),
      
      // Agent control
      enabled: Deno.env.get('CLAUDE_AGENT_ENABLED') === 'true',
      
      // Configuration
      max_turns: parseInt(Deno.env.get('CLAUDE_AGENT_MAX_TURNS') || '50'),
      timeout_ms: parseInt(Deno.env.get('CLAUDE_AGENT_TIMEOUT') || '300000'),
      logging: Deno.env.get('CLAUDE_AGENT_LOGGING') === 'true',
      log_level: Deno.env.get('CLAUDE_AGENT_LOG_LEVEL') || 'info',
      dev_mode: Deno.env.get('CLAUDE_AGENT_DEV_MODE') === 'true',
      
      // Deployment
      rollout_percentage: parseInt(Deno.env.get('CLAUDE_AGENT_ROLLOUT_PERCENTAGE') || '0'),
      allow_fallback: Deno.env.get('CLAUDE_AGENT_ALLOW_FALLBACK') !== 'false',
      
      // Feature flags
      atomic_processing: Deno.env.get('CLAUDE_AGENT_ATOMIC_PROCESSING') !== 'false',
      storage_verification: Deno.env.get('CLAUDE_AGENT_STORAGE_VERIFICATION') !== 'false',
      progress_tracking: Deno.env.get('CLAUDE_AGENT_PROGRESS_TRACKING') !== 'false',
    };
  }

  // Validate environment and return issues
  static validateEnvironment(): { valid: boolean; warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];
    const status = this.getEnvironmentStatus();

    // Check required keys
    if (!status.has_anthropic_key) {
      errors.push('Missing ANTHROPIC_API_KEY - required for Claude Code SDK');
    }

    if (!status.has_supabase_url) {
      errors.push('Missing SUPABASE_URL - required for database and storage operations');
    }

    if (!status.has_service_key) {
      errors.push('Missing sb_secret_key or SUPABASE_SERVICE_ROLE_KEY - required for Supabase operations');
    }

    // Check agent enabled but missing config
    if (status.enabled) {
      if (status.max_turns < 1 || status.max_turns > 100) {
        warnings.push('CLAUDE_AGENT_MAX_TURNS should be between 1 and 100');
      }

      if (status.timeout_ms < 10000 || status.timeout_ms > 600000) {
        warnings.push('CLAUDE_AGENT_TIMEOUT should be between 10s and 10 minutes');
      }

      if (!['debug', 'info', 'warn', 'error'].includes(status.log_level)) {
        warnings.push('CLAUDE_AGENT_LOG_LEVEL should be one of: debug, info, warn, error');
      }

      if (status.rollout_percentage < 0 || status.rollout_percentage > 100) {
        warnings.push('CLAUDE_AGENT_ROLLOUT_PERCENTAGE should be between 0 and 100');
      }

      // Production warnings
      if (status.rollout_percentage > 0 && status.dev_mode) {
        warnings.push('Development mode enabled with rollout - consider disabling CLAUDE_AGENT_DEV_MODE in production');
      }

      if (status.rollout_percentage > 50 && !status.allow_fallback) {
        warnings.push('High rollout percentage without fallback may cause issues if Claude agent fails');
      }
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors
    };
  }

  // Generate environment file template
  static generateEnvFile(config: Partial<Record<string, string>> = {}): string {
    const defaultConfig = {
      CLAUDE_AGENT_ENABLED: 'false',
      CLAUDE_AGENT_LOGGING: 'false',
      CLAUDE_AGENT_LOG_LEVEL: 'info',
      CLAUDE_AGENT_ROLLOUT_PERCENTAGE: '0',
      CLAUDE_AGENT_ALLOW_FALLBACK: 'true',
      CLAUDE_AGENT_DEV_MODE: 'false',
      ...config
    };

    let envFile = '# ORBIT Claude Code Agent Configuration\n\n';
    envFile += '# Core Required Keys\n';
    envFile += `ANTHROPIC_API_KEY=${config.ANTHROPIC_API_KEY || 'sk-ant-your-key-here'}\n`;
    envFile += `SUPABASE_URL=${config.SUPABASE_URL || 'https://your-project.supabase.co'}\n`;
    envFile += `sb_secret_key=${config.sb_secret_key || 'your-service-role-key-here'}\n\n`;
    
    envFile += '# Agent Configuration\n';
    for (const [key, value] of Object.entries(defaultConfig)) {
      envFile += `${key}=${value}\n`;
    }

    return envFile;
  }

  // Print configuration guide to console
  static printConfigurationGuide(): void {
    console.log('\n' + '='.repeat(80));
    console.log('🤖 ORBIT CLAUDE CODE AGENT - CONFIGURATION GUIDE');
    console.log('='.repeat(80));

    const status = this.getEnvironmentStatus();
    const validation = this.validateEnvironment();

    console.log('\n📋 Current Environment Status:');
    console.log('  Anthropic API Key:', status.has_anthropic_key ? '✅ Set' : '❌ Missing');
    console.log('  Supabase URL:', status.has_supabase_url ? '✅ Set' : '❌ Missing');
    console.log('  Service Key:', status.has_service_key ? '✅ Set' : '❌ Missing');
    console.log('  Agent Enabled:', status.enabled ? '✅ Yes' : '❌ No');
    
    if (status.enabled) {
      console.log('  Rollout Percentage:', `${status.rollout_percentage}%`);
      console.log('  Fallback Allowed:', status.allow_fallback ? '✅ Yes' : '❌ No');
      console.log('  Development Mode:', status.dev_mode ? '🧪 Yes' : '📦 Production');
    }

    if (validation.errors.length > 0) {
      console.log('\n❌ Configuration Errors:');
      validation.errors.forEach(error => console.log(`  • ${error}`));
    }

    if (validation.warnings.length > 0) {
      console.log('\n⚠️  Configuration Warnings:');
      validation.warnings.forEach(warning => console.log(`  • ${warning}`));
    }

    if (validation.valid) {
      console.log('\n✅ Configuration is valid!');
    } else {
      console.log('\n❌ Configuration has errors that must be fixed');
    }

    console.log('\n📖 Quick Setup:');
    console.log('  1. Set ANTHROPIC_API_KEY with your Claude API key');
    console.log('  2. Ensure SUPABASE_URL and sb_secret_key are set');
    console.log('  3. Set CLAUDE_AGENT_ENABLED=true to enable the agent');
    console.log('  4. Use CLAUDE_AGENT_ROLLOUT_PERCENTAGE for gradual rollout');
    console.log('  5. Enable CLAUDE_AGENT_LOGGING=true for debugging');

    console.log('\n' + '='.repeat(80) + '\n');
  }
}

// Auto-print guide if run directly
if (import.meta.main) {
  ORBITAgentEnvironmentHelper.printConfigurationGuide();
}`