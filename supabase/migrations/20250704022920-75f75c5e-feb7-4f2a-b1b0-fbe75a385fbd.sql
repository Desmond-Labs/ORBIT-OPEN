-- Fix missing orbit_users records for authenticated users

-- First, create orbit_users records for any existing auth users that don't have them
INSERT INTO public.orbit_users (id, email)
SELECT 
    au.id,
    au.email
FROM auth.users au
LEFT JOIN public.orbit_users ou ON au.id = ou.id
WHERE ou.id IS NULL
AND au.email IS NOT NULL;

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users to automatically create orbit_users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();