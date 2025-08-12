
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ThumbnailCache {
  [key: string]: string | null;
}

export const useThumbnails = (images: Array<{ id: string; storage_path_processed: string | null }>) => {
  const [thumbnails, setThumbnails] = useState<ThumbnailCache>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const generateThumbnails = async () => {
      if (!images.length) return;

      setLoading(true);

      try {
        console.log('Calling get-thumbnails edge function for', images.length, 'images');

        // Get the auth session to get the access token
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          console.error('Not authenticated - cannot get thumbnails');
          setLoading(false);
          return;
        }

        // Call the edge function to get thumbnails via Supabase client
        const { data, error } = await supabase.functions.invoke('get-thumbnails', {
          body: { images }
        });

        if (error) {
          console.error('Edge function get-thumbnails error:', error);
          throw error;
        }

        const newThumbnails = (data as any)?.thumbnails || {};
        console.log('Received thumbnails from edge function:', Object.keys(newThumbnails).length);
        
        setThumbnails(newThumbnails);
      } catch (error) {
        console.error('Error calling get-thumbnails edge function:', error);
        // Set empty thumbnails on error
        const emptyThumbnails: ThumbnailCache = {};
        images.forEach(image => {
          emptyThumbnails[image.id] = null;
        });
        setThumbnails(emptyThumbnails);
      } finally {
        setLoading(false);
      }
    };

    generateThumbnails();
  }, [images]);

  return { thumbnails, loading };
};
