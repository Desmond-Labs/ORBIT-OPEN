-- Add token-based access system for orders
-- This allows users to access their order results from email links without full authentication

-- 1. Add access token columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS access_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS token_used_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS token_max_uses INTEGER DEFAULT 10;

-- 2. Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_orders_access_token ON public.orders(access_token) 
WHERE access_token IS NOT NULL;

-- 3. Create function to generate secure access tokens
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
BEGIN
    -- Generate a secure token (UUID + timestamp for uniqueness)
    token := gen_random_uuid()::TEXT || '-' || extract(epoch from now())::bigint::TEXT;
    
    -- Check if order exists
    SELECT id INTO existing_order_id 
    FROM public.orders 
    WHERE id = order_id_param;
    
    IF existing_order_id IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;
    
    -- Update the order with the new token
    UPDATE public.orders 
    SET 
        access_token = token,
        token_expires_at = now() + (expires_in_hours || ' hours')::interval,
        token_used_count = 0
    WHERE id = order_id_param;
    
    RETURN token;
END;
$$;

-- 4. Create function to validate access tokens
CREATE OR REPLACE FUNCTION public.validate_order_token(
    token_param TEXT,
    order_id_param UUID DEFAULT NULL
)
RETURNS TABLE(
    valid BOOLEAN,
    order_id UUID,
    user_id UUID,
    expires_at TIMESTAMPTZ,
    uses_remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    order_record RECORD;
BEGIN
    -- Find order by token
    SELECT 
        o.id,
        o.user_id,
        o.access_token,
        o.token_expires_at,
        o.token_used_count,
        o.token_max_uses
    INTO order_record
    FROM public.orders o
    WHERE o.access_token = token_param
      AND (order_id_param IS NULL OR o.id = order_id_param);
    
    -- Check if token exists and is valid
    IF order_record.id IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, NULL::TIMESTAMPTZ, 0;
        RETURN;
    END IF;
    
    -- Check if token is expired
    IF order_record.token_expires_at < now() THEN
        RETURN QUERY SELECT FALSE, order_record.id, order_record.user_id, order_record.token_expires_at, 0;
        RETURN;
    END IF;
    
    -- Check usage limits
    IF order_record.token_used_count >= order_record.token_max_uses THEN
        RETURN QUERY SELECT FALSE, order_record.id, order_record.user_id, order_record.token_expires_at, 0;
        RETURN;
    END IF;
    
    -- Token is valid
    RETURN QUERY SELECT 
        TRUE, 
        order_record.id, 
        order_record.user_id, 
        order_record.token_expires_at,
        order_record.token_max_uses - order_record.token_used_count;
END;
$$;

-- 5. Create function to increment token usage
CREATE OR REPLACE FUNCTION public.increment_token_usage(token_param TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.orders 
    SET token_used_count = token_used_count + 1
    WHERE access_token = token_param
      AND token_expires_at > now()
      AND token_used_count < token_max_uses;
    
    RETURN FOUND;
END;
$$;

-- 6. Add token-based RLS policies for orders
CREATE POLICY "Token access to orders" ON public.orders
    FOR SELECT 
    USING (
        -- Allow access if user provides valid token
        (access_token IS NOT NULL 
         AND access_token = current_setting('app.current_token', true)
         AND token_expires_at > now()
         AND token_used_count < token_max_uses)
        OR
        -- Keep existing authenticated user access
        auth.uid() = user_id
    );

-- 7. Add token-based RLS policies for images
CREATE POLICY "Token access to images via order" ON public.images
    FOR SELECT 
    USING (
        -- Allow access if order has valid token
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = images.order_id
              AND o.access_token IS NOT NULL
              AND o.access_token = current_setting('app.current_token', true)
              AND o.token_expires_at > now()
              AND o.token_used_count < o.token_max_uses
        )
        OR
        -- Keep existing authenticated user access via order ownership
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = images.order_id
              AND o.user_id = auth.uid()
        )
    );

-- 8. Create function to clean up expired tokens (for maintenance)
CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    UPDATE public.orders 
    SET 
        access_token = NULL,
        token_expires_at = NULL,
        token_used_count = 0
    WHERE token_expires_at < now() - interval '1 day'; -- Keep expired tokens for 1 day for debugging
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RETURN cleaned_count;
END;
$$;

-- 9. Create a view for token analytics (optional, for monitoring)
CREATE OR REPLACE VIEW public.token_usage_stats AS
SELECT 
    COUNT(*) FILTER (WHERE access_token IS NOT NULL) as total_tokens_generated,
    COUNT(*) FILTER (WHERE access_token IS NOT NULL AND token_expires_at > now()) as active_tokens,
    COUNT(*) FILTER (WHERE access_token IS NOT NULL AND token_expires_at <= now()) as expired_tokens,
    AVG(token_used_count) FILTER (WHERE access_token IS NOT NULL) as avg_token_usage,
    MAX(token_used_count) as max_token_usage
FROM public.orders;

-- Grant appropriate permissions
GRANT SELECT ON public.token_usage_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_order_token TO anon, authenticated;

-- Add comment for documentation
COMMENT ON COLUMN public.orders.access_token IS 'Secure token for accessing order results without full authentication';
COMMENT ON COLUMN public.orders.token_expires_at IS 'Expiration timestamp for the access token';
COMMENT ON COLUMN public.orders.token_used_count IS 'Number of times the token has been used';
COMMENT ON COLUMN public.orders.token_max_uses IS 'Maximum number of times the token can be used';