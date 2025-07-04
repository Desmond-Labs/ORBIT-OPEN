-- Step 4: Database Schema Enhancements

-- Add payment intent ID and processing fields to orders table
ALTER TABLE public.orders 
ADD COLUMN stripe_payment_intent_id_actual text,
ADD COLUMN processing_stage text DEFAULT 'pending',
ADD COLUMN processing_started_at timestamp with time zone,
ADD COLUMN processing_completion_percentage integer DEFAULT 0,
ADD COLUMN webhook_events jsonb DEFAULT '[]'::jsonb;

-- Add payment intent ID to payments table  
ALTER TABLE public.payments
ADD COLUMN stripe_payment_intent_id_actual text;

-- Add processing status tracking to batches table
ALTER TABLE public.batches
ADD COLUMN processing_stage text DEFAULT 'pending',
ADD COLUMN processing_completion_percentage integer DEFAULT 0,
ADD COLUMN webhook_triggered boolean DEFAULT false;

-- Add index for better performance on payment intent lookups
CREATE INDEX IF NOT EXISTS idx_orders_payment_intent_actual ON public.orders(stripe_payment_intent_id_actual);
CREATE INDEX IF NOT EXISTS idx_payments_payment_intent_actual ON public.payments(stripe_payment_intent_id_actual);

-- Add index for processing stage queries
CREATE INDEX IF NOT EXISTS idx_orders_processing_stage ON public.orders(processing_stage);
CREATE INDEX IF NOT EXISTS idx_batches_processing_stage ON public.batches(processing_stage);