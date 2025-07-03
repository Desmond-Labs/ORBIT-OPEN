-- ORBIT Database Enhancement Plan Implementation (Fixed)

-- 1. Enhanced orbit_users table
ALTER TABLE public.orbit_users 
ADD COLUMN IF NOT EXISTS billing_period_start timestamp with time zone DEFAULT date_trunc('month', now()),
ADD COLUMN IF NOT EXISTS billing_period_end timestamp with time zone DEFAULT (date_trunc('month', now()) + interval '1 month'),
ADD COLUMN IF NOT EXISTS monthly_spend_current numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_lifetime_spend numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS preferred_payment_method_id text,
ADD COLUMN IF NOT EXISTS tier_discount_eligible boolean DEFAULT false;

-- 2. Create orders table
CREATE TABLE public.orders (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.orbit_users(id) ON DELETE CASCADE,
    batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL,
    order_number text NOT NULL UNIQUE,
    image_count integer NOT NULL DEFAULT 0,
    base_cost numeric(10,2) NOT NULL DEFAULT 0,
    tier_discount numeric(10,2) DEFAULT 0,
    total_cost numeric(10,2) NOT NULL DEFAULT 0,
    cost_breakdown jsonb,
    payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled')),
    stripe_payment_intent_id text,
    stripe_customer_id text,
    order_status text DEFAULT 'created' CHECK (order_status IN ('created', 'payment_pending', 'paid', 'processing', 'completed', 'failed', 'cancelled')),
    estimated_completion_time timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    completed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb
);

-- 3. Create payments table
CREATE TABLE public.payments (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.orbit_users(id) ON DELETE CASCADE,
    stripe_payment_intent_id text NOT NULL,
    stripe_charge_id text,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'usd',
    payment_method text,
    payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded')),
    failure_reason text,
    refund_amount numeric(10,2) DEFAULT 0,
    stripe_webhook_events jsonb DEFAULT '[]'::jsonb,
    processed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);

-- 4. Create storage_buckets table
CREATE TABLE public.storage_buckets (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.orbit_users(id) ON DELETE CASCADE,
    bucket_name text NOT NULL UNIQUE,
    bucket_type text NOT NULL CHECK (bucket_type IN ('raw_images', 'processed_images', 'thumbnails', 'exports')),
    storage_size_bytes bigint DEFAULT 0,
    file_count integer DEFAULT 0,
    retention_days integer DEFAULT 30,
    cleanup_enabled boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    last_cleanup_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb
);

-- 5. Create file_downloads table
CREATE TABLE public.file_downloads (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.orbit_users(id) ON DELETE CASCADE,
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
    batch_id uuid REFERENCES public.batches(id) ON DELETE CASCADE,
    file_paths text[] NOT NULL,
    download_url text,
    access_token text UNIQUE,
    expires_at timestamp with time zone NOT NULL,
    download_count integer DEFAULT 0,
    max_downloads integer DEFAULT 10,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    last_accessed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb
);

-- 6. Enhanced batches table
ALTER TABLE public.batches 
ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS estimated_cost numeric(10,2),
ADD COLUMN IF NOT EXISTS actual_cost numeric(10,2),
ADD COLUMN IF NOT EXISTS tier_pricing_applied jsonb,
ADD COLUMN IF NOT EXISTS quality_level text DEFAULT 'standard' CHECK (quality_level IN ('basic', 'standard', 'premium')),
ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries integer DEFAULT 3;

-- 7. Enhanced images table
ALTER TABLE public.images 
ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS processing_cost numeric(10,2),
ADD COLUMN IF NOT EXISTS tier_price_applied numeric(10,2),
ADD COLUMN IF NOT EXISTS quality_settings jsonb,
ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS processing_duration_ms integer,
ADD COLUMN IF NOT EXISTS file_hash text,
ADD COLUMN IF NOT EXISTS thumbnail_path text;

-- 8. Enable RLS on all tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_downloads ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS Policies

-- Orders policies
CREATE POLICY "Users can view own orders" ON public.orders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders" ON public.orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders" ON public.orders
    FOR UPDATE USING (auth.uid() = user_id);

-- Payments policies
CREATE POLICY "Users can view own payments" ON public.payments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create payments" ON public.payments
    FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update payments" ON public.payments
    FOR UPDATE USING (true);

-- Storage buckets policies
CREATE POLICY "Users can view own storage buckets" ON public.storage_buckets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage storage buckets" ON public.storage_buckets
    FOR ALL WITH CHECK (true);

-- File downloads policies
CREATE POLICY "Users can view own downloads" ON public.file_downloads
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own downloads" ON public.file_downloads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own downloads" ON public.file_downloads
    FOR UPDATE USING (auth.uid() = user_id);

-- 10. Create pricing calculation function
CREATE OR REPLACE FUNCTION public.calculate_tier_pricing(
    user_id_param uuid,
    image_count_param integer,
    billing_period_start_param timestamp with time zone DEFAULT NULL
) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_monthly_images integer;
    tier_breakdown jsonb := '{"tiers": [], "total_cost": 0, "total_discount": 0}'::jsonb;
    remaining_images integer := image_count_param;
    current_tier integer := 1;
    tier_cost numeric := 0;
    total_cost numeric := 0;
    period_start timestamp with time zone;
BEGIN
    -- Get billing period start
    IF billing_period_start_param IS NULL THEN
        SELECT billing_period_start INTO period_start 
        FROM public.orbit_users WHERE id = user_id_param;
    ELSE
        period_start := billing_period_start_param;
    END IF;

    -- Get current monthly usage
    SELECT COALESCE(images_processed_this_month, 0) INTO current_monthly_images
    FROM public.orbit_users WHERE id = user_id_param;

    -- Tier 1: $3.75 for images 1-49
    IF current_monthly_images < 49 AND remaining_images > 0 THEN
        tier_cost := LEAST(remaining_images, 49 - current_monthly_images) * 3.75;
        tier_breakdown := jsonb_set(tier_breakdown, '{tiers}', 
            (tier_breakdown->'tiers') || jsonb_build_object(
                'tier', 1, 
                'range', '1-49', 
                'price_per_image', 3.75,
                'images', LEAST(remaining_images, 49 - current_monthly_images),
                'cost', tier_cost
            )
        );
        total_cost := total_cost + tier_cost;
        remaining_images := remaining_images - LEAST(remaining_images, 49 - current_monthly_images);
    END IF;

    -- Tier 2: $3.25 for images 50-99
    IF current_monthly_images < 99 AND remaining_images > 0 THEN
        tier_cost := LEAST(remaining_images, 50) * 3.25;
        tier_breakdown := jsonb_set(tier_breakdown, '{tiers}', 
            (tier_breakdown->'tiers') || jsonb_build_object(
                'tier', 2, 
                'range', '50-99', 
                'price_per_image', 3.25,
                'images', LEAST(remaining_images, 50),
                'cost', tier_cost
            )
        );
        total_cost := total_cost + tier_cost;
        remaining_images := remaining_images - LEAST(remaining_images, 50);
    END IF;

    -- Tier 3: $2.75 for images 100-249
    IF current_monthly_images < 249 AND remaining_images > 0 THEN
        tier_cost := LEAST(remaining_images, 150) * 2.75;
        tier_breakdown := jsonb_set(tier_breakdown, '{tiers}', 
            (tier_breakdown->'tiers') || jsonb_build_object(
                'tier', 3, 
                'range', '100-249', 
                'price_per_image', 2.75,
                'images', LEAST(remaining_images, 150),
                'cost', tier_cost
            )
        );
        total_cost := total_cost + tier_cost;
        remaining_images := remaining_images - LEAST(remaining_images, 150);
    END IF;

    -- Tier 4: $2.25 for images 250+
    IF remaining_images > 0 THEN
        tier_cost := remaining_images * 2.25;
        tier_breakdown := jsonb_set(tier_breakdown, '{tiers}', 
            (tier_breakdown->'tiers') || jsonb_build_object(
                'tier', 4, 
                'range', '250+', 
                'price_per_image', 2.25,
                'images', remaining_images,
                'cost', tier_cost
            )
        );
        total_cost := total_cost + tier_cost;
    END IF;

    -- Update total cost in breakdown
    tier_breakdown := jsonb_set(tier_breakdown, '{total_cost}', to_jsonb(total_cost));
    
    RETURN tier_breakdown;
END;
$$;

-- 11. Create order number generation function
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    order_num text;
BEGIN
    order_num := 'ORB-' || TO_CHAR(now(), 'YYYY') || '-' || 
                 LPAD(EXTRACT(DOY FROM now())::text, 3, '0') || '-' ||
                 LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    RETURN order_num;
END;
$$;

-- 12. Create storage bucket setup function
CREATE OR REPLACE FUNCTION public.setup_user_storage_buckets(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    base_bucket_name text;
    bucket_types text[] := ARRAY['raw_images', 'processed_images', 'thumbnails', 'exports'];
    bucket_type text;
BEGIN
    -- Generate base bucket name
    base_bucket_name := 'orbit-' || REPLACE(user_id_param::text, '-', '');
    
    -- Create bucket entries for each type
    FOREACH bucket_type IN ARRAY bucket_types
    LOOP
        INSERT INTO public.storage_buckets (user_id, bucket_name, bucket_type)
        VALUES (user_id_param, base_bucket_name || '-' || bucket_type, bucket_type)
        ON CONFLICT (bucket_name) DO NOTHING;
    END LOOP;
END;
$$;

-- 13. Create updated timestamp triggers
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 14. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON public.payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_status ON public.payments(payment_status);

CREATE INDEX IF NOT EXISTS idx_storage_buckets_user_id ON public.storage_buckets(user_id);
CREATE INDEX IF NOT EXISTS idx_storage_buckets_bucket_type ON public.storage_buckets(bucket_type);

CREATE INDEX IF NOT EXISTS idx_file_downloads_user_id ON public.file_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_file_downloads_access_token ON public.file_downloads(access_token);
CREATE INDEX IF NOT EXISTS idx_file_downloads_expires_at ON public.file_downloads(expires_at);

CREATE INDEX IF NOT EXISTS idx_batches_order_id ON public.batches(order_id);
CREATE INDEX IF NOT EXISTS idx_images_order_id ON public.images(order_id);

-- 15. Create automatic user setup trigger
CREATE OR REPLACE FUNCTION public.setup_new_orbit_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Setup storage buckets for new user
    PERFORM public.setup_user_storage_buckets(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_orbit_user_created
    AFTER INSERT ON public.orbit_users
    FOR EACH ROW
    EXECUTE FUNCTION public.setup_new_orbit_user();