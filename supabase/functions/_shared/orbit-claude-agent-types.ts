// ORBIT Claude Code Agent - TypeScript Interfaces and Types
// Modular and independent agent for ORBIT image processing workflow

export interface ORBITAgentConfig {
  anthropicApiKey: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  mcpServices: {
    aiAnalysis: string;
    metadata: string;
    storage: string;
  };
  maxTurns?: number;
  timeoutMs?: number;
  enableLogging?: boolean;
}

export interface Order {
  id: string;
  user_id: string;
  order_number: string;
  batch_id: string;
  processing_stage: string;
  payment_status: string;
  created_at: string;
  processing_completion_percentage: number;
}

export interface Image {
  id: string;
  order_id: string;
  batch_id: string;
  original_filename: string;
  storage_path_original: string;
  storage_path_processed?: string;
  processing_status: string;
  gemini_analysis_raw?: string;
  ai_analysis?: any;
  analysis_type?: string;
  processed_at?: string;
  error_message?: string;
}

export interface Batch {
  id: string;
  user_id: string;
  status: string;
  processed_count: number;
  error_count: number;
  processing_start_time?: string;
  processing_end_time?: string;
  completed_at?: string;
}

export interface OrderContext {
  order: Order;
  batch: Batch;
  images: Image[];
  totalImages: number;
  pendingImages: number;
  orderFolder: string;
}

export interface WorkflowResult {
  success: boolean;
  orderId: string;
  batchId: string;
  results: {
    total_images: number;
    success_count: number;
    error_count: number;
    status: 'completed' | 'completed_with_errors' | 'failed';
  };
  processed_results: ImageProcessingResult[];
  processing_time_ms: number;
  error?: string;
}

export interface ImageProcessingResult {
  image_id: string;
  filename: string;
  status: 'success' | 'error';
  analysis?: any;
  error?: string;
  error_type?: string;
  correlation_id?: string;
  atomic_verified?: boolean;
  rollback_successful?: boolean;
}

export interface AgentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: {
    database: 'connected' | 'error';
    storage: 'connected' | 'error';
    mcp_services: 'online' | 'partial' | 'offline';
    claude_sdk: 'initialized' | 'error';
    configuration: 'valid' | 'invalid';
  };
  timestamp: string;
}

export interface SupabaseToolResult {
  success: boolean;
  data?: any;
  error?: string;
  execution_time_ms: number;
}

export interface MCPServiceCall {
  service: 'ai-analysis' | 'metadata' | 'storage';
  tool_name: string;
  parameters: any;
  correlation_id?: string;
}

export interface MCPServiceResult {
  success: boolean;
  data?: any;
  error?: string;
  service: string;
  processing_time_ms: number;
  correlation_id?: string;
}

// Claude Code SDK message types
export interface ClaudeMessage {
  type: 'text' | 'tool_use' | 'tool_result';
  content?: string;
  name?: string;
  input?: any;
  result?: any;
  error?: string;
}

// Workflow phase tracking
export interface WorkflowPhase {
  phase: 'pre-flight' | 'order-discovery' | 'image-processing' | 'finalization' | 'email-cleanup';
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  progress_percentage: number;
}

// Error classification and retry configuration
export enum ErrorType {
  GEMINI_API_ERROR = 'GEMINI_API_ERROR',
  STORAGE_ACCESS_ERROR = 'STORAGE_ACCESS_ERROR',
  METADATA_EMBED_ERROR = 'METADATA_EMBED_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EMAIL_FUNCTION_ERROR = 'EMAIL_FUNCTION_ERROR',
  DEPLOYMENT_SYNC_ERROR = 'DEPLOYMENT_SYNC_ERROR',
  CLAUDE_SDK_ERROR = 'CLAUDE_SDK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
}

export interface ErrorContext {
  type: ErrorType;
  correlation_id: string;
  phase: string;
  image_id?: string;
  order_id: string;
  retry_count: number;
  original_error: Error;
}

// Atomic processing verification
export interface AtomicVerificationResult {
  success: boolean;
  details: {
    processing_status: string;
    has_storage_path: boolean;
    has_analysis: boolean;
    has_ai_analysis: boolean;
  };
  error?: string;
}

// Storage verification structures
export interface StorageVerificationResult {
  success: boolean;
  folder_path: string;
  total_files_found: number;
  processed_files_count: number;
  expected_files_count: number;
  files: string[];
  missing_files?: string[];
  error?: string;
}