-- Fix orbit_users and auth.users synchronization
-- This migration ensures all auth.users have corresponding orbit_users records

-- First, insert any missing orbit_users records for existing auth users
INSERT INTO public.orbit_users (id, email)
SELECT 
    au.id,
    au.email
FROM auth.users au
LEFT JOIN public.orbit_users ou ON au.id = ou.id
WHERE ou.id IS NULL
  AND au.email IS NOT NULL
  AND au.email_confirmed_at IS NOT NULL;

-- Update the handle_new_auth_user function to remove the storage bucket setup
-- since that functionality references a non-existent table
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
    
    -- Note: Storage bucket setup removed as it references non-existent table
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't prevent user creation
        RAISE LOG 'Error creating orbit_users record for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Ensure the trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();