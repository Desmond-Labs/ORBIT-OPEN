
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";
import { SupabaseAuthManager } from '../_shared/auth-verification.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log(`${req.method} request to get-thumbnails`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize enhanced authentication manager
    const authManager = new SupabaseAuthManager({
      supabaseUrl: Deno.env.get('SUPABASE_URL') || '',
      legacyServiceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      newSecretKey: Deno.env.get('sb_secret_key'),
      allowLegacy: true // Enable backward compatibility during migration
    });
    
    // Use service role client for storage access
    const supabaseClient = authManager.getSupabaseClient(true);

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

    const { images } = await req.json();

    if (!images || !Array.isArray(images)) {
      console.log("Missing or invalid images array in request body");
      return new Response(JSON.stringify({ error: "Images array is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log('Processing thumbnails for', images.length, 'images');

    const thumbnails: { [key: string]: string | null } = {};

    // Process each image
    for (const image of images) {
      if (!image.id || !image.storage_path_processed) {
        thumbnails[image.id] = null;
        continue;
      }

      try {
        console.log('Processing image:', image.id, 'Path:', image.storage_path_processed);
        
        // Try different bucket configurations with service role permissions
        const bucketsToTry = ['orbit-exports', 'orbit-images', 'processed_images'];
        let signedUrl = null;

        for (const bucket of bucketsToTry) {
          try {
            console.log(`Trying bucket: ${bucket} with path: ${image.storage_path_processed}`);
            
            const { data, error } = await supabaseClient.storage
              .from(bucket)
              .createSignedUrl(image.storage_path_processed, 3600, {
                transform: {
                  width: 128,
                  height: 128,
                  quality: 80
                }
              });

            if (!error && data?.signedUrl) {
              signedUrl = data.signedUrl;
              console.log(`Success with bucket: ${bucket}`);
              break;
            } else {
              console.log(`Failed with bucket: ${bucket}`, error?.message);
            }
          } catch (bucketError) {
            console.log(`Error with bucket: ${bucket}`, bucketError);
            continue;
          }
        }

        thumbnails[image.id] = signedUrl;
      } catch (error) {
        console.error('Error generating thumbnail for image:', image.id, error);
        thumbnails[image.id] = null;
      }
    }

    return new Response(JSON.stringify({ thumbnails }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('Error in get-thumbnails function:', error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
