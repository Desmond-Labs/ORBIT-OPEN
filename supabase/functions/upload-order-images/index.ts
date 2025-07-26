import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/+esm";

// Security-enhanced CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://orbit-image-forge.lovable.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY", 
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

interface UploadRequest {
  orderId: string;
  files: {
    name: string;
    data: string; // base64 encoded file data
    type: string;
  }[];
}

// Supported MIME types
const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp',
  'image/gif'
];

// File validation function
function validateFile(file: { name: string; data: string; type: string }) {
  // Validate filename
  if (!file.name || typeof file.name !== 'string' || file.name.length === 0) {
    return { valid: false, error: 'Invalid filename' };
  }
  
  // Validate MIME type
  if (!file.type || !SUPPORTED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: `Unsupported file type: ${file.type}` };
  }
  
  // Validate base64 data
  if (!file.data || typeof file.data !== 'string') {
    return { valid: false, error: 'Invalid file data' };
  }
  
  // Decode and validate file size
  try {
    const fileData = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
    const maxFileSize = 50 * 1024 * 1024; // 50MB
    
    if (fileData.length > maxFileSize) {
      return { valid: false, error: `File size exceeds 50MB limit` };
    }
    
    if (fileData.length === 0) {
      return { valid: false, error: 'File is empty' };
    }
    
    return { valid: true, fileData, size: fileData.length };
  } catch (error) {
    return { valid: false, error: 'Invalid base64 data' };
  }
}

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
    // Enhanced environment variable validation
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error('Missing required Supabase environment variables');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    const supabaseService = createClient(
      supabaseUrl,
      supabaseServiceKey,
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

    // Enhanced input validation and sanitization
    const requestBody = await req.json();
    const { orderId, files }: UploadRequest = requestBody;

    // Validate orderId format
    if (!orderId || typeof orderId !== 'string' || !orderId.match(/^[a-f0-9-]+$/)) {
      return new Response(JSON.stringify({ error: "Invalid orderId format" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid request: missing or invalid files array" }), {
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
    
    console.log(`✅ Starting upload of ${files.length} files to folder: ${folderPath}`);

    const uploadResults = [];
    const imageRecords = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        console.log(`🔍 Processing file ${i + 1}/${files.length}: ${file.name}`);
        
        // Validate file
        const validation = validateFile(file);
        if (!validation.valid) {
          console.error(`❌ File validation failed for ${file.name}:`, validation.error);
          uploadResults.push({
            filename: file.name,
            success: false,
            error: validation.error
          });
          continue;
        }

        const fileData = validation.fileData;
        const fileSize = validation.size;

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

        // Enhanced filename sanitization
        const sanitizedName = file.name
          .replace(/[^a-zA-Z0-9.-]/g, '_')
          .replace(/_{2,}/g, '_')
          .replace(/^_+|_+$/g, '')
          .substring(0, 100); // Limit filename length
        const timestamp = Date.now();
        const fileName = `${timestamp}_${i}_${sanitizedName}`;
        const filePath = `${folderPath}/${fileName}`;
        
        console.log(`📤 Uploading file: ${filePath} (${fileSize} bytes)`);

        // Upload file to storage bucket
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

        console.log(`✅ Successfully uploaded: ${filePath}`);

        // Create image record in database
        const { data: imageRecord, error: imageError } = await supabaseService
          .from("images")
          .insert({
            order_id: orderId,
            user_id: user.id,
            original_filename: file.name,
            storage_path_original: filePath,
            mime_type: file.type,
            file_size: fileSize,
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
          size: fileSize
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