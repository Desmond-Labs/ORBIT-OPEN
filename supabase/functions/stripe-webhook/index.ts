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
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error(`Webhook signature verification failed:`, err);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    console.log(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Update payment status in database
        const { error: paymentError } = await supabaseClient
          .from("payments")
          .update({
            payment_status: "succeeded",
            processed_at: new Date().toISOString(),
            stripe_webhook_events: supabaseClient.rpc('array_append', {
              array_field: 'stripe_webhook_events',
              new_element: event
            })
          })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        if (paymentError) {
          console.error("Error updating payment:", paymentError);
          return new Response("Error updating payment", { status: 500 });
        }

        // Update order status
        const { error: orderError } = await supabaseClient
          .from("orders")
          .update({
            payment_status: "completed",
            order_status: "paid",
            updated_at: new Date().toISOString()
          })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        if (orderError) {
          console.error("Error updating order:", orderError);
          return new Response("Error updating order", { status: 500 });
        }

        console.log(`Payment succeeded for intent: ${paymentIntent.id}`);
        break;

      case "payment_intent.payment_failed":
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        
        await supabaseClient
          .from("payments")
          .update({
            payment_status: "failed",
            failure_reason: failedPayment.last_payment_error?.message || "Payment failed",
            stripe_webhook_events: supabaseClient.rpc('array_append', {
              array_field: 'stripe_webhook_events',
              new_element: event
            })
          })
          .eq("stripe_payment_intent_id", failedPayment.id);

        await supabaseClient
          .from("orders")
          .update({
            payment_status: "failed",
            order_status: "failed",
            updated_at: new Date().toISOString()
          })
          .eq("stripe_payment_intent_id", failedPayment.id);

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