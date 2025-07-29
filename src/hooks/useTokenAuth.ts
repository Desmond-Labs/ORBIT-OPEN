import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TokenValidationResult {
  valid: boolean;
  order_id: string | null;
  user_id: string | null;
  expires_at: string | null;
  uses_remaining: number;
}

interface TokenAuthState {
  isValidating: boolean;
  isValidToken: boolean;
  tokenData: TokenValidationResult | null;
  error: string | null;
}

export const useTokenAuth = (token: string | null, orderId: string | null) => {
  const [state, setState] = useState<TokenAuthState>({
    isValidating: false,
    isValidToken: false,
    tokenData: null,
    error: null
  });

  const validateToken = async (tokenToValidate: string, orderIdToValidate: string) => {
    setState(prev => ({ ...prev, isValidating: true, error: null }));

    try {
      console.log('🔐 Validating token for order:', orderIdToValidate);

      // Call the token validation function
      const { data, error } = await supabase
        .rpc('validate_order_token', {
          token_param: tokenToValidate,
          order_id_param: orderIdToValidate
        });

      if (error) {
        console.error('🔐 Token validation error:', error);
        throw error;
      }

      const tokenData = data[0] as TokenValidationResult;
      console.log('🔐 Token validation result:', tokenData);

      if (tokenData.valid) {
        // Set the token in session configuration for RLS
        await supabase
          .rpc('set_config', {
            setting_name: 'app.current_token',
            setting_value: tokenToValidate,
            is_local: true
          });

        console.log('🔐 Token set in session configuration for RLS access');
      }

      setState({
        isValidating: false,
        isValidToken: tokenData.valid,
        tokenData,
        error: tokenData.valid ? null : 'Invalid or expired token'
      });

      return tokenData.valid;
    } catch (error: any) {
      console.error('🔐 Token validation failed:', error);
      setState({
        isValidating: false,
        isValidToken: false,
        tokenData: null,
        error: error.message || 'Token validation failed'
      });
      return false;
    }
  };

  const incrementTokenUsage = async (tokenToIncrement: string) => {
    try {
      console.log('🔐 Incrementing token usage');
      const { data, error } = await supabase
        .rpc('increment_token_usage', {
          token_param: tokenToIncrement
        });

      if (error) {
        console.error('🔐 Failed to increment token usage:', error);
        return false;
      }

      console.log('🔐 Token usage incremented successfully');
      return data;
    } catch (error: any) {
      console.error('🔐 Error incrementing token usage:', error);
      return false;
    }
  };

  // Auto-validate token when provided
  useEffect(() => {
    if (token && orderId && !state.isValidating && !state.isValidToken) {
      validateToken(token, orderId);
    }
  }, [token, orderId]);

  return {
    ...state,
    validateToken,
    incrementTokenUsage,
    hasValidToken: state.isValidToken && state.tokenData,
    expiresAt: state.tokenData?.expires_at ? new Date(state.tokenData.expires_at) : null,
    usesRemaining: state.tokenData?.uses_remaining || 0
  };
};