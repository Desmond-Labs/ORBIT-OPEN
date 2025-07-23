
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ProcessingStatus {
  orderId: string;
  orderNumber: string;
  totalCost: number;
  imageCount: number;
  processedCount: number;
  failedCount: number;
  orderStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingStage: string;
  processingProgress: number;
  images: any[];
  createdAt: string;
  completedAt?: string;
  paymentStatus: 'pending' | 'completed' | 'succeeded' | 'failed';
}

export const useOrderProcessingStatus = (orderId: string | null) => {
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchOrderStatus = async () => {
    if (!orderId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch order data
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) throw new Error(`Order not found: ${orderError.message}`);

      // Fetch images data
      const { data: images, error: imagesError } = await supabase
        .from('images')
        .select('*')
        .eq('order_id', orderId);

      if (imagesError) throw new Error(`Error fetching images: ${imagesError.message}`);

      // Calculate processing status - fix the status value to match database
      const totalImages = images?.length || 0;
      const processedImages = images?.filter(img => img.processing_status === 'complete').length || 0;
      const failedImages = images?.filter(img => img.processing_status === 'failed' || img.processing_status === 'error').length || 0;
      const processingImages = images?.filter(img => img.processing_status === 'processing').length || 0;

      console.log('Processing status debug:', {
        totalImages,
        processedImages,
        failedImages,
        processingImages,
        imageStatuses: images?.map(img => ({ id: img.id, status: img.processing_status }))
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
      setError(err.message);
      toast({
        title: "Error Loading Status",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    if (!orderId) return;

    // Initial fetch
    fetchOrderStatus();

    // Set up real-time subscription for order updates
    const orderChannel = supabase
      .channel('order-status-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          console.log('Order updated:', payload);
          fetchOrderStatus();
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
          console.log('Image updated:', payload);
          fetchOrderStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
    };
  }, [orderId]);

  return { status, loading, error, refetch: fetchOrderStatus };
};
