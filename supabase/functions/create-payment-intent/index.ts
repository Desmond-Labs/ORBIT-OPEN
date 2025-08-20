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

    const { imageCount, batchName }: PaymentRequest = await req.json();

    if (!imageCount || imageCount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid image count" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Calculate hybrid pricing (free daily + paid excess) using the database function
    const { data: pricingData, error: pricingError } = await supabaseClient
      .rpc('calculate_hybrid_pricing', {
        user_id_param: user.id,
        image_count_param: imageCount  
      });

    if (pricingError) {
      console.error("Error calculating hybrid pricing:", pricingError);
      return new Response(JSON.stringify({ error: "Error calculating pricing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    console.log("💰 Hybrid pricing breakdown:", pricingData);

    const totalCost = pricingData.total_cost;
    const freeImagesUsed = pricingData.free_images_used;
    const paidImages = pricingData.paid_images;
    const isFreeOnly = pricingData.is_free_only;
    const amountInCents = Math.round(totalCost * 100);

    // Only initialize Stripe if payment is needed
    let stripe: Stripe | null = null;
    if (!isFreeOnly) {
      stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2023-10-16",
      });
    }

    // Get or create Stripe customer only if needed
    let customerId = null;
    if (!isFreeOnly) {
      const userDataPromise = supabaseClient
        .from("orbit_users")
        .select("stripe_customer_id, email")
        .eq("id", user.id)
        .single();

      const { data: userData } = await userDataPromise;
      customerId = userData?.stripe_customer_id;

      // Create customer in parallel with other operations if needed
      if (!customerId && stripe) {
        const customer = await stripe.customers.create({
          email: userData?.email || user.email,
          metadata: { user_id: user.id }
        });
        customerId = customer.id;

        // Update user with Stripe customer ID (don't await, run in background)
        supabaseClient
          .from("orbit_users")
          .update({ stripe_customer_id: customerId })
          .eq("id", user.id)
          .then(() => console.log('Customer ID updated'));
      }
    }

    let session = null;
    let checkoutUrl = null;
    let paymentIntentId = null;

    // Create checkout session only for paid orders
    if (!isFreeOnly && totalCost > 0 && stripe) {
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `ORBIT Image Analysis - ${imageCount} images`,
                description: `${freeImagesUsed} free images + ${paidImages} paid images`,
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${Deno.env.get("FRONTEND_URL") || "http://localhost:3000"}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${Deno.env.get("FRONTEND_URL") || "http://localhost:3000"}/`,
        metadata: {
          user_id: user.id,
          image_count: imageCount.toString(),
          free_images: freeImagesUsed.toString(),
          paid_images: paidImages.toString(),
          batch_name: batchName || `Batch ${new Date().toISOString()}`
        },
      });
      
      checkoutUrl = session.url;
      paymentIntentId = session.id;
    }

    // Create order record using service role client
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Parallel database operations for better performance
    const orderNumberPromise = supabaseService.rpc('generate_order_number');
    
    // Create batch and get order number in parallel
    const [{ data: orderNumber }, batchResult] = await Promise.all([
      orderNumberPromise,
      supabaseService
        .from("batches")
        .insert({
          user_id: user.id,
          name: batchName || `Batch ${new Date().toISOString()}`,
          status: "pending",
          image_count: imageCount,
          quality_level: "standard"
        })
        .select()
        .single()
    ]);

    const { data: batch, error: batchError } = batchResult;
    if (batchError) {
      console.error("Error creating batch:", batchError);
      return new Response(JSON.stringify({ error: "Error creating batch" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Create order and payment record in parallel
    const [orderResult, paymentResult] = await Promise.all([
      supabaseService
        .from("orders")
        .insert({
          user_id: user.id,
          batch_id: batch.id,
          order_number: orderNumber,
          image_count: imageCount,
          base_cost: totalCost,
          total_cost: totalCost,
          cost_breakdown: pricingData,
          stripe_payment_intent_id: paymentIntentId,
          stripe_customer_id: customerId,
          payment_status: isFreeOnly ? "completed" : "pending",
          order_status: isFreeOnly ? "ready_for_processing" : "payment_pending",
          metadata: {
            free_images_used: freeImagesUsed,
            paid_images: paidImages,
            is_free_only: isFreeOnly,
            daily_limit_applied: true
          }
        })
        .select()
        .single(),
      // Start payment record creation early
      new Promise(resolve => setTimeout(resolve, 0)) // Placeholder for parallel execution
    ]);

    const { data: order, error: orderError } = orderResult;
    if (orderError) {
      console.error("Error creating order:", orderError);
      return new Response(JSON.stringify({ error: "Error creating order" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Update batch with order_id and create payment record in parallel
    await Promise.all([
      supabaseService
        .from("batches")
        .update({ order_id: order.id })
        .eq("id", batch.id),
      supabaseService
        .from("payments")
        .insert({
          order_id: order.id,
          user_id: user.id,
          stripe_payment_intent_id: paymentIntentId,
          amount: totalCost,
          payment_status: isFreeOnly ? "completed" : "pending",
          metadata: {
            free_images_used: freeImagesUsed,
            paid_images: paidImages,
            is_free_only: isFreeOnly
          }
        })
    ]);

    // Payment record creation is handled in parallel above

    // If free only, increment daily usage and return success
    if (isFreeOnly) {
      await supabaseService.rpc('increment_daily_usage', {
        user_id_param: user.id,
        images_count: freeImagesUsed
      });
      
      return new Response(JSON.stringify({
        success: true,
        order_id: order.id,
        batch_id: batch.id,
        order_number: orderNumber,
        total_cost: 0,
        free_images_used: freeImagesUsed,
        paid_images: 0,
        is_free_only: true,
        ready_for_upload: true,
        message: `🎉 ${freeImagesUsed} images processed for free using your daily limit!`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Return response for paid orders
    return new Response(JSON.stringify({
      checkout_url: checkoutUrl,
      session_id: session?.id,
      order_id: order.id,
      batch_id: batch.id,
      order_number: orderNumber,
      amount: totalCost,
      free_images_used: freeImagesUsed,
      paid_images: paidImages,
      is_free_only: false,
      tier_breakdown: pricingData,
      message: `${freeImagesUsed} images free + ${paidImages} images for $${totalCost}`
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