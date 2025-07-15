-- Add RLS policy to allow service role to read all processed images
CREATE POLICY "Allow service role to read all processed images" 
ON storage.objects 
FOR SELECT 
TO service_role
USING (bucket_id = 'processed_images');