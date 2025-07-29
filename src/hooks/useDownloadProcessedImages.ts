import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useDownloadProcessedImages = () => {
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const downloadProcessedImages = async (orderId: string, tokenAuth?: any) => {
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
      console.log('Token auth provided:', !!tokenAuth);

      let authHeaders: any = {
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmZGN2eG1pemx6bG55eXFwZmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyMzM1NzMsImV4cCI6MjA2MTgwOTU3M30.bpYLwFpQxq5tAw4uvRrHPi9WeFmxHnLjQaZraZqa3Bs'
      };

      let requestBody: any = { orderId };

      if (tokenAuth && tokenAuth.isValidToken) {
        // Token-based authentication
        console.log('Using token authentication for download');
        // We need to get the actual token from the URL params since it's not stored in tokenData
        const urlParams = new URLSearchParams(window.location.search);
        const actualToken = urlParams.get('token');
        if (actualToken) {
          requestBody.accessToken = actualToken;
          authHeaders['Authorization'] = `Bearer ${actualToken}`;
        } else {
          throw new Error('Token not found in URL');
        }
      } else {
        // Regular user authentication
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error('Not authenticated');
        }
        
        authHeaders['Authorization'] = `Bearer ${session.access_token}`;
      }

      // Call the edge function directly to get the ZIP file
      const response = await fetch(`https://ufdcvxmizlzlnyyqpfck.supabase.co/functions/v1/download-processed-images`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Download response error:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Get the response as a blob and trigger download
      const blob = await response.blob();
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
        description: "Your complete processed files package (images, reports, and metadata) is being downloaded as a ZIP file.",
        variant: "default"
      });

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