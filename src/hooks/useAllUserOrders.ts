import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UserOrder {
  id: string;
  orderNumber: string;
  totalCost: number;
  imageCount: number;
  orderStatus: 'payment_pending' | 'paid' | 'images_uploaded' | 'upload_failed' | 'processing' | 'completed' | 'completed_with_errors' | 'failed';
  processingStage: string;
  createdAt: string;
  completedAt?: string;
  processedCount: number;
  failedCount: number;
  paymentStatus: 'pending' | 'completed' | 'succeeded' | 'failed';
}

export const useAllUserOrders = (userId: string | null) => {
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true); // Start with loading=true
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchUserOrders = async () => {
    if (!userId) {
      console.log('📋 No userId provided, setting empty orders');
      setOrders([]);
      setLoading(false);
      return;
    }

    console.log('📋 Fetching orders for user:', userId);
    setLoading(true);
    setError(null);

    try {
      // Fetch orders for the user - only show orders with completed payments
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .in('payment_status', ['completed', 'succeeded'])
        .order('created_at', { ascending: false });

      if (ordersError) throw new Error(`Error fetching orders: ${ordersError.message}`);

      if (!ordersData) {
        console.log('📋 No orders found for user');
        setOrders([]);
        return;
      }

      console.log('📋 Found orders:', ordersData.length);

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
              paymentStatus: order.payment_status || 'pending',
            } as UserOrder;
          }

          const totalImages = images?.length || 0;
          const processedImages = images?.filter(img => img.processing_status === 'complete').length || 0;
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
            paymentStatus: order.payment_status || 'pending',
          } as UserOrder;
        })
      );

      setOrders(enrichedOrders);
      console.log('📋 Orders enriched and set:', enrichedOrders.length);

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
    console.log('📋 useAllUserOrders effect triggered, userId:', userId);
    
    if (!userId) {
      console.log('📋 No userId, setting empty state');
      setOrders([]);
      setLoading(false);
      return;
    }

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