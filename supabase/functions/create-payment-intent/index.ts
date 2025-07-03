import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://cdn.skypack.dev/stripe@13.11.0?dts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
    const authHeader = req.headers.get("Authorization")!;
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

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      customer: customerId,
      metadata: {
        user_id: user.id,
        image_count: imageCount.toString(),
        batch_name: batchName || `Batch ${new Date().toISOString()}`
      },
      automatic_payment_methods: {
        enabled: true,
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
        stripe_payment_intent_id: paymentIntent.id,
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
        stripe_payment_intent_id: paymentIntent.id,
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
      client_secret: paymentIntent.client_secret,
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