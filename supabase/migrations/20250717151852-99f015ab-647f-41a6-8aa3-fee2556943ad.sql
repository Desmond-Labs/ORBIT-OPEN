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

-- Setup storage buckets for any users that might not have had it run
-- This will safely handle existing users and new ones
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN 
        SELECT id FROM auth.users 
        WHERE email_confirmed_at IS NOT NULL
    LOOP
        -- This function has ON CONFLICT DO NOTHING logic, so it's safe to run multiple times
        PERFORM public.setup_user_storage_buckets(user_record.id);
    END LOOP;
END $$;

-- Verify that our trigger is properly set up (this should already exist but let's ensure it)
-- The trigger should automatically create orbit_users records for new auth users
-- If it doesn't exist, create it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();