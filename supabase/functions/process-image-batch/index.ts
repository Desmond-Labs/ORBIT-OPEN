// ORBIT Batch Image Processing Edge Function
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessBatchRequest {
  orderId: string;
  analysisType?: 'product' | 'lifestyle';
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
    
    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('🚀 Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!serviceKey,
      serviceKeyLength: serviceKey?.length || 0
    });
    
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing required environment variables');
    }
    
    // Initialize Supabase with service role for full access
    const supabase = createClient(supabaseUrl, serviceKey);

    // No user authentication needed for webhook-triggered processing
    // The order validation below provides sufficient security
    console.log('🚀 Starting batch image processing (webhook-triggered)');

    const { orderId, analysisType = 'product' }: ProcessBatchRequest = await req.json();

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

    // 4. Update batch status to processing and order processing stage to analyzing
    await supabase
      .from('batches')
      .update({
        status: 'processing',
        processing_start_time: new Date().toISOString()
      })
      .eq('id', batch.id);

    // Update order processing stage to indicate active AI analysis
    await supabase
      .from('orders')
      .update({
        processing_stage: 'analyzing',
        processing_completion_percentage: 20
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

        // Call Gemini analysis function
        const analysisResult = await callGeminiAnalysis({
          image_path: image.storage_path_original,
          analysis_type: analysisType,
          supabase_url: Deno.env.get('SUPABASE_URL'),
          supabase_key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        });

        // Update image with analysis results
        await supabase
          .from('images')
          .update({
            processing_status: 'complete',
            processed_at: new Date().toISOString(),
            ai_analysis: analysisResult.metadata,
            gemini_analysis_raw: analysisResult.raw_text,
            analysis_type: analysisType,
            processing_duration_ms: analysisResult.processing_time_ms
          })
          .eq('id', image.id);

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
      const progressPercentage = Math.round(20 + (totalProcessed / images.length) * 70); // 20% base + 70% for processing
      await supabase
        .from('orders')
        .update({
          processing_completion_percentage: progressPercentage
        })
        .eq('id', orderId);
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

    // 7.5. Generate access token and send completion email for both complete and partial success
    if (finalStatus === 'completed' || finalStatus === 'completed_with_errors') {
      try {
        // Generate access token for email link
        console.log(`🔐 Generating access token for order: ${orderId}`);
        const { data: tokenData, error: tokenError } = await supabase
          .rpc('generate_order_access_token', {
            order_id_param: orderId,
            expires_in_hours: 168 // 7 days
          });

        if (tokenError) {
          console.error('🔐 Failed to generate access token:', tokenError);
          throw tokenError;
        }

        const accessToken = tokenData[0].token;
        console.log(`🔐 Access token generated successfully: ${accessToken.substring(0, 8)}... for order: ${orderId}`);

        // Get user email and name from orbit_users table using the order's user_id
        const { data: userProfile, error: userError } = await supabase
          .from('orbit_users')
          .select('email, name')
          .eq('id', order.user_id)
          .single();

        if (!userError && userProfile?.email) {
          console.log(`📧 Sending completion email to: ${userProfile.email}`);
          console.log(`📧 Order ID: ${orderId}, Image count: ${successCount}, Error count: ${errorCount}`);
          
          const emailResult = await supabase.functions.invoke('send-order-completion-email', {
            body: {
              orderId: orderId,
              userEmail: userProfile.email,
              userName: userProfile.name,
              imageCount: successCount,
              downloadUrl: `${Deno.env.get('FRONTEND_URL') || 'https://orbit-image-forge.lovable.app'}/?token=${accessToken}&order=${orderId}&step=processing`
            }
          });

          console.log(`📧 Email function response:`, emailResult);
          
          if (emailResult.error) {
            console.error('📧 Failed to send completion email:', emailResult.error);
            console.error('📧 Error details:', JSON.stringify(emailResult.error, null, 2));
          } else {
            console.log('📧 Completion email sent successfully:', emailResult.data);
          }
        } else {
          console.warn('📧 Could not find user email for completion notification');
          console.warn('📧 User error:', userError);
          console.warn('📧 User profile:', userProfile);
        }
      } catch (emailError) {
        console.error('❌ Error in email/token process:', emailError);
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

async function callGeminiAnalysis(parameters: any) {
  try {
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/orbit-gemini-analysis`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'x-session-id': crypto.randomUUID()
        },
        body: JSON.stringify({
          tool: 'analyze_image',
          parameters
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Gemini analysis failed');
    }

    const result = await response.json();
    return result.result;

  } catch (error) {
    throw new Error(`Failed to call Gemini analysis: ${error.message}`);
  }
}

console.log('ORBIT Batch Processing Edge Function deployed and ready');