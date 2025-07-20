
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
      const newThumbnails: ThumbnailCache = {};

      for (const image of images) {
        if (!image.storage_path_processed) {
          newThumbnails[image.id] = null;
          continue;
        }

        try {
          console.log('Processing image:', image.id, 'Path:', image.storage_path_processed);
          
          // Try different bucket configurations
          const bucketsToTry = ['orbit-exports', 'processed_images', 'orbit-images'];
          let signedUrl = null;

          for (const bucket of bucketsToTry) {
            try {
              console.log(`Trying bucket: ${bucket} with path: ${image.storage_path_processed}`);
              
              const { data, error } = await supabase.storage
                .from(bucket)
                .createSignedUrl(image.storage_path_processed, 3600, {
                  transform: {
                    width: 128,
                    height: 128,
                    quality: 80
                  }
                });

              if (!error && data?.signedUrl) {
                signedUrl = data.signedUrl;
                console.log(`Success with bucket: ${bucket}`);
                break;
              } else {
                console.log(`Failed with bucket: ${bucket}`, error?.message);
              }
            } catch (bucketError) {
              console.log(`Error with bucket: ${bucket}`, bucketError);
              continue;
            }
          }

          newThumbnails[image.id] = signedUrl;
        } catch (error) {
          console.error('Error generating thumbnail for image:', image.id, error);
          newThumbnails[image.id] = null;
        }
      }

      setThumbnails(newThumbnails);
      setLoading(false);
    };

    generateThumbnails();
  }, [images]);

  return { thumbnails, loading };
};
