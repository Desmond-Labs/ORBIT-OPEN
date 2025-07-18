import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProcessedImage {
  id: string;
  original_filename: string;
  storage_path_processed: string | null;
  gemini_analysis_raw: string | null;
  processed_at: string | null;
  analysis_type: string | null;
}

export const useProcessedImages = (orderId: string | null) => {
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    const fetchProcessedImages = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('images')
          .select(`
            id,
            original_filename,
            storage_path_processed,
            gemini_analysis_raw,
            processed_at,
            analysis_type
          `)
          .eq('order_id', orderId)
          .eq('processing_status', 'complete');

        if (fetchError) throw fetchError;

        setImages(data || []);
      } catch (err: any) {
        console.error('Error fetching processed images:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProcessedImages();
  }, [orderId]);

  return { images, loading, error };
};