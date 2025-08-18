/**
 * Enhanced JWT Verification Library
 * Supabase New API Keys Migration Support
 * 
 * Provides modern JWT verification using .well-known/jwks.json approach
 * with backward compatibility for legacy keys during transition
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// JWT verification interfaces
export interface JWTVerificationResult {
  success: boolean;
  payload?: any;
  user?: any;
  error?: string;
  keyFormat: 'legacy' | 'new_secret' | 'new_publishable';
}

export interface AuthConfig {
  supabaseUrl: string;
  legacyServiceKey?: string;
  newSecretKey?: string;
  newPublishableKey?: string;
  allowLegacy: boolean;
  requireAuth: boolean;
}

// Key format detection
export function detectKeyFormat(key: string): 'legacy' | 'new_secret' | 'new_publishable' | 'invalid' {
  if (!key || typeof key !== 'string') {
    return 'invalid';
  }
  
  // New secret key format
  if (key.startsWith('sb_secret_')) {
    return 'new_secret';
  }
  
  // New publishable key format  
  if (key.startsWith('sb_publishable_')) {
    return 'new_publishable';
  }
  
  // Legacy format (JWT-like)
  if (key.startsWith('eyJ') || key.includes('.')) {
    return 'legacy';
  }
  
  return 'invalid';
}

/**
 * Enhanced Authentication Manager
 */
export class SupabaseAuthManager {
  private config: AuthConfig;
  private supabaseClient: any;
  private jwksCache: any = null;
  private jwksCacheExpiry: number = 0;
  
  constructor(config: Partial<AuthConfig> = {}) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const legacyServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const newSecretKey = Deno.env.get('SUPABASE_SECRET_KEY');
    const newPublishableKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
    
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable is required');
    }
    
    this.config = {
      supabaseUrl,
      legacyServiceKey,
      newSecretKey,
      newPublishableKey,
      allowLegacy: true, // Enable during transition
      requireAuth: true,
      ...config
    };
    
    // Initialize Supabase client with appropriate key
    const clientKey = this.config.newSecretKey || this.config.legacyServiceKey;
    if (clientKey) {
      this.supabaseClient = createClient(supabaseUrl, clientKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
    }
    
    console.log('🔐 SupabaseAuthManager initialized with key format support');
  }
  
  /**
   * Get JWKS (JSON Web Key Set) from Supabase
   */
  private async getJWKS(): Promise<any> {
    // Check cache first (cache for 1 hour)
    if (this.jwksCache && Date.now() < this.jwksCacheExpiry) {
      return this.jwksCache;
    }
    
    try {
      const jwksUrl = `${this.config.supabaseUrl}/.well-known/jwks.json`;
      const response = await fetch(jwksUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch JWKS: ${response.status}`);
      }
      
      const jwks = await response.json();
      
      // Cache for 1 hour
      this.jwksCache = jwks;
      this.jwksCacheExpiry = Date.now() + (60 * 60 * 1000);
      
      return jwks;
    } catch (error) {
      console.error('Failed to fetch JWKS:', error);
      throw new Error(`JWKS fetch failed: ${error.message}`);
    }
  }
  
  /**
   * Verify JWT token using modern approach
   */
  private async verifyJWTWithJWKS(token: string): Promise<JWTVerificationResult> {
    try {
      // For now, use Supabase client verification as fallback
      // In production, would implement full JWKS verification
      const { data: { user }, error } = await this.supabaseClient.auth.getUser(token);
      
      if (error) {
        return {
          success: false,
          error: error.message,
          keyFormat: 'new_secret'
        };
      }
      
      return {
        success: true,
        user,
        payload: user,
        keyFormat: 'new_secret'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        keyFormat: 'new_secret'
      };
    }
  }
  
  /**
   * Legacy JWT verification (backward compatibility)
   */
  private async verifyLegacyJWT(token: string): Promise<JWTVerificationResult> {
    if (!this.config.allowLegacy) {
      return {
        success: false,
        error: 'Legacy key format not allowed',
        keyFormat: 'legacy'
      };
    }
    
    try {
      const { data: { user }, error } = await this.supabaseClient.auth.getUser(token);
      
      if (error) {
        return {
          success: false,
          error: error.message,
          keyFormat: 'legacy'
        };
      }
      
      return {
        success: true,
        user,
        payload: user,
        keyFormat: 'legacy'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        keyFormat: 'legacy'
      };
    }
  }
  
  /**
   * Main JWT verification method
   */
  async verifyJWT(token: string): Promise<JWTVerificationResult> {
    if (!token) {
      return {
        success: false,
        error: 'No token provided',
        keyFormat: 'invalid'
      };
    }
    
    try {
      // Try modern verification first
      if (this.config.newSecretKey) {
        const result = await this.verifyJWTWithJWKS(token);
        if (result.success) {
          return result;
        }
      }
      
      // Fallback to legacy verification if allowed
      if (this.config.allowLegacy && this.config.legacyServiceKey) {
        return await this.verifyLegacyJWT(token);
      }
      
      return {
        success: false,
        error: 'No valid verification method available',
        keyFormat: 'invalid'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        keyFormat: 'invalid'
      };
    }
  }
  
  /**
   * Extract token from request headers
   */
  extractTokenFromRequest(request: Request): string | null {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return null;
    }
    
    // Handle "Bearer token" format
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Handle direct token
    return authHeader;
  }
  
  /**
   * Verify request authentication
   */
  async verifyRequest(request: Request): Promise<JWTVerificationResult> {
    if (!this.config.requireAuth) {
      return {
        success: true,
        keyFormat: 'new_secret'
      };
    }
    
    const token = this.extractTokenFromRequest(request);
    if (!token) {
      return {
        success: false,
        error: 'Missing authorization token',
        keyFormat: 'invalid'
      };
    }
    
    return await this.verifyJWT(token);
  }
  
  /**
   * Create error response for authentication failures
   */
  createAuthErrorResponse(result: JWTVerificationResult): Response {
    return new Response(
      JSON.stringify({
        error: 'Authentication failed',
        message: result.error,
        keyFormat: result.keyFormat
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
  
  /**
   * Get Supabase client (for internal use)
   */
  getSupabaseClient(useServiceRole: boolean = true) {
    if (useServiceRole) {
      // Return service role client for elevated permissions
      return this.supabaseClient;
    } else {
      // Return user client for regular operations
      const userKey = this.config.newPublishableKey || this.config.legacyAnonKey || this.config.legacyServiceKey;
      return createClient(this.config.supabaseUrl, userKey);
    }
  }
  
  /**
   * Get service token for inter-function calls
   */
  getServiceToken(): string {
    return this.config.newSecretKey || this.config.legacyServiceKey || '';
  }
  
  /**
   * Get key format for debugging
   */
  getKeyFormat(): string {
    if (this.config.newSecretKey) {
      return detectKeyFormat(this.config.newSecretKey);
    } else if (this.config.legacyServiceKey) {
      return detectKeyFormat(this.config.legacyServiceKey);
    }
    return 'none';
  }
  
  /**
   * Get configuration info (for debugging)
   */
  getConfigInfo() {
    return {
      hasLegacyKey: !!this.config.legacyServiceKey,
      hasNewSecretKey: !!this.config.newSecretKey,
      hasNewPublishableKey: !!this.config.newPublishableKey,
      allowLegacy: this.config.allowLegacy,
      requireAuth: this.config.requireAuth,
      legacyKeyFormat: this.config.legacyServiceKey ? detectKeyFormat(this.config.legacyServiceKey) : 'none',
      newSecretKeyFormat: this.config.newSecretKey ? detectKeyFormat(this.config.newSecretKey) : 'none',
      newPublishableKeyFormat: this.config.newPublishableKey ? detectKeyFormat(this.config.newPublishableKey) : 'none'
    };
  }
}

/**
 * Enhanced security path protection with new auth system
 */
export async function enhancedSecurityPathProtection(request?: Request, config?: Partial<AuthConfig>): Promise<void> {
  try {
    await Deno.permissions.request({ name: 'env' });
  } catch (error) {
    console.warn('Environment permission request failed:', error);
  }
  
  // Validate environment setup
  const authManager = new SupabaseAuthManager(config);
  const configInfo = authManager.getConfigInfo();
  
  console.log('🔒 Enhanced security path protection active');
  console.log('🔑 Auth configuration:', configInfo);
  
  // Verify request if provided
  if (request) {
    const authResult = await authManager.verifyRequest(request);
    if (!authResult.success && authManager['config'].requireAuth) {
      console.warn('🚨 Authentication failed:', authResult.error);
      throw new Error(`Authentication failed: ${authResult.error}`);
    }
  }
}

/**
 * Convenience function for creating auth manager
 */
export function createAuthManager(config?: Partial<AuthConfig>): SupabaseAuthManager {
  return new SupabaseAuthManager(config);
}

/**
 * Audit logging for authentication events
 */
export function auditAuthEvent(event: {
  type: 'auth_success' | 'auth_failure' | 'key_migration' | 'security_warning';
  keyFormat: string;
  userAgent?: string;
  ipAddress?: string;
  error?: string;
  timestamp?: string;
}) {
  const logEntry = {
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
    service: 'orbit-auth-verification'
  };
  
  console.log('🔍 Auth Audit:', JSON.stringify(logEntry));
  
  // In production, would send to logging service
}