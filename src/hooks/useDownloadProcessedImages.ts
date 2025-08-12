import { useState } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
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

      const supabaseAnonKey = SUPABASE_ANON_KEY;
      
      let authHeaders: any = {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey
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
          // Note: Don't set Authorization header with access token - it's not a JWT
          // The access token in request body is sufficient for token-based authentication
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
      const response = await fetch(`${SUPABASE_URL}/functions/v1/download-processed-images`, {
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