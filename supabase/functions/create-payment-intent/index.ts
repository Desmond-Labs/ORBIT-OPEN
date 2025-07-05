import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://cdn.skypack.dev/stripe@13.11.0?dts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/+esm";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequest {
  imageCount: number;
  batchName?: string;
  files?: {
    name: string;
    size: number;
    type: string;
    data: string; // base64 encoded file data
  }[];
}

serve(async (req) => {
  console.log("🚀 Function started, method:", req.method);
  
  if (req.method === "OPTIONS") {
    console.log("✅ OPTIONS request handled");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔍 Processing POST request");
    
    // Test environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    
    console.log("🔍 Environment check:");
    console.log("- SUPABASE_URL:", supabaseUrl ? "✅ Set" : "❌ Missing");
    console.log("- SUPABASE_ANON_KEY:", supabaseKey ? "✅ Set" : "❌ Missing");
    console.log("- STRIPE_SECRET_KEY:", stripeKey ? "✅ Set" : "❌ Missing");
    
    if (!supabaseUrl || !supabaseKey || !stripeKey) {
      console.log("❌ Missing required environment variables");
      return new Response(JSON.stringify({ 
        error: "Missing environment variables",
        details: {
          supabaseUrl: !!supabaseUrl,
          supabaseKey: !!supabaseKey,
          stripeKey: !!stripeKey
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
    
    console.log("🔍 Creating Supabase client");
    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    console.log("✅ Supabase client created");

    // Get authenticated user
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) {
      console.log("❌ Missing authorization header");
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    console.log("✅ Authorization header found");
    
    const token = authHeader.replace("Bearer ", "");
    console.log("🔍 Getting user from token");
    const { data, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      console.log("❌ Error getting user:", userError);
      return new Response(JSON.stringify({ error: "Authentication failed", details: userError }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const user = data.user;
    console.log("✅ User authenticated:", user?.id);

    if (!user) {
      console.log("❌ User object is null");
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    console.log("🔍 Parsing request body");
    const requestText = await req.text();
    console.log("📝 Raw request body:", requestText);
    
    let requestBody;
    try {
      requestBody = JSON.parse(requestText);
      console.log("✅ Request body parsed:", requestBody);
    } catch (parseError) {
      console.log("❌ Error parsing request body:", parseError);
      return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    
    const { imageCount, batchName }: PaymentRequest = requestBody;

    if (!imageCount || imageCount <= 0) {
      console.log("❌ Invalid image count:", imageCount);
      return new Response(JSON.stringify({ error: "Invalid image count" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    console.log("✅ Valid image count:", imageCount);

    // Test Stripe initialization
    console.log("🔍 Initializing Stripe");
    try {
      const stripe = new Stripe(stripeKey, {
        apiVersion: "2023-10-16",
      });
      console.log("✅ Stripe initialized successfully");
    } catch (stripeError) {
      console.log("❌ Error initializing Stripe:", stripeError);
      return new Response(JSON.stringify({ error: "Stripe initialization failed", details: stripeError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // For now, just return success to test if we get this far
    console.log("🎉 Test completed successfully");
    return new Response(JSON.stringify({
      success: true,
      message: "Function is working",
      userId: user.id,
      imageCount: imageCount
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("💥 Unexpected error:", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error", 
      details: error.message,
      stack: error.stack 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});