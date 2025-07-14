-- Fix security issue in handle_new_auth_user function by setting explicit search_path
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
    -- Create orbit_users record for new auth user
    INSERT INTO public.orbit_users (id, email)
    VALUES (NEW.id, NEW.email);
    
    -- Setup storage buckets for the new user
    PERFORM public.setup_user_storage_buckets(NEW.id);
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't prevent user creation
        RAISE LOG 'Error creating orbit_users record for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;