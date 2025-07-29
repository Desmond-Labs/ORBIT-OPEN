-- Add missing utility functions for token-based access system

-- 1. Create set_config function for RLS token setting
CREATE OR REPLACE FUNCTION public.set_config(
    setting_name TEXT,
    setting_value TEXT,
    is_local BOOLEAN DEFAULT true
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Set the configuration parameter for the current session
    PERFORM set_config(setting_name, setting_value, is_local);
END;
$$;

-- 2. Grant permissions for the set_config function
GRANT EXECUTE ON FUNCTION public.set_config TO anon, authenticated;

-- 3. Add missing update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Ensure the trigger exists for orders table
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Add helpful indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_orders_user_id_status ON public.orders(user_id, order_status);
CREATE INDEX IF NOT EXISTS idx_images_order_id_status ON public.images(order_id, processing_status);

-- 6. Add a function to safely get current token from session
CREATE OR REPLACE FUNCTION public.get_current_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN current_setting('app.current_token', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_current_token TO anon, authenticated;

-- 7. Add comment for documentation
COMMENT ON FUNCTION public.set_config IS 'Sets configuration parameters for the current session, used for RLS token validation';
COMMENT ON FUNCTION public.get_current_token IS 'Safely retrieves the current access token from session configuration';