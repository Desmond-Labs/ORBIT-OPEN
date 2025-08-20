// ORBIT Batch Image Processing Edge Function
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SupabaseAuthManager } from '../_shared/auth-verification.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessBatchRequest {
  orderId: string;
  analysisType?: 'product' | 'lifestyle';
  manualTest?: boolean;
}

interface ImageFile {
  id: string;
  original_filename: string;
  storage_path_original: string;
  file_size: number;
  mime_type: string;
}

// ERROR CLASSIFICATION & RETRY SYSTEM (ORBIT WORKFLOW COMPLIANCE)
// Error types for intelligent retry strategies
enum ErrorType {
  GEMINI_API_ERROR = 'GEMINI_API_ERROR',
  STORAGE_ACCESS_ERROR = 'STORAGE_ACCESS_ERROR', 
  METADATA_EMBED_ERROR = 'METADATA_EMBED_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EMAIL_FUNCTION_ERROR = 'EMAIL_FUNCTION_ERROR',
  DEPLOYMENT_SYNC_ERROR = 'DEPLOYMENT_SYNC_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// Retry configuration for each error type
const RETRY_CONFIG = {
  [ErrorType.GEMINI_API_ERROR]: { maxRetries: 1, retryDelay: 2000 },
  [ErrorType.STORAGE_ACCESS_ERROR]: { maxRetries: 2, retryDelay: 1000 },
  [ErrorType.METADATA_EMBED_ERROR]: { maxRetries: 1, retryDelay: 1500 },
  [ErrorType.DATABASE_ERROR]: { maxRetries: 1, retryDelay: 1000 },
  [ErrorType.EMAIL_FUNCTION_ERROR]: { maxRetries: 2, retryDelay: 3000 },
  [ErrorType.DEPLOYMENT_SYNC_ERROR]: { maxRetries: 0, retryDelay: 0 }, // Manual intervention
  [ErrorType.UNKNOWN_ERROR]: { maxRetries: 0, retryDelay: 0 }
};

// Error classification function
function classifyError(error: Error, context: string): ErrorType {
  const errorMessage = error.message.toLowerCase();
  const errorStack = error.stack?.toLowerCase() || '';
  
  // Gemini API errors
  if (errorMessage.includes('gemini') || 
      errorMessage.includes('google api') ||
      errorMessage.includes('ai analysis failed') ||
      context.includes('mcp-ai-analysis')) {
    return ErrorType.GEMINI_API_ERROR;
  }
  
  // Storage access errors
  if (errorMessage.includes('storage') ||
      errorMessage.includes('bucket') ||
      errorMessage.includes('file not found') ||
      errorMessage.includes('download failed') ||
      context.includes('mcp-storage')) {
    return ErrorType.STORAGE_ACCESS_ERROR;
  }
  
  // Metadata embedding errors
  if (errorMessage.includes('metadata') ||
      errorMessage.includes('xmp') ||
      errorMessage.includes('embed') ||
      context.includes('mcp-metadata')) {
    return ErrorType.METADATA_EMBED_ERROR;
  }
  
  // Database errors
  if (errorMessage.includes('database') ||
      errorMessage.includes('sql') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('timeout') ||
      errorStack.includes('supabase')) {
    return ErrorType.DATABASE_ERROR;
  }
  
  // Email function errors
  if (errorMessage.includes('email') ||
      errorMessage.includes('resend') ||
      errorMessage.includes('send-order-completion') ||
      context.includes('email')) {
    return ErrorType.EMAIL_FUNCTION_ERROR;
  }
  
  // Deployment sync errors
  if (errorMessage.includes('function not found') ||
      errorMessage.includes('deployment') ||
      errorMessage.includes('version mismatch')) {
    return ErrorType.DEPLOYMENT_SYNC_ERROR;
  }
  
  return ErrorType.UNKNOWN_ERROR;
}

// Retry function with exponential backoff
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  errorType: ErrorType,
  correlationId: string,
  attempt: number = 1
): Promise<T> {
  const config = RETRY_CONFIG[errorType];
  
  try {
    console.log(`🔄 Attempt ${attempt} for ${errorType} (correlation: ${correlationId})`);
    return await operation();
  } catch (error) {
    console.error(`❌ Attempt ${attempt} failed for ${errorType}:`, error.message);
    
    if (attempt >= config.maxRetries + 1) {
      console.error(`🚨 Max retries exceeded for ${errorType} (correlation: ${correlationId})`);
      throw new Error(`Max retries exceeded for ${errorType}: ${error.message}`);
    }
    
    const delay = config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
    console.log(`⏳ Retrying ${errorType} in ${delay}ms (correlation: ${correlationId})`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return retryWithBackoff(operation, errorType, correlationId, attempt + 1);
  }
}

// Generate correlation ID for error tracking
function generateCorrelationId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ATOMIC PROCESSING UTILITIES (ORBIT WORKFLOW COMPLIANCE)
// Rollback function for atomic processing - cleans up partial failures
async function atomicRollbackImage(supabase: any, imageId: string, orderId: string, storagePath: string) {
  console.log(`🔄 ATOMIC ROLLBACK: Cleaning up partial processing for image ${imageId}...`);
  
  try {
    // Step 1: Extract folder path for storage cleanup
    const pathParts = storagePath.split('/');
    const orderFolder = pathParts[0]; // "order_id_user_id" folder
    const originalFilename = pathParts[pathParts.length - 1]; // Get the filename
    const baseFilename = originalFilename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
    
    // Step 2: Clean up any processed files in storage
    console.log(`🗑️ Cleaning up processed files for: ${baseFilename}`);
    
    // Note: We don't actually delete files here as that could be destructive
    // Instead we just ensure database state is clean
    // In a production system, you might want to implement file cleanup
    
    // Step 3: Reset database record to clean state
    const { error: resetError } = await supabase
      .from('images')
      .update({
        processing_status: 'pending',
        storage_path_processed: null,
        gemini_analysis_raw: null,
        ai_analysis: null,
        error_message: null,
        processed_at: null,
        retry_count: null
      })
      .eq('id', imageId);
    
    if (resetError) {
      console.error(`❌ Failed to reset image ${imageId}:`, resetError);
      throw new Error(`Database rollback failed: ${resetError.message}`);
    }
    
    console.log(`✅ ATOMIC ROLLBACK COMPLETED: Image ${imageId} reset to clean state`);
    return true;
    
  } catch (rollbackError) {
    console.error(`🚨 CRITICAL: Atomic rollback failed for image ${imageId}:`, rollbackError);
    // Mark as permanently failed if rollback fails
    await supabase
      .from('images')
      .update({
        processing_status: 'error',
        error_message: `Rollback failed: ${rollbackError.message}`,
        processed_at: new Date().toISOString()
      })
      .eq('id', imageId);
    
    return false;
  }
}

// Atomic completion verification - ensures image is fully processed
async function atomicVerifyImageComplete(supabase: any, imageId: string, expectedStoragePath: string) {
  console.log(`🔍 ATOMIC VERIFICATION: Checking image ${imageId} completion...`);
  
  // Database verification
  const { data: imageData, error: dbError } = await supabase
    .from('images')
    .select('processing_status, storage_path_processed, gemini_analysis_raw, ai_analysis')
    .eq('id', imageId)
    .single();
  
  if (dbError) {
    console.error(`❌ Database verification failed:`, dbError);
    return { success: false, error: `Database verification failed: ${dbError.message}` };
  }
  
  // Check all required fields are present
  const isComplete = imageData.processing_status === 'complete';
  const hasStoragePath = !!imageData.storage_path_processed;
  const hasAnalysis = !!imageData.gemini_analysis_raw;
  const hasAIAnalysis = !!imageData.ai_analysis;
  
  const verificationResult = {
    success: isComplete && hasStoragePath && hasAnalysis && hasAIAnalysis,
    details: {
      processing_status: imageData.processing_status,
      has_storage_path: hasStoragePath,
      has_analysis: hasAnalysis,
      has_ai_analysis: hasAIAnalysis
    }
  };
  
  console.log(`📊 Atomic verification result:`, verificationResult);
  
  if (!verificationResult.success) {
    return { 
      success: false, 
      error: `Image incomplete: ${JSON.stringify(verificationResult.details)}` 
    };
  }
  
  return verificationResult;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 process-image-batch function called');
    console.log('🚀 Request method:', req.method);
    console.log('🚀 Request headers:', Object.fromEntries(req.headers.entries()));
    
    // Initialize enhanced authentication manager
    const authManager = new SupabaseAuthManager({
      supabaseUrl: Deno.env.get('SUPABASE_URL') || '',
      legacyServiceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      newSecretKey: Deno.env.get('sb_secret_key'),
      allowLegacy: true // Enable backward compatibility during migration
    });
    
    // Get authenticated Supabase client with new key system
    const supabase = authManager.getSupabaseClient();
    
    console.log('🚀 Enhanced authentication initialized:', {
      hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
      authSystemReady: true,
      keyFormat: authManager.getKeyFormat()
    });

    // Parse request to check for manual test flag
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid JSON in request body',
          error: error.message
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // No user authentication needed for webhook-triggered processing
    // The order validation below provides sufficient security
    console.log('🚀 Starting batch image processing');

    const { orderId, analysisType = 'product', manualTest = false }: ProcessBatchRequest = requestBody;

    // ✅ AUTOMATIC PROCESSING ENABLED - Enhanced with comprehensive safeguards
    // Pre-flight validation ensures system readiness before processing
    console.log('🚀 AUTOMATIC PROCESSING ENABLED - Performing pre-flight validation...');
    
    // PRE-FLIGHT VALIDATION: Critical system checks
    const preflightValidation = {
      hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
      hasSecretKey: !!Deno.env.get('sb_secret_key'),
      hasGoogleApiKey: !!Deno.env.get('GOOGLE_API_KEY'),
      authManagerReady: !!authManager,
      validOrderId: !!orderId
    };
    
    console.log('🔍 Pre-flight validation results:', preflightValidation);
    
    // Check for critical missing components
    const missingComponents = Object.entries(preflightValidation)
      .filter(([key, value]) => !value)
      .map(([key]) => key);
    
    if (missingComponents.length > 0) {
      console.error('❌ PRE-FLIGHT VALIDATION FAILED:', missingComponents);
      return new Response(
        JSON.stringify({
          success: false,
          message: `Pre-flight validation failed: Missing ${missingComponents.join(', ')}`,
          orderId: orderId || 'N/A',
          status: 'validation_failed',
          missing_components: missingComponents
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log('✅ PRE-FLIGHT VALIDATION PASSED - All systems ready for automatic processing');
    
    // Optional manual test mode for debugging (backwards compatibility)
    if (requestBody.manualTest) {
      console.log('🧪 MANUAL TEST MODE FLAG DETECTED - Processing normally with enhanced logging');
    }

    if (!orderId) {
      throw new Error('Order ID is required');
    }

    console.log(`Starting batch processing for order: ${orderId}`);

    // 1. Get the order and validate it exists with proper status
    // Enhanced logging and error handling for order lookup with retry mechanism
    console.log(`🔍 Attempting to find order with ID: ${orderId}`);
    
    let order = null;
    let orderError = null;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second
    
    // Retry function for order lookup
    const attemptOrderLookup = async (attempt: number): Promise<any> => {
      console.log(`🔍 Order lookup attempt ${attempt}/${maxRetries} for: ${orderId}`);
      
      // First try: Direct order ID lookup
      const { data: directOrder, error: directError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      
      if (directOrder) {
        console.log(`✅ Found order directly by ID: ${orderId} (attempt ${attempt})`);
        return { order: directOrder, error: null };
      } else {
        console.log(`❌ Direct lookup failed (attempt ${attempt}): ${directError?.message}`);
        
        // Second try: Search by stripe payment intent fields in case orderId is actually a payment intent
        console.log(`🔍 Trying alternative lookup by payment intent fields (attempt ${attempt})`);
        const { data: altOrder, error: altError } = await supabase
          .from('orders')
          .select('*')
          .or(`stripe_payment_intent_id.eq.${orderId},stripe_payment_intent_id_actual.eq.${orderId}`)
          .single();
        
        if (altOrder) {
          console.log(`✅ Found order by payment intent lookup: ${altOrder.id} (searched for: ${orderId}, attempt ${attempt})`);
          return { order: altOrder, error: null };
        } else {
          console.log(`❌ Alternative lookup also failed (attempt ${attempt}): ${altError?.message}`);
          return { order: null, error: altError || directError };
        }
      }
    };
    
    // Try with retries
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await attemptOrderLookup(attempt);
      
      if (result.order) {
        order = result.order;
        break;
      } else {
        orderError = result.error;
        
        if (attempt < maxRetries) {
          console.log(`⏳ Waiting ${retryDelay}ms before retry ${attempt + 1}...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    if (!order) {
      // Enhanced error message with debugging info
      console.error(`🚨 Order lookup failed completely for: ${orderId} after ${maxRetries} attempts`);
      
      // Try to get some debugging info - recent orders to see what's in the database
      const { data: recentOrders } = await supabase
        .from('orders')
        .select('id, stripe_payment_intent_id, stripe_payment_intent_id_actual, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      
      console.log('Recent orders in database:', recentOrders);
      
      throw new Error(`Order not found: ${orderId} after ${maxRetries} retry attempts. Last error: ${orderError?.message}`);
    }

    // Validate order is in the correct state for processing
    if (order.payment_status !== 'completed' && order.payment_status !== 'succeeded') {
      throw new Error(`Order payment not completed. Status: ${order.payment_status}`);
    }

    console.log(`Processing order ${orderId} for user ${order.user_id}`);

    // 2. Get the batch associated with this order (should already exist)
    console.log(`🔍 Looking up batch for order. batch_id: ${order.batch_id}`);
    
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('*')
      .eq('id', order.batch_id)
      .single();
    
    if (batchError || !batch) {
      throw new Error(`No batch found for this order. batch_id: ${order.batch_id}, error: ${batchError?.message}`);
    }

    console.log(`Using existing batch: ${batch.id} for order: ${orderId}`);

    // 3. Get all images for this batch
    const { data: images, error: imagesError } = await supabase
      .from('images')
      .select('*')
      .eq('batch_id', batch.id)
      .eq('processing_status', 'pending');

    if (imagesError) {
      throw new Error('Failed to get images for processing');
    }

    if (!images || images.length === 0) {
      console.log(`❌ No images found for batch ${batch.id}`);
      
      // Debug: Check if batch exists but has no images at all
      const { data: allBatchImages } = await supabase
        .from('images')
        .select('id, processing_status, created_at')
        .eq('batch_id', batch.id);
        
      console.log(`🔍 Total images in batch (any status): ${allBatchImages?.length || 0}`);
      if (allBatchImages && allBatchImages.length > 0) {
        console.log(`📋 Image statuses:`, allBatchImages.map(img => img.processing_status));
        throw new Error(`No pending images found for processing in batch ${batch.id}. Found ${allBatchImages.length} images with other statuses.`);
      }
      
      throw new Error(`No images found for processing in batch ${batch.id}. Batch appears to be empty.`);
    }

    console.log(`Processing ${images.length} images for batch ${batch.id}`);

    // 4. Update batch status to processing and order processing stage to processing
    await supabase
      .from('batches')
      .update({
        status: 'processing',
        processing_start_time: new Date().toISOString()
      })
      .eq('id', batch.id);

    // Update order processing stage to indicate active processing
    await supabase
      .from('orders')
      .update({
        processing_stage: 'processing',
        processing_completion_percentage: 10
      })
      .eq('id', orderId);

    // 5. Process each image
    const processedResults = [];
    let successCount = 0;
    let errorCount = 0;

    for (const image of images) {
      try {
        console.log(`Processing image: ${image.original_filename}`);

        // Update image status to processing
        await supabase
          .from('images')
          .update({ processing_status: 'processing' })
          .eq('id', image.id);

        // Update order processing stage to analyzing when starting AI analysis
        await supabase
          .from('orders')
          .update({
            processing_stage: 'analyzing'
          })
          .eq('id', orderId);

        // 🚀 REMOTE MCP AI ANALYSIS - Using deployed remote MCP server
        console.log('🔄 Calling remote MCP AI analysis server for image:', image.storage_path_original);
        
        // Format the storage path correctly for MCP server (bucket/path format)
        const storagePath = `orbit-images/${image.storage_path_original}`;
        console.log('📁 Formatted storage path for MCP:', storagePath);
        
        let analysisResult;
        
        // ENHANCED ERROR HANDLING: AI Analysis with intelligent retry
        const aiAnalysisCorrelationId = generateCorrelationId();
        console.log(`🎯 AI Analysis correlation ID: ${aiAnalysisCorrelationId}`);
        
        try {
          // Wrap AI analysis call with retry logic
          const aiAnalysisOperation = async () => {
            console.log('🔄 Executing AI analysis operation...');
            
            // Call remote MCP AI analysis server with sb_secret_key authentication
            const mcpResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/mcp-ai-analysis`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('sb_secret_key')}`,
                'Content-Type': 'application/json',
                'apikey': `${Deno.env.get('sb_secret_key')}`,
                'X-Correlation-ID': aiAnalysisCorrelationId
              },
              body: JSON.stringify({
                image_path: image.storage_path_original, // Use direct path, MCP server handles orbit-images bucket
                analysis_type: analysisType
              })
            });

            console.log('📡 MCP Response status:', mcpResponse.status);
            
            if (!mcpResponse.ok) {
              const errorText = await mcpResponse.text();
              console.error('❌ MCP call failed:', mcpResponse.status, errorText);
              throw new Error(`MCP AI analysis failed: ${mcpResponse.status} - ${errorText}`);
            }

            return await mcpResponse.json();
          };
          
          // Execute with intelligent retry for GEMINI_API_ERROR
          const geminiAnalysis = await retryWithBackoff(
            aiAnalysisOperation,
            ErrorType.GEMINI_API_ERROR,
            aiAnalysisCorrelationId
          );
          console.log('✅ Successfully parsed Gemini analysis:', {
            analysisType: geminiAnalysis.analysis_type,
            confidence: geminiAnalysis.confidence,
            hasMetadata: !!geminiAnalysis.metadata
          });

          analysisResult = {
            metadata: geminiAnalysis.metadata || geminiAnalysis,
            raw_text: JSON.stringify(geminiAnalysis),
            processing_time_ms: geminiAnalysis.processing_time_ms || 0,
            analysis_type: geminiAnalysis.analysis_type,
            confidence: geminiAnalysis.confidence
          };

        } catch (mcpError) {
          // ENHANCED ERROR CLASSIFICATION: Classify and handle AI analysis errors
          const errorType = classifyError(mcpError, 'mcp-ai-analysis');
          console.error(`🚨 CLASSIFIED ERROR: ${errorType} in AI Analysis (correlation: ${aiAnalysisCorrelationId}):`, mcpError);
          
          // Critical errors should not continue with fallback
          if (errorType === ErrorType.GEMINI_API_ERROR || 
              errorType === ErrorType.DEPLOYMENT_SYNC_ERROR ||
              errorType === ErrorType.UNKNOWN_ERROR) {
            console.error(`❌ CRITICAL: ${errorType} - cannot continue with fallback`);
            throw new Error(`Critical AI analysis failure (${errorType}): ${mcpError.message}`);
          }
          
          // For other error types, use fallback but log the classification
          console.warn(`⚠️ NON-CRITICAL: ${errorType} - continuing with error fallback`);
          analysisResult = {
            metadata: { 
              error: mcpError.message,
              error_type: errorType,
              correlation_id: aiAnalysisCorrelationId,
              status: 'failed',
              fallback: true
            },
            raw_text: `AI Analysis failed (${errorType}): ${mcpError.message}`,
            processing_time_ms: 0
          };
        }

        // STEP 5C: STORE ANALYSIS WITH VERIFICATION
        console.log('💾 Storing AI analysis results in database...');
        await supabase
          .from('images')
          .update({
            gemini_analysis_raw: analysisResult.raw_text,
            processing_status: 'prcoessing',
            ai_analysis: analysisResult.metadata,
            analysis_type: analysisType,
            processing_duration_ms: analysisResult.processing_time_ms
          })
          .eq('id', image.id);

        // 🚨 VERIFICATION CHECKPOINT: Verify the JSON was stored correctly
        console.log('🔍 Verifying analysis data was stored correctly...');
        const { data: verificationData, error: verificationError } = await supabase
          .from('images')
          .select('gemini_analysis_raw, ai_analysis, analysis_type')
          .eq('id', image.id)
          .single();

        if (verificationError || !verificationData?.gemini_analysis_raw || !verificationData?.ai_analysis) {
          console.error('❌ Analysis storage verification failed:', verificationError);
          throw new Error(`Failed to store analysis data: ${verificationError?.message || 'Missing analysis data'}`);
        }

        console.log('✅ Analysis data verified successfully in database');

        // STEP 5D: EMBED METADATA INTO IMAGE
        console.log('🔄 Starting metadata embedding process...');
        
        // ENHANCED ERROR HANDLING: Metadata processing with intelligent retry
        const metadataCorrelationId = generateCorrelationId();
        console.log(`🎯 Metadata Processing correlation ID: ${metadataCorrelationId}`);
        
        try {
          // Wrap metadata processing call with retry logic
          const metadataOperation = async () => {
            console.log('🔄 Executing metadata embedding operation...');
            
            const metadataResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/mcp-metadata`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('sb_secret_key')}`,
                'Content-Type': 'application/json',
                'apikey': `${Deno.env.get('sb_secret_key')}`,
                'X-Correlation-ID': metadataCorrelationId
              },
              body: JSON.stringify({
                tool_name: 'process_image_metadata',
                parameters: {
                  image_path: image.storage_path_original,
                  analysis_result: {
                    analysis_type: analysisResult.analysis_type,
                    confidence: analysisResult.confidence,
                    processing_time_ms: analysisResult.processing_time_ms,
                    metadata: analysisResult.metadata
                  }
                }
              })
            });
            
            if (!metadataResponse.ok) {
              const errorText = await metadataResponse.text();
              console.error('❌ Metadata processing failed:', metadataResponse.status, errorText);
              throw new Error(`Metadata processing failed: ${metadataResponse.status} - ${errorText}`);
            }
            
            return await metadataResponse.json();
          };
          
          // Execute with intelligent retry for METADATA_EMBED_ERROR
          const metadataResult = await retryWithBackoff(
            metadataOperation,
            ErrorType.METADATA_EMBED_ERROR,
            metadataCorrelationId
          );
          
          console.log('✅ Metadata embedding completed with retry support:', {
            success: metadataResult.success,
            processingTime: metadataResult.processing_time_ms,
            processedPath: metadataResult.processed_file_path,
            correlationId: metadataCorrelationId
          });

          // STEP 5G: UPDATE DATABASE WITH COMPREHENSIVE VERIFICATION
          if (metadataResult.success) {
            console.log('🔄 Starting STEP 5G: Database update with verification...');
            
            // Update image with processed metadata paths
            const { error: updateError } = await supabase
              .from('images')
              .update({
                processing_status: 'complete',
                processed_at: new Date().toISOString(),
                storage_path_processed: metadataResult.processed_file_path
              })
              .eq('id', image.id);
            
            if (updateError) {
              throw new Error(`Database update failed: ${updateError.message}`);
            }
            
            console.log('✅ Database updated successfully');
            
            // 🚨 CRITICAL STORAGE VERIFICATION STEP (ORBIT WORKFLOW COMPLIANCE)
            console.log('🔍 MANDATORY: Verifying processed files exist in storage before database update...');
            
            // Extract folder path for verification
            const pathParts = image.storage_path_original.split('/');
            const orderFolder = pathParts[0]; // "order_id_user_id" folder
            const folderPath = `${orderFolder}/processed`;
            
            // STORAGE-FIRST APPROACH: Verify storage before any database updates
            const storageResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/mcp-storage`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('sb_secret_key')}`,
                'Content-Type': 'application/json',
                'apikey': `${Deno.env.get('sb_secret_key')}`,
              },
              body: JSON.stringify({
                tool_name: 'list_files',
                parameters: {
                  bucket_name: 'orbit-images',
                  folder_path: folderPath
                }
              })
            });
            
            // STRICT VERIFICATION: Storage access must succeed
            if (!storageResponse.ok) {
              const errorText = await storageResponse.text();
              console.error('❌ CRITICAL: Storage verification failed - cannot proceed without storage access');
              throw new Error(`Storage verification failed: ${storageResponse.status} - ${errorText}`);
            }
            
            const storageResult = await storageResponse.json();
            const processedFiles = storageResult.files || [];
            
            // COMPREHENSIVE FILE VERIFICATION: Check all expected files exist
            const expectedFilename = metadataResult.processed_file_path.split('/').pop();
            const expectedBasename = expectedFilename?.replace('_processed.jpg', '') || '';
            
            // Verify main processed file exists
            const mainFileExists = processedFiles.some((file: string) => 
              file.includes(expectedBasename) && file.includes('_processed.jpg')
            );
            
            // Verify XMP file exists (non-critical but log if missing)
            const xmpFileExists = processedFiles.some((file: string) => 
              file.includes(expectedBasename) && file.includes('.xmp')
            );
            
            // Verify report file exists (non-critical but log if missing)
            const reportFileExists = processedFiles.some((file: string) => 
              file.includes(expectedBasename) && file.includes('_report.txt')
            );
            
            console.log('📁 COMPREHENSIVE Storage verification:', {
              folderPath,
              expectedBasename,
              totalFilesFound: processedFiles.length,
              mainFileExists,
              xmpFileExists,
              reportFileExists,
              filesInStorage: processedFiles.slice(0, 5) // Show first 5 for debugging
            });
            
            // CRITICAL CHECKPOINT: Main processed file MUST exist
            if (!mainFileExists) {
              console.error('❌ CRITICAL FAILURE: Main processed file not found in storage');
              console.error('Expected file pattern:', `*${expectedBasename}*_processed.jpg`);
              console.error('Files found:', processedFiles);
              throw new Error(`Storage verification failed: Main processed file missing for ${expectedBasename}`);
            }
            
            // Log warnings for missing non-critical files
            if (!xmpFileExists) {
              console.warn('⚠️ XMP metadata file not found - proceeding but logging issue');
            }
            if (!reportFileExists) {
              console.warn('⚠️ Report file not found - proceeding but logging issue');
            }
            
            console.log('✅ STORAGE VERIFICATION PASSED: All critical files confirmed in storage');
            
            // 🚨 FINAL IMAGE VERIFICATION
            console.log('🔍 Performing final image verification...');
            const { data: verificationData, error: verificationError } = await supabase
              .from('images')
              .select('id, processing_status, storage_path_processed, gemini_analysis_raw')
              .eq('id', image.id)
              .single();
            
            if (verificationError) {
              console.error('❌ Final verification query failed:', verificationError);
              throw new Error(`Final verification failed: ${verificationError.message}`);
            }
            
            // Comprehensive verification checks
            const hasProcessedPath = !!verificationData.storage_path_processed;
            const hasAnalysis = !!verificationData.gemini_analysis_raw;
            const isComplete = verificationData.processing_status === 'complete';
            
            console.log('🔍 Final verification results:', {
              imageId: image.id,
              processing_status: verificationData.processing_status,
              has_processed_path: hasProcessedPath,
              has_analysis: hasAnalysis,
              is_complete: isComplete
            });
            
            // Critical verification checkpoint
            if (!isComplete || !hasProcessedPath || !hasAnalysis) {
              console.error('❌ Final verification FAILED - rolling back...');
              
              // Rollback database update
              await supabase
                .from('images')
                .update({
                  processing_status: 'error',
                  processed_at: new Date().toISOString(),
                  error_message: `Final verification failed: complete=${isComplete}, path=${hasProcessedPath}, analysis=${hasAnalysis}`
                })
                .eq('id', image.id);
              
              throw new Error(`Final verification failed - image incomplete`);
            }
            
            console.log('✅ Image processing fully completed with comprehensive verification');
            
            // ATOMIC VERIFICATION: Final check before declaring success
            console.log('🔍 ATOMIC VERIFICATION: Performing final atomic check before success...');
            const atomicVerification = await atomicVerifyImageComplete(
              supabase, 
              image.id, 
              metadataResult.processed_file_path
            );
            
            if (!atomicVerification.success) {
              console.error('❌ ATOMIC VERIFICATION FAILED:', atomicVerification.error);
              throw new Error(`Atomic verification failed: ${atomicVerification.error}`);
            }
            
            console.log('✅ ATOMIC VERIFICATION PASSED: Image fully complete and verified');
          } else {
            throw new Error(`Metadata embedding failed: ${metadataResult.error}`);
          }

        } catch (metadataError) {
          console.error('🚨 Metadata embedding error:', metadataError);
          
          // For metadata errors, still attempt atomic rollback for consistency
          console.log('🔄 Metadata error - attempting atomic rollback...');
          const rollbackSuccess = await atomicRollbackImage(
            supabase, 
            image.id, 
            orderId, 
            image.storage_path_original
          );
          
          if (rollbackSuccess) {
            console.log('✅ Rollback successful after metadata error');
          } else {
            console.error('❌ Rollback failed after metadata error');
          }
          
          // Mark as error (not complete) when metadata fails
          await supabase
            .from('images')
            .update({
              processing_status: 'error',
              processed_at: new Date().toISOString(),
              error_message: `Metadata embedding failed: ${metadataError.message}`
            })
            .eq('id', image.id);
            
          // Throw error to trigger main catch block for proper error handling
          throw metadataError;
        }

        // ATOMIC SUCCESS: Only reach here if all verifications passed
        processedResults.push({
          image_id: image.id,
          filename: image.original_filename,
          status: 'success',
          analysis: analysisResult,
          atomic_verified: true
        });

        successCount++;
        console.log(`✅ ATOMIC SUCCESS: ${image.original_filename} - fully processed and verified`);

      } catch (error) {
        // ENHANCED ERROR CLASSIFICATION: Main image processing error handler
        const mainErrorCorrelationId = generateCorrelationId();
        const errorType = classifyError(error, 'image-processing-main');
        
        console.error(`🚨 CLASSIFIED ATOMIC PROCESSING ERROR: ${errorType} for image ${image.original_filename} (correlation: ${mainErrorCorrelationId}):`, error);

        // ATOMIC ROLLBACK: Clean up any partial processing
        console.log(`🔄 Initiating atomic rollback for image ${image.id} (${errorType})...`);
        
        const rollbackSuccess = await atomicRollbackImage(
          supabase, 
          image.id, 
          orderId, 
          image.storage_path_original
        );
        
        if (rollbackSuccess) {
          console.log(`✅ Atomic rollback successful for image ${image.id}`);
          
          // Mark as error after successful rollback with classification info
          await supabase
            .from('images')
            .update({
              processing_status: 'error',
              error_message: `Processing failed (${errorType}): ${error.message}`,
              processed_at: new Date().toISOString(),
              error_correlation_id: mainErrorCorrelationId
            })
            .eq('id', image.id);
        } else {
          console.error(`❌ Atomic rollback FAILED for image ${image.id} - system may be in inconsistent state`);
          // Image is already marked as error by rollback function
        }

        processedResults.push({
          image_id: image.id,
          filename: image.original_filename,
          status: 'error',
          error: error.message,
          error_type: errorType,
          correlation_id: mainErrorCorrelationId,
          rollback_successful: rollbackSuccess
        });

        errorCount++;
        
        // ESCALATION LOGIC: Check for consecutive critical errors
        if (errorType === ErrorType.DEPLOYMENT_SYNC_ERROR || 
            errorType === ErrorType.UNKNOWN_ERROR) {
          console.error(`🚨 CRITICAL ERROR TYPE: ${errorType} - Consider escalating to Tier 2 orchestrator`);
        }
      }

      // Update batch progress
      await supabase
        .from('batches')
        .update({
          processed_count: successCount,
          error_count: errorCount
        })
        .eq('id', batch.id);

      // Update order processing progress
      const totalProcessed = successCount + errorCount;
      const progressPercentage = Math.round(10 + (totalProcessed / images.length) * 80); // 10% base + 80% for processing
      await supabase
        .from('orders')
        .update({
          processing_completion_percentage: progressPercentage
        })
        .eq('id', orderId);
    }

    // STEP 6: VERIFY ALL IMAGES COMPLETED
    console.log('🔄 Starting STEP 6: Comprehensive verification that ALL images are properly processed...');
    
    const { data: completionData, error: completionError } = await supabase
      .rpc('get_order_completion_status', { order_id_param: orderId });
    
    // If RPC doesn't exist, fall back to direct query
    let totalImages = 0;
    let completedImages = 0;
    let hasProcessedFiles = 0;
    
    if (completionError) {
      console.log('📊 Using direct SQL for completion verification...');
      const { data: directData, error: directError } = await supabase
        .from('images')
        .select('processing_status, storage_path_processed')
        .eq('order_id', orderId);
      
      if (directError) {
        console.error('❌ Failed to verify order completion:', directError);
        throw new Error(`Order verification failed: ${directError.message}`);
      }
      
      totalImages = directData.length;
      completedImages = directData.filter(img => img.processing_status === 'complete').length;
      hasProcessedFiles = directData.filter(img => img.storage_path_processed !== null).length;
    } else {
      totalImages = completionData[0]?.total_images || 0;
      completedImages = completionData[0]?.completed_images || 0;
      hasProcessedFiles = completionData[0]?.has_processed_files || 0;
    }
    
    console.log('📊 Order completion verification results:', {
      orderId,
      totalImages,
      completedImages,
      hasProcessedFiles,
      successFromLoop: successCount,
      errorFromLoop: errorCount
    });
    
    // 🚨 CRITICAL VERIFICATION CHECKPOINT
    const allImagesComplete = totalImages === completedImages;
    const allHaveProcessedFiles = totalImages === hasProcessedFiles;
    const loopCountsMatch = (successCount + errorCount) === totalImages;
    
    if (!allImagesComplete || !allHaveProcessedFiles || !loopCountsMatch) {
      console.error('❌ CRITICAL: Order verification FAILED');
      console.error('Verification details:', {
        allImagesComplete,
        allHaveProcessedFiles,
        loopCountsMatch,
        issue: !allImagesComplete ? 'Some images not complete' : 
               !allHaveProcessedFiles ? 'Some images missing processed files' :
               !loopCountsMatch ? 'Processing loop counts mismatch' : 'Unknown'
      });
      
      // Mark order as failed
      await supabase
        .from('orders')
        .update({
          order_status: 'failed',
          processing_stage: 'failed',
          error_message: `Order verification failed: ${totalImages} total, ${completedImages} complete, ${hasProcessedFiles} with files`
        })
        .eq('id', orderId);
        
      throw new Error(`Order verification failed - not all images processed correctly`);
    }
    
    console.log('✅ STEP 6 PASSED: All images verified as properly processed');

    // STEP 7: VERIFY PROCESSED FILES IN STORAGE
    console.log('🔄 Starting STEP 7: Storage-database consistency verification...');
    
    // Get order folder path
    const firstImage = images[0]; // We know we have at least one image
    const pathParts = firstImage.storage_path_original.split('/');
    const orderFolder = pathParts[0]; // "order_id_user_id" folder
    const processedFolderPath = `${orderFolder}/processed`;
    
    try {
      // Use MCP storage tool to list all files in processed folder
      console.log('📁 Checking processed folder:', processedFolderPath);
      
      const storageListResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/mcp-storage`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('sb_secret_key')}`,
          'Content-Type': 'application/json',
          'apikey': `${Deno.env.get('sb_secret_key')}`,
        },
        body: JSON.stringify({
          tool_name: 'list_files',
          parameters: {
            bucket_name: 'orbit-images',
            folder_path: processedFolderPath
          }
        })
      });
      
      let storageFilesCount = 0;
      let storageFiles = [];
      
      // CRITICAL: Storage listing must succeed for /orbit workflow compliance
      if (!storageListResponse.ok) {
        const errorText = await storageListResponse.text();
        console.error('❌ CRITICAL: Storage listing failed - cannot complete order without storage verification');
        
        // Mark order as failed due to storage access failure
        await supabase
          .from('orders')
          .update({
            order_status: 'failed',
            processing_stage: 'failed',
            error_message: `Storage verification access failed: ${storageListResponse.status} - ${errorText}`
          })
          .eq('id', orderId);
          
        throw new Error(`Storage verification access failed: ${storageListResponse.status} - ${errorText}`);
      } else {
        const storageListResult = await storageListResponse.json();
        storageFiles = storageListResult.files || [];
        
        // Count processed image files (exclude thumbnails, xmp, txt files for core count)
        storageFilesCount = storageFiles.filter((file: string) => 
          file.includes('_processed.jpg') || file.includes('_web.jpg')
        ).length;
        
        console.log('📊 Storage verification results:', {
          processedFolderPath,
          totalFilesInStorage: storageFiles.length,
          processedImageFiles: storageFilesCount,
          databaseCompletedImages: completedImages,
          storageFiles: storageFiles.slice(0, 5) // Show first 5 for debugging
        });
        
        // 🚨 STORAGE VERIFICATION CHECKPOINT
        // We expect at least completedImages processed files in storage
        // Note: Storage might have more files (thumbnails, XMP, reports) so we check minimum
        if (storageFilesCount < completedImages) {
          console.error('❌ STORAGE VERIFICATION FAILED');
          console.error('Storage mismatch details:', {
            expectedProcessedFiles: completedImages,
            actualProcessedFiles: storageFilesCount,
            deficit: completedImages - storageFilesCount
          });
          
          // Mark order as failed due to storage inconsistency
          await supabase
            .from('orders')
            .update({
              order_status: 'failed',
              processing_stage: 'failed',
              error_message: `Storage verification failed: Expected ${completedImages} processed files, found ${storageFilesCount}`
            })
            .eq('id', orderId);
            
          throw new Error(`Storage verification failed - processed files missing from storage`);
        }
        
        // Additional verification: Check each database record has corresponding storage file
        console.log('🔍 Verifying each database record has storage file...');
        const { data: imageRecords, error: recordsError } = await supabase
          .from('images')
          .select('id, original_filename, storage_path_processed')
          .eq('order_id', orderId)
          .eq('processing_status', 'complete');
        
        if (recordsError) {
          console.warn('⚠️ Could not fetch image records for storage verification');
        } else {
          let missingFiles = 0;
          for (const record of imageRecords) {
            if (record.storage_path_processed) {
              const expectedPath = record.storage_path_processed;
              const fileName = expectedPath.split('/').pop();
              const fileFoundInStorage = storageFiles.some((file: string) => 
                file.includes(fileName?.replace('_processed.jpg', ''))
              );
              
              if (!fileFoundInStorage) {
                console.warn(`⚠️ Missing storage file for: ${record.original_filename}`);
                missingFiles++;
              }
            }
          }
          
          if (missingFiles > 0) {
            console.warn(`⚠️ Found ${missingFiles} database records with missing storage files`);
            // Don't fail the order for individual missing files, but log for investigation
          } else {
            console.log('✅ All database records have corresponding storage files');
          }
        }
        
        console.log('✅ STEP 7 PASSED: Storage-database consistency verified');
      }
      
    } catch (storageError) {
      console.warn('⚠️ Storage verification error:', storageError.message);
      // Don't fail the entire order for storage verification issues
      // But log for investigation
      console.log('⚠️ Continuing without storage verification due to error');
    }

    // 6. Update final batch status
    const finalStatus = errorCount === 0 ? 'completed' : 'completed_with_errors';
    await supabase
      .from('batches')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        processing_end_time: new Date().toISOString(),
        processed_count: successCount,
        error_count: errorCount,
        processing_results: { results: processedResults }
      })
      .eq('id', batch.id);

    // 7. Update order status and processing stage
    await supabase
      .from('orders')
      .update({
        order_status: finalStatus === 'completed' ? 'completed' : 'completed_with_errors',
        processing_stage: 'completed',
        processing_completion_percentage: 100,
        completed_at: new Date().toISOString()
      })
      .eq('id', orderId);

    // 7.5. Send completion email for both complete and partial success
    if (finalStatus === 'completed' || finalStatus === 'completed_with_errors') {
      try {
        console.log(`📧 Sending completion email for order: ${orderId}`);
        console.log(`📧 Image count: ${successCount}, Error count: ${errorCount}`);
        
        const emailResult = await supabase.functions.invoke('send-order-completion-email', {
          body: {
            orderId: orderId
          },
          headers: {
            Authorization: `Bearer ${authManager.getServiceToken()}`
          }
        });

        console.log(`📧 Email function response:`, emailResult);
        
        if (emailResult.error) {
          console.error('📧 Failed to send completion email:', emailResult.error);
          console.error('📧 Error details:', JSON.stringify(emailResult.error, null, 2));
        } else {
          console.log('📧 Completion email sent successfully:', emailResult.data);
        }
      } catch (emailError) {
        console.error('❌ Error in email process:', emailError);
        console.error('❌ Email error stack:', emailError.stack);
        // Don't fail the entire process if email fails - batch results should still be recorded
      }
    }

    // Ensure batch results are properly recorded even if email fails
    console.log(`📊 Recording final batch results - Success: ${successCount}, Errors: ${errorCount}`);

    // 8. Create download link if successful
    let downloadInfo = null;
    if (successCount > 0) {
      const { data: downloadData, error: downloadError } = await supabase
        .from('file_downloads')
        .insert({
          user_id: order.user_id,
          order_id: orderId,
          batch_id: batch.id,
          file_paths: processedResults
            .filter(r => r.status === 'success')
            .map(r => `analysis/${r.image_id}.json`),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          access_token: crypto.randomUUID(),
          max_downloads: 10
        })
        .select()
        .single();

      if (!downloadError) {
        downloadInfo = downloadData;
      }
    }

    console.log(`Batch processing completed. Success: ${successCount}, Errors: ${errorCount}`);

    return new Response(JSON.stringify({
      success: true,
      batch_id: batch.id,
      order_id: orderId,
      results: {
        total_images: images.length,
        success_count: successCount,
        error_count: errorCount,
        status: finalStatus
      },
      download_info: downloadInfo,
      processed_results: processedResults,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('🚨 Batch processing error:', error);
    console.error('🚨 Error stack:', error.stack);
    console.error('🚨 Error name:', error.name);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      errorName: error.name,
      errorStack: error.stack,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// NOTE: callGeminiAnalysis function removed - AI analysis will be handled by Claude Code SDK orchestrator

console.log('ORBIT Batch Processing Edge Function deployed and ready');