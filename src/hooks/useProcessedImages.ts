import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProcessedImage {
  id: string;
  original_filename: string;
  thumbnail_path: string | null;
  ai_analysis: any;
  processing_cost: number | null;
  processing_duration_ms: number | null;
  processed_at: string | null;
  analysis_type: string | null;
  storage_path_processed: string | null;
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
            thumbnail_path,
            ai_analysis,
            processing_cost,
            processing_duration_ms,
            processed_at,
            analysis_type,
            storage_path_processed
          `)
          .eq('order_id', orderId)
          .eq('processing_status', 'completed');

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