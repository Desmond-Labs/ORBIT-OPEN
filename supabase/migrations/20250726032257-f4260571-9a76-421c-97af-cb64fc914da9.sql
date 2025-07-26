-- Add DELETE policy for file_downloads table
CREATE POLICY "Users can delete own downloads" 
ON public.file_downloads 
FOR DELETE 
USING (auth.uid() = user_id);