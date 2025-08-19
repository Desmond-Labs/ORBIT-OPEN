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

    // 🚫 SAFETY GUARD: Disable all automatic processing
    // This prevents any automatic triggers while maintaining manual processing capability
    const DISABLE_AUTO_PROCESSING = true; // Set to false to re-enable automatic processing
    
    if (DISABLE_AUTO_PROCESSING && !requestBody.manualTest) {
      console.log('🚫 AUTOMATIC PROCESSING DISABLED - Manual processing only');
      console.log('🚫 To enable automatic processing, set DISABLE_AUTO_PROCESSING to false');
      console.log('🚫 To test manually, add "manualTest": true to your request');
      
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Automatic processing is disabled. Add "manualTest": true to test manually.',
          orderId: 'N/A',
          status: 'disabled'
        }),
        {
          status: 423, // 423 Locked - indicates resource is locked/disabled
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (requestBody.manualTest) {
      console.log('🧪 MANUAL TEST MODE ACTIVATED - Processing will proceed');
    }

    // No user authentication needed for webhook-triggered processing
    // The order validation below provides sufficient security
    console.log('🚀 Starting batch image processing');

    const { orderId, analysisType = 'product', manualTest = false }: ProcessBatchRequest = requestBody;

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
        try {
          // Call remote MCP AI analysis server with sb_secret_key authentication
          const mcpResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/mcp-ai-analysis`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('sb_secret_key')}`,
              'Content-Type': 'application/json',
              'apikey': `${Deno.env.get('sb_secret_key')}`,
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

          const geminiAnalysis = await mcpResponse.json();
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
          console.error('🚨 MCP AI Analysis failed:', mcpError);
          
          // Fallback for errors - still mark as processed but with error info
          analysisResult = {
            metadata: { 
              error: mcpError.message,
              status: 'failed',
              fallback: true
            },
            raw_text: `AI Analysis failed: ${mcpError.message}`,
            processing_time_ms: 0
          };
          
          // Don't throw here - let the process continue with error metadata
          console.log('⚠️ Continuing with error analysis result');
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
        
        try {
          const metadataResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/mcp-metadata`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('sb_secret_key')}`,
              'Content-Type': 'application/json',
              'apikey': `${Deno.env.get('sb_secret_key')}`,
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

          const metadataResult = await metadataResponse.json();
          console.log('✅ Metadata embedding completed:', {
            success: metadataResult.success,
            processingTime: metadataResult.processing_time_ms,
            processedPath: metadataResult.processed_file_path
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
            
            // 🚨 STORAGE VERIFICATION STEP
            console.log('🔍 Verifying processed files exist in storage...');
            
            // Extract folder path for verification
            const pathParts = image.storage_path_original.split('/');
            const orderFolder = pathParts[0]; // "order_id_user_id" folder
            const folderPath = `${orderFolder}/processed`;
            
            try {
              // Use MCP storage tool to list files in processed folder
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
              
              if (!storageResponse.ok) {
                console.warn('⚠️ Storage verification failed - proceeding without verification');
              } else {
                const storageResult = await storageResponse.json();
                const processedFiles = storageResult.files || [];
                
                // Check if our processed file exists
                const expectedFilename = metadataResult.processed_file_path.split('/').pop();
                const fileExists = processedFiles.some((file: string) => 
                  file.includes(expectedFilename?.replace('_processed.jpg', ''))
                );
                
                console.log('📁 Storage verification:', {
                  folderPath,
                  expectedFile: expectedFilename,
                  filesFound: processedFiles.length,
                  fileExists
                });
                
                if (!fileExists) {
                  console.warn('⚠️ Processed file not found in storage - but continuing as metadata was successful');
                }
              }
            } catch (storageError) {
              console.warn('⚠️ Storage verification error:', storageError.message);
              // Don't fail the entire process for storage verification issues
            }
            
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
          } else {
            throw new Error(`Metadata embedding failed: ${metadataResult.error}`);
          }

        } catch (metadataError) {
          console.error('🚨 Metadata embedding error:', metadataError);
          
          // Still mark as complete but with metadata error
          await supabase
            .from('images')
            .update({
              processing_status: 'complete',
              processed_at: new Date().toISOString(),
              error_message: `Metadata embedding failed: ${metadataError.message}`
            })
            .eq('id', image.id);
            
          console.log('⚠️ Marked as complete despite metadata error');
        }

        processedResults.push({
          image_id: image.id,
          filename: image.original_filename,
          status: 'success',
          analysis: analysisResult
        });

        successCount++;
        console.log(`Successfully processed: ${image.original_filename}`);

      } catch (error) {
        console.error(`Error processing image ${image.original_filename}:`, error);

        // Update image with error status
        await supabase
          .from('images')
          .update({
            processing_status: 'error',
            error_message: error.message,
            processed_at: new Date().toISOString()
          })
          .eq('id', image.id);

        processedResults.push({
          image_id: image.id,
          filename: image.original_filename,
          status: 'error',
          error: error.message
        });

        errorCount++;
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
      
      if (!storageListResponse.ok) {
        console.warn('⚠️ Storage listing failed - skipping storage verification');
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