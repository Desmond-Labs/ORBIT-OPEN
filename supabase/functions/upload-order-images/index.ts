import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/+esm";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UploadRequest {
  orderId: string;
  files: {
    name: string;
    data: string; // base64 encoded file data
    type: string;
  }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    if (!user) {
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { orderId, files }: UploadRequest = await req.json();

    if (!orderId || !files || files.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid request: missing orderId or files" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Verify the order belongs to the user
    const { data: order, error: orderError } = await supabaseService
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found or unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // Create folder structure: {order_id}_{user_id}/original/
    const folderPath = `${orderId}_${user.id}/original`;
    
    console.log(`Uploading ${files.length} files to folder: ${folderPath}`);

    const uploadResults = [];
    const imageRecords = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        // Decode base64 file data
        const fileData = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
        
        // Create unique filename to avoid conflicts
        const timestamp = Date.now();
        const fileName = `${timestamp}_${i}_${file.name}`;
        const filePath = `${folderPath}/${fileName}`;
        
        console.log(`Uploading file: ${filePath}`);

        // Upload file to storage bucket
        const { data: uploadData, error: uploadError } = await supabaseService.storage
          .from("orbit-images")
          .upload(filePath, fileData, {
            contentType: file.type,
            upsert: false
          });

        if (uploadError) {
          console.error(`Error uploading file ${fileName}:`, uploadError);
          uploadResults.push({
            filename: file.name,
            success: false,
            error: uploadError.message
          });
          continue;
        }

        console.log(`Successfully uploaded: ${filePath}`);

        // Create image record in database
        const { data: imageRecord, error: imageError } = await supabaseService
          .from("images")
          .insert({
            order_id: orderId,
            user_id: user.id,
            original_filename: file.name,
            storage_path_original: filePath,
            mime_type: file.type,
            file_size: fileData.length,
            processing_status: "pending"
          })
          .select()
          .single();

        if (imageError) {
          console.error(`Error creating image record for ${fileName}:`, imageError);
        } else {
          imageRecords.push(imageRecord);
        }

        uploadResults.push({
          filename: file.name,
          success: true,
          path: filePath,
          size: fileData.length
        });

      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        uploadResults.push({
          filename: file.name,
          success: false,
          error: error.message
        });
      }
    }

    // Update order status
    const successCount = uploadResults.filter(r => r.success).length;
    const { error: updateError } = await supabaseService
      .from("orders")
      .update({
        order_status: successCount > 0 ? "images_uploaded" : "upload_failed",
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("Error updating order status:", updateError);
    }

    const response = {
      orderId,
      totalFiles: files.length,
      successCount,
      failureCount: files.length - successCount,
      uploadResults,
      imageRecords,
      folderPath
    };

    console.log("Upload completed:", response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Upload error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});