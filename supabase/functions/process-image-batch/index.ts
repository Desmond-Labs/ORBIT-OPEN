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
    // Initialize Supabase with service role for full access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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
      throw new Error('No images found for processing');
    }

    console.log(`Processing ${images.length} images for batch ${batch.id}`);

    // 4. Update batch status to processing
    await supabase
      .from('batches')
      .update({
        status: 'processing',
        processing_start_time: new Date().toISOString()
      })
      .eq('id', batch.id);

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

    // 7. Update order status
    await supabase
      .from('orders')
      .update({
        order_status: finalStatus === 'completed' ? 'completed' : 'completed_with_errors',
        completed_at: new Date().toISOString()
      })
      .eq('id', orderId);

    // 7.5. Send completion email if order is successfully completed
    if (finalStatus === 'completed') {
      try {
        // Get user email from orbit_users table using the order's user_id
        const { data: userProfile, error: userError } = await supabase
          .from('orbit_users')
          .select('email')
          .eq('id', order.user_id)
          .single();

        if (!userError && userProfile?.email) {
          console.log(`Sending completion email to: ${userProfile.email}`);
          
          const emailResult = await supabase.functions.invoke('send-order-completion-email', {
            body: {
              orderId: orderId,
              userEmail: userProfile.email,
              imageCount: successCount,
              downloadUrl: downloadInfo ? `${Deno.env.get('FRONTEND_URL') || 'https://ufdcvxmizlzlnyyqpfck.supabase.co'}/processing?order=${orderId}&step=processing` : undefined
            }
          });

          if (emailResult.error) {
            console.error('Failed to send completion email:', emailResult.error);
          } else {
            console.log('Completion email sent successfully');
          }
        } else {
          console.warn('Could not find user email for completion notification');
        }
      } catch (emailError) {
        console.error('Error sending completion email:', emailError);
        // Don't fail the entire process if email fails
      }
    }

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
    console.error('Batch processing error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
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