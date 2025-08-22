# ORBIT Claude Code Agent

A modular and independent Claude Code SDK integration for the ORBIT Image Forge system that provides intelligent, automated image processing workflows.

## Overview

The ORBIT Claude Code Agent uses Anthropic's Claude Code SDK to orchestrate the complete image processing pipeline, including AI analysis, metadata embedding, and database operations. It integrates seamlessly with the existing `process-image-batch` function while maintaining full backward compatibility.

## Architecture

```
┌─────────────────────────┐    ┌─────────────────────────┐
│   process-image-batch   │───▶│  ORBITAgentIntegration  │
│      (Entry Point)      │    │   (Routing Logic)       │
└─────────────────────────┘    └─────────────────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    ▼                      ▼                      ▼
        ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
        │   Claude Agent      │ │   Legacy Process    │ │   Fallback Logic    │
        │   (Claude SDK)      │ │   (Existing Code)   │ │   (Error Recovery)  │
        └─────────────────────┘ └─────────────────────┘ └─────────────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Supabase    │ │ MCP         │ │ Progress    │
│ Tools       │ │ Services    │ │ Tracking    │
└─────────────┘ └─────────────┘ └─────────────┘
```

## Key Components

### 1. Core Agent (`orbit-claude-agent.ts`)
- **ORBITClaudeAgent**: Main class that orchestrates the workflow using Claude Code SDK
- Integrates with Supabase for database operations
- Communicates with MCP services for AI analysis and metadata processing
- Implements comprehensive error handling and atomic processing

### 2. Configuration Management (`orbit-claude-agent-config.ts`)
- **ORBITAgentConfigManager**: Handles environment variables and validation
- Supports feature flags, retry configuration, and performance tuning
- Provides development and production configuration profiles

### 3. Integration Layer (`orbit-claude-agent-integration.ts`)
- **ORBITAgentIntegration**: Bridges the agent with existing process-image-batch
- Implements rollout percentage for gradual deployment
- Handles fallback to legacy processing on errors

### 4. Workflow Prompts (`orbit-claude-workflow-prompts.ts`)
- **ORBITWorkflowPrompts**: Comprehensive prompts for Claude Code SDK
- Defines all workflow phases with verification checkpoints
- Includes error recovery and health check prompts

### 5. Supabase Tools (`orbit-claude-supabase-tools.ts`)
- **ORBITSupabaseToolkit**: Claude-compatible database and storage operations
- Implements timing, logging, and error handling
- Provides order-specific and batch operations

### 6. MCP Integration (`orbit-claude-mcp-integration.ts`)
- **ORBITMCPServiceIntegration**: Communication with MCP services
- Handles AI analysis, metadata embedding, and storage operations
- Includes retry logic and service health checking

## Environment Configuration

### Required Environment Variables

```bash
# Core Configuration
ANTHROPIC_API_KEY=sk-ant-your-claude-api-key-here
SUPABASE_URL=https://your-project.supabase.co
sb_secret_key=your-supabase-service-role-key

# Agent Control
CLAUDE_AGENT_ENABLED=true
```

### Optional Configuration

```bash
# Deployment & Rollout
CLAUDE_AGENT_ROLLOUT_PERCENTAGE=10     # 0-100, gradual rollout
CLAUDE_AGENT_ALLOW_FALLBACK=true       # Fallback to legacy on errors

# Performance Tuning
CLAUDE_AGENT_MAX_TURNS=50               # Max Claude turns per workflow
CLAUDE_AGENT_TIMEOUT=300000             # Timeout in milliseconds

# Development & Debugging
CLAUDE_AGENT_LOGGING=true               # Enable detailed logging
CLAUDE_AGENT_LOG_LEVEL=info             # debug, info, warn, error
CLAUDE_AGENT_DEV_MODE=false             # Development mode

# Feature Flags
CLAUDE_AGENT_ATOMIC_PROCESSING=true     # Enable atomic operations
CLAUDE_AGENT_STORAGE_VERIFICATION=true  # Verify storage consistency
CLAUDE_AGENT_PROGRESS_TRACKING=true     # Track workflow progress

# Retry Configuration
CLAUDE_AGENT_MAX_RETRIES=3              # Global retry limit
CLAUDE_AGENT_RETRY_DELAY=2000           # Base retry delay (ms)
```

## Deployment Guide

### 1. Development Setup

```bash
# 1. Set required environment variables
export ANTHROPIC_API_KEY="sk-ant-your-key"
export SUPABASE_URL="https://your-project.supabase.co"
export sb_secret_key="your-service-key"

# 2. Enable agent in development mode
export CLAUDE_AGENT_ENABLED=true
export CLAUDE_AGENT_DEV_MODE=true
export CLAUDE_AGENT_LOGGING=true
export CLAUDE_AGENT_ROLLOUT_PERCENTAGE=100

# 3. Run health check
deno run --allow-all test-claude-agent.ts

# 4. Deploy functions
supabase functions deploy
```

### 2. Staging Deployment

```bash
# Enable for limited rollout with fallback
CLAUDE_AGENT_ENABLED=true
CLAUDE_AGENT_ROLLOUT_PERCENTAGE=10
CLAUDE_AGENT_ALLOW_FALLBACK=true
CLAUDE_AGENT_LOGGING=false
CLAUDE_AGENT_LOG_LEVEL=warn
```

### 3. Production Deployment

```bash
# Full production configuration
CLAUDE_AGENT_ENABLED=true
CLAUDE_AGENT_ROLLOUT_PERCENTAGE=50
CLAUDE_AGENT_ALLOW_FALLBACK=true
CLAUDE_AGENT_LOGGING=false
CLAUDE_AGENT_LOG_LEVEL=error
CLAUDE_AGENT_TIMEOUT=600000
```

## Usage

### Processing with Claude Agent

```bash
# Enable Claude agent for specific order
curl -X POST "${SUPABASE_URL}/functions/v1/process-image-batch" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "your-order-id",
    "analysisType": "lifestyle",
    "useClaudeAgent": true
  }'
```

### Health Check

```bash
# Check agent health and configuration
curl "${SUPABASE_URL}/functions/v1/orbit-claude-agent-health"
```

### Configuration Info

```typescript
import { ORBITAgentEnvironmentHelper } from './supabase/functions/_shared/orbit-claude-agent-env-template.ts';

// Print configuration guide
ORBITAgentEnvironmentHelper.printConfigurationGuide();

// Get current status
const status = ORBITAgentEnvironmentHelper.getEnvironmentStatus();
console.log(status);
```

## Workflow Phases

The Claude agent executes a comprehensive 5-phase workflow:

### Phase 0: Pre-flight Validation
- System health checks
- Database connectivity verification
- Storage access validation
- Configuration validation

### Phase 1: Order Discovery & Preparation
- Order status updates
- Image inventory
- File existence verification
- Atomic processing setup

### Phase 2: Per-Image Processing (Atomic Pipeline)
- Image status tracking
- AI analysis via MCP services
- Metadata embedding
- Storage verification
- Database consistency checks

### Phase 3: Order Finalization & Verification
- Completion verification
- Storage-database consistency
- Final status updates
- Error reconciliation

### Phase 4: Email & Cleanup
- Completion notifications
- Final verification
- System cleanup
- Audit logging

## Error Handling

### Error Classification
- **GEMINI_API_ERROR**: AI analysis failures
- **STORAGE_ACCESS_ERROR**: File storage issues
- **METADATA_EMBED_ERROR**: Metadata processing failures
- **DATABASE_ERROR**: Database connectivity/query issues
- **EMAIL_FUNCTION_ERROR**: Notification failures
- **DEPLOYMENT_SYNC_ERROR**: Function deployment issues

### Retry Strategy
- Intelligent retry with exponential backoff
- Error-type-specific retry limits
- Atomic rollback on persistent failures
- Fallback to legacy processing when configured

### Recovery Mechanisms
- Atomic processing with rollback capability
- Partial completion handling
- Storage-database consistency verification
- Comprehensive error logging with correlation IDs

## Monitoring & Observability

### Logging
```typescript
// Enable detailed logging
CLAUDE_AGENT_LOGGING=true
CLAUDE_AGENT_LOG_LEVEL=debug
```

### Health Checks
- `/functions/v1/orbit-claude-agent-health` - Agent health status
- Environment validation
- MCP service connectivity
- Database/storage accessibility

### Progress Tracking
- Todo-based workflow tracking
- Phase-specific progress updates
- Correlation ID tracking
- Performance timing

## Testing

### Comprehensive Test Suite

```bash
# Run full test suite
deno run --allow-all test-claude-agent.ts
```

### Individual Component Tests

```typescript
// Test environment configuration
import { validateORBITAgentEnvironment } from './supabase/functions/_shared/orbit-claude-agent-config.ts';
const validation = validateORBITAgentEnvironment();

// Test agent initialization
import { createORBITClaudeAgent } from './supabase/functions/_shared/orbit-claude-agent.ts';
const agent = createORBITClaudeAgent();

// Test integration layer
import { ORBITAgentIntegration } from './supabase/functions/_shared/orbit-claude-agent-integration.ts';
const integration = new ORBITAgentIntegration();
```

## Security Considerations

### API Key Management
- Store Anthropic API keys securely in environment variables
- Use Supabase service role keys for database access
- Rotate keys regularly

### Access Control
- Agent operates with service-level permissions
- Order validation prevents unauthorized access
- MCP service authentication via Supabase keys

### Data Protection
- No sensitive data in logs (when logging disabled)
- Secure communication with external services
- Atomic operations prevent data corruption

## Performance Optimization

### Configuration Tuning
- `CLAUDE_AGENT_PARALLEL_LIMIT`: Control concurrent operations
- `CLAUDE_AGENT_BATCH_SIZE`: Optimize batch processing
- `CLAUDE_AGENT_TIMEOUT`: Adjust for complex workflows
- `CLAUDE_AGENT_MAX_TURNS`: Balance thoroughness vs. efficiency

### Resource Management
- Memory limit configuration
- Concurrency controls
- Timeout management
- Connection pooling

## Troubleshooting

### Common Issues

1. **Agent Not Enabled**
   - Check `CLAUDE_AGENT_ENABLED=true`
   - Verify environment variables are set

2. **Authentication Failures**
   - Validate `ANTHROPIC_API_KEY`
   - Confirm `sb_secret_key` or `SUPABASE_SERVICE_ROLE_KEY`

3. **MCP Service Errors**
   - Check MCP service deployment status
   - Verify Supabase function accessibility

4. **Storage Verification Failures**
   - Confirm storage bucket permissions
   - Check file path consistency

### Debug Mode
```bash
CLAUDE_AGENT_DEV_MODE=true
CLAUDE_AGENT_LOGGING=true
CLAUDE_AGENT_LOG_LEVEL=debug
```

### Health Check Diagnostics
Use the health check endpoint for detailed system status and configuration validation.

## Migration & Rollback

### Gradual Rollout
- Start with `CLAUDE_AGENT_ROLLOUT_PERCENTAGE=5`
- Monitor performance and error rates
- Gradually increase percentage
- Use `CLAUDE_AGENT_ALLOW_FALLBACK=true` for safety

### Rollback Strategy
- Set `CLAUDE_AGENT_ENABLED=false` for immediate disable
- Fallback automatically routes to legacy processing
- No data loss due to atomic processing design

### A/B Testing
- Use rollout percentage for controlled testing
- Compare performance metrics between agents
- Monitor success rates and processing times

## Contributing

### Development Workflow
1. Set up development environment
2. Run comprehensive test suite
3. Test with sample orders
4. Verify health checks pass
5. Deploy to staging for validation

### Code Structure
- Follow existing TypeScript patterns
- Maintain comprehensive error handling
- Include detailed logging and monitoring
- Add tests for new functionality

---

## Support

For issues or questions:
1. Check health endpoint diagnostics
2. Review configuration guide
3. Run comprehensive test suite
4. Enable debug logging for investigation
5. Consult error classification and recovery mechanisms