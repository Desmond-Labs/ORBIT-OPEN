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

    const { imageCount, batchName }: PaymentRequest = await req.json();

    if (!imageCount || imageCount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid image count" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Calculate tier pricing using the database function
    const { data: pricingData, error: pricingError } = await supabaseClient
      .rpc('calculate_tier_pricing', {
        user_id_param: user.id,
        image_count_param: imageCount
      });

    if (pricingError) {
      console.error("Error calculating pricing:", pricingError);
      return new Response(JSON.stringify({ error: "Error calculating pricing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const totalCost = pricingData.total_cost;
    const amountInCents = Math.round(totalCost * 100);

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Get or create Stripe customer
    const { data: userData } = await supabaseClient
      .from("orbit_users")
      .select("stripe_customer_id, email")
      .eq("id", user.id)
      .single();

    let customerId = userData?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userData?.email || user.email,
        metadata: { user_id: user.id }
      });
      customerId = customer.id;

      // Update user with Stripe customer ID
      await supabaseClient
        .from("orbit_users")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
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

    const { data: order, error: orderError } = await supabaseService
      .from("orders")
      .insert({
        user_id: user.id,
        order_number: orderNumber,
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