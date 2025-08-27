/**
 * Enhanced Supabase Client Configuration
 * Supports new Supabase API key format with backward compatibility
 * 
 * Updated to use new authentication system while maintaining legacy support
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Configuration for enhanced authentication system
const getSupabaseConfig = () => {
  // Get URL from environment variables - required for production
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  // New publishable key format (preferred)
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  // Legacy anon key (fallback during transition)
  const legacyAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  // Use new publishable key if available, otherwise fall back to legacy anon key
  const clientKey = publishableKey || legacyAnonKey;
  
  // Detect key format for logging
  const keyFormat = clientKey.startsWith('sb_publishable_') ? 'new_publishable' : 'legacy_anon';
  
  console.log(`🔐 Supabase client using ${keyFormat} key format`);
  
  return {
    url: supabaseUrl,
    key: clientKey,
    keyFormat
  };
};

// Get configuration
const config = getSupabaseConfig();

export const SUPABASE_URL = config.url;
export const SUPABASE_ANON_KEY = config.key; // Maintained for backward compatibility
export const SUPABASE_KEY_FORMAT = config.keyFormat;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Utility functions for migration support
export const isUsingNewKeyFormat = () => SUPABASE_KEY_FORMAT === 'new_publishable';

export const getMigrationStatus = () => ({
  keyFormat: SUPABASE_KEY_FORMAT,
  migrationReady: isUsingNewKeyFormat(),
  hasPublishableKey: !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  hasLegacyAnonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
  timestamp: new Date().toISOString()
});

// Log migration status in development
if (import.meta.env.DEV) {
  console.log('📊 Supabase Migration Status:', getMigrationStatus());
}