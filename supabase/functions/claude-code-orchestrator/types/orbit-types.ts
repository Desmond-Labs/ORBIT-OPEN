/**
 * ORBIT TypeScript Type Definitions
 * 
 * Comprehensive type definitions for the Claude Code ORBIT orchestrator
 * and all related MCP tool integrations.
 */

// Core ORBIT Request/Response Types
export interface OrbitRequest {
  orderId: string;
  action?: 'process' | 'recover' | 'validate' | 'debug';
  analysisType?: 'product' | 'lifestyle';
  debugMode?: boolean;
}

export interface OrbitResponse {
  success: boolean;
  orchestrationType: 'claude-code-sdk';
  orderId: string;
  message: string;
  execution: {
    todoList: OrbitTodo[];
    totalDuration: number;
    phases: OrbitPhases;
    toolMetrics: ToolMetrics;
  };
  results?: OrbitResults;
  errors?: string[];
  timestamp: string;
}

// TodoWrite Integration Types
export interface OrbitTodo {
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  id: string;
  startTime?: number;
  completionTime?: number;
  duration?: number;
}

// Workflow Phase Types
export interface OrbitPhases {
  planning: PhaseStatus;
  discovery: PhaseStatus;
  processing: PhaseStatus;
  validation: PhaseStatus;
  reporting: PhaseStatus;
}

export interface PhaseStatus {
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime: number;
  endTime: number;
  duration: number;
}

// Database Entity Types
export interface OrbitOrder {
  id: string;
  user_id: string;
  batch_id: string;
  order_number: string;
  image_count: number;
  base_cost: number;
  tier_discount: number;
  total_cost: number;
  payment_status: string;
  stripe_payment_intent_id: string;
  stripe_customer_id: string;
  order_status: string;
  created_at: string;
  updated_at: string;
  processing_stage: string;
  processing_completion_percentage: number;
  email_sent: boolean;
  metadata: Record<string, any>;
}

export interface OrbitImage {
  id: string;
  batch_id: string;
  user_id: string;
  order_id: string;
  original_filename: string;
  storage_path_original: string;
  storage_path_processed: string | null;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  file_size: number;
  mime_type: string;
  extracted_metadata: Record<string, any> | null;
  ai_analysis: Record<string, any> | null;
  created_at: string;
  processed_at: string | null;
  processing_cost: number | null;
  analysis_type: 'product' | 'lifestyle';
  gemini_analysis_raw: string | null;
  updated_at: string;
}

// MCP Tool Result Types
export interface GeminiAnalysisResult {
  imageId: string;
  filename: string;
  analysisType: 'product' | 'lifestyle';
  analysis: {
    result?: {
      content?: Array<{
        text: string;
        type: string;
      }>;
    };
  };
  processingTime: number;
  success: boolean;
  error?: string;
}

export interface MetadataProcessingResult {
  imageId: string;
  filename: string;
  metadata: {
    result?: {
      content?: Array<{
        text: string;
        type: string;
      }>;
    };
  };
  outputPath: string;
  processingTime: number;
  success: boolean;
  error?: string;
}

export interface StorageOperationResult {
  imageId?: string;
  filename?: string;
  operation: 'list_files' | 'download_file' | 'upload_batch' | 'create_signed_urls';
  storage: {
    result?: {
      content?: Array<{
        text: string;
        type: string;
      }>;
    };
  };
  processingTime: number;
  success: boolean;
  error?: string;
}

export interface ReportGenerationResult {
  imageId: string;
  filename: string;
  format: 'detailed' | 'simple' | 'json-only' | 'marketing' | 'technical';
  reports: {
    result?: {
      content?: Array<{
        text: string;
        type: string;
      }>;
    };
  };
  processingTime: number;
  success: boolean;
  error?: string;
}

// Workflow Results
export interface OrbitResults {
  discovery: DiscoveryResults;
  processing: ProcessingResults;
  validation: ValidationResults;
  reporting?: ReportingResults;
}

export interface DiscoveryResults {
  order: OrbitOrder;
  images: OrbitImage[];
  paymentStatus: string;
  imageCount: number;
  storageValidated: boolean;
  userPermissions: string;
  discoveryTime?: number;
}

export interface ProcessingResults {
  imagesProcessed: number;
  analysisResults: GeminiAnalysisResult[];
  metadataResults: MetadataProcessingResult[];
  analysisCompleted: boolean;
  metadataEmbedded: boolean;
  reportsGenerated: boolean;
  totalProcessingTime: number;
  avgTimePerImage: number;
}

export interface ValidationResults {
  allImagesProcessed: boolean;
  metadataValidated: boolean;
  noRegressions: boolean;
  systemStable: boolean;
  validationChecks: {
    databaseConsistency: boolean;
    storageIntegrity: boolean;
    metadataIntegrity: boolean;
    performanceAcceptable: boolean;
  };
}

export interface ReportingResults {
  emailSent: boolean;
  processingDuration: number;
  totalTasks: number;
  completedTasks: number;
  toolsUsed: number;
  reportGenerated: boolean;
  performanceMetrics: PerformanceMetrics;
}

// Performance and Tool Metrics
export interface ToolMetrics {
  claudeApiCalls: number;
  geminiAnalysisCalls: number;
  metadataProcessingCalls: number;
  storageOperations: number;
  totalDuration: number;
  avgResponseTime: number;
  costEstimate: number;
}

export interface PerformanceMetrics {
  totalExecutionTime: number;
  phaseBreakdown: {
    planning: number;
    discovery: number;
    processing: number;
    validation: number;
    reporting: number;
  };
  toolPerformance: {
    claudeApi: ToolPerformance;
    geminiAnalysis: ToolPerformance;
    metadataProcessing: ToolPerformance;
    storageOperations: ToolPerformance;
  };
  memoryUsage?: number;
  networkCalls: number;
  errorsEncountered: number;
}

export interface ToolPerformance {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  totalTime: number;
  errorRate: number;
}

// Claude API Integration Types
export interface ClaudeClientConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface ClaudeToolCall {
  toolName: string;
  parameters: Record<string, any>;
  timeout?: number;
}

export interface ClaudeToolResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  metadata?: Record<string, any>;
}

// TodoWrite API Types
export interface TodoWriteRequest {
  todos: OrbitTodo[];
}

export interface TodoWriteResponse {
  success: boolean;
  updatedTodos: OrbitTodo[];
  error?: string;
}

// Error Handling Types
export interface OrbitError {
  code: string;
  message: string;
  phase: string;
  tool?: string;
  timestamp: number;
  context?: Record<string, any>;
  recoverable: boolean;
}

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Constants
export const ORBIT_PHASES: readonly string[] = [
  'planning',
  'discovery', 
  'processing',
  'validation',
  'reporting'
] as const;

export const ORBIT_TODO_STATUSES: readonly string[] = [
  'pending',
  'in_progress', 
  'completed',
  'failed'
] as const;

export const ANALYSIS_TYPES: readonly string[] = [
  'product',
  'lifestyle'
] as const;

export const MCP_TOOLS: readonly string[] = [
  'gemini-analysis',
  'metadata-processor',
  'storage-manager',
  'report-generator'
] as const;

// Production Services Types (Enhancement Phase)

// Order Discovery Service Types
export interface OrderDiscoveryOptions {
  maxOrdersPerBatch?: number;
  prioritizeOlderOrders?: boolean;
  statusFilter?: string[];
  userFilter?: string[];
}

export interface OrderDiscoveryResult {
  foundOrders: OrbitOrder[];
  totalOrdersFound: number;
  queryTime: number;
  nextBatchAvailable: boolean;
  discoveryMetrics: {
    pendingOrders: number;
    processingOrders: number;
    completedOrders: number;
    failedOrders: number;
  };
}

export interface ProcessingProgressUpdate {
  orderId: string;
  percentage: number;
  stage: string;
  updatedAt: string;
  message?: string;
}

// Storage Verification Service Types
export interface StorageVerificationResult {
  verificationPassed: boolean;
  orderId: string;
  userId: string;
  originalFolderVerification: {
    verified: boolean;
    expectedFiles: number;
    foundFiles: number;
    missingFiles: string[];
  };
  processedFolderVerification: {
    verified: boolean;
    expectedFiles: number;
    foundFiles: number;
    missingFiles: string[];
  };
  storagePatternCompliance: boolean;
  verificationTime: number;
  issues: string[];
  recommendations: string[];
}

export interface ImageProcessingVerification {
  imageId: string;
  filename: string;
  originalFileExists: boolean;
  processedFileExists: boolean;
  metadataEmbedded: boolean;
  reportGenerated: boolean;
  isComplete: boolean;
  issues: string[];
}

// Error Recovery Service Types
export type ErrorType = 
  | 'GEMINI_API_ERROR'
  | 'STORAGE_ACCESS_ERROR' 
  | 'METADATA_EMBED_ERROR'
  | 'DATABASE_ERROR'
  | 'EMAIL_FUNCTION_ERROR'
  | 'DEPLOYMENT_SYNC_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ERROR';

export interface ErrorClassification {
  type: ErrorType;
  severity: ErrorSeverity;
  isRetryable: boolean;
  maxRetries: number;
  baseDelayMs: number;
  exponentialBackoff: boolean;
  description: string;
}

export interface RetryStrategy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBackoff: boolean;
  jitterEnabled: boolean;
}

export interface ErrorContext {
  orderId?: string;
  imageId?: string;
  userId?: string;
  phase?: string;
  operation?: string;
  correlationId: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface RecoveryResult {
  success: boolean;
  attemptNumber: number;
  totalRetries: number;
  finalError?: string;
  recoveryTime: number;
  strategy: string;
}

// Email Notification Service Types
export interface EmailResult {
  success: boolean;
  emailId?: string;
  deliveryStatus?: 'sent' | 'delivered' | 'failed';
  error?: string;
  retryable?: boolean;
  responseTime: number;
}

export interface EmailNotificationOptions {
  orderId: string;
  retryAttempts?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  verificationEnabled?: boolean;
}

export interface EmailStatus {
  orderId: string;
  emailSent: boolean;
  emailId?: string;
  sentAt?: string;
  deliveryStatus?: string;
  lastAttemptAt?: string;
  attemptCount: number;
  lastError?: string;
}

// Batch Processing Validator Types
export interface BatchValidationResult {
  isValid: boolean;
  orderId: string;
  userId: string;
  batchId?: string;
  validationSummary: {
    totalImages: number;
    processedImages: number;
    failedImages: number;
    pendingImages: number;
    completionRate: number;
  };
  validationChecks: {
    allImagesProcessed: boolean;
    storageConsistency: boolean;
    databaseConsistency: boolean;
    metadataIntegrity: boolean;
    analysisCompleteness: boolean;
    fileIntegrity: boolean;
  };
  validationDetails: {
    processedImagesList: string[];
    failedImagesList: Array<{
      imageId: string;
      filename: string;
      reason: string;
      retryable: boolean;
    }>;
    storageIssues: string[];
    databaseIssues: string[];
    metadataIssues: string[];
  };
  recommendations: string[];
  validationTime: number;
  canComplete: boolean;
  blockers: string[];
}

export interface BatchCompletionReport {
  orderId: string;
  completionTime: string;
  processingDuration: number;
  totalImages: number;
  successfulImages: number;
  failedImages: number;
  filesGenerated: number;
  storageUsed: number;
  avgProcessingTimePerImage: number;
  qualityScore: number;
  recommendations: string[];
}

// Enhanced Workflow Options
export interface WorkflowOptions {
  enableMetrics?: boolean;
  enableLogging?: boolean;
  enableRecovery?: boolean;
  maxRetries?: number;
}