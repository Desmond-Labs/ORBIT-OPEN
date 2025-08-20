// ORBIT Orchestrator - Tier 2 Intelligent Recovery System
// Claude Code SDK powered workflow orchestration with self-healing capabilities

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrchestratorRequest {
  orderId: string;
  action?: 'process' | 'recover' | 'validate' | 'cleanup';
  analysisType?: 'product' | 'lifestyle';
  correlationId?: string;
  escalationReason?: string;
}

interface WorkflowContext {
  orderId: string;
  correlationId: string;
  startTime: number;
  currentPhase: string;
  totalImages: number;
  processedImages: number;
  failedImages: number;
  retryCount: number;
  errors: Array<{
    phase: string;
    error: string;
    timestamp: number;
    errorType: string;
  }>;
}

// Initialize Supabase client
function initializeSupabase() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('sb_secret_key') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Workflow Context Management
class WorkflowContextManager {
  private context: WorkflowContext;
  
  constructor(orderId: string, correlationId: string) {
    this.context = {
      orderId,
      correlationId,
      startTime: Date.now(),
      currentPhase: 'initialization',
      totalImages: 0,
      processedImages: 0,
      failedImages: 0,
      retryCount: 0,
      errors: []
    };
  }
  
  updatePhase(phase: string) {
    this.context.currentPhase = phase;
    console.log(`🔄 Phase Transition: ${phase} (correlation: ${this.context.correlationId})`);
  }
  
  addError(phase: string, error: string, errorType: string) {
    this.context.errors.push({
      phase,
      error,
      errorType,
      timestamp: Date.now()
    });
    console.error(`❌ Error in ${phase}: ${errorType} - ${error}`);
  }
  
  incrementRetry() {
    this.context.retryCount++;
    console.log(`🔄 Retry count increased to: ${this.context.retryCount}`);
  }
  
  setTotalImages(count: number) {
    this.context.totalImages = count;
  }
  
  incrementProcessedImages() {
    this.context.processedImages++;
  }
  
  incrementFailedImages() {
    this.context.failedImages++;
  }
  
  getContext(): WorkflowContext {
    return { ...this.context };
  }
  
  getDuration(): number {
    return Date.now() - this.context.startTime;
  }
}

// Phase 0: Pre-flight System Validation (ORBIT Compliance)
async function preflightValidation(supabase: any, context: WorkflowContextManager): Promise<boolean> {
  context.updatePhase('preflight-validation');
  
  try {
    console.log('🔍 PHASE 0: Pre-flight System Validation');
    
    // Step 0A: Initialize Progress Tracking
    console.log('📋 Step 0A: Progress tracking initialized via WorkflowContextManager');
    
    // Step 0B: Validate Deployment Status
    console.log('🚀 Step 0B: Validating deployment status');
    const deploymentCheck = {
      hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
      hasSecretKey: !!Deno.env.get('sb_secret_key'),
      hasGoogleApiKey: !!Deno.env.get('GOOGLE_API_KEY'),
      supabaseConnected: !!supabase
    };
    
    console.log('🔍 Deployment validation:', deploymentCheck);
    
    const missingComponents = Object.entries(deploymentCheck)
      .filter(([key, value]) => !value)
      .map(([key]) => key);
    
    if (missingComponents.length > 0) {
      context.addError('preflight-validation', `Missing components: ${missingComponents.join(', ')}`, 'DEPLOYMENT_SYNC_ERROR');
      return false;
    }
    
    // Step 0C: Validate Storage Accessibility
    console.log('📁 Step 0C: Validating storage accessibility');
    try {
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      if (bucketError) {
        context.addError('preflight-validation', `Storage access failed: ${bucketError.message}`, 'STORAGE_ACCESS_ERROR');
        return false;
      }
      
      const orbitBucket = buckets?.find((bucket: any) => bucket.name === 'orbit-images');
      if (!orbitBucket) {
        context.addError('preflight-validation', 'orbit-images bucket not found', 'STORAGE_ACCESS_ERROR');
        return false;
      }
      
      console.log('✅ Storage accessibility validated');
    } catch (storageError) {
      context.addError('preflight-validation', `Storage validation failed: ${storageError.message}`, 'STORAGE_ACCESS_ERROR');
      return false;
    }
    
    // Step 0D: Validate Database Connectivity
    console.log('🗄️ Step 0D: Validating database connectivity');
    try {
      const { data: testQuery, error: dbError } = await supabase
        .from('orders')
        .select('count')
        .limit(1);
      
      if (dbError) {
        context.addError('preflight-validation', `Database connectivity failed: ${dbError.message}`, 'DATABASE_ERROR');
        return false;
      }
      
      console.log('✅ Database connectivity validated');
    } catch (dbError) {
      context.addError('preflight-validation', `Database validation failed: ${dbError.message}`, 'DATABASE_ERROR');
      return false;
    }
    
    console.log('✅ PHASE 0 COMPLETED: All pre-flight validations passed');
    return true;
    
  } catch (error) {
    context.addError('preflight-validation', error.message, 'UNKNOWN_ERROR');
    return false;
  }
}

// Phase 1: Order Discovery & Preparation (ORBIT Compliance)
async function orderDiscoveryAndPreparation(supabase: any, orderId: string, context: WorkflowContextManager): Promise<any> {
  context.updatePhase('order-discovery');
  
  try {
    console.log('🔍 PHASE 1: Order Discovery & Preparation');
    
    // Step 1: Find Order
    console.log(`🔍 Step 1: Finding order ${orderId}`);
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    
    if (orderError || !order) {
      context.addError('order-discovery', `Order not found: ${orderError?.message}`, 'DATABASE_ERROR');
      return null;
    }
    
    // Step 2: Validate Order State
    console.log('🔍 Step 2: Validating order state');
    if (order.payment_status !== 'completed' && order.payment_status !== 'succeeded') {
      context.addError('order-discovery', `Invalid payment status: ${order.payment_status}`, 'UNKNOWN_ERROR');
      return null;
    }
    
    // Step 3: Discover Images
    console.log('🔍 Step 3: Discovering images for order');
    const { data: images, error: imagesError } = await supabase
      .from('images')
      .select('*')
      .eq('order_id', orderId);
    
    if (imagesError) {
      context.addError('order-discovery', `Failed to get images: ${imagesError.message}`, 'DATABASE_ERROR');
      return null;
    }
    
    context.setTotalImages(images?.length || 0);
    console.log(`📊 Found ${context.getContext().totalImages} images for order ${orderId}`);
    
    // Step 4: Verify Original Files Exist (using storage validation)
    console.log('📁 Step 4: Verifying original files in storage');
    const storageFolder = `${orderId}_${order.user_id}/original`;
    
    try {
      const { data: storageFiles, error: storageError } = await supabase.storage
        .from('orbit-images')
        .list(storageFolder);
      
      if (storageError) {
        context.addError('order-discovery', `Storage verification failed: ${storageError.message}`, 'STORAGE_ACCESS_ERROR');
        return null;
      }
      
      console.log(`📁 Found ${storageFiles?.length || 0} files in storage folder: ${storageFolder}`);
      
      // Verify storage file count matches database image count
      if ((storageFiles?.length || 0) !== images.length) {
        context.addError('order-discovery', 
          `File mismatch: Database has ${images.length} images, storage has ${storageFiles?.length || 0}`, 
          'STORAGE_ACCESS_ERROR');
        return null;
      }
      
    } catch (storageError) {
      context.addError('order-discovery', `Storage access failed: ${storageError.message}`, 'STORAGE_ACCESS_ERROR');
      return null;
    }
    
    console.log('✅ PHASE 1 COMPLETED: Order discovery successful');
    return { order, images };
    
  } catch (error) {
    context.addError('order-discovery', error.message, 'UNKNOWN_ERROR');
    return null;
  }
}

// Phase 2: Per-Image Atomic Processing (ORBIT Compliance)
async function processImagesAtomically(supabase: any, orderData: any, context: WorkflowContextManager): Promise<boolean> {
  context.updatePhase('atomic-image-processing');
  
  try {
    console.log('🔄 PHASE 2: Per-Image Atomic Processing');
    
    const { order, images } = orderData;
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const authToken = Deno.env.get('sb_secret_key') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      console.log(`\n🖼️ Processing image ${i + 1}/${images.length}: ${image.original_filename}`);
      
      try {
        // Step A: Analyze with Gemini AI via remote MCP (using direct storage path)
        console.log('🤖 Step A: Analyzing with Gemini AI');
        const analysisResponse = await fetch(`${supabaseUrl}/functions/v1/mcp-ai-analysis`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'apikey': authToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image_path: image.storage_path_original,
            analysis_type: 'lifestyle'
          })
        });
        
        if (!analysisResponse.ok) {
          throw new Error(`AI analysis failed: HTTP ${analysisResponse.status}`);
        }
        
        const analysisResult = await analysisResponse.json();
        console.log('✅ AI analysis completed');
        
        // Step C: Store analysis with verification
        console.log('💾 Step C: Storing analysis in database');
        const { error: updateError } = await supabase
          .from('images')
          .update({
            gemini_analysis_raw: JSON.stringify(analysisResult),
            processing_status: 'processing'
          })
          .eq('id', image.id);
        
        if (updateError) {
          throw new Error(`Failed to store analysis: ${updateError.message}`);
        }
        
        // Step D: Embed metadata via remote MCP
        console.log('🏷️ Step D: Embedding metadata into image');
        const processedFilename = `${image.original_filename.replace(/\.[^/.]+$/, '')}_processed.jpg`;
        const outputPath = `${order.id}_${order.user_id}/processed/${processedFilename}`;
        
        const metadataResponse = await fetch(`${supabaseUrl}/functions/v1/mcp-metadata`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'apikey': authToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tool_name: 'process_image_metadata',
            parameters: {
              image_path: image.storage_path_original,
              analysis_result: analysisResult,
              output_path: outputPath
            }
          })
        });
        
        if (!metadataResponse.ok) {
          throw new Error(`Metadata embedding failed: HTTP ${metadataResponse.status}`);
        }
        
        const metadataResult = await metadataResponse.json();
        console.log('✅ Metadata embedding completed');
        
        // Extract the actual processed file path from the metadata response
        const actualProcessedPath = metadataResult.processed_file_path;
        if (!actualProcessedPath) {
          throw new Error('Metadata response missing processed_file_path');
        }
        
        // Step E: Verify processed file exists using the actual path
        console.log('🔍 Step E: Verifying processed file in storage');
        const actualFilename = actualProcessedPath.split('/').pop();
        const { data: verifyFiles, error: verifyError } = await supabase.storage
          .from('orbit-images')
          .list(`${order.id}_${order.user_id}/processed`);
        
        if (verifyError) {
          throw new Error(`Storage verification failed: ${verifyError.message}`);
        }
        
        const processedFileExists = verifyFiles?.some(file => file.name === actualFilename);
        if (!processedFileExists) {
          throw new Error(`Processed file not found in storage: ${actualFilename}`);
        }
        
        // Step F: Update database with processed path
        console.log('📝 Step F: Updating database with processed path');
        const { error: finalUpdateError } = await supabase
          .from('images')
          .update({
            storage_path_processed: actualProcessedPath,
            processing_status: 'complete',
            processed_at: new Date().toISOString()
          })
          .eq('id', image.id);
        
        if (finalUpdateError) {
          throw new Error(`Failed to update processed path: ${finalUpdateError.message}`);
        }
        
        context.incrementProcessedImages();
        console.log(`✅ Image ${i + 1}/${images.length} completed successfully`);
        
      } catch (imageError) {
        console.error(`❌ Error processing image ${image.original_filename}:`, imageError.message);
        context.addError('image-processing', `Image ${image.original_filename}: ${imageError.message}`, classifyError(imageError, 'image-processing'));
        context.incrementFailedImages();
        
        // Mark image as error but continue with other images
        await supabase
          .from('images')
          .update({
            processing_status: 'error',
            error_message: imageError.message
          })
          .eq('id', image.id);
      }
    }
    
    console.log(`\n📊 PHASE 2 SUMMARY: ${context.getContext().processedImages} processed, ${context.getContext().failedImages} failed`);
    return context.getContext().processedImages > 0; // Success if at least one image processed
    
  } catch (error) {
    context.addError('atomic-processing', error.message, 'UNKNOWN_ERROR');
    return false;
  }
}

// Phase 3: Order Finalization & Verification (ORBIT Compliance)
async function finalizeOrder(supabase: any, orderId: string, context: WorkflowContextManager): Promise<boolean> {
  context.updatePhase('order-finalization');
  
  try {
    console.log('🏁 PHASE 3: Order Finalization & Verification');
    
    // Step 1: Verify all images completion status
    console.log('🔍 Step 1: Verifying all images completion status');
    const { data: imageStats, error: statsError } = await supabase
      .from('images')
      .select('id, processing_status, storage_path_processed')
      .eq('order_id', orderId);
    
    if (statsError) {
      context.addError('finalization', `Failed to get image stats: ${statsError.message}`, 'DATABASE_ERROR');
      return false;
    }
    
    const totalImages = imageStats.length;
    const completedImages = imageStats.filter(img => img.processing_status === 'complete').length;
    const hasProcessedPaths = imageStats.filter(img => img.storage_path_processed !== null).length;
    
    console.log(`📊 Image Stats: ${completedImages}/${totalImages} completed, ${hasProcessedPaths}/${totalImages} have processed paths`);
    
    // Allow partial success but require at least one successful image
    if (completedImages === 0) {
      context.addError('finalization', 'No images were successfully processed', 'UNKNOWN_ERROR');
      return false;
    }
    
    // Step 2: Verify processed files in storage
    console.log('📁 Step 2: Verifying processed files in storage');
    const { data: order } = await supabase
      .from('orders')
      .select('user_id')
      .eq('id', orderId)
      .single();
    
    const { data: processedFiles, error: storageError } = await supabase.storage
      .from('orbit-images')
      .list(`${orderId}_${order.user_id}/processed`);
    
    if (storageError) {
      context.addError('finalization', `Storage verification failed: ${storageError.message}`, 'STORAGE_ACCESS_ERROR');
      return false;
    }
    
    console.log(`📁 Found ${processedFiles?.length || 0} files in processed folder`);
    
    // Step 3: Complete order processing
    console.log('✅ Step 3: Marking order as completed');
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        processing_stage: 'completed',
        processing_completion_percentage: 100,
        order_status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', orderId);
    
    if (orderUpdateError) {
      context.addError('finalization', `Failed to mark order complete: ${orderUpdateError.message}`, 'DATABASE_ERROR');
      return false;
    }
    
    console.log('✅ PHASE 3 COMPLETED: Order finalization successful');
    return true;
    
  } catch (error) {
    context.addError('finalization', error.message, 'UNKNOWN_ERROR');
    return false;
  }
}

// Phase 4: Email & Cleanup (ORBIT Compliance)
async function emailAndCleanup(supabase: any, orderId: string, context: WorkflowContextManager): Promise<boolean> {
  context.updatePhase('email-and-cleanup');
  
  try {
    console.log('📧 PHASE 4: Email & Cleanup');
    
    // Step 1: Check if email was already sent
    console.log('🔍 Step 1: Checking email status');
    const { data: orderStatus, error: statusError } = await supabase
      .from('orders')
      .select('email_sent, processing_stage')
      .eq('id', orderId)
      .single();
    
    if (statusError) {
      context.addError('email-cleanup', `Failed to check order status: ${statusError.message}`, 'DATABASE_ERROR');
      return false;
    }
    
    if (orderStatus.email_sent) {
      console.log('✅ Email already sent, skipping email step');
      return true;
    }
    
    // Step 2: Send completion email
    console.log('📧 Step 2: Sending completion email');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const authToken = Deno.env.get('sb_secret_key') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-order-completion-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'apikey': authToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: orderId // Use camelCase as required by the function
      })
    });
    
    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      context.addError('email-cleanup', `Email send failed: HTTP ${emailResponse.status} - ${errorText}`, 'EMAIL_FUNCTION_ERROR');
      return false;
    }
    
    // Step 3: Mark email as sent
    console.log('✅ Step 3: Marking email as sent');
    const { error: emailUpdateError } = await supabase
      .from('orders')
      .update({ email_sent: true })
      .eq('id', orderId);
    
    if (emailUpdateError) {
      context.addError('email-cleanup', `Failed to mark email as sent: ${emailUpdateError.message}`, 'DATABASE_ERROR');
      return false;
    }
    
    console.log('✅ PHASE 4 COMPLETED: Email sent successfully');
    return true;
    
  } catch (error) {
    context.addError('email-cleanup', error.message, 'UNKNOWN_ERROR');
    return false;
  }
}

// Error Classification System (Enhanced from Tier 1)
enum ErrorType {
  GEMINI_API_ERROR = 'GEMINI_API_ERROR',
  STORAGE_ACCESS_ERROR = 'STORAGE_ACCESS_ERROR', 
  METADATA_EMBED_ERROR = 'METADATA_EMBED_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EMAIL_FUNCTION_ERROR = 'EMAIL_FUNCTION_ERROR',
  DEPLOYMENT_SYNC_ERROR = 'DEPLOYMENT_SYNC_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

function classifyError(error: Error, context: string): ErrorType {
  const errorMessage = error.message.toLowerCase();
  
  if (errorMessage.includes('gemini') || errorMessage.includes('google api') || context.includes('ai-analysis')) {
    return ErrorType.GEMINI_API_ERROR;
  }
  if (errorMessage.includes('storage') || errorMessage.includes('bucket') || context.includes('storage')) {
    return ErrorType.STORAGE_ACCESS_ERROR;
  }
  if (errorMessage.includes('metadata') || errorMessage.includes('xmp') || context.includes('metadata')) {
    return ErrorType.METADATA_EMBED_ERROR;
  }
  if (errorMessage.includes('database') || errorMessage.includes('sql') || context.includes('database')) {
    return ErrorType.DATABASE_ERROR;
  }
  if (errorMessage.includes('email') || context.includes('email')) {
    return ErrorType.EMAIL_FUNCTION_ERROR;
  }
  if (errorMessage.includes('deployment') || errorMessage.includes('function not found')) {
    return ErrorType.DEPLOYMENT_SYNC_ERROR;
  }
  
  return ErrorType.UNKNOWN_ERROR;
}

// Self-Healing & Recovery System
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  backoffMultiplier: number;
  maxDelay: number;
}

const RETRY_CONFIGS: Record<ErrorType, RetryConfig> = {
  [ErrorType.GEMINI_API_ERROR]: { maxRetries: 2, baseDelay: 1000, backoffMultiplier: 2, maxDelay: 10000 },
  [ErrorType.STORAGE_ACCESS_ERROR]: { maxRetries: 3, baseDelay: 500, backoffMultiplier: 1.5, maxDelay: 5000 },
  [ErrorType.METADATA_EMBED_ERROR]: { maxRetries: 2, baseDelay: 1000, backoffMultiplier: 2, maxDelay: 8000 },
  [ErrorType.DATABASE_ERROR]: { maxRetries: 2, baseDelay: 800, backoffMultiplier: 2, maxDelay: 6000 },
  [ErrorType.EMAIL_FUNCTION_ERROR]: { maxRetries: 3, baseDelay: 2000, backoffMultiplier: 1.5, maxDelay: 15000 },
  [ErrorType.DEPLOYMENT_SYNC_ERROR]: { maxRetries: 0, baseDelay: 0, backoffMultiplier: 1, maxDelay: 0 }, // No retry for deployment issues
  [ErrorType.UNKNOWN_ERROR]: { maxRetries: 1, baseDelay: 1000, backoffMultiplier: 2, maxDelay: 5000 }
};

class SelfHealingExecutor {
  private context: WorkflowContextManager;
  
  constructor(context: WorkflowContextManager) {
    this.context = context;
  }
  
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: string = ''
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= 3; attempt++) { // Max 3 attempts total
      try {
        if (attempt > 0) {
          console.log(`🔄 Retry attempt ${attempt} for ${operationName}`);
          this.context.incrementRetry();
        }
        
        const result = await operation();
        
        if (attempt > 0) {
          console.log(`✅ Recovery successful for ${operationName} after ${attempt} retries`);
        }
        
        return result;
        
      } catch (error) {
        lastError = error as Error;
        const errorType = classifyError(lastError, context);
        const retryConfig = RETRY_CONFIGS[errorType];
        
        console.error(`❌ Attempt ${attempt + 1} failed for ${operationName}: ${lastError.message}`);
        this.context.addError(`retry-${attempt}`, `${operationName}: ${lastError.message}`, errorType);
        
        // Check if we should retry
        if (attempt >= retryConfig.maxRetries) {
          console.error(`🚫 Max retries (${retryConfig.maxRetries}) exceeded for ${operationName}`);
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt),
          retryConfig.maxDelay
        );
        
        console.log(`⏳ Waiting ${delay}ms before retry for ${operationName}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error(`Operation ${operationName} failed after all retries`);
  }
  
  async rollbackImageProcessing(supabase: any, imageId: string, orderId: string, userId: string): Promise<void> {
    console.log(`🔄 Rolling back image processing for image ${imageId}`);
    
    try {
      // Reset database status
      await supabase
        .from('images')
        .update({
          processing_status: 'pending',
          storage_path_processed: null,
          error_message: null,
          processed_at: null
        })
        .eq('id', imageId);
      
      // Attempt to clean up any partial processed files
      try {
        const { data: processedFiles } = await supabase.storage
          .from('orbit-images')
          .list(`${orderId}_${userId}/processed`);
        
        if (processedFiles && processedFiles.length > 0) {
          // Find files that might belong to this failed image
          const imageName = imageId.substring(0, 8); // Use first 8 chars as identifier
          const filesToDelete = processedFiles
            .filter(file => file.name.includes(imageName))
            .map(file => `${orderId}_${userId}/processed/${file.name}`);
          
          if (filesToDelete.length > 0) {
            await supabase.storage
              .from('orbit-images')
              .remove(filesToDelete);
            
            console.log(`🗑️ Cleaned up ${filesToDelete.length} partial files for image ${imageId}`);
          }
        }
      } catch (cleanupError) {
        console.warn(`⚠️ Cleanup warning for image ${imageId}: ${cleanupError.message}`);
      }
      
      console.log(`✅ Rollback completed for image ${imageId}`);
      
    } catch (rollbackError) {
      console.error(`🚨 Rollback failed for image ${imageId}: ${rollbackError.message}`);
      throw rollbackError;
    }
  }
  
  async validateSystemHealth(supabase: any): Promise<boolean> {
    console.log('🏥 Performing system health validation');
    
    try {
      // Check database connectivity
      await this.executeWithRetry(async () => {
        const { data, error } = await supabase.from('orders').select('count').limit(1);
        if (error) throw error;
        return data;
      }, 'database-health-check', 'database');
      
      // Check storage connectivity
      await this.executeWithRetry(async () => {
        const { data, error } = await supabase.storage.listBuckets();
        if (error) throw error;
        return data;
      }, 'storage-health-check', 'storage');
      
      // Check edge function connectivity
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const authToken = Deno.env.get('sb_secret_key') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      await this.executeWithRetry(async () => {
        const response = await fetch(`${supabaseUrl}/functions/v1/mcp-ai-analysis`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ test: 'health_check' })
        });
        
        // Accept both 200 (success) and 400 (bad request) as function is responding
        if (!response.ok && response.status !== 400) {
          throw new Error(`Health check failed: HTTP ${response.status}`);
        }
        
        return true;
      }, 'mcp-function-health-check', 'deployment');
      
      console.log('✅ System health validation passed');
      return true;
      
    } catch (healthError) {
      console.error(`🚨 System health validation failed: ${healthError.message}`);
      this.context.addError('health-check', healthError.message, classifyError(healthError, 'health-check'));
      return false;
    }
  }
  
  async recoverFromOrderFailure(supabase: any, orderId: string): Promise<boolean> {
    console.log(`🏥 Attempting order recovery for ${orderId}`);
    
    try {
      // Reset order status to allow reprocessing
      await supabase
        .from('orders')
        .update({
          processing_stage: 'pending',
          order_status: 'paid',
          error_message: null,
          processing_completion_percentage: 0
        })
        .eq('id', orderId);
      
      // Reset all images in the order
      await supabase
        .from('images')
        .update({
          processing_status: 'pending',
          storage_path_processed: null,
          error_message: null,
          processed_at: null
        })
        .eq('order_id', orderId);
      
      console.log(`✅ Order ${orderId} reset for reprocessing`);
      return true;
      
    } catch (recoveryError) {
      console.error(`🚨 Order recovery failed for ${orderId}: ${recoveryError.message}`);
      this.context.addError('order-recovery', recoveryError.message, classifyError(recoveryError, 'recovery'));
      return false;
    }
  }
}

// Main Orchestrator Function
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🤖 ORBIT Orchestrator - Tier 2 Intelligent Recovery System');
    console.log('🤖 Claude Code SDK powered workflow orchestration');
    
    const requestBody = await req.json();
    const { orderId, action = 'process', analysisType = 'lifestyle', correlationId, escalationReason }: OrchestratorRequest = requestBody;
    
    if (!orderId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Order ID is required',
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Initialize systems
    const supabase = initializeSupabase();
    const workflowCorrelationId = correlationId || `orch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const context = new WorkflowContextManager(orderId, workflowCorrelationId);
    const selfHealing = new SelfHealingExecutor(context);
    
    console.log(`🎯 Orchestration started: ${action} for order ${orderId}`);
    console.log(`🎯 Correlation ID: ${workflowCorrelationId}`);
    if (escalationReason) {
      console.log(`🚨 Escalation Reason: ${escalationReason}`);
    }
    
    // Phase 0: Pre-flight System Validation with Self-Healing
    const preflightPassed = await selfHealing.executeWithRetry(
      () => preflightValidation(supabase, context),
      'pre-flight-validation',
      'system'
    );
    
    if (!preflightPassed) {
      // Attempt system health recovery
      console.log('🏥 Attempting system health recovery');
      const healthRecovered = await selfHealing.validateSystemHealth(supabase);
      
      if (!healthRecovered) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Pre-flight validation failed and system health recovery unsuccessful',
          context: context.getContext(),
          timestamp: new Date().toISOString()
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Retry pre-flight after health recovery
      const retryPreflight = await preflightValidation(supabase, context);
      if (!retryPreflight) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Pre-flight validation failed after health recovery',
          context: context.getContext(),
          timestamp: new Date().toISOString()
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Phase 1: Order Discovery & Preparation with Self-Healing
    const orderData = await selfHealing.executeWithRetry(
      () => orderDiscoveryAndPreparation(supabase, orderId, context),
      'order-discovery',
      'database'
    );
    
    if (!orderData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Order discovery failed after retries',
        context: context.getContext(),
        timestamp: new Date().toISOString()
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Phase 2: Per-Image Atomic Processing with Self-Healing
    const processingSuccess = await selfHealing.executeWithRetry(
      () => processImagesAtomically(supabase, orderData, context),
      'image-processing',
      'ai-analysis'
    );
    
    if (!processingSuccess) {
      // Attempt order recovery if processing completely failed
      console.log('🏥 Attempting order recovery after processing failure');
      const recoveryAttempted = await selfHealing.recoverFromOrderFailure(supabase, orderId);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Image processing failed after retries',
        recovery_attempted: recoveryAttempted,
        context: context.getContext(),
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Phase 3: Order Finalization & Verification with Self-Healing
    const finalizationSuccess = await selfHealing.executeWithRetry(
      () => finalizeOrder(supabase, orderId, context),
      'order-finalization',
      'database'
    );
    
    if (!finalizationSuccess) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Order finalization failed after retries',
        context: context.getContext(),
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Phase 4: Email & Cleanup with Self-Healing
    const emailSuccess = await selfHealing.executeWithRetry(
      () => emailAndCleanup(supabase, orderId, context),
      'email-notification',
      'email'
    ).catch((emailError) => {
      // Don't fail the entire operation if only email fails after retries
      console.warn('⚠️ Email notification failed after retries, but order processing completed successfully');
      console.error('Email Error:', emailError.message);
      return false;
    });
    
    // Return complete success
    return new Response(JSON.stringify({
      success: true,
      message: 'ORBIT orchestration completed successfully',
      action,
      orderId,
      analysisType,
      correlationId: workflowCorrelationId,
      context: context.getContext(),
      results: {
        preflightPassed: true,
        orderDiscovered: true,
        imagesProcessed: context.getContext().processedImages,
        imagesFailed: context.getContext().failedImages,
        orderFinalized: finalizationSuccess,
        emailSent: emailSuccess,
        totalRetries: context.getContext().retryCount,
        selfHealingActivated: context.getContext().retryCount > 0
      },
      phases: {
        phase0: 'Pre-flight validation completed',
        phase1: 'Order discovery completed',
        phase2: `Image processing completed (${context.getContext().processedImages}/${context.getContext().totalImages})`,
        phase3: 'Order finalization completed',
        phase4: emailSuccess ? 'Email sent successfully' : 'Email failed (non-critical)'
      },
      duration_ms: context.getDuration(),
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('🚨 Orchestrator Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      errorName: error.name,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

console.log('🤖 ORBIT Orchestrator (Tier 2) - Claude Code SDK powered Edge Function ready');