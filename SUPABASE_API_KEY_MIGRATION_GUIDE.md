# Supabase API Key Migration Guide

## Overview

This document outlines the migration from legacy Supabase API keys to the new API key system announced in [Supabase's GitHub discussion](https://github.com/orgs/supabase/discussions/29260).

## Migration Status

### ✅ Phase A: Infrastructure Update (COMPLETED)

#### A1: Enhanced JWT Verification Library
- **File**: `supabase/functions/_shared/auth-verification.ts`
- **Status**: ✅ Completed
- **Features**:
  - `SupabaseAuthManager` class for handling both legacy and new keys
  - `detectKeyFormat()` function for key type identification
  - JWT verification using `.well-known/jwks.json` approach
  - Backward compatibility during transition
  - Comprehensive audit logging

#### A2: MCP Server Authentication System
- **Files**: 
  - `supabase/functions/_shared/mcp-server.ts` (Updated)
  - `supabase/functions/mcp-ai-analysis/index.ts` (Updated)
  - `supabase/functions/mcp-metadata/index.ts` (Updated)
  - `supabase/functions/mcp-storage/index.ts` (Updated)
- **Status**: ✅ Completed
- **Changes**:
  - All MCP servers updated to use new authentication configuration
  - Backward compatibility maintained during transition
  - Enhanced security path protection with new auth system

#### A3: Environment Variables Configuration
- **Files**: `.env`, `.env.example`
- **Status**: ✅ Completed
- **Updates**:
  - Added `SUPABASE_SECRET_KEY` (sb_secret_... format)
  - Added `SUPABASE_PUBLISHABLE_KEY` (sb_publishable_... format)
  - Updated `SUPABASE_ACCESS_TOKEN` (sbp_... format) - **Needs actual token**
  - Maintained legacy keys for transition period

## Key Format Changes

### Legacy Format (Current)
```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### New Format (Target)
```
SUPABASE_SECRET_KEY=sb_secret_1234567890abcdef...
SUPABASE_PUBLISHABLE_KEY=sb_publishable_1234567890abcdef...
SUPABASE_ACCESS_TOKEN=sbp_1234567890abcdef...
```

## Required Actions

### 1. Obtain New API Keys
- Access your Supabase project dashboard
- Navigate to Settings > API
- Generate new API keys in the new format:
  - Secret key (sb_secret_...)
  - Publishable key (sb_publishable_...)
  - Access token for CLI (sbp_...)

### 2. Update Environment Variables
Replace the placeholder values in `.env`:
```bash
# Replace with actual keys from Supabase dashboard
SUPABASE_SECRET_KEY=sb_secret_YOUR_ACTUAL_SECRET_KEY
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_ACTUAL_PUBLISHABLE_KEY
SUPABASE_ACCESS_TOKEN=sbp_YOUR_ACTUAL_ACCESS_TOKEN
```

### 3. Test Deployment
Once new keys are configured, test the new authentication system:
```bash
# Deploy test function
supabase functions deploy test-new-auth

# Test authentication
curl -X POST https://ufdcvxmizlzlnyyqpfck.supabase.co/functions/v1/test-new-auth \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json"
```

### 4. Update Frontend Configuration (Next Phase)
Update `src/integrations/supabase/client.ts` to use new publishable key:
```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY // Changed from ANON_KEY
```

## Migration Benefits

### Security Enhancements
- **Instant Key Revocation**: New keys can be revoked immediately
- **Zero-Downtime Rotation**: Keys can be rotated without service interruption
- **Enhanced Monitoring**: Better tracking of key usage and security events
- **JWKS Support**: Modern JWT verification using JSON Web Key Set

### Operational Improvements
- **Backward Compatibility**: Legacy and new keys work simultaneously during transition
- **Audit Logging**: Comprehensive authentication event tracking
- **Error Handling**: Enhanced error messages with key format detection
- **Performance**: More efficient token validation with caching

## Testing Checklist

### ✅ Infrastructure Tests
- [x] SupabaseAuthManager handles both key formats
- [x] Key format detection works correctly
- [x] MCP servers use new authentication system
- [x] Environment variables properly configured

### ⏳ Deployment Tests (Pending Access Token)
- [ ] Test function deploys successfully with new access token
- [ ] Authentication works with new secret key
- [ ] Legacy keys still function during transition
- [ ] Audit logging captures authentication events

### ⏳ Integration Tests (Next Phase)
- [ ] Frontend uses new publishable key
- [ ] All Edge Functions work with new keys
- [ ] MCP servers authenticate properly
- [ ] Email system functions correctly

## Timeline

- **November 2025**: Legacy keys will be deprecated
- **Migration Period**: Both key formats supported until deprecation
- **Recommended**: Complete migration by September 2025

## Support and Troubleshooting

### Common Issues

1. **"Invalid access token format"**
   - Solution: Update SUPABASE_ACCESS_TOKEN to sbp_... format
   
2. **"Authentication failed"** 
   - Check key format using `detectKeyFormat()` function
   - Verify environment variables are properly set
   
3. **"JWKS fetch failed"**
   - Ensure SUPABASE_URL is correctly configured
   - Check network connectivity to `.well-known/jwks.json`

### Debug Information

The test function provides detailed debugging information:
```json
{
  "authentication": {
    "verified": true,
    "keyFormat": "new_secret",
    "user": { "id": "user-id" }
  },
  "authConfiguration": {
    "hasLegacyKey": true,
    "hasNewSecretKey": true,
    "allowLegacy": true
  },
  "environment": {
    "legacyKeyFormat": "legacy",
    "newSecretKeyFormat": "new_secret"
  }
}
```

## Next Steps

1. **Immediate**: Obtain new API keys from Supabase dashboard
2. **Deploy**: Test the new authentication system
3. **Frontend**: Update client configuration to use new publishable key  
4. **Validation**: Run comprehensive authentication flow tests
5. **Production**: Deploy with backward compatibility support

---

For questions or issues, refer to the [Supabase API key discussion](https://github.com/orgs/supabase/discussions/29260) or check the authentication system logs.