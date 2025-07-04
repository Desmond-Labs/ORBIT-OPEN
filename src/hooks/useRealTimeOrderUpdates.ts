import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useRealTimeOrderUpdates = (
  setRealTimeOrderData: (data: any) => void,
  setProcessingStage: (stage: string) => void,
  setProcessingProgress: (progress: number) => void,
  setCurrentStep: (step: 'auth' | 'upload' | 'payment' | 'processing' | 'complete') => void
) => {
  const setupRealTimeSubscription = useCallback((orderIdParam: string) => {
    const channel = supabase
      .channel('order-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderIdParam}`
        },
        (payload) => {
          console.log('Order status update:', payload);
          const newOrder = payload.new;
          setRealTimeOrderData(newOrder);
          setProcessingStage(newOrder.processing_stage || 'pending');
          setProcessingProgress(newOrder.processing_completion_percentage || 0);
          
          if (newOrder.order_status === 'completed') {
            setCurrentStep('complete');
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [setRealTimeOrderData, setProcessingStage, setProcessingProgress, setCurrentStep]);

  return { setupRealTimeSubscription };
};