/**
 * Enhanced Error Recovery Service
 * 
 * Implements intelligent retry logic with proper failure tracking and recovery strategies.
 * Provides comprehensive error classification, exponential backoff, and recovery coordination.
 * 
 * This service transforms basic error handling into a robust production-ready system
 * that can intelligently recover from transient failures while properly handling permanent errors.
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

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

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

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

export interface ImageRetryStatus {
  imageId: string;
  filename: string;
  retryCount: number;
  maxRetries: number;
  lastRetryAt: string;
  lastErrorType: ErrorType;
  lastErrorMessage: string;
  retryStrategy: string;
  isRetryable: boolean;
  nextRetryAt?: string;
}

export class ErrorRecoveryService {
  private supabase: any;
  private errorClassifications: Map<ErrorType, ErrorClassification>;
  private defaultRetryStrategy: RetryStrategy;

  constructor() {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('sb_secret_key') || Deno.env.get('SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration required for Error Recovery Service');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize error classifications
    this.initializeErrorClassifications();

    // Set default retry strategy
    this.defaultRetryStrategy = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      exponentialBackoff: true,
      jitterEnabled: true
    };

    console.log('🔄 Enhanced Error Recovery Service initialized');
    console.log(`⚙️ Default strategy: ${this.defaultRetryStrategy.maxRetries} retries, ${this.defaultRetryStrategy.baseDelayMs}ms base delay`);
  }

  /**
   * Main recovery method - attempts to recover from an error with intelligent retry
   */
  async attemptRecovery<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    customStrategy?: Partial<RetryStrategy>
  ): Promise<RecoveryResult & { result?: T }> {
    const startTime = Date.now();
    const strategy = { ...this.defaultRetryStrategy, ...customStrategy };
    const correlationId = context.correlationId;
    
    console.log(`🔄 Starting recovery attempt for ${context.operation || 'unknown operation'} (${correlationId})`);

    let lastError: Error | null = null;
    let attemptNumber = 0;

    // Initial attempt (not counted as a retry)
    try {
      attemptNumber = 1;
      console.log(`🎯 Attempt ${attemptNumber} for ${correlationId}`);
      
      const result = await operation();
      
      const recoveryTime = Date.now() - startTime;
      console.log(`✅ Recovery succeeded on attempt ${attemptNumber} (${recoveryTime}ms) - ${correlationId}`);
      
      return {
        success: true,
        attemptNumber,
        totalRetries: attemptNumber - 1,
        recoveryTime,
        strategy: 'initial-attempt',
        result
      };

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ Initial attempt failed for ${correlationId}: ${lastError.message}`);
    }

    // Classify the error to determine retry strategy
    const errorClassification = this.classifyError(lastError!);
    
    if (!errorClassification.isRetryable) {
      await this.logNonRetryableError(context, lastError!, errorClassification);
      
      return {
        success: false,
        attemptNumber: 1,
        totalRetries: 0,
        finalError: `Non-retryable error: ${lastError!.message}`,
        recoveryTime: Date.now() - startTime,
        strategy: 'no-retry'
      };
    }

    // Update strategy based on error classification
    const finalStrategy: RetryStrategy = {
      ...strategy,
      maxRetries: Math.min(strategy.maxRetries, errorClassification.maxRetries),
      baseDelayMs: Math.max(strategy.baseDelayMs, errorClassification.baseDelayMs),
      exponentialBackoff: strategy.exponentialBackoff && errorClassification.exponentialBackoff
    };

    console.log(`🔄 Error classified as ${errorClassification.type} (${errorClassification.severity}) - retrying with strategy: ${JSON.stringify(finalStrategy)}`);

    // Retry loop
    for (let retryAttempt = 1; retryAttempt <= finalStrategy.maxRetries; retryAttempt++) {
      attemptNumber++;
      
      // Calculate delay with exponential backoff and jitter
      const delay = this.calculateRetryDelay(retryAttempt, finalStrategy);
      
      console.log(`⏱️ Waiting ${delay}ms before retry ${retryAttempt}/${finalStrategy.maxRetries} - ${correlationId}`);
      await this.sleep(delay);

      // Update retry status in database
      if (context.imageId) {
        await this.updateImageRetryStatus(context.imageId, retryAttempt, errorClassification, lastError!.message);
      }

      try {
        console.log(`🎯 Retry attempt ${retryAttempt} (overall attempt ${attemptNumber}) for ${correlationId}`);
        
        const result = await operation();
        
        const recoveryTime = Date.now() - startTime;
        console.log(`✅ Recovery succeeded on retry ${retryAttempt} (attempt ${attemptNumber}) after ${recoveryTime}ms - ${correlationId}`);
        
        // Clear retry status on success
        if (context.imageId) {
          await this.clearImageRetryStatus(context.imageId);
        }
        
        return {
          success: true,
          attemptNumber,
          totalRetries: retryAttempt,
          recoveryTime,
          strategy: `retry-${errorClassification.type.toLowerCase()}`,
          result
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`⚠️ Retry ${retryAttempt} failed for ${correlationId}: ${lastError.message}`);
        
        // Re-classify error in case it's different
        const newClassification = this.classifyError(lastError);
        if (!newClassification.isRetryable) {
          console.warn(`🚫 Error became non-retryable: ${newClassification.type}`);
          break;
        }
      }
    }

    // All retries exhausted or error became non-retryable
    const recoveryTime = Date.now() - startTime;
    console.error(`❌ Recovery failed after ${attemptNumber} attempts (${finalStrategy.maxRetries} retries) - ${correlationId}`);

    // Mark as permanent failure
    if (context.imageId) {
      await this.markImageAsPermanentFailure(context.imageId, lastError!, errorClassification);
    }

    await this.logRecoveryFailure(context, lastError!, errorClassification, attemptNumber);

    return {
      success: false,
      attemptNumber,
      totalRetries: finalStrategy.maxRetries,
      finalError: `Max retries exceeded: ${lastError!.message}`,
      recoveryTime,
      strategy: `failed-${errorClassification.type.toLowerCase()}`
    };
  }

  /**
   * Get retry status for a specific image
   */
  async getImageRetryStatus(imageId: string): Promise<ImageRetryStatus | null> {
    try {
      const { data, error } = await this.supabase
        .from('images')
        .select(`
          id,
          original_filename,
          processing_status,
          retry_count,
          last_retry_at,
          error_message
        `)
        .eq('id', imageId)
        .single();

      if (error || !data) {
        return null;
      }

      // Parse error message to extract error type
      const errorType = this.extractErrorTypeFromMessage(data.error_message);
      const classification = this.errorClassifications.get(errorType);

      return {
        imageId,
        filename: data.original_filename,
        retryCount: data.retry_count || 0,
        maxRetries: classification?.maxRetries || this.defaultRetryStrategy.maxRetries,
        lastRetryAt: data.last_retry_at,
        lastErrorType: errorType,
        lastErrorMessage: data.error_message || '',
        retryStrategy: classification?.description || 'default',
        isRetryable: classification?.isRetryable ?? true,
        nextRetryAt: this.calculateNextRetryTime(data.last_retry_at, data.retry_count, classification)
      };

    } catch (error) {
      console.error('❌ Error getting image retry status:', error);
      return null;
    }
  }

  /**
   * Reset retry status for an image (used after successful processing)
   */
  async clearImageRetryStatus(imageId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('images')
        .update({
          retry_count: 0,
          last_retry_at: null,
          error_message: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', imageId);

      if (error) {
        console.warn(`⚠️ Failed to clear retry status for image ${imageId}: ${error.message}`);
      } else {
        console.log(`✅ Cleared retry status for image ${imageId}`);
      }

    } catch (error) {
      console.warn(`⚠️ Error clearing retry status for image ${imageId}:`, error);
    }
  }

  /**
   * Get overall recovery statistics
   */
  async getRecoveryStats(): Promise<{
    totalRecoveryAttempts: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    averageRecoveryTime: number;
    errorTypeBreakdown: Record<ErrorType, number>;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('images')
        .select('retry_count, error_message, processing_status')
        .gt('retry_count', 0);

      if (error) {
        console.warn('⚠️ Failed to get recovery stats:', error.message);
        return this.getEmptyStats();
      }

      const stats = {
        totalRecoveryAttempts: data?.length || 0,
        successfulRecoveries: data?.filter((img: any) => img.processing_status === 'completed').length || 0,
        failedRecoveries: data?.filter((img: any) => img.processing_status === 'error').length || 0,
        averageRecoveryTime: 0, // TODO: Calculate from logs
        errorTypeBreakdown: {} as Record<ErrorType, number>
      };

      // Count error types
      data?.forEach((img: any) => {
        if (img.error_message) {
          const errorType = this.extractErrorTypeFromMessage(img.error_message);
          stats.errorTypeBreakdown[errorType] = (stats.errorTypeBreakdown[errorType] || 0) + 1;
        }
      });

      return stats;

    } catch (error) {
      console.error('❌ Error getting recovery stats:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Initialize error classifications with retry strategies
   */
  private initializeErrorClassifications(): void {
    this.errorClassifications = new Map([
      ['GEMINI_API_ERROR', {
        type: 'GEMINI_API_ERROR',
        severity: 'high',
        isRetryable: true,
        maxRetries: 2,
        baseDelayMs: 5000,
        exponentialBackoff: true,
        description: 'Google Gemini API failures - retry with backoff'
      }],
      ['STORAGE_ACCESS_ERROR', {
        type: 'STORAGE_ACCESS_ERROR',
        severity: 'medium',
        isRetryable: true,
        maxRetries: 3,
        baseDelayMs: 2000,
        exponentialBackoff: true,
        description: 'Storage upload/download failures - retry aggressively'
      }],
      ['METADATA_EMBED_ERROR', {
        type: 'METADATA_EMBED_ERROR',
        severity: 'medium',
        isRetryable: true,
        maxRetries: 2,
        baseDelayMs: 1000,
        exponentialBackoff: false,
        description: 'XMP embedding failures - retry with fixed delay'
      }],
      ['DATABASE_ERROR', {
        type: 'DATABASE_ERROR',
        severity: 'high',
        isRetryable: true,
        maxRetries: 2,
        baseDelayMs: 3000,
        exponentialBackoff: true,
        description: 'Database operation failures - retry with caution'
      }],
      ['EMAIL_FUNCTION_ERROR', {
        type: 'EMAIL_FUNCTION_ERROR',
        severity: 'low',
        isRetryable: true,
        maxRetries: 3,
        baseDelayMs: 5000,
        exponentialBackoff: true,
        description: 'Email notification failures - retry aggressively'
      }],
      ['NETWORK_ERROR', {
        type: 'NETWORK_ERROR',
        severity: 'medium',
        isRetryable: true,
        maxRetries: 3,
        baseDelayMs: 2000,
        exponentialBackoff: true,
        description: 'Network connectivity issues - retry with backoff'
      }],
      ['TIMEOUT_ERROR', {
        type: 'TIMEOUT_ERROR',
        severity: 'medium',
        isRetryable: true,
        maxRetries: 2,
        baseDelayMs: 10000,
        exponentialBackoff: true,
        description: 'Operation timeout - retry with longer delays'
      }],
      ['DEPLOYMENT_SYNC_ERROR', {
        type: 'DEPLOYMENT_SYNC_ERROR',
        severity: 'critical',
        isRetryable: false,
        maxRetries: 0,
        baseDelayMs: 0,
        exponentialBackoff: false,
        description: 'Function deployment mismatch - manual intervention required'
      }],
      ['VALIDATION_ERROR', {
        type: 'VALIDATION_ERROR',
        severity: 'high',
        isRetryable: false,
        maxRetries: 0,
        baseDelayMs: 0,
        exponentialBackoff: false,
        description: 'Data validation failure - fix required'
      }],
      ['UNKNOWN_ERROR', {
        type: 'UNKNOWN_ERROR',
        severity: 'medium',
        isRetryable: true,
        maxRetries: 1,
        baseDelayMs: 3000,
        exponentialBackoff: false,
        description: 'Unknown error type - limited retry'
      }]
    ]);
  }

  /**
   * Classify an error to determine retry strategy
   */
  private classifyError(error: Error): ErrorClassification {
    const message = error.message.toLowerCase();
    
    // Pattern matching for error classification
    if (message.includes('gemini') || message.includes('google') || message.includes('ai analysis')) {
      return this.errorClassifications.get('GEMINI_API_ERROR')!;
    }
    
    if (message.includes('storage') || message.includes('upload') || message.includes('download')) {
      return this.errorClassifications.get('STORAGE_ACCESS_ERROR')!;
    }
    
    if (message.includes('metadata') || message.includes('xmp') || message.includes('embed')) {
      return this.errorClassifications.get('METADATA_EMBED_ERROR')!;
    }
    
    if (message.includes('database') || message.includes('sql') || message.includes('query')) {
      return this.errorClassifications.get('DATABASE_ERROR')!;
    }
    
    if (message.includes('email') || message.includes('notification')) {
      return this.errorClassifications.get('EMAIL_FUNCTION_ERROR')!;
    }
    
    if (message.includes('network') || message.includes('connection') || message.includes('fetch')) {
      return this.errorClassifications.get('NETWORK_ERROR')!;
    }
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return this.errorClassifications.get('TIMEOUT_ERROR')!;
    }
    
    if (message.includes('deployment') || message.includes('function not found')) {
      return this.errorClassifications.get('DEPLOYMENT_SYNC_ERROR')!;
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return this.errorClassifications.get('VALIDATION_ERROR')!;
    }
    
    return this.errorClassifications.get('UNKNOWN_ERROR')!;
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number, strategy: RetryStrategy): number {
    let delay = strategy.baseDelayMs;
    
    if (strategy.exponentialBackoff) {
      delay = strategy.baseDelayMs * Math.pow(2, attempt - 1);
    }
    
    // Apply maximum delay cap
    delay = Math.min(delay, strategy.maxDelayMs);
    
    // Add jitter to prevent thundering herd
    if (strategy.jitterEnabled) {
      delay = delay + (Math.random() * delay * 0.1);
    }
    
    return Math.floor(delay);
  }

  /**
   * Update retry status for an image in the database
   */
  private async updateImageRetryStatus(
    imageId: string,
    retryAttempt: number,
    errorClassification: ErrorClassification,
    errorMessage: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('images')
        .update({
          processing_status: 'retrying',
          retry_count: retryAttempt,
          last_retry_at: new Date().toISOString(),
          error_message: `${errorClassification.type}: ${errorMessage}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', imageId);

      if (error) {
        console.warn(`⚠️ Failed to update retry status: ${error.message}`);
      }

    } catch (error) {
      console.warn(`⚠️ Error updating retry status:`, error);
    }
  }

  /**
   * Mark image as permanent failure after retry exhaustion
   */
  private async markImageAsPermanentFailure(
    imageId: string,
    error: Error,
    errorClassification: ErrorClassification
  ): Promise<void> {
    try {
      const { error: updateError } = await this.supabase
        .from('images')
        .update({
          processing_status: 'error',
          error_message: `Max retries exceeded (${errorClassification.type}): ${error.message}`,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', imageId);

      if (updateError) {
        console.error(`❌ Failed to mark image as permanent failure: ${updateError.message}`);
      } else {
        console.log(`❌ Marked image ${imageId} as permanent failure`);
      }

    } catch (error) {
      console.error(`❌ Error marking image as permanent failure:`, error);
    }
  }

  /**
   * Log non-retryable error for monitoring
   */
  private async logNonRetryableError(
    context: ErrorContext,
    error: Error,
    classification: ErrorClassification
  ): Promise<void> {
    console.error(`🚫 Non-retryable ${classification.type} (${classification.severity}): ${error.message}`);
    console.error(`📋 Context: ${JSON.stringify(context)}`);
    
    // TODO: Send to monitoring system
  }

  /**
   * Log recovery failure for monitoring
   */
  private async logRecoveryFailure(
    context: ErrorContext,
    error: Error,
    classification: ErrorClassification,
    totalAttempts: number
  ): Promise<void> {
    console.error(`❌ Recovery failed for ${classification.type} after ${totalAttempts} attempts`);
    console.error(`📋 Final error: ${error.message}`);
    console.error(`📋 Context: ${JSON.stringify(context)}`);
    
    // TODO: Send to monitoring system
  }

  /**
   * Extract error type from stored error message
   */
  private extractErrorTypeFromMessage(message: string): ErrorType {
    if (!message) return 'UNKNOWN_ERROR';
    
    const colonIndex = message.indexOf(':');
    if (colonIndex > 0) {
      const prefix = message.substring(0, colonIndex).toUpperCase();
      if (this.errorClassifications.has(prefix as ErrorType)) {
        return prefix as ErrorType;
      }
    }
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * Calculate next retry time based on last retry and count
   */
  private calculateNextRetryTime(
    lastRetryAt: string | null,
    retryCount: number | null,
    classification?: ErrorClassification
  ): string | undefined {
    if (!lastRetryAt || !retryCount || !classification) {
      return undefined;
    }
    
    const lastRetry = new Date(lastRetryAt);
    const delay = this.calculateRetryDelay(retryCount + 1, {
      ...this.defaultRetryStrategy,
      baseDelayMs: classification.baseDelayMs,
      exponentialBackoff: classification.exponentialBackoff
    });
    
    return new Date(lastRetry.getTime() + delay).toISOString();
  }

  /**
   * Get empty statistics object
   */
  private getEmptyStats() {
    return {
      totalRecoveryAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      averageRecoveryTime: 0,
      errorTypeBreakdown: {} as Record<ErrorType, number>
    };
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}