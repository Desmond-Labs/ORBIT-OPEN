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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 Starting create-payment-intent function");
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    console.log("✅ Supabase client initialized");

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
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
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
    const requestBody = await req.json();
    console.log("📝 Request body:", requestBody);
    const { imageCount, batchName }: PaymentRequest = requestBody;

    if (!imageCount || imageCount <= 0) {
      console.log("❌ Invalid image count:", imageCount);
      return new Response(JSON.stringify({ error: "Invalid image count" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    console.log("✅ Valid image count:", imageCount);

    // Calculate tier pricing using the database function
    console.log("🔍 Calculating tier pricing");
    const { data: pricingData, error: pricingError } = await supabaseClient
      .rpc('calculate_tier_pricing', {
        user_id_param: user.id,
        image_count_param: imageCount
      });

    if (pricingError) {
      console.error("❌ Error calculating pricing:", pricingError);
      return new Response(JSON.stringify({ error: "Error calculating pricing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
    console.log("✅ Pricing calculated:", pricingData);

    const totalCost = pricingData.total_cost;
    const amountInCents = Math.round(totalCost * 100);
    console.log("💰 Total cost:", totalCost, "Amount in cents:", amountInCents);

    // Initialize Stripe
    console.log("🔍 Initializing Stripe");
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });
    console.log("✅ Stripe initialized");

    // Get or create Stripe customer
    console.log("🔍 Getting user data from orbit_users");
    const { data: userData, error: userDataError } = await supabaseClient
      .from("orbit_users")
      .select("stripe_customer_id, email")
      .eq("id", user.id)
      .maybeSingle();

    if (userDataError) {
      console.error("❌ Error getting user data:", userDataError);
      return new Response(JSON.stringify({ error: "Error fetching user data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
    console.log("✅ User data retrieved:", userData);

    // If user doesn't exist in orbit_users, create the record
    if (!userData) {
      console.log("🔍 Creating new orbit_users record");
      const { error: createUserError } = await supabaseClient
        .from("orbit_users")
        .insert({
          id: user.id,
          email: user.email
        });
      
      if (createUserError) {
        console.error("❌ Error creating orbit_users record:", createUserError);
        return new Response(JSON.stringify({ error: "Error creating user record" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }
      console.log("✅ Created new orbit_users record");
    }

    let customerId = userData?.stripe_customer_id;
    console.log("🔍 Current customer ID:", customerId);

    if (!customerId) {
      console.log("🔍 Creating new Stripe customer");
      const customer = await stripe.customers.create({
        email: userData?.email || user.email,
        metadata: { user_id: user.id }
      });
      customerId = customer.id;
      console.log("✅ Created Stripe customer:", customerId);

      // Update user with Stripe customer ID
      console.log("🔍 Updating user with Stripe customer ID");
      const { error: updateError } = await supabaseClient
        .from("orbit_users")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
        
      if (updateError) {
        console.error("❌ Error updating user with customer ID:", updateError);
      } else {
        console.log("✅ Updated user with Stripe customer ID");
      }
    }

    // Determine frontend URL dynamically with intelligent fallback
    const getSmartFrontendUrl = () => {
      // Priority 1: Environment variable (production setting)
      const envUrl = Deno.env.get("FRONTEND_URL");
      console.log("🔍 DEBUG - FRONTEND_URL env var:", envUrl);
      
      if (envUrl) {
        const finalEnvUrl = envUrl.startsWith('http') ? envUrl : `https://${envUrl}`;
        console.log("✅ Using FRONTEND_URL:", finalEnvUrl);
        return finalEnvUrl;
      }
      
      // Priority 2: Request origin header (current domain)
      const origin = req.headers.get("origin");
      console.log("🔍 DEBUG - Origin header:", origin);
      
      if (origin) {
        // Ensure production URLs use HTTPS
        if (origin.includes('lovable.app') && origin.startsWith('http:')) {
          const httpsOrigin = origin.replace('http:', 'https:');
          console.log("✅ Using origin (converted to HTTPS):", httpsOrigin);
          return httpsOrigin;
        }
        console.log("✅ Using origin:", origin);
        return origin;
      }
      
      // Priority 3: Intelligent fallback based on environment detection
      const host = req.headers.get("host");
      console.log("🔍 DEBUG - Host header:", host);
      
      if (host) {
        if (host.includes('localhost') || host.includes('127.0.0.1')) {
          console.log("✅ Using localhost fallback");
          return "http://localhost:5173";
        }
        if (host.includes('lovable.app')) {
          const hostUrl = `https://${host}`;
          console.log("✅ Using host-based URL:", hostUrl);
          return hostUrl;
        }
        // Default to HTTPS for unknown production domains
        const httpsHost = `https://${host}`;
        console.log("✅ Using HTTPS host fallback:", httpsHost);
        return httpsHost;
      }
      
      // Final fallback for development
      console.log("⚠️ Using final fallback: localhost");
      return "http://localhost:5173";
    };

    const frontendUrl = getSmartFrontendUrl();
    console.log("🎯 FINAL frontendUrl being used:", frontendUrl);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `ORBIT Image Analysis - ${imageCount} images`,
              description: `AI-powered analysis for ${imageCount} product images`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${frontendUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/`,
      metadata: {
        user_id: user.id,
        image_count: imageCount.toString(),
        batch_name: batchName || `Batch ${new Date().toISOString()}`
      },
    });

    // Create order record using service role client
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Generate order number
    const { data: orderNumber } = await supabaseService.rpc('generate_order_number');

    // Create batch first
    const { data: batch, error: batchError } = await supabaseService
      .from("batches")
      .insert({
        user_id: user.id,
        name: batchName || `Batch ${new Date().toISOString()}`,
        status: 'created',
        image_count: imageCount,
        quality_level: 'standard'
      })
      .select()
      .single();

    if (batchError) {
      console.error("Error creating batch:", batchError);
      return new Response(JSON.stringify({ error: "Error creating batch" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    console.log("✅ Batch created:", batch.id);

    const { data: order, error: orderError } = await supabaseService
      .from("orders")
      .insert({
        user_id: user.id,
        order_number: orderNumber,
        batch_id: batch.id,
        image_count: imageCount,
        base_cost: totalCost,
        total_cost: totalCost,
        cost_breakdown: pricingData,
        stripe_payment_intent_id: session.id,
        stripe_customer_id: customerId,
        payment_status: "pending",
        order_status: "payment_pending"
      })
      .select()
      .single();

    if (orderError) {
      console.error("Error creating order:", orderError);
      return new Response(JSON.stringify({ error: "Error creating order" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Create payment record
    const { error: paymentError } = await supabaseService
      .from("payments")
      .insert({
        order_id: order.id,
        user_id: user.id,
        stripe_payment_intent_id: session.id,
        amount: totalCost,
        payment_status: "pending"
      });

    if (paymentError) {
      console.error("Error creating payment record:", paymentError);
      return new Response(JSON.stringify({ error: "Error creating payment record" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    return new Response(JSON.stringify({
      checkout_url: session.url,
      session_id: session.id,
      order_id: order.id,
      batch_id: batch.id,
      amount: totalCost,
      tier_breakdown: pricingData
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Payment intent creation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});