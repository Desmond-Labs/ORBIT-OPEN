import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UserOrder {
  id: string;
  orderNumber: string;
  totalCost: number;
  imageCount: number;
  orderStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingStage: string;
  createdAt: string;
  completedAt?: string;
  processedCount: number;
  failedCount: number;
}

export const useAllUserOrders = (userId: string | null) => {
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchUserOrders = async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch orders for the user
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (ordersError) throw new Error(`Error fetching orders: ${ordersError.message}`);

      if (!ordersData) {
        setOrders([]);
        return;
      }

      // For each order, get image counts and processing status
      const enrichedOrders = await Promise.all(
        ordersData.map(async (order) => {
          const { data: images, error: imagesError } = await supabase
            .from('images')
            .select('processing_status')
            .eq('order_id', order.id);

          if (imagesError) {
            console.error(`Error fetching images for order ${order.id}:`, imagesError);
            return {
              id: order.id,
              orderNumber: order.order_number,
              totalCost: order.total_cost,
              imageCount: order.image_count,
              orderStatus: order.order_status || 'pending',
              processingStage: order.processing_stage || 'pending',
              createdAt: order.created_at,
              completedAt: order.completed_at,
              processedCount: 0,
              failedCount: 0,
            } as UserOrder;
          }

          const totalImages = images?.length || 0;
          const processedImages = images?.filter(img => img.processing_status === 'completed').length || 0;
          const failedImages = images?.filter(img => img.processing_status === 'failed' || img.processing_status === 'error').length || 0;
          
          // Determine overall order status
          let orderStatus: UserOrder['orderStatus'] = 'pending';
          if (order.order_status === 'completed' || processedImages === totalImages) {
            orderStatus = 'completed';
          } else if (processedImages > 0 || order.order_status === 'processing') {
            orderStatus = 'processing';
          } else if (failedImages === totalImages) {
            orderStatus = 'failed';
          }

          return {
            id: order.id,
            orderNumber: order.order_number,
            totalCost: order.total_cost,
            imageCount: totalImages,
            orderStatus,
            processingStage: order.processing_stage || 'pending',
            createdAt: order.created_at,
            completedAt: order.completed_at,
            processedCount: processedImages,
            failedCount: failedImages,
          } as UserOrder;
        })
      );

      setOrders(enrichedOrders);

    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Error Loading Orders",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Set up real-time subscription for user orders
  useEffect(() => {
    if (!userId) return;

    // Initial fetch
    fetchUserOrders();

    // Set up real-time subscription for orders
    const ordersChannel = supabase
      .channel('user-orders-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('User order updated:', payload);
          fetchUserOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [userId]);

  return { orders, loading, error, refetch: fetchUserOrders };
};