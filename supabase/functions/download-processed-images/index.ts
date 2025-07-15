import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Processing download request for order:', orderId);

    // Get order information
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get all processed images for this order
    const { data: images, error: imagesError } = await supabase
      .from('images')
      .select('*')
      .eq('order_id', orderId)
      .eq('processing_status', 'completed')
      .not('storage_path_processed', 'is', null);

    if (imagesError) {
      console.error('Error fetching images:', imagesError);
      return new Response(
        JSON.stringify({ error: 'Error fetching processed images' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!images || images.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No processed images found for this order' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Found ${images.length} processed images for order ${orderId}`);

    // Create a ZIP file containing all processed images
    const JSZip = (await import('https://esm.sh/jszip@3.10.1')).default;
    const zip = new JSZip();

    // Add each processed image to the ZIP
    for (const image of images) {
      try {
        if (!image.storage_path_processed) continue;

        // Download the file from Supabase storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('processed_images')
          .download(image.storage_path_processed);

        if (downloadError) {
          console.error(`Error downloading image ${image.original_filename}:`, downloadError);
          continue;
        }

        if (fileData) {
          // Add file to ZIP with original filename
          const arrayBuffer = await fileData.arrayBuffer();
          zip.file(image.original_filename, arrayBuffer);
          console.log(`Added ${image.original_filename} to ZIP`);
        }
      } catch (error) {
        console.error(`Error processing image ${image.original_filename}:`, error);
        continue;
      }
    }

    // Generate the ZIP file
    const zipContent = await zip.generateAsync({ type: 'uint8array' });

    // Create a download record for tracking
    const downloadRecord = {
      user_id: order.user_id,
      order_id: orderId,
      file_paths: images.map(img => img.storage_path_processed).filter(Boolean),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      metadata: {
        order_number: order.order_number,
        image_count: images.length,
        download_type: 'processed_images_zip'
      }
    };

    const { error: downloadRecordError } = await supabase
      .from('file_downloads')
      .insert(downloadRecord);

    if (downloadRecordError) {
      console.error('Error creating download record:', downloadRecordError);
    }

    // Return the ZIP file
    const filename = `orbit-${order.order_number}-processed-images.zip`;
    
    return new Response(zipContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': zipContent.length.toString(),
      },
    });

  } catch (error) {
    console.error('Error in download-processed-images function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});