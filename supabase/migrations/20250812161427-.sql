-- Harden RLS on feedback_submissions to prevent any public access to emails
-- 1) Ensure RLS is enabled (idempotent)
ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

-- 2) Remove broad select policy and replace with authenticated-only owner select
DROP POLICY IF EXISTS "Users can view their own feedback" ON public.feedback_submissions;

CREATE POLICY "Authenticated users can view their own feedback"
ON public.feedback_submissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3) Restrict INSERT/UPDATE/DELETE to service role only when performed via API.
-- Note: Our SECURITY DEFINER RPC (submit_feedback) will bypass RLS for inserts.
CREATE POLICY IF NOT EXISTS "Service role can insert feedback"
ON public.feedback_submissions
FOR INSERT
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Service role can update feedback"
ON public.feedback_submissions
FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Service role can delete feedback"
ON public.feedback_submissions
FOR DELETE
USING (auth.role() = 'service_role');