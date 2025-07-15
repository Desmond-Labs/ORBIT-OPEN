import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useDownloadProcessedImages = () => {
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const downloadProcessedImages = async (orderId: string) => {
    if (!orderId) {
      toast({
        title: "Error",
        description: "Order ID is required",
        variant: "destructive"
      });
      return;
    }

    setDownloading(true);

    try {
      console.log('Starting download for order:', orderId);

      // Call the edge function to get the ZIP file
      const { data, error } = await supabase.functions.invoke('download-processed-images', {
        body: { orderId }
      });

      if (error) {
        throw new Error(error.message || 'Failed to download processed images');
      }

      // Convert the response to a blob and trigger download
      if (data) {
        // Create blob URL and trigger download
        const blob = new Blob([data], { type: 'application/zip' });
        const url = window.URL.createObjectURL(blob);
        
        // Create temporary link and click it
        const link = document.createElement('a');
        link.href = url;
        link.download = `orbit-processed-images-${orderId.slice(0, 8)}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the blob URL
        window.URL.revokeObjectURL(url);

        toast({
          title: "Download Started",
          description: "Your processed images are being downloaded as a ZIP file.",
          variant: "default"
        });
      }

    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download processed images. Please try again.",
        variant: "destructive"
      });
    } finally {
      setDownloading(false);
    }
  };

  return {
    downloadProcessedImages,
    downloading
  };
};