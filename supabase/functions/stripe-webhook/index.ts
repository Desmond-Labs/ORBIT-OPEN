import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://cdn.skypack.dev/stripe@13.11.0?dts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/+esm";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
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
            order_status: "paid",
            processing_stage: "initializing",
            processing_completion_percentage: 0,
            stripe_payment_intent_id_actual: paymentIntent.id,
            webhook_events: [...currentOrderEvents, event],
            webhook_event_ids: [...currentOrderEventIds, eventId],
            last_webhook_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .or(`stripe_payment_intent_id.eq.${checkoutSessionId},stripe_payment_intent_id_actual.eq.${paymentIntent.id}`)
          .select()
          .single();

        if (orderError || !orderData) {
          console.error(`🚨 Error updating order for session ${checkoutSessionId}:`, orderError);
          console.error(`❌ Payment Intent ID: ${paymentIntent.id}`);
          console.error(`❌ Searched using query: stripe_payment_intent_id.eq.${checkoutSessionId} OR stripe_payment_intent_id_actual.eq.${paymentIntent.id}`);
          
          // Get debugging info to understand what's in the database
          try {
            const { data: debugOrders } = await supabaseClient
              .from('orders')
              .select('id, stripe_payment_intent_id, stripe_payment_intent_id_actual, created_at, payment_status')
              .order('created_at', { ascending: false })
              .limit(5);
            
            console.error(`❌ Recent orders in database:`, debugOrders);
          } catch (debugError) {
            console.error(`❌ Could not fetch debug orders:`, debugError);
          }
          
          return new Response(JSON.stringify({ 
            error: "Error updating order", 
            details: orderError?.message,
            searchedSessionId: checkoutSessionId,
            paymentIntentId: paymentIntent.id
          }), { 
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        console.log(`✅ Payment confirmed and order status updated for session: ${checkoutSessionId}, Order ID: ${orderData.id}`);
        console.log(`📋 Order ready for manual processing - Payment status: ${orderData.payment_status}, Order status: ${orderData.order_status}`);
        console.log(`🔄 Processing stage: ${orderData.processing_stage} (${orderData.processing_completion_percentage}%)`);
        
        // Note: Automatic processing removed - orders now require manual trigger for AI analysis

        console.log(`✅ Payment webhook completed successfully for intent: ${paymentIntent.id}`);
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