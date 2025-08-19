import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/+esm";
import { SupabaseAuthManager } from '../_shared/auth-verification.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UploadRequest {
  orderId: string;
  // No longer need base64 - will receive FormData with actual files
}

// Supported MIME types
const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp',
  'image/gif'
];

// Basic file signature validation
function validateFileSignature(buffer: Uint8Array, mimeType: string): boolean {
  if (buffer.length < 8) return false;
  
  const header = buffer.subarray(0, 8);
  
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      return header[0] === 0xFF && header[1] === 0xD8;
    case 'image/png':
      return header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;
    case 'image/webp':
      return buffer.length >= 12 && 
             header.subarray(0, 4).every((byte, i) => byte === [0x52, 0x49, 0x46, 0x46][i]) &&
             header.subarray(8, 12).every((byte, i) => byte === [0x57, 0x45, 0x42, 0x50][i]);
    case 'image/gif':
      const gifHeader = String.fromCharCode(...header.subarray(0, 6));
      return gifHeader === 'GIF87a' || gifHeader === 'GIF89a';
    default:
      return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize enhanced authentication manager
    const authManager = new SupabaseAuthManager({
      supabaseUrl: Deno.env.get('SUPABASE_URL') || '',
      legacyAnonKey: Deno.env.get('SUPABASE_ANON_KEY'),
      newPublishableKey: Deno.env.get('sb_publishable_key'),
      legacyServiceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      newSecretKey: Deno.env.get('sb_secret_key'),
      allowLegacy: true // Enable backward compatibility during migration
    });
    
    // Create clients using enhanced authentication
    const supabaseClient = authManager.getSupabaseClient(false); // User client
    const supabaseService = authManager.getSupabaseClient(true); // Service client

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

    // Parse FormData for direct file uploads
    const formData = await req.formData();
    const orderId = formData.get("orderId") as string;

    if (!orderId) {
      return new Response(JSON.stringify({ error: "Invalid request: missing orderId" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Get all files from FormData
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("file_") && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return new Response(JSON.stringify({ error: "No files provided" }), {
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

    // Validate batch size
    const maxBatchSize = 20;
    if (files.length > maxBatchSize) {
      return new Response(JSON.stringify({ 
        error: `Batch size exceeds limit. Maximum ${maxBatchSize} files allowed.` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Create folder structure: {order_id}_{user_id}/original/
    const folderPath = `${orderId}_${user.id}/original`;
    
    console.log(`✅ Starting direct upload of ${files.length} files to folder: ${folderPath}`);

    const uploadResults = [];
    const imageRecords = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        console.log(`🔍 Processing file ${i + 1}/${files.length}: ${file.name} (${file.size} bytes)`);
        
        // Validate file type
        if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
          console.error(`❌ Unsupported file type: ${file.type}`);
          uploadResults.push({
            filename: file.name,
            success: false,
            error: `Unsupported file type: ${file.type}`
          });
          continue;
        }

        // Validate file size
        const maxFileSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxFileSize) {
          console.error(`❌ File too large: ${file.size} bytes`);
          uploadResults.push({
            filename: file.name,
            success: false,
            error: `File size exceeds 50MB limit`
          });
          continue;
        }

        if (file.size === 0) {
          console.error(`❌ Empty file: ${file.name}`);
          uploadResults.push({
            filename: file.name,
            success: false,
            error: 'File is empty'
          });
          continue;
        }

        // Read file for signature validation
        const arrayBuffer = await file.arrayBuffer();
        const fileData = new Uint8Array(arrayBuffer);

        // Validate file signature
        if (!validateFileSignature(fileData, file.type)) {
          console.error(`❌ Invalid file signature for ${file.name}`);
          uploadResults.push({
            filename: file.name,
            success: false,
            error: `Invalid file signature for ${file.type}`
          });
          continue;
        }

        // Sanitize filename - preserve original name, only replace problematic characters
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_() ]/g, '_');
        const fileName = sanitizedName;
        const filePath = `${folderPath}/${fileName}`;
        
        console.log(`📤 Uploading file directly: ${filePath} (${file.size} bytes)`);

        // Upload file directly to storage bucket with original filename
        // upsert: false prevents overwriting existing files with same name
        const { data: uploadData, error: uploadError } = await supabaseService.storage
          .from("orbit-images")
          .upload(filePath, fileData, {
            contentType: file.type,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error(`❌ Error uploading file ${fileName}:`, uploadError);
          uploadResults.push({
            filename: file.name,
            success: false,
            error: uploadError.message
          });
          continue;
        }

        console.log(`✅ Successfully uploaded directly: ${filePath}`);

        // Create image record in database
        const { data: imageRecord, error: imageError } = await supabaseService
          .from("images")
          .insert({
            order_id: orderId,
            batch_id: order.batch_id,
            user_id: user.id,
            original_filename: file.name,
            storage_path_original: filePath,
            mime_type: file.type,
            file_size: file.size,
            processing_status: "pending"
          })
          .select()
          .single();

        if (imageError) {
          console.error(`⚠️ Error creating image record for ${fileName}:`, imageError);
        } else {
          imageRecords.push(imageRecord);
          console.log(`📝 Created image record for ${fileName}`);
        }

        uploadResults.push({
          filename: file.name,
          success: true,
          path: filePath,
          size: file.size
        });

      } catch (error) {
        console.error(`💥 Error processing file ${file.name}:`, error);
        uploadResults.push({
          filename: file.name,
          success: false,
          error: `Processing failed: ${error.message}`
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
      folderPath,
      method: "direct_upload" // Indicates this used the optimized method
    };

    console.log("Direct upload completed:", response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Direct upload error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});