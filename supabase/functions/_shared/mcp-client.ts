/**
 * MCP Client Library - JSON-RPC 2.0 compliant MCP client implementation
 * For communicating between ORBIT Edge Functions via MCP protocol
 */

import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  MCPErrorCode,
  MCPMethod,
  MCPBatchRequest,
  MCPBatchResponse,
  MCPInitializeRequest,
  MCPInitializeResponse,
  MCPToolsListRequest,
  MCPToolsListResponse,
  MCPToolsCallRequest,
  MCPToolsCallResponse,
  MCPTool,
  MCPToolResult,
  createMCPError,
  createMCPResponse,
  isValidJsonRpcRequest,
  isBatchRequest,
  MCP_PROTOCOL_VERSION,
} from './mcp-types.ts';

/**
 * MCP Client Configuration
 */
export interface MCPClientConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  retryDelay: number;
  authToken?: string;
  clientInfo: {
    name: string;
    version: string;
  };
}

/**
 * MCP Connection State
 */
interface MCPConnectionState {
  initialized: boolean;
  serverInfo?: {
    name: string;
    version: string;
    capabilities: any;
  };
  availableTools: MCPTool[];
}

/**
 * Request Options
 */
interface MCPRequestOptions {
  timeout?: number;
  retries?: number;
  authToken?: string;
}

/**
 * MCP Client Implementation
 */
export class MCPClient {
  private config: MCPClientConfig;
  private state: MCPConnectionState;
  private requestId: number;

  constructor(config: MCPClientConfig) {
    this.config = config;
    this.state = {
      initialized: false,
      availableTools: [],
    };
    this.requestId = 1;

    console.log(`MCP Client created for: ${config.baseUrl}`);
  }

  /**
   * Initialize connection with MCP server
   */
  async initialize(): Promise<MCPInitializeResponse['result']> {
    console.log('Initializing MCP connection...');

    const request: MCPInitializeRequest = {
      jsonrpc: "2.0",
      method: MCPMethod.Initialize,
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        clientInfo: this.config.clientInfo,
        capabilities: {
          tools: {
            listChanged: true,
          },
        },
      },
      id: this.getNextRequestId(),
    };

    try {
      const response = await this.sendRequest<MCPInitializeResponse>(request);
      
      if ('error' in response) {
        throw new Error(`Initialize failed: ${response.error.message}`);
      }

      this.state.initialized = true;
      this.state.serverInfo = {
        name: response.result.serverInfo.name,
        version: response.result.serverInfo.version,
        capabilities: response.result.capabilities,
      };

      console.log(`MCP connection initialized with ${this.state.serverInfo.name}`);
      return response.result;

    } catch (error) {
      console.error('MCP initialization failed:', error);
      throw new MCPClientError('Initialization failed', MCPErrorCode.InitializationError, error);
    }
  }

  /**
   * List available tools from the server
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.state.initialized) {
      await this.initialize();
    }

    const request: MCPToolsListRequest = {
      jsonrpc: "2.0",
      method: MCPMethod.ToolsList,
      id: this.getNextRequestId(),
    };

    try {
      const response = await this.sendRequest<MCPToolsListResponse>(request);
      
      if ('error' in response) {
        throw new Error(`List tools failed: ${response.error.message}`);
      }

      this.state.availableTools = response.result.tools;
      console.log(`Retrieved ${response.result.tools.length} tools from MCP server`);
      
      return response.result.tools;

    } catch (error) {
      console.error('Failed to list MCP tools:', error);
      throw new MCPClientError('List tools failed', MCPErrorCode.InternalError, error);
    }
  }

  /**
   * Call a tool on the server
   */
  async callTool(
    toolName: string,
    arguments_: Record<string, any>,
    options: MCPRequestOptions = {}
  ): Promise<MCPToolResult[]> {
    if (!this.state.initialized) {
      await this.initialize();
    }

    // Check if tool exists
    const tool = this.state.availableTools.find(t => t.name === toolName);
    if (!tool) {
      // Refresh tools list in case it changed
      await this.listTools();
      const refreshedTool = this.state.availableTools.find(t => t.name === toolName);
      if (!refreshedTool) {
        throw new MCPClientError(`Tool not found: ${toolName}`, MCPErrorCode.MethodNotFound);
      }
    }

    const request: MCPToolsCallRequest = {
      jsonrpc: "2.0",
      method: MCPMethod.ToolsCall,
      params: {
        name: toolName,
        arguments: arguments_,
      },
      id: this.getNextRequestId(),
    };

    try {
      console.log(`Calling MCP tool: ${toolName} with args:`, arguments_);
      
      const response = await this.sendRequest<MCPToolsCallResponse>(request, options);
      
      if ('error' in response) {
        throw new Error(`Tool call failed: ${response.error.message}`);
      }

      if (response.result.isError) {
        console.warn(`Tool ${toolName} returned error result`);
      } else {
        console.log(`Tool ${toolName} executed successfully`);
      }

      return response.result.content;

    } catch (error) {
      console.error(`Failed to call tool ${toolName}:`, error);
      throw new MCPClientError(`Tool call failed: ${toolName}`, MCPErrorCode.ToolExecutionError, error);
    }
  }

  /**
   * Ping the server
   */
  async ping(): Promise<any> {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      method: MCPMethod.Ping,
      id: this.getNextRequestId(),
    };

    try {
      const response = await this.sendRequest(request, { timeout: 5000 });
      
      if ('error' in response) {
        throw new Error(`Ping failed: ${response.error.message}`);
      }

      return response.result;

    } catch (error) {
      console.error('MCP ping failed:', error);
      throw new MCPClientError('Ping failed', MCPErrorCode.InternalError, error);
    }
  }

  /**
   * Send batch requests
   */
  async sendBatch(requests: JsonRpcRequest[]): Promise<JsonRpcResponse[]> {
    if (requests.length === 0) {
      return [];
    }

    try {
      console.log(`Sending batch request with ${requests.length} items`);
      
      const response = await this.httpRequest(requests);
      
      if (!Array.isArray(response)) {
        throw new Error('Invalid batch response - expected array');
      }

      return response as JsonRpcResponse[];

    } catch (error) {
      console.error('Batch request failed:', error);
      throw new MCPClientError('Batch request failed', MCPErrorCode.InternalError, error);
    }
  }

  /**
   * Send single request with retry logic
   */
  private async sendRequest<T extends JsonRpcResponse>(
    request: JsonRpcRequest,
    options: MCPRequestOptions = {}
  ): Promise<T> {
    const maxRetries = options.retries ?? this.config.retries;
    const timeout = options.timeout ?? this.config.timeout;
    
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const response = await this.httpRequest(request, {
          ...options,
          timeout,
        });

        return response as T;

      } catch (error) {
        lastError = error as Error;
        
        if (attempt <= maxRetries) {
          const delay = this.config.retryDelay * attempt;
          console.warn(`Request attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
          await this.delay(delay);
        }
      }
    }

    throw lastError || new Error('Request failed after all retries');
  }

  /**
   * Make HTTP request to MCP server
   */
  private async httpRequest(
    requestData: JsonRpcRequest | JsonRpcRequest[],
    options: MCPRequestOptions = {}
  ): Promise<JsonRpcResponse | JsonRpcResponse[]> {
    const controller = new AbortController();
    const timeout = options.timeout ?? this.config.timeout;
    
    // Set timeout
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const authToken = options.authToken ?? this.config.authToken;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(this.config.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();

      // Validate response format
      if (Array.isArray(requestData)) {
        if (!Array.isArray(responseData)) {
          throw new Error('Invalid batch response format');
        }
      } else {
        if (!this.isValidJsonRpcResponse(responseData)) {
          throw new Error('Invalid JSON-RPC response format');
        }
      }

      return responseData;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Validate JSON-RPC response format
   */
  private isValidJsonRpcResponse(obj: any): obj is JsonRpcResponse {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      obj.jsonrpc === "2.0" &&
      ('result' in obj || 'error' in obj) &&
      ('id' in obj)
    );
  }

  /**
   * Get next request ID
   */
  private getNextRequestId(): number {
    return this.requestId++;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current connection state
   */
  getConnectionState(): MCPConnectionState {
    return { ...this.state };
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.state.initialized;
  }

  /**
   * Get available tools
   */
  getAvailableTools(): MCPTool[] {
    return [...this.state.availableTools];
  }
}

/**
 * Custom error class for MCP client errors
 */
export class MCPClientError extends Error {
  public readonly code: MCPErrorCode;
  public readonly originalError?: Error;

  constructor(message: string, code: MCPErrorCode, originalError?: Error) {
    super(message);
    this.name = 'MCPClientError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Factory function to create MCP client for ORBIT services
 */
export function createORBITMCPClient(
  serviceUrl: string,
  options: Partial<MCPClientConfig> = {}
): MCPClient {
  const config: MCPClientConfig = {
    baseUrl: serviceUrl,
    timeout: 30000, // 30 seconds
    retries: 3,
    retryDelay: 1000, // 1 second
    authToken: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), // Use service role by default
    clientInfo: {
      name: 'ORBIT-MCP-Client',
      version: '1.0.0',
    },
    ...options,
  };

  return new MCPClient(config);
}

/**
 * Connection pool for managing multiple MCP clients
 */
export class MCPConnectionPool {
  private clients: Map<string, MCPClient>;
  private defaultConfig: Partial<MCPClientConfig>;

  constructor(defaultConfig: Partial<MCPClientConfig> = {}) {
    this.clients = new Map();
    this.defaultConfig = defaultConfig;
  }

  /**
   * Get or create client for service
   */
  getClient(serviceName: string, serviceUrl: string): MCPClient {
    if (!this.clients.has(serviceName)) {
      const client = createORBITMCPClient(serviceUrl, this.defaultConfig);
      this.clients.set(serviceName, client);
      console.log(`Created MCP client for service: ${serviceName}`);
    }

    return this.clients.get(serviceName)!;
  }

  /**
   * Initialize all clients
   */
  async initializeAll(): Promise<void> {
    const initPromises = Array.from(this.clients.entries()).map(
      async ([name, client]) => {
        try {
          await client.initialize();
          console.log(`Initialized MCP client: ${name}`);
        } catch (error) {
          console.error(`Failed to initialize MCP client ${name}:`, error);
          throw error;
        }
      }
    );

    await Promise.all(initPromises);
    console.log(`Initialized ${this.clients.size} MCP clients`);
  }

  /**
   * Ping all clients
   */
  async pingAll(): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    
    const pingPromises = Array.from(this.clients.entries()).map(
      async ([name, client]) => {
        try {
          const result = await client.ping();
          results[name] = { status: 'ok', ...result };
        } catch (error) {
          results[name] = { status: 'error', error: error.message };
        }
      }
    );

    await Promise.all(pingPromises);
    return results;
  }

  /**
   * Get all client states
   */
  getAllStates(): Record<string, MCPConnectionState> {
    const states: Record<string, MCPConnectionState> = {};
    
    for (const [name, client] of this.clients.entries()) {
      states[name] = client.getConnectionState();
    }
    
    return states;
  }

  /**
   * Close all connections
   */
  close(): void {
    this.clients.clear();
    console.log('Closed all MCP connections');
  }
}

/**
 * Global connection pool instance for ORBIT services
 */
let globalPool: MCPConnectionPool | null = null;

export function getGlobalMCPPool(): MCPConnectionPool {
  if (!globalPool) {
    globalPool = new MCPConnectionPool({
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      authToken: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    });
  }
  
  return globalPool;
}