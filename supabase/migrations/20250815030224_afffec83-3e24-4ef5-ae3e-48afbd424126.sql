-- Fix RLS policies for payments table to prevent unauthorized access

-- Ensure RLS is enabled on payments table
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "System can create payments" ON public.payments;
DROP POLICY IF EXISTS "System can update payments" ON public.payments;

-- Create secure INSERT policy - only allow service role or authenticated users for their own records
CREATE POLICY "Secure payment creation" ON public.payments
FOR INSERT
WITH CHECK (
  auth.role() = 'service_role' OR 
  (auth.uid() = user_id)
);

-- Create secure UPDATE policy - only allow service role or users updating their own records
CREATE POLICY "Secure payment updates" ON public.payments
FOR UPDATE
USING (
  auth.role() = 'service_role' OR 
  (auth.uid() = user_id)
);

-- Ensure DELETE is restricted - only service role should be able to delete payments
CREATE POLICY "Service role only deletes" ON public.payments
FOR DELETE
USING (auth.role() = 'service_role');