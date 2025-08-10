
-- 1) Table for user feedback
CREATE TABLE public.feedback_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,                     -- optional, will be set if user is logged in
  email text NULL,                       -- optional fallback if user isn't logged in
  page_path text NOT NULL,               -- e.g. "/orders/123"
  page_url text NULL,                    -- full URL for context if available
  feedback text NOT NULL,                -- the comment itself
  user_agent text NULL,                  -- browser user agent, useful for debugging
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Enable RLS
ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

-- 3) RLS policies
-- Service role can manage everything
CREATE POLICY "Service role can manage all feedback"
  ON public.feedback_submissions
  FOR ALL
  USING (auth.role() = 'service_role');

-- Optionally allow users to view their own feedback (not required by UI, but safe to have)
CREATE POLICY "Users can view their own feedback"
  ON public.feedback_submissions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Note: We will NOT create a general INSERT policy.
-- Inserts will be performed through a SECURITY DEFINER function below.

-- 4) RPC to submit feedback securely (bypasses RLS for inserts)
CREATE OR REPLACE FUNCTION public.submit_feedback(
  page_path text,
  feedback_text text,
  email text DEFAULT NULL,
  page_url text DEFAULT NULL,
  user_agent text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_id uuid;
  uid uuid := auth.uid();
BEGIN
  IF page_path IS NULL OR length(trim(page_path)) = 0 THEN
    RAISE EXCEPTION 'page_path is required';
  END IF;

  IF feedback_text IS NULL OR length(trim(feedback_text)) < 5 THEN
    RAISE EXCEPTION 'feedback_text must be at least 5 characters';
  END IF;

  INSERT INTO public.feedback_submissions (user_id, email, page_path, page_url, feedback, user_agent)
  VALUES (uid, email, page_path, page_url, feedback_text, user_agent)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- 5) Helpful index for ops
CREATE INDEX IF NOT EXISTS feedback_submissions_created_at_idx
  ON public.feedback_submissions (created_at DESC);
