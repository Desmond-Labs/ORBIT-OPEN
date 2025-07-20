
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

        // Call the edge function to get thumbnails
        const response = await fetch(`https://ufdcvxmizlzlnyyqpfck.supabase.co/functions/v1/get-thumbnails`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmZGN2eG1pemx6bG55eXFwZmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyMzM1NzMsImV4cCI6MjA2MTgwOTU3M30.bpYLwFpQxq5tAw4uvRrHPi9WeFmxHnLjQaZraZqa3Bs'
          },
          body: JSON.stringify({ images })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Edge function response error:', errorText);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const { thumbnails: newThumbnails } = await response.json();
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
