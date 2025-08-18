/**
 * MCP (Model Context Protocol) Types and Interfaces
 * JSON-RPC 2.0 compliant implementation for ORBIT Image Forge
 */

// JSON-RPC 2.0 Base Types
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, any>;
  id?: string | number | null;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: JsonRpcError;
  id: string | number | null;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

// MCP Error Codes (JSON-RPC 2.0 + MCP specific)
export enum MCPErrorCode {
  // JSON-RPC 2.0 Standard Errors
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  
  // MCP Specific Errors
  InitializationError = -32000,
  AuthenticationError = -32001,
  AuthorizationError = -32002,
  ResourceNotFound = -32003,
  ResourceUnavailable = -32004,
  ToolExecutionError = -32005,
  ValidationError = -32006,
  RateLimitError = -32007,
}

// MCP Method Names
export enum MCPMethod {
  Initialize = "initialize",
  ToolsList = "tools/list", 
  ToolsCall = "tools/call",
  Ping = "ping",
}

// MCP Initialize Request/Response
export interface MCPInitializeRequest {
  jsonrpc: "2.0";
  method: "initialize";
  params: {
    protocolVersion: string;
    clientInfo: {
      name: string;
      version: string;
    };
    capabilities: {
      tools?: ToolCapabilities;
    };
  };
  id: string | number;
}

export interface MCPInitializeResponse {
  jsonrpc: "2.0";
  result: {
    protocolVersion: string;
    serverInfo: {
      name: string;
      version: string;
    };
    capabilities: {
      tools?: ToolCapabilities;
    };
  };
  id: string | number;
}

export interface ToolCapabilities {
  listChanged?: boolean;
}

// MCP Tool Definitions
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface MCPToolsListRequest {
  jsonrpc: "2.0";
  method: "tools/list";
  params?: {
    cursor?: string;
  };
  id: string | number;
}

export interface MCPToolsListResponse {
  jsonrpc: "2.0";
  result: {
    tools: MCPTool[];
    nextCursor?: string;
  };
  id: string | number;
}

export interface MCPToolsCallRequest {
  jsonrpc: "2.0";
  method: "tools/call";
  params: {
    name: string;
    arguments: Record<string, any>;
  };
  id: string | number;
}

export interface MCPToolsCallResponse {
  jsonrpc: "2.0";
  result: {
    content: MCPToolResult[];
    isError?: boolean;
  };
  id: string | number;
}

export interface MCPToolResult {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;
  mimeType?: string;
  metadata?: Record<string, any>;
}

// Authentication & Authorization
export interface MCPAuthContext {
  userId?: string;
  token?: string;
  permissions?: string[];
  isServiceRole?: boolean;
}

export interface MCPServerConfig {
  name: string;
  version: string;
  tools: MCPTool[];
  corsOrigins?: string[];
  authRequired?: boolean;
  rateLimits?: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
}

// Request Processing
export interface MCPRequestContext {
  request: JsonRpcRequest;
  auth: MCPAuthContext;
  startTime: number;
  clientInfo?: {
    userAgent?: string;
    ip?: string;
  };
}

export interface MCPHandlerResult {
  result?: any;
  error?: JsonRpcError;
}

// Tool Handler Function Type
export type MCPToolHandler = (
  params: Record<string, any>,
  context: MCPRequestContext
) => Promise<MCPToolResult[]>;

// Server Handler Function Type  
export type MCPMethodHandler = (
  params: any,
  context: MCPRequestContext
) => Promise<MCPHandlerResult>;

// Batch Request Support
export interface MCPBatchRequest extends Array<JsonRpcRequest> {}
export interface MCPBatchResponse extends Array<JsonRpcResponse> {}

// Server Configuration for Different MCP Services
export interface MCPServiceToolDefinition {
  name: string;
  handler: MCPToolHandler;
  schema: MCPTool;
}

// AI Analysis MCP Tools
export interface AIAnalysisParams {
  imagePath?: string;
  imageUrl?: string;
  analysisType?: "lifestyle" | "product";
}

export interface AIAnalysisResult {
  type: "text";
  text: string;
  metadata: {
    analysisType: string;
    confidence: number;
    processingTime: number;
    features: Record<string, any>;
  };
}

// Metadata Processing MCP Tools  
export interface MetadataEmbedParams {
  sourcePath: string;
  metadata: Record<string, any>;
  outputPath: string;
  schemaType?: "lifestyle" | "product" | "orbit";
}

export interface MetadataResult {
  type: "text";
  text: string;
  metadata: {
    outputPath: string;
    fileSize: number;
    processingTime: number;
  };
}

// Storage Operations MCP Tools
export interface StorageUploadParams {
  bucketName: string;
  filePaths: string[];
  folderPrefix: string;
  userId: string;
  batchId: string;
}

export interface StorageResult {
  type: "text";
  text: string;
  metadata: {
    uploadedFiles: string[];
    failedFiles: string[];
    totalSize: number;
  };
}

// Error Creation Helpers
export function createMCPError(
  code: MCPErrorCode,
  message: string,
  data?: any,
  id: string | number | null = null
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    error: {
      code,
      message,
      data,
    },
    id,
  };
}

// Response Creation Helpers  
export function createMCPResponse(
  result: any,
  id: string | number | null
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    result,
    id,
  };
}

// Validation Helpers
export function isValidJsonRpcRequest(obj: any): obj is JsonRpcRequest {
  return (
    typeof obj === "object" &&
    obj !== null &&
    obj.jsonrpc === "2.0" &&
    typeof obj.method === "string" &&
    (obj.id === undefined || 
     typeof obj.id === "string" || 
     typeof obj.id === "number" || 
     obj.id === null)
  );
}

export function isBatchRequest(obj: any): obj is MCPBatchRequest {
  return Array.isArray(obj) && obj.length > 0;
}

// Protocol Version
export const MCP_PROTOCOL_VERSION = "2024-11-05";
export const SERVER_VERSION = "1.0.0";