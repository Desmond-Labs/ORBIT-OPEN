-- Add daily tracking fields to orbit_users table
ALTER TABLE public.orbit_users 
ADD COLUMN daily_analyses_used integer DEFAULT 0,
ADD COLUMN daily_analysis_limit integer DEFAULT 2,
ADD COLUMN last_daily_reset timestamp with time zone DEFAULT now(),
ADD COLUMN daily_limit_reset_time time DEFAULT '00:00:00'::time;

-- Create hybrid pricing function that handles free daily + paid excess
CREATE OR REPLACE FUNCTION public.calculate_hybrid_pricing(
    user_id_param uuid, 
    image_count_param integer,
    billing_period_start_param timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    user_record RECORD;
    free_images_available integer := 0;
    free_images_used integer := 0;
    paid_images integer := 0;
    paid_pricing jsonb;
    result jsonb;
    period_start timestamp with time zone;
BEGIN
    -- Get user record with daily usage info
    SELECT daily_analyses_used, daily_analysis_limit, last_daily_reset, billing_period_start
    INTO user_record
    FROM public.orbit_users 
    WHERE id = user_id_param;
    
    IF user_record IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Check if daily reset is needed (if last reset was yesterday or earlier)
    IF user_record.last_daily_reset < date_trunc('day', now()) THEN
        -- Reset daily usage
        UPDATE public.orbit_users 
        SET daily_analyses_used = 0,
            last_daily_reset = now()
        WHERE id = user_id_param;
        
        user_record.daily_analyses_used := 0;
    END IF;
    
    -- Calculate free images available today
    free_images_available := GREATEST(0, user_record.daily_analysis_limit - user_record.daily_analyses_used);
    
    -- Determine how many images will be free vs paid
    free_images_used := LEAST(image_count_param, free_images_available);
    paid_images := GREATEST(0, image_count_param - free_images_used);
    
    -- Get paid pricing for excess images if any
    IF paid_images > 0 THEN
        SELECT calculate_tier_pricing(user_id_param, paid_images, billing_period_start_param) INTO paid_pricing;
    ELSE
        paid_pricing := '{"tiers": [], "total_cost": 0, "total_discount": 0}'::jsonb;
    END IF;
    
    -- Build result
    result := jsonb_build_object(
        'free_images_used', free_images_used,
        'paid_images', paid_images,
        'free_images_available', free_images_available,
        'daily_limit', user_record.daily_analysis_limit,
        'daily_used', user_record.daily_analyses_used,
        'paid_pricing', paid_pricing,
        'total_cost', COALESCE((paid_pricing->>'total_cost')::numeric, 0),
        'is_free_only', (paid_images = 0),
        'is_mixed_order', (free_images_used > 0 AND paid_images > 0),
        'daily_resets_at', date_trunc('day', now()) + interval '1 day'
    );
    
    RETURN result;
END;
$function$;

-- Function to increment daily usage after processing
CREATE OR REPLACE FUNCTION public.increment_daily_usage(
    user_id_param uuid,
    images_count integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
    UPDATE public.orbit_users
    SET daily_analyses_used = daily_analyses_used + images_count,
        updated_at = now()
    WHERE id = user_id_param;
    
    RETURN FOUND;
END;
$function$;

-- Function to reset all users' daily limits (for scheduled job)
CREATE OR REPLACE FUNCTION public.reset_daily_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    reset_count integer;
BEGIN
    UPDATE public.orbit_users
    SET daily_analyses_used = 0,
        last_daily_reset = now()
    WHERE last_daily_reset < date_trunc('day', now());
    
    GET DIAGNOSTICS reset_count = ROW_COUNT;
    RETURN reset_count;
END;
$function$;