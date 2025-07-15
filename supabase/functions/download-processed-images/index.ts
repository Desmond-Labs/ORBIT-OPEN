import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log(`${req.method} request to download-processed-images`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use SERVICE_ROLE_KEY for database access while maintaining user auth
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get authenticated user from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("Missing authorization header");
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.log("User authentication failed:", userError);
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    console.log('User authenticated:', user.id);

    const { orderId } = await req.json();

    if (!orderId) {
      console.log("Missing orderId in request body");
      return new Response(JSON.stringify({ error: "Order ID is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log('Processing download request for order:', orderId, 'user:', user.id);

    // Get order information and verify ownership
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (orderError || !order) {
      console.error('Order query failed:', orderError);
      return new Response(JSON.stringify({ error: "Order not found or access denied" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    console.log('Order found:', order.order_number);

    // Get all processed images for this order
    console.log('Searching for images with processing_status in: ["completed", "complete"]');
    const { data: images, error: imagesError } = await supabaseClient
      .from('images')
      .select('original_filename, storage_path_processed, processing_status')
      .eq('order_id', orderId)
      .in('processing_status', ['completed', 'complete'])
      .not('storage_path_processed', 'is', null);

    if (imagesError) {
      console.error('Images query failed:', imagesError);
      return new Response(JSON.stringify({ error: "Error fetching processed images" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!images || images.length === 0) {
      console.log('No processed images found for order:', orderId);
      return new Response(JSON.stringify({ error: "No processed images found for this order" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    console.log(`Found ${images.length} processed images for order ${orderId}`);

    // Create a ZIP file using the static import
    const zip = new JSZip();

    // Add each processed image to the ZIP
    for (const image of images) {
      try {
        if (!image.storage_path_processed) continue;

        // Download the file from Supabase storage
        const { data: fileData, error: downloadError } = await supabaseClient.storage
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

    const { error: downloadRecordError } = await supabaseClient
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
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});