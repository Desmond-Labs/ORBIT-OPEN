import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ProcessingStatus } from './useOrderProcessingStatus';

export const useTokenOrderStatus = (token: string | null, orderId: string | null, tokenValid: boolean) => {
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchOrderStatusWithToken = async () => {
    if (!token || !orderId || !tokenValid) {
      setStatus(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('📊 Fetching order status with token for order:', orderId);

      // Set the token for RLS policies before making queries
      await supabase.rpc('set_config', {
        setting_name: 'app.current_token',
        setting_value: token,
        is_local: true,
      });

      // Fetch order data using token-based access
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) {
        throw new Error(`Order not found: ${orderError.message}`);
      }

      console.log('✅ Order found with token access:', order.order_number);

      // Fetch images data using token-based access
      const { data: images, error: imagesError } = await supabase
        .from('images')
        .select('*')
        .eq('order_id', orderId);

      if (imagesError) {
        console.warn('Images query warning:', imagesError);
        // Don't throw error for images - order might still be valid
      }

      // Calculate processing status
      const totalImages = images?.length || 0;
      const processedImages = images?.filter(img => img.processing_status === 'complete').length || 0;
      const failedImages = images?.filter(img => img.processing_status === 'failed' || img.processing_status === 'error').length || 0;
      const processingImages = images?.filter(img => img.processing_status === 'processing').length || 0;

      console.log('🔍 Processing status with token:', {
        totalImages,
        processedImages,
        failedImages,
        processingImages,
      });

      // Determine overall order status
      let orderStatus: ProcessingStatus['orderStatus'] = 'pending';
      if (order.order_status === 'completed' || processedImages === totalImages) {
        orderStatus = 'completed';
      } else if (processingImages > 0 || order.order_status === 'processing') {
        orderStatus = 'processing';
      } else if (failedImages === totalImages) {
        orderStatus = 'failed';
      }

      // Calculate progress percentage
      const progressPercentage = totalImages > 0 ? Math.round((processedImages / totalImages) * 100) : 0;

      // Cast payment status to the expected type
      const paymentStatus = (['pending', 'completed', 'succeeded', 'failed'] as const).includes(order.payment_status as any) 
        ? order.payment_status as 'pending' | 'completed' | 'succeeded' | 'failed'
        : 'pending';

      setStatus({
        orderId: order.id,
        orderNumber: order.order_number,
        totalCost: order.total_cost,
        imageCount: totalImages,
        processedCount: processedImages,
        failedCount: failedImages,
        orderStatus,
        processingStage: order.processing_stage || 'pending',
        processingProgress: progressPercentage,
        images: images || [],
        createdAt: order.created_at,
        completedAt: order.completed_at,
        paymentStatus,
      });

    } catch (err: any) {
      console.error('❌ Error fetching order status with token:', err);
      setError(err.message);
      toast({
        title: "Error Loading Order",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Set up real-time subscription for token-based access
  useEffect(() => {
    if (!token || !orderId || !tokenValid) return;

    // Initial fetch
    fetchOrderStatusWithToken();

    // Set up real-time subscription for order updates
    const orderChannel = supabase
      .channel(`token-order-status-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          console.log('📡 Order updated (token access):', payload);
          fetchOrderStatusWithToken();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'images',
          filter: `order_id=eq.${orderId}`
        },
        (payload) => {
          console.log('📡 Image updated (token access):', payload);
          fetchOrderStatusWithToken();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
    };
  }, [token, orderId, tokenValid]);

  return { 
    status, 
    loading, 
    error, 
    refetch: fetchOrderStatusWithToken 
  };
};