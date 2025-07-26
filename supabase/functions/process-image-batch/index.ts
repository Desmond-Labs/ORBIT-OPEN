// ORBIT Batch Image Processing Edge Function
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Security-enhanced CORS headers
const getAllowedOrigins = () => {
  const frontendUrl = Deno.env.get('FRONTEND_URL');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  return [
    frontendUrl,
    supabaseUrl,
    'https://ufdcvxmizlzlnyyqpfck.supabase.co',
    'https://orbit-image-forge.lovable.app'
  ].filter(Boolean);
};

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://orbit-image-forge.lovable.app', // Restrict to specific domain
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '3600',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
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
    // Validate origin
    const origin = req.headers.get('origin');
    const allowedOrigins = getAllowedOrigins();
    if (origin && !allowedOrigins.includes(origin)) {
      console.warn(`Blocked request from unauthorized origin: ${origin}`);
      return new Response(JSON.stringify({ error: 'Unauthorized origin' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase with service role for full access
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Enhanced authentication handling for webhooks and user requests
    const authHeader = req.headers.get('Authorization');
    let user = null;
    let isWebhookRequest = false;

    if (!authHeader) {
      // Check if this is a webhook request (from stripe-webhook function)
      const userAgent = req.headers.get('user-agent');
      if (userAgent?.includes('Deno') || req.headers.get('x-webhook-source')) {
        isWebhookRequest = true;
        console.log('Processing webhook request with service role authentication');
      } else {
        throw new Error('Missing authentication header');
      }
    } else {
      const token = authHeader.replace('Bearer ', '');
      if (token === supabaseKey) {
        // Service role authentication (from webhooks)
        isWebhookRequest = true;
        console.log('Processing request with service role authentication');
      } else {
        // User authentication
        const { data: userData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !userData.user) {
          throw new Error('User not authenticated');
        }
        user = userData.user;
      }
    }

    // Enhanced input validation
    const requestBody = await req.json();
    const { orderId, analysisType = 'product' }: ProcessBatchRequest = requestBody;

    // Input sanitization
    if (!orderId || typeof orderId !== 'string' || !orderId.match(/^[a-f0-9-]+$/)) {
      throw new Error('Invalid Order ID format');
    }

    if (analysisType && !['product', 'lifestyle'].includes(analysisType)) {
      throw new Error('Invalid analysis type');
    }

    console.log(`Starting batch processing for order: ${orderId}`);

    // 1. Get the order and verify ownership (skip user check for webhook requests)
    let orderQuery = supabase
      .from('orders')
      .select('*, batches(*)')
      .eq('id', orderId);
    
    if (!isWebhookRequest && user) {
      orderQuery = orderQuery.eq('user_id', user.id);
    }
    
    const { data: order, error: orderError } = await orderQuery.single();

    if (orderError || !order) {
      throw new Error('Order not found or access denied');
    }

    // 2. Get the batch associated with this order (should already exist)
    let batch = order.batches;
    if (!batch) {
      throw new Error('No batch found for this order. Order should have been created with a batch.');
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

        // Call Gemini analysis function with enhanced security
        const analysisResult = await callGeminiAnalysis({
          image_path: image.storage_path_original,
          analysis_type: analysisType,
          supabase_url: supabaseUrl,
          supabase_key: supabaseKey
        });

        // Sanitize analysis results before storing
        const sanitizedAnalysis = analysisResult.metadata ? 
          JSON.parse(JSON.stringify(analysisResult.metadata).replace(/<script[^>]*>.*?<\/script>/gi, '')) : 
          null;
        
        const sanitizedRawText = analysisResult.raw_text ? 
          analysisResult.raw_text.replace(/<script[^>]*>.*?<\/script>/gi, '') : 
          null;

        // Update image with analysis results
        await supabase
          .from('images')
          .update({
            processing_status: 'complete',
            processed_at: new Date().toISOString(),
            ai_analysis: sanitizedAnalysis,
            gemini_analysis_raw: sanitizedRawText,
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
      // Get user email from orbit_users table
      const userId = isWebhookRequest ? order.user_id : user.id;
      const { data: userProfile, error: userError } = await supabase
        .from('orbit_users')
        .select('email')
        .eq('id', userId)
        .single();

        if (!userError && userProfile?.email) {
          console.log(`Sending completion email to: ${userProfile.email}`);
          
          // Sanitize email for security
          const sanitizedEmail = userProfile.email.trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
            console.error('Invalid email format detected');
            return;
          }
          
          const emailResult = await supabase.functions.invoke('send-order-completion-email', {
            body: {
              orderId: orderId,
              userEmail: sanitizedEmail,
              imageCount: successCount,
              downloadUrl: downloadInfo ? `${Deno.env.get('FRONTEND_URL') || 'https://orbit-image-forge.lovable.app'}/processing?order=${orderId}&step=processing` : undefined
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
    if (successCount > 0 && (!isWebhookRequest || order.user_id)) {
      const userId = isWebhookRequest ? order.user_id : user.id;
      const { data: downloadData, error: downloadError } = await supabase
        .from('file_downloads')
        .insert({
          user_id: userId,
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