import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DailyLimitData {
  daily_used: number;
  daily_limit: number;
  free_images_available: number;
  daily_resets_at: string;
  is_free_only: boolean;
  is_mixed_order: boolean;
  free_images_used: number;
  paid_images: number;
  total_cost: number;
}

export const useDailyLimit = (user: any, imageCount: number) => {
  const [dailyLimitData, setDailyLimitData] = useState<DailyLimitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkDailyLimit = async () => {
    if (!user || imageCount <= 0) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase
        .rpc('calculate_hybrid_pricing', {
          user_id_param: user.id,
          image_count_param: imageCount
        });

      if (rpcError) {
        console.error('Error checking daily limit:', rpcError);
        setError('Failed to check daily limit');
        return;
      }

      setDailyLimitData(data as unknown as DailyLimitData);
    } catch (err) {
      console.error('Error in checkDailyLimit:', err);
      setError('Failed to check daily limit');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkDailyLimit();
  }, [user, imageCount]);

  const getTimeUntilReset = () => {
    if (!dailyLimitData?.daily_resets_at) return '';

    const resetTime = new Date(dailyLimitData.daily_resets_at);
    const now = new Date();
    const diff = resetTime.getTime() - now.getTime();

    if (diff <= 0) return 'Resetting now...';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `Resets in ${hours}h ${minutes}m`;
    } else {
      return `Resets in ${minutes}m`;
    }
  };

  const getPricingMessage = () => {
    if (!dailyLimitData) return '';

    const { free_images_used, paid_images, total_cost, is_free_only } = dailyLimitData;

    if (is_free_only) {
      return `${free_images_used} images FREE`;
    } else if (free_images_used > 0) {
      return `${free_images_used} images FREE + ${paid_images} images $${total_cost} = $${total_cost}`;
    } else {
      return `${paid_images} images $${total_cost}`;
    }
  };

  const getButtonText = (isProcessing: boolean = false) => {
    if (isProcessing) return 'Processing...';
    
    if (!dailyLimitData) return 'Calculate Cost';

    if (dailyLimitData.is_free_only) {
      return 'Process Images (FREE)';
    } else {
      return 'Pay with Stripe';
    }
  };

  return {
    dailyLimitData,
    loading,
    error,
    checkDailyLimit,
    getTimeUntilReset,
    getPricingMessage,
    getButtonText
  };
};