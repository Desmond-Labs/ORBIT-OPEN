-- Add batch tracking improvements and webhook event storage fixes

-- First, create a batch for any existing orders that don't have one
INSERT INTO public.batches (id, user_id, order_id, name, status, image_count)
SELECT 
    gen_random_uuid(),
    o.user_id,
    o.id,
    'Order #' || o.order_number,
    'pending',
    o.image_count
FROM public.orders o
WHERE o.batch_id IS NULL;

-- Update orders to reference their new batches
UPDATE public.orders 
SET batch_id = b.id
FROM public.batches b
WHERE public.orders.id = b.order_id 
AND public.orders.batch_id IS NULL;

-- Now make batch_id required for orders
ALTER TABLE public.orders 
ALTER COLUMN batch_id SET NOT NULL;

-- Add foreign key constraint from orders to batches
ALTER TABLE public.orders 
ADD CONSTRAINT fk_orders_batch_id 
FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_batch_id ON public.orders(batch_id);
CREATE INDEX IF NOT EXISTS idx_batches_order_id ON public.batches(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON public.payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_id ON public.orders(stripe_payment_intent_id);

-- Add webhook event deduplication tracking
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS webhook_event_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS webhook_event_ids jsonb DEFAULT '[]'::jsonb;

-- Add better webhook tracking
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS last_webhook_at timestamp with time zone;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS last_webhook_at timestamp with time zone;