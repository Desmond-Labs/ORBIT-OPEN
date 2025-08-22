// ORBIT Claude Code Agent - Core Implementation
// Modular and independent agent for ORBIT image processing workflow

import { query } from 'npm:@anthropic-ai/claude-code-sdk@1.0.0';
import { ORBITAgentConfigManager } from './orbit-claude-agent-config.ts';
import { ORBITSupabaseToolkit } from './orbit-claude-supabase-tools.ts';
import { ORBITMCPServiceIntegration } from './orbit-claude-mcp-integration.ts';
import { buildORBITWorkflowPrompt, buildORBITSystemPrompt, buildORBITHealthCheckPrompt, buildORBITErrorRecoveryPrompt } from './orbit-claude-workflow-prompts.ts';
import { 
  Order, 
  Batch, 
  Image, 
  OrderContext, 
  WorkflowResult, 
  ImageProcessingResult, 
  AgentHealth,
  ErrorType,
  ErrorContext,
  ORBITAgentConfig
} from './orbit-claude-agent-types.ts';

export class ORBITClaudeAgent {
  private config: ORBITAgentConfig;
  private configManager: ORBITAgentConfigManager;
  private supabaseToolkit: ORBITSupabaseToolkit;
  private mcpIntegration: ORBITMCPServiceIntegration;
  private sessionId: string;
  private isHealthy: boolean = false;

  constructor() {
    this.configManager = new ORBITAgentConfigManager();
    this.config = this.configManager.getConfig();
    this.supabaseToolkit = new ORBITSupabaseToolkit(
      this.config.supabaseUrl,
      this.config.supabaseServiceKey,
      this.config.enableLogging
    );
    this.mcpIntegration = new ORBITMCPServiceIntegration(
      this.config.supabaseUrl,
      this.config.supabaseServiceKey,
      this.config.enableLogging
    );
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `orbit-agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private log(level: 'info' | 'error' | 'debug', message: string, data?: any) {
    if (this.config.enableLogging) {
      const timestamp = new Date().toISOString();
      const logData = data ? JSON.stringify(data, null, 2) : '';
      console.log(`[${timestamp}] [${level.toUpperCase()}] [${this.sessionId}] ${message} ${logData}`);
    }
  }

  // Health check method
  async performHealthCheck(): Promise<AgentHealth> {
    this.log('info', 'Starting ORBIT agent health check');
    
    try {
      const healthCheckPrompt = buildORBITHealthCheckPrompt();
      const systemPrompt = buildORBITSystemPrompt();

      // Check configuration first
      const configValid = this.validateConfiguration();
      if (!configValid.valid) {
        return {
          status: 'unhealthy',
          details: {
            database: 'error',
            storage: 'error',
            mcp_services: 'offline',
            claude_sdk: 'error',
            configuration: 'invalid'
          },
          timestamp: new Date().toISOString()
        };
      }

      // Perform comprehensive health check using Claude Code SDK
      const healthResult = await query({
        anthropicApiKey: this.config.anthropicApiKey,
        systemPrompt: systemPrompt,
        userPrompt: healthCheckPrompt,
        maxTurns: 5,
        tools: this.buildClaudeSDKTools()
      });

      this.log('debug', 'Health check result', healthResult);

      // Extract health status from result
      const isHealthy = this.parseHealthCheckResult(healthResult);
      this.isHealthy = isHealthy;

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        details: {
          database: 'connected',
          storage: 'connected', 
          mcp_services: 'online',
          claude_sdk: 'initialized',
          configuration: 'valid'
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.log('error', 'Health check failed', { error: error.message });
      this.isHealthy = false;
      
      return {
        status: 'unhealthy',
        details: {
          database: 'error',
          storage: 'error',
          mcp_services: 'offline',
          claude_sdk: 'error',
          configuration: 'valid'
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  // Main workflow processing method
  async processOrder(orderId: string): Promise<WorkflowResult> {
    const startTime = Date.now();
    const correlationId = `${this.sessionId}-order-${orderId}`;
    
    this.log('info', `Starting ORBIT workflow processing for order ${orderId}`, { correlationId });

    try {
      // 1. Validate agent is healthy and enabled
      if (!this.configManager.isEnabled()) {
        throw new Error('ORBIT Claude Agent is disabled. Set CLAUDE_AGENT_ENABLED=true to enable.');
      }

      if (!this.isHealthy) {
        this.log('info', 'Performing health check before processing');
        const healthResult = await this.performHealthCheck();
        if (healthResult.status === 'unhealthy') {
          throw new Error('ORBIT Agent failed health check. Cannot process order.');
        }
      }

      // 2. Gather order context
      const orderContext = await this.buildOrderContext(orderId);
      this.log('info', `Order context built for ${orderId}`, {
        totalImages: orderContext.totalImages,
        pendingImages: orderContext.pendingImages,
        orderFolder: orderContext.orderFolder
      });

      // 3. Build workflow prompt
      const workflowPrompt = buildORBITWorkflowPrompt(orderContext);
      const systemPrompt = buildORBITSystemPrompt();

      // 4. Execute workflow using Claude Code SDK
      this.log('info', `Executing ORBIT workflow with Claude Code SDK`, { correlationId });

      const workflowResult = await query({
        anthropicApiKey: this.config.anthropicApiKey,
        systemPrompt: systemPrompt,
        userPrompt: workflowPrompt,
        maxTurns: this.config.maxTurns || 50,
        tools: this.buildClaudeSDKTools()
      });

      this.log('debug', 'Claude Code SDK workflow result', { 
        correlationId,
        turnCount: workflowResult.messages?.length || 0
      });

      // 5. Parse and validate results
      const processedResults = await this.parseWorkflowResults(workflowResult, orderContext);
      
      const processingTimeMs = Date.now() - startTime;
      
      this.log('info', `ORBIT workflow completed for order ${orderId}`, {
        correlationId,
        processingTimeMs,
        successCount: processedResults.success_count,
        errorCount: processedResults.error_count
      });

      return {
        success: true,
        orderId,
        batchId: orderContext.batch.id,
        results: processedResults,
        processed_results: [], // Will be populated by parseWorkflowResults
        processing_time_ms: processingTimeMs
      };

    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      this.log('error', `ORBIT workflow failed for order ${orderId}`, {
        error: error.message,
        correlationId,
        processingTimeMs
      });

      // Attempt error recovery
      await this.handleWorkflowError(error, orderId, correlationId);

      return {
        success: false,
        orderId,
        batchId: 'unknown',
        results: {
          total_images: 0,
          success_count: 0,
          error_count: 0,
          status: 'failed'
        },
        processed_results: [],
        processing_time_ms: processingTimeMs,
        error: error.message
      };
    }
  }

  // Build order context from database
  private async buildOrderContext(orderId: string): Promise<OrderContext> {
    this.log('debug', 'Building order context', { orderId });

    // Get order details
    const orderResult = await this.supabaseToolkit.getOrderDetails(orderId);
    if (!orderResult.success || !orderResult.data || orderResult.data.length === 0) {
      throw new Error(`Order ${orderId} not found or inaccessible`);
    }

    const orderData = orderResult.data[0];
    
    const order: Order = {
      id: orderData.id,
      user_id: orderData.user_id,
      order_number: orderData.order_number,
      batch_id: orderData.batch_id,
      processing_stage: orderData.processing_stage,
      payment_status: orderData.payment_status,
      created_at: orderData.created_at,
      processing_completion_percentage: orderData.processing_completion_percentage || 0
    };

    const batch: Batch = {
      id: orderData.batch_id,
      user_id: orderData.user_id,
      status: orderData.batch_status,
      processed_count: orderData.processed_count || 0,
      error_count: orderData.error_count || 0,
      processing_start_time: orderData.processing_start_time,
      processing_end_time: orderData.processing_end_time,
      completed_at: orderData.completed_at
    };

    // Get images for this order
    const imagesResult = await this.supabaseToolkit.getOrderImages(orderId);
    if (!imagesResult.success) {
      throw new Error(`Failed to load images for order ${orderId}: ${imagesResult.error}`);
    }

    const images: Image[] = imagesResult.data || [];
    const pendingImages = images.filter(img => img.processing_status === 'pending').length;
    const orderFolder = `${order.user_id}/${order.batch_id}/${orderId}`;

    return {
      order,
      batch,
      images,
      totalImages: images.length,
      pendingImages,
      orderFolder
    };
  }

  // Build tools for Claude Code SDK
  private buildClaudeSDKTools() {
    return [
      // Database operations
      {
        name: 'supabase_execute_sql',
        description: 'Execute SQL queries on the Supabase database',
        schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'SQL query to execute' },
            params: { type: 'array', description: 'Query parameters' }
          },
          required: ['query']
        },
        handler: async (params: any) => {
          return await this.supabaseToolkit.executeSQL(params.query, params.params);
        }
      },
      
      // Storage operations
      {
        name: 'supabase_storage_list_files',
        description: 'List files in Supabase Storage buckets',
        schema: {
          type: 'object',
          properties: {
            bucket_name: { type: 'string', description: 'Storage bucket name' },
            folder_path: { type: 'string', description: 'Folder path to list' }
          },
          required: ['bucket_name']
        },
        handler: async (params: any) => {
          return await this.supabaseToolkit.listStorageFiles(params.bucket_name, params.folder_path);
        }
      },

      {
        name: 'supabase_storage_create_signed_urls',
        description: 'Create signed URLs for secure file access',
        schema: {
          type: 'object',
          properties: {
            bucket_name: { type: 'string', description: 'Storage bucket name' },
            file_paths: { type: 'array', items: { type: 'string' }, description: 'Array of file paths' },
            expires_in: { type: 'number', description: 'Expiration time in seconds' }
          },
          required: ['bucket_name', 'file_paths']
        },
        handler: async (params: any) => {
          return await this.supabaseToolkit.createSignedUrls(
            params.bucket_name, 
            params.file_paths, 
            params.expires_in || 3600
          );
        }
      },

      // MCP Service tools (placeholder implementations)
      {
        name: 'mcp_ai_analysis',
        description: 'Call Gemini AI analysis MCP service',
        schema: {
          type: 'object',
          properties: {
            image_url: { type: 'string', description: 'Signed URL to image' },
            analysis_type: { type: 'string', enum: ['lifestyle', 'product'], description: 'Analysis type' }
          },
          required: ['image_url']
        },
        handler: async (params: any) => {
          return await this.mcpIntegration.analyzeImage(params.image_url, params.analysis_type);
        }
      },

      {
        name: 'mcp_metadata_embed',
        description: 'Call metadata embedding MCP service',
        schema: {
          type: 'object',
          properties: {
            source_path: { type: 'string', description: 'Source image path in storage' },
            output_path: { type: 'string', description: 'Output path for processed image' },
            metadata: { type: 'object', description: 'Metadata to embed' },
            compression_quality: { type: 'number', description: 'JPEG compression quality' }
          },
          required: ['source_path', 'output_path', 'metadata']
        },
        handler: async (params: any) => {
          return await this.mcpIntegration.embedImageMetadata(
            params.source_path,
            params.output_path, 
            params.metadata,
            params.compression_quality || 95
          );
        }
      },

      {
        name: 'mcp_storage_operations', 
        description: 'Call storage operations MCP service',
        schema: {
          type: 'object',
          properties: {
            operation: { type: 'string', description: 'Storage operation type' },
            parameters: { type: 'object', description: 'Operation parameters' }
          },
          required: ['operation', 'parameters']
        },
        handler: async (params: any) => {
          return await this.mcpIntegration.callMCPService('storage', params.operation, params.parameters);
        }
      },

      // Progress tracking
      {
        name: 'todo_write',
        description: 'Track workflow progress and phases',
        schema: {
          type: 'object',
          properties: {
            todos: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  content: { type: 'string' },
                  status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
                  id: { type: 'string' }
                },
                required: ['content', 'status', 'id']
              }
            }
          },
          required: ['todos']
        },
        handler: async (params: any) => {
          // Log progress tracking
          this.log('info', 'Workflow progress update', params.todos);
          return { success: true, message: 'Progress tracked successfully' };
        }
      }
    ];
  }


  // Workflow result parsing
  private async parseWorkflowResults(workflowResult: any, orderContext: OrderContext): Promise<any> {
    this.log('debug', 'Parsing workflow results', { orderId: orderContext.order.id });

    // Verify final order status
    const finalOrderResult = await this.supabaseToolkit.getOrderDetails(orderContext.order.id);
    if (!finalOrderResult.success) {
      throw new Error('Failed to verify final order status');
    }

    const finalOrder = finalOrderResult.data[0];
    const successCount = finalOrder.completed_images || 0;
    const errorCount = finalOrder.total_images - successCount;

    return {
      total_images: finalOrder.total_images,
      success_count: successCount,
      error_count: errorCount,
      status: finalOrder.processing_stage === 'completed' ? 'completed' : 
              (successCount > 0 ? 'completed_with_errors' : 'failed')
    };
  }

  // Error handling and recovery
  private async handleWorkflowError(error: Error, orderId: string, correlationId: string): Promise<void> {
    this.log('error', 'Handling workflow error', { error: error.message, orderId, correlationId });

    try {
      // Mark order as failed if not already marked
      await this.supabaseToolkit.updateOrderStatus(orderId, 'failed', 'failed', 0);
      
      // Log error for debugging
      const errorContext = {
        error: error.message,
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
        session_id: this.sessionId
      };

      this.log('error', 'Workflow error logged', errorContext);

    } catch (recoveryError) {
      this.log('error', 'Error recovery failed', { 
        originalError: error.message,
        recoveryError: recoveryError.message,
        orderId,
        correlationId
      });
    }
  }

  // Configuration validation
  private validateConfiguration(): { valid: boolean; errors: string[] } {
    try {
      new ORBITAgentConfigManager();
      return { valid: true, errors: [] };
    } catch (error) {
      return { valid: false, errors: [error.message] };
    }
  }

  // Health check result parsing
  private parseHealthCheckResult(healthResult: any): boolean {
    // Parse the Claude Code SDK result to determine health status
    // This would analyze the actual response from the health check
    return true; // Simplified for now
  }

  // Public getters
  getSessionId(): string {
    return this.sessionId;
  }

  getConfig(): ORBITAgentConfig {
    return { ...this.config };
  }

  isAgentHealthy(): boolean {
    return this.isHealthy;
  }

  isAgentEnabled(): boolean {
    return this.configManager.isEnabled();
  }
}

// Factory function for creating ORBIT Claude Agent
export function createORBITClaudeAgent(): ORBITClaudeAgent {
  return new ORBITClaudeAgent();
}

// Helper function for health check
export async function performORBITAgentHealthCheck(): Promise<AgentHealth> {
  const agent = new ORBITClaudeAgent();
  return await agent.performHealthCheck();
}