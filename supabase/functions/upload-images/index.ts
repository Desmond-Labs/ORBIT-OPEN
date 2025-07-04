import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UploadRequest {
  orderId: string;
  batchId: string;
  files: {
    name: string;
    size: number;
    type: string;
    data: string; // base64 encoded
  }[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData.user;
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { orderId, batchId, files }: UploadRequest = await req.json();

    if (!orderId || !batchId || !files || files.length === 0) {
      throw new Error('Missing required parameters: orderId, batchId, and files');
    }

    console.log(`📤 Starting upload of ${files.length} files for order ${orderId}`);

    const uploadedImages = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`📤 Processing file ${i + 1}/${files.length}: ${file.name}`);

      try {
        // Decode base64 data
        const fileData = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
        
        // Generate unique filename
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2);
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const storageFileName = `${timestamp}_${randomId}.${fileExtension}`;
        const storagePath = `${user.id}/raw_images/${storageFileName}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('orbit-uploads')
          .upload(storagePath, fileData, {
            contentType: file.type,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error(`❌ Upload failed for ${file.name}:`, uploadError);
          throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
        }

        console.log(`✅ File uploaded to storage: ${uploadData.path}`);

        // Create image record in database
        const { data: imageData, error: imageError } = await supabase
          .from('images')
          .insert({
            user_id: user.id,
            order_id: orderId,
            batch_id: batchId,
            original_filename: file.name,
            storage_path_original: uploadData.path,
            file_size: file.size,
            mime_type: file.type,
            processing_status: 'pending'
          })
          .select()
          .single();

        if (imageError) {
          console.error(`❌ Database insert failed for ${file.name}:`, imageError);
          // Clean up uploaded file
          await supabase.storage.from('orbit-uploads').remove([uploadData.path]);
          throw new Error(`Failed to save image metadata for ${file.name}: ${imageError.message}`);
        }

        uploadedImages.push({
          id: imageData.id,
          original_filename: imageData.original_filename,
          storage_path_original: imageData.storage_path_original,
          file_size: imageData.file_size,
          mime_type: imageData.mime_type
        });

        console.log(`✅ Image record created: ${imageData.id}`);

      } catch (fileError) {
        console.error(`❌ Error processing file ${file.name}:`, fileError);
        throw fileError;
      }
    }

    // Update batch with image count
    await supabase
      .from('batches')
      .update({ 
        image_count: uploadedImages.length,
        status: 'uploaded'
      })
      .eq('id', batchId);

    console.log(`🎉 Successfully uploaded ${uploadedImages.length} images`);

    return new Response(JSON.stringify({
      success: true,
      uploaded_images: uploadedImages,
      count: uploadedImages.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('❌ Image upload error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

console.log('ORBIT Image Upload Edge Function deployed and ready');