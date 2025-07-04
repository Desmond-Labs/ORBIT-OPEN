import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useRealTimeOrderUpdates = (
  setRealTimeOrderData: (data: any) => void,
  setProcessingStage: (stage: string) => void,
  setProcessingProgress: (progress: number) => void,
  setCurrentStep: (step: 'auth' | 'upload' | 'payment' | 'processing' | 'complete') => void
) => {
  const setupRealTimeSubscription = useCallback((orderIdParam: string) => {
    console.log('🔄 Setting up real-time subscription for order:', orderIdParam);
    
    const channel = supabase
      .channel('order-status', {
        config: {
          broadcast: { self: true },
          presence: { key: `order-${orderIdParam}` }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderIdParam}`
        },
        (payload) => {
          console.log('📡 Order status update received:', payload);
          const newOrder = payload.new;
          setRealTimeOrderData(newOrder);
          setProcessingStage(newOrder.processing_stage || 'pending');
          setProcessingProgress(newOrder.processing_completion_percentage || 0);
          
          if (newOrder.order_status === 'completed') {
            console.log('✅ Order completed, switching to complete step');
            setCurrentStep('complete');
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription established');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time subscription error:', err);
        } else if (status === 'TIMED_OUT') {
          console.warn('⏰ Real-time subscription timed out');
        } else if (status === 'CLOSED') {
          console.log('🔌 Real-time subscription closed');
        }
      });

    return () => {
      console.log('🧹 Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [setRealTimeOrderData, setProcessingStage, setProcessingProgress, setCurrentStep]);

  return { setupRealTimeSubscription };
};