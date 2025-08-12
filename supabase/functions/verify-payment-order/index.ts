import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Create service role client for bypass RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req: Request) => {
  // Set CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId } = await req.json();
    
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('🔧 Service role lookup for session ID:', sessionId);

    // Use service role to bypass RLS and find the order
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .or(`stripe_payment_intent_id.eq.${sessionId},stripe_payment_intent_id_actual.eq.${sessionId}`)
      .single();

    if (error) {
      console.error('Service role lookup error:', error);
      return new Response(
        JSON.stringify({ error: 'Order not found', details: error.message }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!order) {
      return new Response(
        JSON.stringify({ error: 'No order found for session ID' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ Service role found order:', order.order_number);

    // Verify the requester owns the order (defense-in-depth)
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');
    if (jwt) {
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
      if (authError) {
        console.error('Auth check error:', authError);
      } else if (user && user.id !== order.user_id) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: order does not belong to user' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Return a sanitized subset of the order data (no tokens or Stripe IDs)
    const sanitizedOrder = {
      id: order.id,
      order_number: order.order_number,
      image_count: order.image_count,
      total_cost: order.total_cost,
      payment_status: order.payment_status,
      order_status: order.order_status,
      processing_stage: order.processing_stage,
      processing_completion_percentage: order.processing_completion_percentage,
      created_at: order.created_at,
      updated_at: order.updated_at,
    };

    return new Response(
      JSON.stringify(sanitizedOrder),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Verify payment order error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});