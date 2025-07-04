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

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData.user;
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { orderId, analysisType = 'product' }: ProcessBatchRequest = await req.json();

    if (!orderId) {
      throw new Error('Order ID is required');
    }

    console.log(`Starting batch processing for order: ${orderId}`);

    // 1. Get the order and verify ownership
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, batches(*)')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found or access denied');
    }

    // 2. Get the batch associated with this order
    let batch = order.batches;
    if (!batch) {
      // Create a new batch if none exists
      const { data: newBatch, error: batchError } = await supabase
        .from('batches')
        .insert({
          user_id: user.id,
          order_id: orderId,
          name: `Batch for Order ${order.order_number}`,
          status: 'processing',
          image_count: order.image_count,
          processing_start_time: new Date().toISOString(),
          quality_level: 'standard'
        })
        .select()
        .single();

      if (batchError) {
        throw new Error('Failed to create batch');
      }
      batch = newBatch;
    }

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

    // 8. Create download link if successful
    let downloadInfo = null;
    if (successCount > 0) {
      const { data: downloadData, error: downloadError } = await supabase
        .from('file_downloads')
        .insert({
          user_id: user.id,
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