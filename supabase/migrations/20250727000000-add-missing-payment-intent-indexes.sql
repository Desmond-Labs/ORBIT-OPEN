-- Migration: Add missing indexes for Stripe payment intent lookups
-- Created: 2025-07-27
-- Purpose: Fix performance issues with webhook order lookups

-- Add indexes for stripe_payment_intent_id_actual field on orders table
-- This field is used in webhook processing to find orders by payment intent ID
CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_id_actual 
ON public.orders (stripe_payment_intent_id_actual);

-- Add indexes for stripe_payment_intent_id field on orders table  
-- This field is used to store checkout session IDs
CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_id 
ON public.orders (stripe_payment_intent_id);

-- Add composite index for efficient webhook lookups using OR conditions
-- This supports the query: .or(`stripe_payment_intent_id.eq.${id},stripe_payment_intent_id_actual.eq.${id}`)
CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intents_composite
ON public.orders (stripe_payment_intent_id, stripe_payment_intent_id_actual);

-- Add similar indexes for payments table
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id_actual 
ON public.payments (stripe_payment_intent_id_actual);

CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id 
ON public.payments (stripe_payment_intent_id);

-- Add composite index for payments table OR queries
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intents_composite
ON public.payments (stripe_payment_intent_id, stripe_payment_intent_id_actual);

-- Add index on payment_status for efficient filtering in webhook processing
CREATE INDEX IF NOT EXISTS idx_orders_payment_status 
ON public.orders (payment_status);

-- Add index on order_status for efficient filtering
CREATE INDEX IF NOT EXISTS idx_orders_order_status 
ON public.orders (order_status);

-- Add GIN index for webhook_event_ids JSONB field (used for deduplication)
CREATE INDEX IF NOT EXISTS idx_orders_webhook_event_ids_gin 
ON public.orders USING gin (webhook_event_ids);

CREATE INDEX IF NOT EXISTS idx_payments_webhook_event_ids_gin 
ON public.payments USING gin (webhook_event_ids);

-- Add index for efficient recent orders lookup (used in debugging)
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc 
ON public.orders (created_at DESC);

-- Comments explaining the purpose of these indexes
COMMENT ON INDEX idx_orders_stripe_payment_intent_id_actual IS 'Index for webhook order lookups by actual Stripe payment intent ID';
COMMENT ON INDEX idx_orders_stripe_payment_intent_id IS 'Index for webhook order lookups by Stripe checkout session ID';
COMMENT ON INDEX idx_orders_stripe_payment_intents_composite IS 'Composite index for efficient OR queries on both Stripe ID fields';
COMMENT ON INDEX idx_orders_webhook_event_ids_gin IS 'GIN index for fast webhook event deduplication checks';