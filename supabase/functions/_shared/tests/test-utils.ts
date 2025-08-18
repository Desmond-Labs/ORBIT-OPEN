/**
 * Test utilities for MCP infrastructure testing
 */

import {
  JsonRpcRequest,
  JsonRpcResponse,
  MCPErrorCode,
  MCPMethod,
  MCPInitializeRequest,
  MCPToolsListRequest,
  MCPToolsCallRequest,
  MCPTool,
  MCPServiceToolDefinition,
  MCPToolResult,
  MCPRequestContext,
  MCPAuthContext,
  createMCPError,
  createMCPResponse,
} from '../mcp-types.ts';

/**
 * Test data factories
 */
export class MCPTestFactory {
  private static requestId = 1;

  static getNextRequestId(): number {
    return this.requestId++;
  }

  static createInitializeRequest(overrides: Partial<MCPInitializeRequest['params']> = {}): MCPInitializeRequest {
    return {
      jsonrpc: "2.0",
      method: MCPMethod.Initialize,
      params: {
        protocolVersion: "2024-11-05",
        clientInfo: {
          name: "test-client",
          version: "1.0.0",
        },
        capabilities: {
          tools: {
            listChanged: true,
          },
        },
        ...overrides,
      },
      id: this.getNextRequestId(),
    };
  }

  static createToolsListRequest(): MCPToolsListRequest {
    return {
      jsonrpc: "2.0",
      method: MCPMethod.ToolsList,
      id: this.getNextRequestId(),
    };
  }

  static createToolsCallRequest(
    toolName: string,
    args: Record<string, any> = {}
  ): MCPToolsCallRequest {
    return {
      jsonrpc: "2.0",
      method: MCPMethod.ToolsCall,
      params: {
        name: toolName,
        arguments: args,
      },
      id: this.getNextRequestId(),
    };
  }

  static createTestTool(name: string = "test-tool"): MCPTool {
    return {
      name,
      description: `Test tool: ${name}`,
      inputSchema: {
        type: "object",
        properties: {
          input: {
            type: "string",
            description: "Test input parameter",
          },
        },
        required: ["input"],
        additionalProperties: false,
      },
    };
  }

  static createTestToolDefinition(name: string = "test-tool"): MCPServiceToolDefinition {
    return {
      name,
      schema: this.createTestTool(name),
      handler: async (params: Record<string, any>, context: MCPRequestContext): Promise<MCPToolResult[]> => {
        return [
          {
            type: "text",
            text: `Test tool ${name} executed with input: ${params.input}`,
            metadata: {
              tool: name,
              input: params.input,
              timestamp: new Date().toISOString(),
            },
          },
        ];
      },
    };
  }

  static createAuthContext(overrides: Partial<MCPAuthContext> = {}): MCPAuthContext {
    return {
      userId: "test-user-123",
      token: "test-token",
      permissions: ["user"],
      isServiceRole: false,
      ...overrides,
    };
  }

  static createRequestContext(
    request: JsonRpcRequest,
    authOverrides: Partial<MCPAuthContext> = {}
  ): MCPRequestContext {
    return {
      request,
      auth: this.createAuthContext(authOverrides),
      startTime: Date.now(),
      clientInfo: {
        userAgent: "test-agent",
        ip: "127.0.0.1",
      },
    };
  }

  static createServiceRoleContext(request: JsonRpcRequest): MCPRequestContext {
    return this.createRequestContext(request, {
      userId: undefined,
      isServiceRole: true,
      permissions: ["admin"],
      token: "service-role-key",
    });
  }
}

/**
 * Test assertion helpers
 */
export class MCPTestAssertions {
  static assertValidJsonRpcResponse(response: any): asserts response is JsonRpcResponse {
    if (typeof response !== 'object' || response === null) {
      throw new Error('Response must be an object');
    }

    if (response.jsonrpc !== "2.0") {
      throw new Error('Response must have jsonrpc: "2.0"');
    }

    if (!('result' in response) && !('error' in response)) {
      throw new Error('Response must have either result or error');
    }

    if (!('id' in response)) {
      throw new Error('Response must have an id field');
    }
  }

  static assertSuccessResponse(response: JsonRpcResponse): void {
    this.assertValidJsonRpcResponse(response);
    
    if ('error' in response && response.error) {
      throw new Error(`Expected success response but got error: ${response.error.message}`);
    }

    if (!('result' in response)) {
      throw new Error('Success response must have result field');
    }
  }

  static assertErrorResponse(response: JsonRpcResponse, expectedCode?: MCPErrorCode): void {
    this.assertValidJsonRpcResponse(response);
    
    if (!('error' in response) || !response.error) {
      throw new Error('Expected error response but got success');
    }

    if (expectedCode !== undefined && response.error.code !== expectedCode) {
      throw new Error(`Expected error code ${expectedCode} but got ${response.error.code}`);
    }
  }

  static assertToolResult(result: MCPToolResult): void {
    if (typeof result !== 'object' || result === null) {
      throw new Error('Tool result must be an object');
    }

    if (!result.type || !['text', 'image', 'resource'].includes(result.type)) {
      throw new Error('Tool result must have a valid type');
    }

    if (result.type === 'text' && typeof result.text !== 'string') {
      throw new Error('Text tool result must have text field');
    }
  }
}

/**
 * Mock HTTP server for testing MCP client
 */
export class MockMCPServer {
  private responses: Map<string, any>;
  private requestLog: JsonRpcRequest[];
  
  constructor() {
    this.responses = new Map();
    this.requestLog = [];
  }

  // Set up mock responses
  mockResponse(method: string, response: any): void {
    this.responses.set(method, response);
  }

  mockInitialize(serverName: string = "test-server"): void {
    this.mockResponse(MCPMethod.Initialize, {
      jsonrpc: "2.0",
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: {
          name: serverName,
          version: "1.0.0",
        },
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
      },
      id: null, // Will be set when processing request
    });
  }

  mockToolsList(tools: MCPTool[] = []): void {
    this.mockResponse(MCPMethod.ToolsList, {
      jsonrpc: "2.0",
      result: {
        tools,
      },
      id: null,
    });
  }

  mockToolCall(toolName: string, result: MCPToolResult[]): void {
    this.mockResponse(`${MCPMethod.ToolsCall}:${toolName}`, {
      jsonrpc: "2.0",
      result: {
        content: result,
        isError: false,
      },
      id: null,
    });
  }

  mockError(method: string, code: MCPErrorCode, message: string): void {
    this.mockResponse(method, {
      jsonrpc: "2.0",
      error: {
        code,
        message,
      },
      id: null,
    });
  }

  // Simulate handling a request
  async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.requestLog.push(request);

    let responseKey = request.method;
    
    // For tool calls, include tool name in key
    if (request.method === MCPMethod.ToolsCall && request.params) {
      responseKey = `${request.method}:${request.params.name}`;
    }

    const mockResponse = this.responses.get(responseKey);
    
    if (!mockResponse) {
      return createMCPError(
        MCPErrorCode.MethodNotFound,
        `Method not found: ${request.method}`,
        undefined,
        request.id
      );
    }

    // Set the correct ID
    const response = { ...mockResponse };
    response.id = request.id;
    
    return response;
  }

  // Get request log
  getRequestLog(): JsonRpcRequest[] {
    return [...this.requestLog];
  }

  // Clear request log
  clearLog(): void {
    this.requestLog = [];
  }

  // Get last request
  getLastRequest(): JsonRpcRequest | null {
    return this.requestLog[this.requestLog.length - 1] || null;
  }
}

/**
 * Performance testing utilities
 */
export class MCPPerformanceTest {
  private startTime: number = 0;
  private endTime: number = 0;

  start(): void {
    this.startTime = performance.now();
  }

  end(): number {
    this.endTime = performance.now();
    return this.endTime - this.startTime;
  }

  assertResponseTime(maxMs: number): void {
    const duration = this.end();
    if (duration > maxMs) {
      throw new Error(`Response time ${duration.toFixed(2)}ms exceeded limit ${maxMs}ms`);
    }
  }

  static async measureAsync<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
  }
}

/**
 * Test environment setup
 */
export class MCPTestEnvironment {
  static setupTestEnv(): void {
    // Set up test environment variables
    Deno.env.set('SUPABASE_URL', 'https://test.supabase.co');
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
  }

  static cleanupTestEnv(): void {
    // Clean up test environment
    // In a real test, you might want to clean up test data
  }

  static createMockFetch(responses: Map<string, Response>): typeof fetch {
    return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : 
                 input instanceof URL ? input.toString() : 
                 input.url;

      const response = responses.get(url);
      if (response) {
        return response;
      }

      // Default mock response
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: MCPErrorCode.InternalError,
          message: "Mock fetch: No response configured for URL",
        },
        id: null,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  }
}

/**
 * Test data validation
 */
export class MCPTestValidation {
  static validateProtocolCompliance(response: JsonRpcResponse): boolean {
    try {
      MCPTestAssertions.assertValidJsonRpcResponse(response);
      return true;
    } catch (error) {
      console.error('Protocol compliance validation failed:', error.message);
      return false;
    }
  }

  static validateCORSHeaders(headers: Headers): boolean {
    const requiredHeaders = [
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Methods',
    ];

    for (const header of requiredHeaders) {
      if (!headers.has(header)) {
        console.error(`Missing CORS header: ${header}`);
        return false;
      }
    }

    return true;
  }

  static validateSecurityHeaders(headers: Headers): boolean {
    // Add any security header validations needed
    const contentType = headers.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Invalid or missing Content-Type header');
      return false;
    }

    return true;
  }
}

/**
 * Load testing utilities
 */
export class MCPLoadTest {
  static async concurrentRequests<T>(
    fn: () => Promise<T>,
    concurrency: number,
    totalRequests: number
  ): Promise<{ results: T[]; errors: Error[]; duration: number }> {
    const start = performance.now();
    const results: T[] = [];
    const errors: Error[] = [];

    const chunks = Math.ceil(totalRequests / concurrency);
    
    for (let chunk = 0; chunk < chunks; chunk++) {
      const chunkSize = Math.min(concurrency, totalRequests - chunk * concurrency);
      const promises: Promise<T>[] = [];

      for (let i = 0; i < chunkSize; i++) {
        promises.push(
          fn().catch(error => {
            errors.push(error);
            throw error;
          })
        );
      }

      const chunkResults = await Promise.allSettled(promises);
      
      for (const result of chunkResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      }
    }

    const duration = performance.now() - start;
    return { results, errors, duration };
  }
}