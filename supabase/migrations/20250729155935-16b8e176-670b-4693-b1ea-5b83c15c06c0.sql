-- Ensure all RPC functions are properly defined and accessible

-- Recreate validate_order_token function to ensure proper type registration
CREATE OR REPLACE FUNCTION public.validate_order_token(token_param text, order_id_param uuid)
 RETURNS TABLE(valid boolean, order_id uuid, user_id uuid, expires_at timestamp with time zone, uses_remaining integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    token_record RECORD;
BEGIN
    SELECT oat.* INTO token_record
    FROM order_access_tokens oat
    WHERE oat.token = token_param
      AND oat.order_id = order_id_param
      AND oat.is_active = TRUE
      AND oat.expires_at > NOW()
      AND oat.current_uses < oat.max_uses;
    
    IF token_record IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, NULL::TIMESTAMPTZ, 0;
    ELSE
        RETURN QUERY SELECT 
            TRUE,
            token_record.order_id,
            token_record.user_id,
            token_record.expires_at,
            (token_record.max_uses - token_record.current_uses);
    END IF;
END;
$function$;

-- Recreate set_config function to ensure proper type registration
CREATE OR REPLACE FUNCTION public.set_config(setting_name text, setting_value text, is_local boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM set_config(setting_name, setting_value, is_local);
    RETURN setting_value;
END;
$function$;

-- Recreate increment_token_usage function to ensure proper type registration
CREATE OR REPLACE FUNCTION public.increment_token_usage(token_param text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    token_record RECORD;
BEGIN
    UPDATE order_access_tokens
    SET current_uses = current_uses + 1,
        updated_at = NOW()
    WHERE token = token_param
      AND is_active = TRUE
      AND expires_at > NOW()
      AND current_uses < max_uses
    RETURNING * INTO token_record;
    
    IF token_record IS NULL THEN
        RETURN FALSE;
    ELSE
        RETURN TRUE;
    END IF;
END;
$function$;