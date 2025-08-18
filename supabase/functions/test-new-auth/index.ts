/**
 * Test Edge Function for New Supabase API Key System
 * Demonstrates both legacy and new authentication working together
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { 
  SupabaseAuthManager, 
  detectKeyFormat,
  auditAuthEvent,
  enhancedSecurityPathProtection,
  type AuthConfig 
} from '../_shared/auth-verification.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Apply enhanced security path protection
    await enhancedSecurityPathProtection(req);

    // Initialize auth manager with transition period configuration
    const authConfig: Partial<AuthConfig> = {
      allowLegacy: true,
      requireAuth: false // For testing purposes
    };

    const authManager = new SupabaseAuthManager(authConfig);
    
    // Get configuration info
    const configInfo = authManager.getConfigInfo();
    console.log('🔐 Auth configuration:', configInfo);

    // Verify the request authentication
    const authResult = await authManager.verifyRequest(req);
    
    // Log the authentication attempt
    auditAuthEvent({
      type: authResult.success ? 'auth_success' : 'auth_failure',
      keyFormat: authResult.keyFormat,
      userAgent: req.headers.get('user-agent') || undefined,
      error: authResult.error
    });

    // Collect environment variable information (for testing)
    const envInfo = {
      hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
      hasLegacyServiceKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      hasNewSecretKey: !!Deno.env.get('SUPABASE_SECRET_KEY'),
      hasNewPublishableKey: !!Deno.env.get('SUPABASE_PUBLISHABLE_KEY'),
      legacyKeyFormat: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 
        detectKeyFormat(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!) : 'none',
      newSecretKeyFormat: Deno.env.get('SUPABASE_SECRET_KEY') ? 
        detectKeyFormat(Deno.env.get('SUPABASE_SECRET_KEY')!) : 'none',
      newPublishableKeyFormat: Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ? 
        detectKeyFormat(Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!) : 'none'
    };

    // Test response
    const response = {
      status: 'success',
      message: 'New Supabase API Key System Test',
      timestamp: new Date().toISOString(),
      authentication: {
        verified: authResult.success,
        keyFormat: authResult.keyFormat,
        error: authResult.error,
        user: authResult.user ? { id: authResult.user.id } : null
      },
      authConfiguration: configInfo,
      environment: envInfo,
      migration: {
        phase: 'A - Infrastructure Update',
        status: 'completed',
        supportedKeyFormats: ['legacy', 'new_secret', 'new_publishable'],
        backwardCompatible: true
      }
    };

    console.log('✅ New auth system test completed successfully');

    return new Response(JSON.stringify(response, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      status: 200,
    });

  } catch (error) {
    console.error('❌ New auth system test failed:', error);
    
    const errorResponse = {
      status: 'error',
      message: 'New auth system test failed',
      error: error.message,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      status: 500,
    });
  }
});

console.log('🧪 Test New Auth System Edge Function deployed');