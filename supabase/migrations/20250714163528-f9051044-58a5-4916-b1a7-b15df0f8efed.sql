-- Add batch_id column to images table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'images' AND column_name = 'batch_id'
    ) THEN
        ALTER TABLE public.images ADD COLUMN batch_id UUID;
        
        -- Add foreign key constraint to batches table
        ALTER TABLE public.images 
        ADD CONSTRAINT images_batch_id_fkey 
        FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;
        
        -- Add index for better performance
        CREATE INDEX idx_images_batch_id ON public.images(batch_id);
    END IF;
END $$;