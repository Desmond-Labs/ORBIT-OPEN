
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
          // Extract bucket and path from storage path
          // Format is typically: bucket/path/to/file.jpg
          const pathParts = image.storage_path_processed.split('/');
          const bucket = pathParts[0] || 'orbit-images';
          const filePath = pathParts.slice(1).join('/');

          if (!filePath) {
            newThumbnails[image.id] = null;
            continue;
          }

          // Create signed URL for thumbnail with transform
          const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(filePath, 3600, {
              transform: {
                width: 128,
                height: 128,
                quality: 80
              }
            });

          if (error) {
            console.error('Error creating signed URL for thumbnail:', error);
            newThumbnails[image.id] = null;
          } else {
            newThumbnails[image.id] = data.signedUrl;
          }
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
