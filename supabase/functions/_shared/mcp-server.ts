/**
 * MCP Server Library - JSON-RPC 2.0 compliant MCP server implementation
 * For ORBIT Image Forge remote MCP servers
 * Updated for New Supabase API Keys Migration
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  MCPErrorCode,
  MCPMethod,
  MCPServerConfig,
  MCPRequestContext,
  MCPMethodHandler,
  MCPToolHandler,
  MCPServiceToolDefinition,
  MCPBatchRequest,
  MCPBatchResponse,
  MCPAuthContext,
  MCPInitializeRequest,
  MCPToolsListRequest,
  MCPToolsCallRequest,
  createMCPError,
  createMCPResponse,
  isValidJsonRpcRequest,
  isBatchRequest,
  MCP_PROTOCOL_VERSION,
  SERVER_VERSION,
} from './mcp-types.ts';

import { 
  SupabaseAuthManager, 
  enhancedSecurityPathProtection, 
  auditAuthEvent,
  detectKeyFormat,
  type JWTVerificationResult,
  type AuthConfig
} from './auth-verification.ts';

// Standard CORS headers matching existing patterns
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Enhanced MCP Server Implementation with New Auth System
 */
export class MCPServer {
  private config: MCPServerConfig;
  private tools: Map<string, MCPServiceToolDefinition>;
  private methodHandlers: Map<string, MCPMethodHandler>;
  private supabase: any;
  private authManager: SupabaseAuthManager;

  constructor(config: MCPServerConfig, authConfig?: Partial<AuthConfig>) {
    this.config = config;
    this.tools = new Map();
    this.methodHandlers = new Map();
    
    // Initialize enhanced authentication manager
    this.authManager = new SupabaseAuthManager(authConfig);
    this.supabase = this.authManager.getSupabaseClient();

    // Register standard MCP method handlers
    this.registerMethodHandler(MCPMethod.Initialize, this.handleInitialize.bind(this));
    this.registerMethodHandler(MCPMethod.ToolsList, this.handleToolsList.bind(this));
    this.registerMethodHandler(MCPMethod.ToolsCall, this.handleToolsCall.bind(this));
    this.registerMethodHandler(MCPMethod.Ping, this.handlePing.bind(this));

    // Log initialization with auth configuration
    const configInfo = this.authManager.getConfigInfo();
    console.log(`🚀 MCP Server initialized: ${config.name} v${config.version}`);
    console.log(`🔐 Auth configuration:`, configInfo);
  }

  /**
   * Register a tool with the server
   */
  registerTool(toolDef: MCPServiceToolDefinition): void {
    this.tools.set(toolDef.name, toolDef);
    console.log(`Registered MCP tool: ${toolDef.name}`);
  }

  /**
   * Register a method handler
   */
  registerMethodHandler(method: string, handler: MCPMethodHandler): void {
    this.methodHandlers.set(method, handler);
    console.log(`Registered MCP method handler: ${method}`);
  }

  /**
   * Main request handler with enhanced authentication
   */
  async handleRequest(request: Request): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only accept POST requests
    if (request.method !== 'POST') {
      return this.createErrorResponse(
        createMCPError(MCPErrorCode.InvalidRequest, 'Only POST method allowed')
      );
    }

    try {
      // Enhanced authentication verification
      const authResult = await this.authManager.verifyRequest(request);
      if (!authResult.success) {
        auditAuthEvent({
          type: 'auth_failure',
          keyFormat: authResult.keyFormat,
          userAgent: request.headers.get('user-agent') || undefined,
          error: authResult.error
        });
        
        return this.authManager.createAuthErrorResponse(authResult);
      }

      // Audit successful authentication
      auditAuthEvent({
        type: 'auth_success',
        keyFormat: authResult.keyFormat,
        userAgent: request.headers.get('user-agent') || undefined
      });

      // Parse request body
      const requestBody = await request.text();
      let parsedBody: any;

      try {
        parsedBody = JSON.parse(requestBody);
      } catch (parseError) {
        return this.createErrorResponse(
          createMCPError(MCPErrorCode.ParseError, 'Invalid JSON in request body')
        );
      }

      // Create enhanced request context with auth results
      const context: MCPRequestContext = {
        request: parsedBody,
        auth: {
          authenticated: authResult.success,
          user: authResult.user,
          payload: authResult.payload,
          keyFormat: authResult.keyFormat
        },
        startTime: Date.now(),
        clientInfo: {
          userAgent: request.headers.get('user-agent') || undefined,
          ip: this.extractClientIP(request),
        },
      };

      // Handle batch or single request
      let response: JsonRpcResponse | MCPBatchResponse;

      if (isBatchRequest(parsedBody)) {
        response = await this.handleBatchRequest(parsedBody, context);
      } else if (isValidJsonRpcRequest(parsedBody)) {
        response = await this.handleSingleRequest(parsedBody, context);
      } else {
        response = createMCPError(
          MCPErrorCode.InvalidRequest,
          'Invalid JSON-RPC request format'
        );
      }

      return this.createSuccessResponse(response);

    } catch (error) {
      console.error('MCP Server error:', error);
      return this.createErrorResponse(
        createMCPError(
          MCPErrorCode.InternalError,
          'Internal server error',
          { message: error.message }
        )
      );
    }
  }

  /**
   * Handle single JSON-RPC request
   */
  private async handleSingleRequest(
    request: JsonRpcRequest,
    context: MCPRequestContext
  ): Promise<JsonRpcResponse> {
    const { method, params, id } = request;

    console.log(`Handling MCP method: ${method} (ID: ${id})`);

    // Check if method exists
    const handler = this.methodHandlers.get(method);
    if (!handler) {
      return createMCPError(
        MCPErrorCode.MethodNotFound,
        `Method not found: ${method}`,
        undefined,
        id
      );
    }

    // Check authentication if required
    if (this.config.authRequired && !this.isAuthenticated(context.auth)) {
      return createMCPError(
        MCPErrorCode.AuthenticationError,
        'Authentication required',
        undefined,
        id
      );
    }

    try {
      const result = await handler(params, context);
      
      if (result.error) {
        return {
          jsonrpc: "2.0",
          error: result.error,
          id,
        };
      }

      return createMCPResponse(result.result, id);

    } catch (error) {
      console.error(`Error in method ${method}:`, error);
      return createMCPError(
        MCPErrorCode.InternalError,
        `Method execution failed: ${method}`,
        { message: error.message },
        id
      );
    }
  }

  /**
   * Handle batch JSON-RPC requests
   */
  private async handleBatchRequest(
    requests: MCPBatchRequest,
    context: MCPRequestContext
  ): Promise<MCPBatchResponse> {
    const responses: JsonRpcResponse[] = [];

    for (const request of requests) {
      if (isValidJsonRpcRequest(request)) {
        const response = await this.handleSingleRequest(request, {
          ...context,
          request,
        });
        responses.push(response);
      } else {
        responses.push(
          createMCPError(
            MCPErrorCode.InvalidRequest,
            'Invalid request in batch'
          )
        );
      }
    }

    return responses;
  }

  /**
   * Handle initialize method
   */
  private async handleInitialize(
    params: any,
    context: MCPRequestContext
  ): Promise<{ result: any }> {
    const initParams = params as MCPInitializeRequest['params'];

    return {
      result: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        serverInfo: {
          name: this.config.name,
          version: this.config.version,
        },
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
      },
    };
  }

  /**
   * Handle tools/list method
   */
  private async handleToolsList(
    params: any,
    context: MCPRequestContext
  ): Promise<{ result: any }> {
    const tools = Array.from(this.tools.values()).map(toolDef => toolDef.schema);

    return {
      result: {
        tools,
      },
    };
  }

  /**
   * Handle tools/call method
   */
  private async handleToolsCall(
    params: any,
    context: MCPRequestContext
  ): Promise<{ result?: any; error?: JsonRpcError }> {
    const { name, arguments: args } = params as MCPToolsCallRequest['params'];

    const toolDef = this.tools.get(name);
    if (!toolDef) {
      return {
        error: {
          code: MCPErrorCode.MethodNotFound,
          message: `Tool not found: ${name}`,
        },
      };
    }

    try {
      // Validate arguments against schema
      const validationResult = this.validateToolArguments(args, toolDef.schema.inputSchema);
      if (!validationResult.valid) {
        return {
          error: {
            code: MCPErrorCode.InvalidParams,
            message: 'Invalid tool arguments',
            data: { validationErrors: validationResult.errors },
          },
        };
      }

      // Execute tool
      const toolResults = await toolDef.handler(args, context);

      return {
        result: {
          content: toolResults,
          isError: false,
        },
      };

    } catch (error) {
      console.error(`Tool execution error (${name}):`, error);
      return {
        result: {
          content: [
            {
              type: "text",
              text: `Tool execution failed: ${error.message}`,
            },
          ],
          isError: true,
        },
      };
    }
  }

  /**
   * Handle ping method
   */
  private async handlePing(
    params: any,
    context: MCPRequestContext
  ): Promise<{ result: any }> {
    return {
      result: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        server: this.config.name,
        uptime: process.uptime ? process.uptime() : 0,
      },
    };
  }

  /**
   * Legacy authentication method - deprecated in favor of SupabaseAuthManager
   * Kept for backward compatibility during migration
   */
  private async extractAuth(request: Request): Promise<MCPAuthContext> {
    console.warn('⚠️ Using deprecated extractAuth method. Update to use SupabaseAuthManager.');
    
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return {};
    }

    // Minimal legacy support - prefer using SupabaseAuthManager
    return { token: authHeader };
  }

  /**
   * Check if context is authenticated
   */
  private isAuthenticated(auth: MCPAuthContext): boolean {
    return !!(auth.userId || auth.isServiceRole || auth.token);
  }

  /**
   * Extract client IP from request
   */
  private extractClientIP(request: Request): string | undefined {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
           request.headers.get('x-real-ip') ||
           undefined;
  }

  /**
   * Validate tool arguments against schema
   */
  private validateToolArguments(
    args: any,
    schema: any
  ): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (schema.type === 'object') {
      if (typeof args !== 'object' || args === null) {
        return { valid: false, errors: ['Arguments must be an object'] };
      }

      // Check required properties
      if (schema.required) {
        for (const prop of schema.required) {
          if (!(prop in args)) {
            errors.push(`Missing required property: ${prop}`);
          }
        }
      }

      // Basic type checking for properties
      if (schema.properties) {
        for (const [prop, propSchema] of Object.entries(schema.properties as any)) {
          if (prop in args) {
            const value = args[prop];
            const expectedType = (propSchema as any).type;
            
            if (expectedType && typeof value !== expectedType) {
              errors.push(`Property ${prop} must be of type ${expectedType}`);
            }
          }
        }
      }
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  /**
   * Create success response
   */
  private createSuccessResponse(data: any): Response {
    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      status: 200,
    });
  }

  /**
   * Create error response
   */
  private createErrorResponse(error: JsonRpcResponse): Response {
    return new Response(JSON.stringify(error), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      status: 200, // JSON-RPC errors still return 200 with error in body
    });
  }
}

/**
 * Enhanced factory function to create MCP server with new auth system
 */
export function createORBITMCPServer(
  name: string,
  tools: MCPServiceToolDefinition[] = [],
  authConfig?: Partial<AuthConfig>
): MCPServer {
  const config: MCPServerConfig = {
    name,
    version: SERVER_VERSION,
    tools: tools.map(t => t.schema),
    corsOrigins: ['*'], // Will be restricted in production
    authRequired: true,
    rateLimits: {
      requestsPerMinute: 100,
      requestsPerHour: 1000,
    },
  };

  // Enhanced server with auth configuration
  const server = new MCPServer(config, authConfig);

  // Register tools
  for (const tool of tools) {
    server.registerTool(tool);
  }

  console.log(`🎯 ORBIT MCP Server created: ${name} with ${tools.length} tools`);
  
  return server;
}

/**
 * Utility to create standard error responses
 */
export function createStandardErrorResponse(
  code: MCPErrorCode,
  message: string,
  data?: any
): Response {
  const error = createMCPError(code, message, data);
  return new Response(JSON.stringify(error), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status: 200,
  });
}

/**
 * Middleware for rate limiting (placeholder for future implementation)
 */
export function rateLimitMiddleware(
  requestsPerMinute: number = 100
) {
  // Placeholder - to be implemented with actual rate limiting logic
  return async (request: Request, next: () => Promise<Response>) => {
    // TODO: Implement rate limiting using Supabase or external service
    return next();
  };
}

/**
 * Enhanced security path protection middleware with new auth system
 */
export async function securityPathProtection(request?: Request, authConfig?: Partial<AuthConfig>): Promise<void> {
  try {
    // Use enhanced security path protection
    await enhancedSecurityPathProtection(request, authConfig);
    
    // Legacy search path protection for database security
    const authManager = new SupabaseAuthManager(authConfig);
    const supabase = authManager.getSupabaseClient();
    
    if (supabase) {
      try {
        await supabase.rpc('set_config', {
          setting_name: 'search_path',
          setting_value: 'public',
          is_local: false
        });
        
        console.log('🔒 Legacy search path protection enabled');
      } catch (error) {
        console.warn('Could not set security search path:', error);
      }
    }
  } catch (error) {
    console.warn('Security path protection failed:', error);
  }
}