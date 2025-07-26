import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://cdn.skypack.dev/stripe@13.11.0?dts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/+esm";

// Security-enhanced CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://orbit-image-nexus.lovable.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Enhanced environment variable validation
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
      console.error("Missing required environment variables");
      return new Response("Server configuration error", { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseServiceKey,
      { auth: { persistSession: false } }
    );

    const signature = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!signature || !webhookSecret) {
      console.error("Missing stripe signature or webhook secret");
      return new Response("Missing signature or secret", { status: 400 });
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error(`Webhook signature verification failed:`, err);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    console.log(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`Processing payment intent: ${paymentIntent.id}`);
        
        // Get the checkout session associated with this payment intent
        let checkoutSessionId = null;
        try {
          const sessions = await stripe.checkout.sessions.list({
            payment_intent: paymentIntent.id,
            limit: 1
          });
          
          if (sessions.data.length > 0) {
            checkoutSessionId = sessions.data[0].id;
            console.log(`Found checkout session: ${checkoutSessionId}`);
          } else {
            console.log(`No checkout session found for payment intent: ${paymentIntent.id}`);
            // Try using the payment intent ID directly as fallback
            checkoutSessionId = paymentIntent.id;
            console.log(`Using payment intent ID as fallback: ${checkoutSessionId}`);
          }
        } catch (sessionError) {
          console.error("Error retrieving checkout session:", sessionError);
          // Use payment intent ID as fallback
          checkoutSessionId = paymentIntent.id;
          console.log(`Using payment intent ID as fallback due to error: ${checkoutSessionId}`);
        }

        // Check for duplicate webhook events - try both session ID and payment intent ID
        const eventId = event.id;
        const { data: existingPayment } = await supabaseClient
          .from("payments")
          .select("webhook_event_ids")
          .or(`stripe_payment_intent_id.eq.${checkoutSessionId},stripe_payment_intent_id_actual.eq.${paymentIntent.id}`)
          .single();

        if (existingPayment?.webhook_event_ids?.includes(eventId)) {
          console.log(`Webhook event ${eventId} already processed, skipping`);
          return new Response(JSON.stringify({ received: true, duplicate: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        // Get current webhook events for proper JSONB array operations - try both session ID and payment intent ID
        const { data: currentPayment } = await supabaseClient
          .from("payments")
          .select("stripe_webhook_events, webhook_event_ids")
          .or(`stripe_payment_intent_id.eq.${checkoutSessionId},stripe_payment_intent_id_actual.eq.${paymentIntent.id}`)
          .single();

        const currentWebhookEvents = currentPayment?.stripe_webhook_events || [];
        const currentEventIds = currentPayment?.webhook_event_ids || [];

        // Update payment status in database - try both session ID and payment intent ID
        const { error: paymentError } = await supabaseClient
          .from("payments")
          .update({
            payment_status: "succeeded",
            processed_at: new Date().toISOString(),
            stripe_payment_intent_id_actual: paymentIntent.id,
            stripe_webhook_events: [...currentWebhookEvents, event],
            webhook_event_ids: [...currentEventIds, eventId],
            last_webhook_at: new Date().toISOString()
          })
          .or(`stripe_payment_intent_id.eq.${checkoutSessionId},stripe_payment_intent_id_actual.eq.${paymentIntent.id}`);

        if (paymentError) {
          console.error("Error updating payment:", paymentError);
        }

        // Get current order webhook events - try both session ID and payment intent ID
        const { data: currentOrder } = await supabaseClient
          .from("orders")
          .select("webhook_events, webhook_event_ids")
          .or(`stripe_payment_intent_id.eq.${checkoutSessionId},stripe_payment_intent_id_actual.eq.${paymentIntent.id}`)
          .single();

        const currentOrderEvents = currentOrder?.webhook_events || [];
        const currentOrderEventIds = currentOrder?.webhook_event_ids || [];

        // Update order status - try both session ID and payment intent ID
        const { data: orderData, error: orderError } = await supabaseClient
          .from("orders")
          .update({
            payment_status: "completed",
            order_status: "processing",
            stripe_payment_intent_id_actual: paymentIntent.id,
            processing_stage: "initializing",
            processing_started_at: new Date().toISOString(),
            processing_completion_percentage: 10,
            webhook_events: [...currentOrderEvents, event],
            webhook_event_ids: [...currentOrderEventIds, eventId],
            last_webhook_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .or(`stripe_payment_intent_id.eq.${checkoutSessionId},stripe_payment_intent_id_actual.eq.${paymentIntent.id}`)
          .select()
          .single();

        if (orderError || !orderData) {
          console.error("Error updating order:", orderError);
          return new Response("Error updating order", { status: 500 });
        }

        console.log(`Order updated for session: ${checkoutSessionId}, Order ID: ${orderData.id}`);

        // Trigger AI image processing with enhanced security
        try {
          console.log(`Starting image processing for order: ${orderData.id}`);
          
          const processingResponse = await fetch(
            `${supabaseUrl}/functions/v1/process-image-batch`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'x-webhook-source': 'stripe-webhook',
                'User-Agent': 'Supabase-Edge-Function/Stripe-Webhook'
              },
              body: JSON.stringify({
                orderId: orderData.id,
                analysisType: 'product' // Default analysis type
              })
            }
          );

          if (!processingResponse.ok) {
            const errorText = await processingResponse.text();
            console.error(`Image processing failed: ${errorText}`);
          } else {
            const processingResult = await processingResponse.json();
            console.log(`Image processing started successfully:`, processingResult);
          }
        } catch (processingError) {
          console.error("Error starting image processing:", processingError);
          // Don't fail the webhook, just log the error
        }

        console.log(`Payment succeeded and processing started for intent: ${paymentIntent.id}`);
        break;

      case "payment_intent.payment_failed":
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        const failedEventId = event.id;
        
        // Get the checkout session for failed payment
        let failedCheckoutSessionId = null;
        try {
          const failedSessions = await stripe.checkout.sessions.list({
            payment_intent: failedPayment.id,
            limit: 1
          });
          
          if (failedSessions.data.length > 0) {
            failedCheckoutSessionId = failedSessions.data[0].id;
          }
        } catch (sessionError) {
          console.error("Error retrieving checkout session for failed payment:", sessionError);
        }

        // Update failed payment with webhook events
        if (failedCheckoutSessionId) {
          const { data: failedCurrentPayment } = await supabaseClient
            .from("payments")
            .select("stripe_webhook_events, webhook_event_ids")
            .eq("stripe_payment_intent_id", failedCheckoutSessionId)
            .single();

          const failedCurrentEvents = failedCurrentPayment?.stripe_webhook_events || [];
          const failedCurrentEventIds = failedCurrentPayment?.webhook_event_ids || [];

          await supabaseClient
            .from("payments")
            .update({
              payment_status: "failed",
              failure_reason: failedPayment.last_payment_error?.message || "Payment failed",
              stripe_webhook_events: [...failedCurrentEvents, event],
              webhook_event_ids: [...failedCurrentEventIds, failedEventId],
              last_webhook_at: new Date().toISOString()
            })
            .eq("stripe_payment_intent_id", failedCheckoutSessionId);

          // Get current order webhook events for failed payment
          const { data: failedCurrentOrder } = await supabaseClient
            .from("orders")
            .select("webhook_events, webhook_event_ids")
            .eq("stripe_payment_intent_id", failedCheckoutSessionId)
            .single();

          const failedOrderEvents = failedCurrentOrder?.webhook_events || [];
          const failedOrderEventIds = failedCurrentOrder?.webhook_event_ids || [];

          await supabaseClient
            .from("orders")
            .update({
              payment_status: "failed",
              order_status: "failed",
              webhook_events: [...failedOrderEvents, event],
              webhook_event_ids: [...failedOrderEventIds, failedEventId],
              last_webhook_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("stripe_payment_intent_id", failedCheckoutSessionId);
        }

        console.log(`Payment failed for intent: ${failedPayment.id}`);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});