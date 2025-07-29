-- Token lifecycle management and automated cleanup
-- This ensures tokens are properly managed and expired tokens are cleaned up

-- 1. Create function to check token health and provide analytics
CREATE OR REPLACE FUNCTION public.get_token_analytics()
RETURNS TABLE(
    total_tokens_issued BIGINT,
    active_tokens BIGINT,
    expired_tokens BIGINT,
    tokens_near_expiry BIGINT,
    total_token_usage BIGINT,
    avg_usage_per_token NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) FILTER (WHERE access_token IS NOT NULL) as total_tokens_issued,
        COUNT(*) FILTER (WHERE access_token IS NOT NULL AND token_expires_at > now()) as active_tokens,
        COUNT(*) FILTER (WHERE access_token IS NOT NULL AND token_expires_at <= now()) as expired_tokens,
        COUNT(*) FILTER (WHERE access_token IS NOT NULL AND token_expires_at > now() AND token_expires_at <= now() + interval '24 hours') as tokens_near_expiry,
        SUM(token_used_count) FILTER (WHERE access_token IS NOT NULL) as total_token_usage,
        AVG(token_used_count) FILTER (WHERE access_token IS NOT NULL) as avg_usage_per_token
    FROM public.orders;
END;
$$;

-- 2. Create function to extend token expiration (admin use)
CREATE OR REPLACE FUNCTION public.extend_token_expiration(
    order_id_param UUID,
    additional_hours INTEGER DEFAULT 168
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_rows INTEGER;
BEGIN
    UPDATE public.orders 
    SET token_expires_at = GREATEST(
        now() + (additional_hours || ' hours')::interval,
        token_expires_at + (additional_hours || ' hours')::interval
    )
    WHERE id = order_id_param
      AND access_token IS NOT NULL;
    
    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    RETURN updated_rows > 0;
END;
$$;

-- 3. Create function to revoke a specific token
CREATE OR REPLACE FUNCTION public.revoke_order_token(order_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_rows INTEGER;
BEGIN
    UPDATE public.orders 
    SET 
        access_token = NULL,
        token_expires_at = NULL,
        token_used_count = 0
    WHERE id = order_id_param;
    
    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    RETURN updated_rows > 0;
END;
$$;

-- 4. Enhanced cleanup function with better logging
CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS TABLE(
    cleaned_count INTEGER,
    cleanup_timestamp TIMESTAMPTZ,
    details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    expired_count INTEGER;
    old_expired_count INTEGER;
    cleanup_details JSONB;
BEGIN
    -- Count tokens that will be cleaned up
    SELECT COUNT(*) INTO expired_count
    FROM public.orders 
    WHERE access_token IS NOT NULL 
      AND token_expires_at < now();
    
    -- Count very old expired tokens (older than 7 days)
    SELECT COUNT(*) INTO old_expired_count
    FROM public.orders 
    WHERE access_token IS NOT NULL 
      AND token_expires_at < now() - interval '7 days';
    
    -- Clean up expired tokens (keep for 1 day after expiration for debugging)
    UPDATE public.orders 
    SET 
        access_token = NULL,
        token_expires_at = NULL,
        token_used_count = 0
    WHERE token_expires_at < now() - interval '1 day';
    
    -- Prepare cleanup details
    cleanup_details := jsonb_build_object(
        'expired_tokens_found', expired_count,
        'old_expired_cleaned', old_expired_count,
        'cleanup_retention_days', 1
    );
    
    RETURN QUERY SELECT 
        old_expired_count,
        now(),
        cleanup_details;
END;
$$;

-- 5. Create function to get order by token (for debugging/support)
CREATE OR REPLACE FUNCTION public.get_order_by_token(token_param TEXT)
RETURNS TABLE(
    order_id UUID,
    order_number TEXT,
    user_email TEXT,
    token_expires_at TIMESTAMPTZ,
    token_used_count INTEGER,
    token_max_uses INTEGER,
    is_valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.order_number,
        u.email,
        o.token_expires_at,
        o.token_used_count,
        o.token_max_uses,
        (o.token_expires_at > now() AND o.token_used_count < o.token_max_uses) as is_valid
    FROM public.orders o
    JOIN public.orbit_users u ON o.user_id = u.id
    WHERE o.access_token = token_param;
END;
$$;

-- 6. Create index for cleanup operations
CREATE INDEX IF NOT EXISTS idx_orders_token_expiry_cleanup 
ON public.orders(token_expires_at) 
WHERE access_token IS NOT NULL;

-- 7. Add trigger to log token generation
CREATE TABLE IF NOT EXISTS public.token_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.orbit_users(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('generated', 'used', 'expired', 'revoked')),
    token_hash TEXT, -- Store hash for security, not actual token
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on audit log
ALTER TABLE public.token_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins and service role can access audit log
CREATE POLICY "Service role can access token audit log" ON public.token_audit_log
    FOR ALL TO service_role
    USING (true);

-- 8. Create function to log token events
CREATE OR REPLACE FUNCTION public.log_token_event(
    order_id_param UUID,
    user_id_param UUID,
    action_param TEXT,
    token_hash_param TEXT DEFAULT NULL,
    expires_at_param TIMESTAMPTZ DEFAULT NULL,
    metadata_param JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.token_audit_log (
        order_id,
        user_id,
        action,
        token_hash,
        expires_at,
        metadata
    ) VALUES (
        order_id_param,
        user_id_param,
        action_param,
        token_hash_param,
        expires_at_param,
        metadata_param
    );
END;
$$;

-- 9. Update the token generation function to include logging
CREATE OR REPLACE FUNCTION public.generate_order_access_token(
    order_id_param UUID,
    expires_in_hours INTEGER DEFAULT 168 -- 7 days default
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    token TEXT;
    existing_order_id UUID;
    order_user_id UUID;
    token_hash TEXT;
BEGIN
    -- Generate a secure token (UUID + timestamp for uniqueness)
    token := gen_random_uuid()::TEXT || '-' || extract(epoch from now())::bigint::TEXT;
    
    -- Check if order exists and get user_id
    SELECT id, user_id INTO existing_order_id, order_user_id
    FROM public.orders 
    WHERE id = order_id_param;
    
    IF existing_order_id IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;
    
    -- Create hash for audit logging (don't store actual token)
    token_hash := encode(digest(token, 'sha256'), 'hex');
    
    -- Update the order with the new token
    UPDATE public.orders 
    SET 
        access_token = token,
        token_expires_at = now() + (expires_in_hours || ' hours')::interval,
        token_used_count = 0
    WHERE id = order_id_param;
    
    -- Log token generation
    PERFORM public.log_token_event(
        order_id_param,
        order_user_id,
        'generated',
        token_hash,
        now() + (expires_in_hours || ' hours')::interval,
        jsonb_build_object('expires_in_hours', expires_in_hours)
    );
    
    RETURN token;
END;
$$;

-- 10. Update increment usage function to include logging
CREATE OR REPLACE FUNCTION public.increment_token_usage(token_param TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    order_record RECORD;
    token_hash TEXT;
BEGIN
    -- Get order info for logging
    SELECT o.id, o.user_id, o.token_used_count, o.token_max_uses 
    INTO order_record
    FROM public.orders o
    WHERE o.access_token = token_param
      AND o.token_expires_at > now()
      AND o.token_used_count < o.token_max_uses;
    
    IF order_record.id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Update usage count
    UPDATE public.orders 
    SET token_used_count = token_used_count + 1
    WHERE access_token = token_param
      AND token_expires_at > now()
      AND token_used_count < token_max_uses;
    
    -- Log token usage
    token_hash := encode(digest(token_param, 'sha256'), 'hex');
    PERFORM public.log_token_event(
        order_record.id,
        order_record.user_id,
        'used',
        token_hash,
        NULL,
        jsonb_build_object(
            'usage_count', order_record.token_used_count + 1,
            'max_uses', order_record.token_max_uses
        )
    );
    
    RETURN FOUND;
END;
$$;

-- 11. Create cleanup job function that can be called by cron
CREATE OR REPLACE FUNCTION public.automated_token_cleanup()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cleanup_result RECORD;
    result JSONB;
BEGIN
    -- Run cleanup
    SELECT * INTO cleanup_result 
    FROM public.cleanup_expired_tokens()
    LIMIT 1;
    
    -- Log cleanup event if any tokens were cleaned
    IF cleanup_result.cleaned_count > 0 THEN
        INSERT INTO public.token_audit_log (
            order_id, user_id, action, metadata
        )
        SELECT 
            gen_random_uuid(), -- Placeholder since this is a system action
            gen_random_uuid(), -- Placeholder since this is a system action  
            'expired',
            jsonb_build_object(
                'cleanup_type', 'automated',
                'cleaned_count', cleanup_result.cleaned_count,
                'timestamp', cleanup_result.cleanup_timestamp
            );
    END IF;
    
    result := jsonb_build_object(
        'success', true,
        'cleaned_count', cleanup_result.cleaned_count,
        'timestamp', cleanup_result.cleanup_timestamp,
        'details', cleanup_result.details
    );
    
    RETURN result;
END;
$$;

-- 12. Grant permissions
GRANT EXECUTE ON FUNCTION public.get_token_analytics TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_tokens TO service_role;
GRANT EXECUTE ON FUNCTION public.automated_token_cleanup TO service_role;
GRANT EXECUTE ON FUNCTION public.extend_token_expiration TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_order_token TO service_role;
GRANT EXECUTE ON FUNCTION public.get_order_by_token TO service_role;

-- 13. Add helpful comments
COMMENT ON FUNCTION public.cleanup_expired_tokens IS 'Cleans up expired access tokens (keeps expired tokens for 1 day for debugging)';
COMMENT ON FUNCTION public.automated_token_cleanup IS 'Automated cleanup function suitable for cron jobs';
COMMENT ON FUNCTION public.get_token_analytics IS 'Provides analytics on token usage and health';
COMMENT ON TABLE public.token_audit_log IS 'Audit log for all token-related events';

-- 14. Create view for monitoring active tokens
CREATE OR REPLACE VIEW public.active_tokens_summary AS
SELECT 
    COUNT(*) as total_active_tokens,
    COUNT(*) FILTER (WHERE token_expires_at <= now() + interval '24 hours') as expiring_soon,
    COUNT(*) FILTER (WHERE token_used_count >= token_max_uses * 0.8) as high_usage,
    AVG(token_used_count)::numeric(5,2) as avg_usage,
    MIN(token_expires_at) as earliest_expiry,
    MAX(token_expires_at) as latest_expiry
FROM public.orders 
WHERE access_token IS NOT NULL 
  AND token_expires_at > now();

-- Grant access to monitoring view
GRANT SELECT ON public.active_tokens_summary TO authenticated, service_role;