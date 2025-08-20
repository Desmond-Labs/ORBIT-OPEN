-- Drop the existing constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_status_check;

-- Create a new constraint with the additional values
ALTER TABLE public.orders ADD CONSTRAINT orders_order_status_check 
CHECK (order_status = ANY (ARRAY[
    'created'::text, 
    'payment_pending'::text, 
    'paid'::text, 
    'images_uploaded'::text,
    'upload_failed'::text,
    'processing'::text, 
    'completed'::text, 
    'failed'::text, 
    'cancelled'::text
]));