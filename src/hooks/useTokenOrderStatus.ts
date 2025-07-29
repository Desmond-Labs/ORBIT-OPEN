import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TokenOrderStatus {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  imageCount: number;
  processedCount: number;
  failedCount: number;
  processingProgress: number;
  processingStage: string;
  totalCost: number;
  createdAt: string;
  completedAt?: string;
  batchName?: string;
  errorCount?: number;
  status?: string;
}

export const useTokenOrderStatus = (orderId: string | null, hasValidToken: boolean) => {
  const [status, setStatus] = useState<TokenOrderStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrderStatus = async () => {
    if (!orderId || !hasValidToken) {
      console.log('🔍 Skipping order fetch - missing orderId or invalid token');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Fetching order status with token access for:', orderId);

      // Fetch order data using token-based RLS
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_status,
          payment_status,
          total_cost,
          created_at,
          completed_at,
          batch_id
        `)
        .eq('id', orderId)
        .single();

      if (orderError) {
        console.error('🔍 Order fetch error:', orderError);
        throw new Error(`Failed to fetch order: ${orderError.message}`);
      }

      if (!order) {
        throw new Error('Order not found');
      }

      console.log('🔍 Order fetched successfully:', order);

      // Fetch batch information
      let batchName = `Order ${order.order_number}`;
      let batchStatus = 'pending';
      let processedCount = 0;
      let errorCount = 0;
      let processingStage = 'initializing';

      if (order.batch_id) {
        const { data: batch, error: batchError } = await supabase
          .from('batches')
          .select('name, status, processed_count, error_count')
          .eq('id', order.batch_id)
          .single();

        if (!batchError && batch) {
          batchName = batch.name || batchName;
          batchStatus = batch.status || batchStatus;
          processedCount = batch.processed_count || 0;
          errorCount = batch.error_count || 0;
        }
      }

      // Fetch image count and processing status
      const { data: images, error: imagesError } = await supabase
        .from('images')
        .select('id, processing_status')
        .eq('order_id', orderId);

      let imageCount = 0;
      let failedCount = 0;
      let completedCount = 0;

      if (!imagesError && images) {
        imageCount = images.length;
        failedCount = images.filter(img => img.processing_status === 'error').length;
        completedCount = images.filter(img => img.processing_status === 'complete').length;
      }

      // Calculate processing progress
      const totalImages = imageCount || 1;
      const processingProgress = Math.round((completedCount / totalImages) * 100);

      // Determine processing stage based on status
      if (order.order_status === 'completed' || order.order_status === 'completed_with_errors') {
        processingStage = 'completed';
      } else if (order.order_status === 'processing') {
        processingStage = 'analyzing';
      } else if (order.payment_status === 'completed' || order.payment_status === 'succeeded') {
        processingStage = 'initializing';
      } else {
        processingStage = 'pending_payment';
      }

      const orderStatus: TokenOrderStatus = {
        orderId: order.id,
        orderNumber: order.order_number,
        orderStatus: order.order_status,
        paymentStatus: order.payment_status,
        imageCount,
        processedCount: completedCount,
        failedCount,
        processingProgress,
        processingStage,
        totalCost: order.total_cost,
        createdAt: order.created_at,
        completedAt: order.completed_at,
        batchName,
        errorCount,
        status: order.order_status
      };

      console.log('🔍 Order status compiled:', orderStatus);
      setStatus(orderStatus);
    } catch (error: any) {
      console.error('🔍 Failed to fetch order status:', error);
      setError(error.message || 'Failed to fetch order status');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId && hasValidToken) {
      fetchOrderStatus();
      
      // Set up periodic polling for processing orders
      const interval = setInterval(() => {
        if (status?.orderStatus === 'processing') {
          fetchOrderStatus();
        }
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(interval);
    }
  }, [orderId, hasValidToken]);

  return {
    status,
    loading,
    error,
    refetch: fetchOrderStatus
  };
};