-- Fix security issues in multiple functions by setting explicit search_path

-- Fix calculate_tier_pricing function
CREATE OR REPLACE FUNCTION public.calculate_tier_pricing(user_id_param uuid, image_count_param integer, billing_period_start_param timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

-- Fix generate_order_number function
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

-- Fix setup_user_storage_buckets function
CREATE OR REPLACE FUNCTION public.setup_user_storage_buckets(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

-- Fix setup_new_orbit_user function
CREATE OR REPLACE FUNCTION public.setup_new_orbit_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Setup storage buckets for new user
    PERFORM public.setup_user_storage_buckets(NEW.id);
    RETURN NEW;
END;
$$;

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'
  );
  RETURN new;
END;
$$;

-- Fix increment_user_stats function
CREATE OR REPLACE FUNCTION public.increment_user_stats(user_id uuid, images_count integer, amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_stats (
    user_id, 
    total_images_processed,
    total_amount_spent
  )
  VALUES (
    user_id,
    images_count,
    amount
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    total_images_processed = user_stats.total_images_processed + images_count,
    total_amount_spent = user_stats.total_amount_spent + amount,
    updated_at = NOW();
END;
$$;

-- Fix setup_user_buckets function
CREATE OR REPLACE FUNCTION public.setup_user_buckets(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- This will be called from the Edge Function
  -- to set up user-specific storage buckets
END;
$$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;