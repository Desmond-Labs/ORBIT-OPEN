/**
 * Enhanced Supabase Client Configuration
 * Supports new Supabase API key format with backward compatibility
 * 
 * MIGRATION: This file demonstrates the new configuration approach.
 * Once new API keys are available, replace the main client.ts with this configuration.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Configuration for new API key system
const getSupabaseConfig = () => {
  // During transition period, prefer environment variables but fall back to hardcoded values
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ufdcvxmizlzlnyyqpfck.supabase.co";
  
  // New publishable key format (preferred)
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  // Legacy anon key (fallback during transition)
  const legacyAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmZGN2eG1pemx6bG55eXFwZmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyMzM1NzMsImV4cCI6MjA2MTgwOTU3M30.bpYLwFpQxq5tAw4uvRrHPi9WeFmxHnLjQaZraZqa3Bs";
  
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
export const SUPABASE_KEY = config.key;
export const SUPABASE_KEY_FORMAT = config.keyFormat;

// Enhanced Supabase client with new key format support
export const supabaseNew = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Utility to check if we're using the new key format
export const isUsingNewKeyFormat = () => SUPABASE_KEY_FORMAT === 'new_publishable';

// Migration status information
export const getMigrationStatus = () => ({
  keyFormat: SUPABASE_KEY_FORMAT,
  migrationReady: isUsingNewKeyFormat(),
  hasPublishableKey: !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  hasLegacyAnonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
  timestamp: new Date().toISOString()
});

// Log migration status on load
if (import.meta.env.DEV) {
  console.log('📊 Supabase Migration Status:', getMigrationStatus());
}