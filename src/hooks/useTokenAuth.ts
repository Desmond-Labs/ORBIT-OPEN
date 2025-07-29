import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TokenValidation {
  valid: boolean;
  order_id: string | null;
  user_id: string | null;
  expires_at: string | null;
  uses_remaining: number;
}

interface TokenAuthState {
  isValidating: boolean;
  tokenValid: boolean;
  tokenData: TokenValidation | null;
  error: string | null;
}

export const useTokenAuth = (token: string | null, orderId: string | null) => {
  const [state, setState] = useState<TokenAuthState>({
    isValidating: false,
    tokenValid: false,
    tokenData: null,
    error: null,
  });
  const { toast } = useToast();

  const validateToken = async () => {
    if (!token) {
      setState(prev => ({ ...prev, tokenValid: false, tokenData: null, error: null }));
      return;
    }

    setState(prev => ({ ...prev, isValidating: true, error: null }));

    try {
      console.log('🔐 Validating token:', token.substring(0, 8) + '...');

      // Call the validation function
      const { data, error } = await supabase.rpc('validate_order_token', {
        token_param: token,
        order_id_param: orderId || null,
      });

      if (error) {
        throw new Error(`Token validation failed: ${error.message}`);
      }

      const tokenData = data?.[0] as TokenValidation;
      
      if (!tokenData?.valid) {
        setState(prev => ({
          ...prev,
          isValidating: false,
          tokenValid: false,
          tokenData,
          error: 'Invalid or expired token',
        }));
        
        toast({
          title: "Access Expired",
          description: "This link has expired or is no longer valid. Please request a new link.",
          variant: "destructive"
        });
        
        return;
      }

      // Set the token in the database session for RLS policies
      await supabase.rpc('set_config', {
        setting_name: 'app.current_token',
        setting_value: token,
        is_local: true,
      });

      setState(prev => ({
        ...prev,
        isValidating: false,
        tokenValid: true,
        tokenData,
        error: null,
      }));

      console.log('✅ Token validated successfully:', {
        order_id: tokenData.order_id,
        expires_at: tokenData.expires_at,
        uses_remaining: tokenData.uses_remaining,
      });

    } catch (error: any) {
      console.error('❌ Token validation error:', error);
      setState(prev => ({
        ...prev,
        isValidating: false,
        tokenValid: false,
        tokenData: null,
        error: error.message,
      }));
    }
  };

  const incrementTokenUsage = async () => {
    if (!token || !state.tokenValid) return false;

    try {
      const { data, error } = await supabase.rpc('increment_token_usage', {
        token_param: token,
      });

      if (error) {
        console.error('Error incrementing token usage:', error);
        return false;
      }

      // Refresh token validation to get updated usage count
      await validateToken();
      return data;
    } catch (error) {
      console.error('Error incrementing token usage:', error);
      return false;
    }
  };

  const clearToken = () => {
    setState({
      isValidating: false,
      tokenValid: false,
      tokenData: null,
      error: null,
    });
  };

  useEffect(() => {
    validateToken();
  }, [token, orderId]);

  return {
    ...state,
    validateToken,
    incrementTokenUsage,
    clearToken,
  };
};