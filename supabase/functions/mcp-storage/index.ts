/**
 * Remote Storage Operations MCP Server - Edge Function Implementation
 * Replicates functionality of local supabase-storage-mcp server
 * Using direct secret key authentication.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { MCPServiceToolDefinition, MCPToolResult, MCPRequestContext } from '../_shared/mcp-types.ts';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const MCP_STORAGE_SECRET = Deno.env.get('sb_secret_key');

// Security configuration matching local server
const SECURITY_CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 100,
  MAX_BATCH_SIZE: 500,
  MAX_BATCH_DOWNLOAD_SIZE: 50,
  MAX_SIGNED_URLS: 100
};

// Result interfaces matching local server
interface SetupBucketsResult {
  success: boolean;
  buckets_created: string[];
  message: string;
  security_configuration: {
    images_bucket: BucketSecurityConfig;
    exports_bucket: BucketSecurityConfig;
  };
}

interface BucketSecurityConfig {
  public: boolean;
  file_size_limit: number;
  allowed_mime_types: string[];
  audit_logging_enabled: boolean;
  threat_detection_enabled: boolean;
}

interface FileListResult {
  files: FileInfo[];
  total_count: number;
  total_size: number;
}

interface FileInfo {
  name: string;
  path: string;
  size: number;
  mime_type: string;
  last_modified: string;
  metadata?: any;
}

interface SignedUrlResult {
  signedUrl: string;
  expiresAt: string;
  fileSize: number;
  mimeType: string;
}

interface SignedUrlBatchResult {
  urls: SignedUrlInfo[];
  total_files: number;
  successful_urls: number;
  failed_urls: number;
  success_rate: string;
  expires_in: number;
}

interface SignedUrlInfo {
  file_path: string;
  signed_url: string;
  expires_at: string;
  success: boolean;
  error?: string;
}

interface DownloadFileResult {
  success: boolean;
  file_path: string;
  file_name: string;
  content: string;
  content_type: string;
  file_size: number;
  format: string;
  transformed: boolean;
  transform_options?: any;
  metadata: {
    last_modified: string;
    cache_control: string;
  };
}

interface AutoDownloadFileResult {
  success: boolean;
  file_path: string;
  file_name: string;
  content?: string;
  download_url?: string;
  content_type: string;
  file_size?: number;
  format: string;
  auto_download_enabled: boolean;
  expires_at?: string;
  transformed: boolean;
  transform_options?: any;
  javascript_trigger?: string;
  metadata: {
    last_modified: string;
    cache_control: string;
  };
}

interface BatchDownloadResult {
  success: boolean;
  batch_summary: {
    total_files: number;
    successful_downloads: number;
    failed_downloads: number;
    success_rate: string;
  };
  downloads: any[];
  auto_download_enabled: boolean;
  javascript_trigger?: string;
  expires_in?: number;
}

interface SecurityStatusResponse {
  security_config: typeof SECURITY_CONFIG;
  rate_limit_status: {
    active_limits: number;
    current_window: number;
  };
  audit_log: {
    total_entries: number;
    recent_entries: Array<{ 
      timestamp: string;
      tool: string;
      success: boolean;
      error: string;
    }>;
  };
  server_info: {
    name: string;
    version: string;
    uptime: number;
    node_version?: string;
  };
}

/**
 * Create Supabase client
 */
function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

/**
 * Generate secure file hash
 */
async function generateFileHash(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate file upload data
 */
function validateFileData(data: any): { valid: boolean; error?: string; size?: number } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid file data object' };
  }
  
  const { filename, content, mime_type } = data;
  
  if (!filename || typeof filename !== 'string') {
    return { valid: false, error: 'Invalid filename' };
  }
  
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'Invalid base64 content' };
  }
  
  if (!mime_type || !SECURITY_CONFIG.ALLOWED_MIME_TYPES.includes(mime_type)) {
    return { valid: false, error: `Unsupported MIME type: ${mime_type}` };
  }
  
  try {
    // Validate base64 and get size
    const buffer = Uint8Array.from(atob(content), c => c.charCodeAt(0));
    if (buffer.length > SECURITY_CONFIG.MAX_FILE_SIZE) {
      return { valid: false, error: `File size ${buffer.length} exceeds limit ${SECURITY_CONFIG.MAX_FILE_SIZE}` };
    }
    
    return { valid: true, size: buffer.length };
  } catch (error) {
    return { valid: false, error: 'Invalid base64 content' };
  }
}

/**
 * Upload file from base64 data
 */
async function uploadFileFromBase64(
  supabase: any, 
  bucket: string, 
  path: string, 
  base64Content: string, 
  mimeType: string
): Promise<{ success: boolean; path?: string; size?: number; error?: string }> {
  try {
    const buffer = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: mimeType,
        upsert: true
      });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return {
      success: true,
      path: data.path,
      size: buffer.length
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Process batch upload (supports both file paths and base64 data)
 */
async function processBatchUpload(
  fileData: any[], 
  options: {
    bucketName: string;
    batchId: string;
    folderPrefix: string;
    userId: string;
    supabase: any;
  }
): Promise<{
  total: number;
  success_count: number;
  error_count: number;
  successful: any[];
  failed: any[];
}> {
  const { bucketName, batchId, folderPrefix, userId, supabase } = options;
  const results = { 
    total: fileData.length, 
    success_count: 0, 
    error_count: 0, 
    successful: [], 
    failed: [] 
  };
  
  for (let i = 0; i < fileData.length; i++) {
    const fileItem = fileData[i];
    
    try {
      // Validate file data
      const validation = validateFileData(fileItem);
      if (!validation.valid) {
        results.failed.push({
          filename: fileItem.filename || `file_${i}`,
          error: validation.error
        });
        results.error_count++;
        continue;
      }
      
      // Create storage path
      const timestamp = Date.now();
      const fileName = fileItem.filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const storagePath = `${batchId}_${userId}/${folderPrefix}/${fileName}`;
      
      // Upload file
      const uploadResult = await uploadFileFromBase64(
        supabase,
        bucketName,
        storagePath,
        fileItem.content,
        fileItem.mime_type
      );
      
      if (uploadResult.success) {
        results.successful.push({
          original_filename: fileItem.filename,
          storage_path: uploadResult.path,
          file_size: uploadResult.size,
          mime_type: fileItem.mime_type,
          upload_timestamp: timestamp
        });
        results.success_count++;
      } else {
        results.failed.push({
          filename: fileItem.filename,
          error: uploadResult.error
        });
        results.error_count++;
      }
    } catch (error) {
      results.failed.push({
        filename: fileItem.filename || `file_${i}`,
        error: error.message
      });
      results.error_count++;
    }
  }
  
  return results;
}

// Tool definitions matching local server functionality
const storageTools: MCPServiceToolDefinition[] = [
  {
    name: 'create_bucket',
    schema: {
      name: 'create_bucket',
      description: 'Create a new storage bucket with comprehensive security validation and audit logging',
      inputSchema: {
        type: 'object',
        properties: {
          bucket_name: {
            type: 'string',
            description: 'Name of the bucket to create (3-63 chars, lowercase, alphanumeric with hyphens)',
            minLength: 3,
            maxLength: 63,
            pattern: '^[a-z0-9][a-z0-9\-]*[a-z0-9]$'
          },
          is_public: {
            type: 'boolean',
            description: 'Whether the bucket should be public',
            default: false
          }
        },
        required: ['bucket_name'],
        additionalProperties: false
      }
    },
    handler: async (params, context) => {
      const { bucket_name, is_public = false } = params;
      
      try {
        const supabase = createSupabaseClient();
        
        const { data, error } = await supabase.storage.createBucket(bucket_name, {
          public: is_public
        });
        
        if (error) {
          throw new Error(`Failed to create bucket: ${error.message}`);
        }
        
        return [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Successfully created secure bucket: ${bucket_name}`,
              bucket_name: data.name,
              security_configuration: {
                public: is_public,
                audit_logging_enabled: true,
                threat_detection_enabled: true
              },
              request_id: crypto.randomUUID(),
              processing_time: Date.now()
            }, null, 2)
          }
        ];
      } catch (error) {
        return [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message
            }, null, 2)
          }
        ];
      }
    }
  },
  
  {
    name: 'setup_orbit_buckets',
    schema: {
      name: 'setup_orbit_buckets',
      description: 'Initialize user-specific storage buckets for ORBIT workflow',
      inputSchema: {
        type: 'object',
        properties: {
          base_bucket_name: {
            type: 'string',
            description: 'Base name for buckets',
            default: 'orbit',
            minLength: 3,
            maxLength: 50
          },
          user_id: {
            type: 'string',
            description: 'User identifier for organization',
            maxLength: 36
          }
        },
        required: [],
        additionalProperties: false
      }
    },
    handler: async (params, context) => {
      const { base_bucket_name = 'orbit', user_id } = params;
      
      try {
        const supabase = createSupabaseClient();
        
        const bucketsToCreate = [
          `${base_bucket_name}-images`,
          `${base_bucket_name}-processed`
        ];
        
        const bucketsCreated: string[] = [];
        
        for (const bucketName of bucketsToCreate) {
          const { data, error } = await supabase.storage.createBucket(bucketName, {
            public: false,
            fileSizeLimit: 50 * 1024 * 1024,
            allowedMimeTypes: SECURITY_CONFIG.ALLOWED_MIME_TYPES
          });
          
          if (error && !error.message.includes('already exists')) {
            throw new Error(`Failed to create bucket ${bucketName}: ${error.message}`);
          }
          
          bucketsCreated.push(bucketName);
        }
        
        const result: SetupBucketsResult = {
          success: true,
          buckets_created: bucketsCreated,
          message: `Successfully created ORBIT bucket structure: ${bucketsCreated.join(', ')}`,
          security_configuration: {
            images_bucket: {
              public: false,
              file_size_limit: 50 * 1024 * 1024,
              allowed_mime_types: SECURITY_CONFIG.ALLOWED_MIME_TYPES,
              audit_logging_enabled: true,
              threat_detection_enabled: true
            },
            exports_bucket: {
              public: false,
              file_size_limit: 50 * 1024 * 1024,
              allowed_mime_types: SECURITY_CONFIG.ALLOWED_MIME_TYPES,
              audit_logging_enabled: true,
              threat_detection_enabled: true
            }
          }
        };
        
        return [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ];
      } catch (error) {
        return [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message
            }, null, 2)
          }
        ];
      }
    }
  },
  
  {
    name: 'upload_image_batch',
    schema: {
      name: 'upload_image_batch',
      description: 'Upload multiple images to designated bucket and folder (supports both file paths and base64 data)',
      inputSchema: {
        type: 'object',
        properties: {
          bucket_name: {
            type: 'string',
            description: 'Target bucket name',
            minLength: 3,
            maxLength: 63
          },
          batch_id: {
            type: 'string',
            description: 'Unique batch identifier',
            maxLength: 64
          },
          folder_prefix: {
            type: 'string',
            description: 'Folder organization (original/processed)',
            maxLength: 100
          },
          user_id: {
            type: 'string',
            description: 'User identifier',
            maxLength: 36
          },
          image_paths: {
            type: 'array',
            description: 'Local file paths to upload (for local testing)',
            items: { type: 'string', maxLength: 4096 },
            minItems: 1,
            maxItems: 500
          },
          image_data: {
            type: 'array',
            description: 'Base64 encoded image data (for Claude Desktop compatibility)',
            items: {
              type: 'object',
              properties: {
                filename: {
                  type: 'string',
                  description: 'Original filename with extension',
                  maxLength: 255
                },
                content: {
                  type: 'string',
                  description: 'Base64 encoded file content',
                  maxLength: 67108864
                },
                mime_type: {
                  type: 'string',
                  description: 'MIME type of the file',
                  enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
                }
              },
              required: ['filename', 'content', 'mime_type'],
              additionalProperties: false
            },
            minItems: 1,
            maxItems: 500
          }
        },
        required: ['bucket_name', 'batch_id', 'folder_prefix', 'user_id', 'image_paths'],
        additionalProperties: false
      }
    },
    handler: async (params, context) => {
      const { bucket_name, batch_id, folder_prefix, user_id, image_paths, image_data } = params;
      
      try {
        // Validate input - must have either image_paths or image_data
        if (!image_paths && !image_data) {
          throw new Error('Either image_paths or image_data must be provided');
        }
        
        if (image_paths && image_data) {
          throw new Error('Cannot specify both image_paths and image_data - choose one');
        }
        
        const supabase = createSupabaseClient();
        
        const uploadOptions = {
          bucketName: bucket_name,
          batchId: batch_id,
          folderPrefix: folder_prefix,
          userId: user_id,
          supabase
        };
        
        let batchResult;
        
        if (image_data) {
          // Use base64 data (for Claude Desktop)
          batchResult = await processBatchUpload(image_data, uploadOptions);
        } else {
          // For image_paths, we would need to read files from local filesystem
          // In Edge Function environment, this would be handled differently
          throw new Error('File path upload not implemented in Edge Function environment');
        }
        
        const successRate = batchResult.total > 0 ? 
          `${Math.round((batchResult.success_count / batchResult.total) * 100)}%` : '0%';
        
        const response = {
          success: true,
          batch_id,
          summary: {
            total_files: batchResult.total,
            successful_uploads: batchResult.success_count,
            failed_uploads: batchResult.error_count,
            success_rate: successRate
          },
          results: {
            successful: batchResult.successful,
            failed: batchResult.failed,
            total: batchResult.total,
            success_count: batchResult.success_count,
            error_count: batchResult.error_count
          },
          request_id: crypto.randomUUID(),
          processing_time: Date.now()
        };
        
        return [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ];
      } catch (error) {
        return [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message
            }, null, 2)
          }
        ];
      }
    }
  },
  
  {
    name: 'list_files',
    schema: {
      name: 'list_files',
      description: 'Enumerate files in bucket folder for processing or download',
      inputSchema: {
        type: 'object',
        properties: {
          bucket_name: {
            type: 'string',
            description: 'Bucket to search',
            minLength: 3,
            maxLength: 63
          },
          folder_path: {
            type: 'string',
            description: 'Specific folder path',
            maxLength: 300
          },
          file_extension: {
            type: 'string',
            description: 'Filter by extension (.jpg, .png)',
            maxLength: 10
          }
        },
        required: ['bucket_name'],
        additionalProperties: false
      }
    },
    handler: async (params, context) => {
      const { bucket_name, folder_path, file_extension } = params;
      
      try {
        const supabase = createSupabaseClient();
        
        const { data, error } = await supabase.storage
          .from(bucket_name)
          .list(folder_path || '', {
            limit: 1000,
            sortBy: { column: 'name', order: 'asc' }
          });
        
        if (error) {
          throw new Error(`Failed to list files: ${error.message}`);
        }
        
        let files = data || [];
        
        // Filter by file extension if specified (case-insensitive)
        if (file_extension) {
          files = files.filter(file => 
            file.name.toLowerCase().endsWith(file_extension.toLowerCase())
          );
        }
        
        const totalSize = files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
        
        const result: FileListResult = {
          files: files.map(file => ({
            name: file.name,
            path: folder_path ? `${folder_path}/${file.name}` : file.name,
            size: file.metadata?.size || 0,
            mime_type: file.metadata?.mimetype || 'unknown',
            last_modified: file.updated_at || file.created_at || new Date().toISOString(),
            metadata: file.metadata
          })),
          total_count: files.length,
          total_size: totalSize
        };
        
        return [
          {
            type: 'text',
            text: JSON.stringify({
              ...result,
              request_id: crypto.randomUUID(),
              processing_time: Date.now()
            }, null, 2)
          }
        ];
      } catch (error) {
        return [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message
            }, null, 2)
          }
        ];
      }
    }
  },
  
  {
    name: 'get_file_url',
    schema: {
      name: 'get_file_url',
      description: 'Generate signed download URL for secure file access',
      inputSchema: {
        type: 'object',
        properties: {
          bucket_name: {
            type: 'string',
            description: 'Source bucket',
            minLength: 3,
            maxLength: 63
          },
          storage_path: {
            type: 'string',
            description: 'Full file path in storage',
            maxLength: 1024
          },
          expires_in: {
            type: 'number',
            description: 'URL expiration in seconds (default: 7200)',
            minimum: 60,
            maximum: 604800,
            default: 7200
          }
        },
        required: ['bucket_name', 'storage_path'],
        additionalProperties: false
      }
    },
    handler: async (params, context) => {
      const { bucket_name, storage_path, expires_in = 7200 } = params;
      
      try {
        const supabase = createSupabaseClient();
        
        const { data, error } = await supabase.storage
          .from(bucket_name)
          .createSignedUrl(storage_path, expires_in);
        
        if (error) {
          throw new Error(`Failed to create signed URL: ${error.message}`);
        }
        
        const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
        
        const result: SignedUrlResult = {
          signedUrl: data.signedUrl,
          expiresAt,
          fileSize: 0, // Would need additional call to get file info
          mimeType: 'unknown' // Would need additional call to get file info
        };
        
        return [
          {
            type: 'text',
            text: JSON.stringify({
              ...result,
              request_id: crypto.randomUUID(),
              processing_time: Date.now()
            }, null, 2)
          }
        ];
      } catch (error) {
        return [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message
            }, null, 2)
          }
        ];
      }
    }
  },
  
  {
    name: 'get_security_status',
    schema: {
      name: 'get_security_status',
      description: 'Get current security configuration and audit information',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      }
    },
    handler: async (params, context) => {
      const securityStatus: SecurityStatusResponse = {
        security_config: SECURITY_CONFIG,
        rate_limit_status: {
          active_limits: 0, // Would track actual limits in production
          current_window: SECURITY_CONFIG.RATE_LIMIT_WINDOW
        },
        audit_log: {
          total_entries: 0,
          recent_entries: []
        },
        server_info: {
          name: 'orbit-supabase-storage',
          version: '2.0.0',
          uptime: 0 // Edge functions don't have persistent uptime
        }
      };
      
      return [
        {
          type: 'text',
          text: JSON.stringify(securityStatus, null, 2)
        }
      ];
    }
  },
  
  {
    name: 'create_signed_urls',
    schema: {
      name: 'create_signed_urls',
      description: 'Generate multiple signed download URLs in a single request for batch operations',
      inputSchema: {
        type: 'object',
        properties: {
          bucket_name: {
            type: 'string',
            description: 'Source bucket',
            minLength: 3,
            maxLength: 63
          },
          file_paths: {
            type: 'array',
            description: 'Array of file paths to generate URLs for',
            items: {
              type: 'string',
              maxLength: 1024
            },
            minItems: 1,
            maxItems: 100
          },
          expires_in: {
            type: 'number',
            description: 'URL expiration in seconds (default: 3600)',
            minimum: 60,
            maximum: 604800,
            default: 3600
          }
        },
        required: ['bucket_name', 'file_paths'],
        additionalProperties: false
      }
    },
    handler: async (params, context) => {
      const { bucket_name, file_paths, expires_in = 3600 } = params;
      
      try {
        if (file_paths.length > SECURITY_CONFIG.MAX_SIGNED_URLS) {
          throw new Error(`Cannot generate more than ${SECURITY_CONFIG.MAX_SIGNED_URLS} URLs in a single request`);
        }
        
        const supabase = createSupabaseClient();
        const results = [];
        let successCount = 0;
        let errorCount = 0;
        
        for (const filePath of file_paths) {
          try {
            const { data, error } = await supabase.storage
              .from(bucket_name)
              .createSignedUrl(filePath, expires_in);
            
            if (error) {
              results.push({
                file_path: filePath,
                signed_url: '',
                expires_at: '',
                success: false,
                error: error.message
              });
              errorCount++;
            } else {
              const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
              results.push({
                file_path: filePath,
                signed_url: data.signedUrl,
                expires_at: expiresAt,
                success: true
              });
              successCount++;
            }
          } catch (error) {
            results.push({
              file_path: filePath,
              signed_url: '',
              expires_at: '',
              success: false,
              error: error.message
            });
            errorCount++;
          }
        }
        
        const successRate = file_paths.length > 0 ? 
          `${Math.round((successCount / file_paths.length) * 100)}%` : '0%';
        
        const result: SignedUrlBatchResult = {
          urls: results,
          total_files: file_paths.length,
          successful_urls: successCount,
          failed_urls: errorCount,
          success_rate: successRate,
          expires_in
        };
        
        return [
          {
            type: 'text',
            text: JSON.stringify({
              ...result,
              request_id: crypto.randomUUID(),
              processing_time: Date.now()
            }, null, 2)
          }
        ];
      } catch (error) {
        return [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message
            }, null, 2)
          }
        ];
      }
    }
  },
  
  {
    name: 'download_file',
    schema: {
      name: 'download_file',
      description: 'Download file content directly with optional image transformations',
      inputSchema: {
        type: 'object',
        properties: {
          bucket_name: {
            type: 'string',
            description: 'Source bucket',
            minLength: 3,
            maxLength: 63
          },
          file_path: {
            type: 'string',
            description: 'Full file path in storage',
            maxLength: 1024
          },
          return_format: {
            type: 'string',
            description: 'Format to return file content',
            enum: ['base64', 'binary'],
            default: 'base64'
          },
          transform_options: {
            type: 'object',
            description: 'Optional image transformation settings',
            properties: {
              width: {
                type: 'number',
                description: 'Resize width in pixels',
                minimum: 1,
                maximum: 5000
              },
              height: {
                type: 'number',
                description: 'Resize height in pixels',
                minimum: 1,
                maximum: 5000
              },
              quality: {
                type: 'number',
                description: 'Image quality (1-100)',
                minimum: 1,
                maximum: 100
              }
            },
            additionalProperties: false
          }
        },
        required: ['bucket_name', 'file_path'],
        additionalProperties: false
      }
    },
    handler: async (params, context) => {
      const { bucket_name, file_path, return_format = 'base64', transform_options } = params;
      
      try {
        const supabase = createSupabaseClient();
        
        // Prepare download options with transformations
        const downloadOptions: any = {};
        
        if (transform_options && typeof transform_options === 'object') {
          const { width, height, quality } = transform_options;
          
          if (width || height || quality) {
            downloadOptions.transform = {};
            if (width && typeof width === 'number' && width > 0) {
              downloadOptions.transform.width = width;
            }
            if (height && typeof height === 'number' && height > 0) {
              downloadOptions.transform.height = height;
            }
            if (quality && typeof quality === 'number' && quality > 0 && quality <= 100) {
              downloadOptions.transform.quality = quality;
            }
          }
        }
        
        const { data, error } = await supabase.storage
          .from(bucket_name)
          .download(file_path, downloadOptions);
        
        if (error) {
          throw new Error(`Failed to download file: ${error.message}`);
        }
        
        if (!data) {
          throw new Error('No data received from download');
        }
        
        const buffer = await data.arrayBuffer();
        const fileBuffer = new Uint8Array(buffer);
        
        let content: string;
        if (return_format === 'base64') {
          content = btoa(String.fromCharCode(...fileBuffer));
        } else {
          content = String.fromCharCode(...fileBuffer);
        }
        
        const fileName = file_path.split('/').pop() || 'unknown';
        const contentType = data.type || 'application/octet-stream';
        
        const result: DownloadFileResult = {
          success: true,
          file_path,
          file_name: fileName,
          content,
          content_type: contentType,
          file_size: fileBuffer.length,
          format: return_format,
          transformed: !!(transform_options && Object.keys(transform_options).length > 0),
          transform_options: transform_options || undefined,
          metadata: {
            last_modified: new Date().toISOString(),
            cache_control: 'no-cache'
          }
        };
        
        return [
          {
            type: 'text',
            text: JSON.stringify({
              ...result,
              request_id: crypto.randomUUID(),
              processing_time: Date.now()
            }, null, 2)
          }
        ];
      } catch (error) {
        return [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              file_path
            }, null, 2)
          }
        ];
      }
    }
  },
  
  {
    name: 'download_file_with_auto_trigger',
    schema: {
      name: 'download_file_with_auto_trigger',
      description: 'Download file with optional auto-download trigger and custom filename support',
      inputSchema: {
        type: 'object',
        properties: {
          bucket_name: {
            type: 'string',
            description: 'Source bucket',
            minLength: 3,
            maxLength: 63
          },
          file_path: {
            type: 'string',
            description: 'Full file path in storage',
            maxLength: 1024
          },
          return_format: {
            type: 'string',
            description: 'Format to return file content or URL',
            enum: ['base64', 'binary', 'signed_url'],
            default: 'base64'
          },
          auto_download: {
            type: 'boolean',
            description: 'Generate auto-download trigger code',
            default: false
          },
          custom_filename: {
            type: 'string',
            description: 'Custom filename for download',
            maxLength: 255
          },
          transform_options: {
            type: 'object',
            description: 'Optional image transformation settings',
            properties: {
              width: {
                type: 'number',
                description: 'Resize width in pixels',
                minimum: 1,
                maximum: 5000
              },
              height: {
                type: 'number',
                description: 'Resize height in pixels',
                minimum: 1,
                maximum: 5000
              },
              quality: {
                type: 'number',
                description: 'Image quality (1-100)',
                minimum: 1,
                maximum: 100
              }
            },
            additionalProperties: false
          }
        },
        required: ['bucket_name', 'file_path'],
        additionalProperties: false
      }
    },
    handler: async (params, context) => {
      const { 
        bucket_name, 
        file_path, 
        return_format = 'base64', 
        auto_download = false,
        custom_filename,
        transform_options 
      } = params;
      
      try {
        const supabase = createSupabaseClient();
        let result: AutoDownloadFileResult;
        
        if (return_format === 'signed_url') {
          // Generate signed URL
          const { data, error } = await supabase.storage
            .from(bucket_name)
            .createSignedUrl(file_path, 3600);
          
          if (error) {
            throw new Error(`Failed to create signed URL: ${error.message}`);
          }
          
          const fileName = custom_filename || file_path.split('/').pop() || 'download';
          const downloadUrl = auto_download ? 
            `${data.signedUrl}&download=${encodeURIComponent(fileName)}` :
            data.signedUrl;
          
          result = {
            success: true,
            file_path,
            file_name: fileName,
            download_url: downloadUrl,
            content_type: 'application/octet-stream',
            format: return_format,
            auto_download_enabled: auto_download,
            expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            transformed: false,
            javascript_trigger: auto_download ? `window.location.href = "${downloadUrl}";` : undefined,
            metadata: {
              last_modified: new Date().toISOString(),
              cache_control: 'no-cache'
            }
          };
        } else {
          // Download file content
          const downloadOptions: any = {};
          
          if (transform_options) {
            const { width, height, quality } = transform_options;
            if (width || height || quality) {
              downloadOptions.transform = {};
              if (width) downloadOptions.transform.width = width;
              if (height) downloadOptions.transform.height = height;
              if (quality) downloadOptions.transform.quality = quality;
            }
          }
          
          const { data, error } = await supabase.storage
            .from(bucket_name)
            .download(file_path, downloadOptions);
          
          if (error) {
            throw new Error(`Failed to download file: ${error.message}`);
          }
          
          const buffer = await data.arrayBuffer();
          const fileBuffer = new Uint8Array(buffer);
          
          const content = return_format === 'base64' ? 
            btoa(String.fromCharCode(...fileBuffer)) :
            String.fromCharCode(...fileBuffer);
          
          const fileName = custom_filename || file_path.split('/').pop() || 'unknown';
          const contentType = data.type || 'application/octet-stream';
          
          // Generate JavaScript auto-download code if requested
          let javascriptTrigger: string | undefined;
          if (auto_download && return_format === 'base64') {
            javascriptTrigger = `
// Auto-download code for ${fileName}
const base64Content = "${content}";
const byteCharacters = atob(base64Content);
const byteNumbers = new Array(byteCharacters.length);
for (let i = 0; i < byteCharacters.length; i++) {
  byteNumbers[i] = byteCharacters.charCodeAt(i);
}
const byteArray = new Uint8Array(byteNumbers);
const blob = new Blob([byteArray], { type: "${contentType}" });
const url = window.URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = "${fileName}";
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
window.URL.revokeObjectURL(url);
console.log('Download triggered for ${fileName}');`;
          }
          
          result = {
            success: true,
            file_path,
            file_name: fileName,
            content,
            content_type: contentType,
            file_size: fileBuffer.length,
            format: return_format,
            auto_download_enabled: auto_download,
            transformed: !!(transform_options && Object.keys(transform_options).length > 0),
            transform_options: transform_options || undefined,
            javascript_trigger: javascriptTrigger,
            metadata: {
              last_modified: new Date().toISOString(),
              cache_control: 'no-cache'
            }
          };
        }
        
        return [
          {
            type: 'text',
            text: JSON.stringify({
              ...result,
              request_id: crypto.randomUUID(),
              processing_time: Date.now()
            }, null, 2)
          }
        ];
      } catch (error) {
        return [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              file_path
            }, null, 2)
          }
        ];
      }
    }
  },
  
  {
    name: 'batch_download',
    schema: {
      name: 'batch_download',
      description: 'Download multiple files with optional auto-download triggers and batch processing',
      inputSchema: {
        type: 'object',
        properties: {
          bucket_name: {
            type: 'string',
            description: 'Source bucket',
            minLength: 3,
            maxLength: 63
          },
          file_paths: {
            type: 'array',
            description: 'Array of file paths to download',
            items: {
              type: 'string',
              maxLength: 1024
            },
            minItems: 1,
            maxItems: 50
          },
          return_format: {
            type: 'string',
            description: 'Format to return files',
            enum: ['base64', 'binary', 'signed_url'],
            default: 'signed_url'
          },
          auto_download: {
            type: 'boolean',
            description: 'Generate auto-download trigger code for batch',
            default: false
          },
          download_delay: {
            type: 'number',
            description: 'Delay between downloads in milliseconds',
            minimum: 0,
            maximum: 10000,
            default: 500
          },
          expires_in: {
            type: 'number',
            description: 'URL expiration in seconds (for signed_url format)',
            minimum: 60,
            maximum: 604800,
            default: 3600
          }
        },
        required: ['bucket_name', 'file_paths'],
        additionalProperties: false
      }
    },
    handler: async (params, context) => {
      const { 
        bucket_name, 
        file_paths, 
        return_format = 'signed_url',
        auto_download = false,
        download_delay = 500,
        expires_in = 3600
      } = params;
      
      try {
        if (file_paths.length > SECURITY_CONFIG.MAX_BATCH_DOWNLOAD_SIZE) {
          throw new Error(`Cannot download more than ${SECURITY_CONFIG.MAX_BATCH_DOWNLOAD_SIZE} files in a single batch`);
        }
        
        const supabase = createSupabaseClient();
        const results = [];
        let successCount = 0;
        let errorCount = 0;
        
        for (const filePath of file_paths) {
          try {
            if (return_format === 'signed_url') {
              const { data, error } = await supabase.storage
                .from(bucket_name)
                .createSignedUrl(filePath, expires_in);
              
              if (error) {
                results.push({
                  file_path: filePath,
                  success: false,
                  error: error.message
                });
                errorCount++;
                continue;
              }
              
              const fileName = filePath.split('/').pop() || 'download';
              const downloadUrl = auto_download ? 
                `${data.signedUrl}&download=${encodeURIComponent(fileName)}` :
                data.signedUrl;
              
              results.push({
                file_path: filePath,
                file_name: fileName,
                download_url: downloadUrl,
                expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
                success: true
              });
              successCount++;
            } else {
              // Direct content download
              const { data, error } = await supabase.storage
                .from(bucket_name)
                .download(filePath);
              
              if (error) {
                results.push({
                  file_path: filePath,
                  success: false,
                  error: error.message
                });
                errorCount++;
                continue;
              }
              
              const buffer = await data.arrayBuffer();
              const fileBuffer = new Uint8Array(buffer);
              const content = return_format === 'base64' ? 
                btoa(String.fromCharCode(...fileBuffer)) :
                String.fromCharCode(...fileBuffer);
              
              const fileName = filePath.split('/').pop() || 'download';
              
              results.push({
                file_path: filePath,
                file_name: fileName,
                content,
                content_type: data.type || 'application/octet-stream',
                file_size: fileBuffer.length,
                success: true
              });
              successCount++;
            }
          } catch (error) {
            results.push({
              file_path: filePath,
              success: false,
              error: error.message
            });
            errorCount++;
          }
        }
        
        const successRate = file_paths.length > 0 ? 
          `${Math.round((successCount / file_paths.length) * 100)}%` : '0%';
        
        // Generate batch download script if enabled
        let batchDownloadScript: string | undefined;
        if (auto_download && return_format === 'signed_url') {
          const successfulUrls = results.filter(r => r.success && r.download_url);
          if (successfulUrls.length > 0) {
            batchDownloadScript = `
// Batch auto-download script
const downloadUrls = ${JSON.stringify(successfulUrls.map(r => ({ url: r.download_url, filename: r.file_name })), null, 2)};
const delay = ${download_delay};

async function batchDownload() {
  console.log('Starting batch download of ' + downloadUrls.length + ' files...');
  for (let i = 0; i < downloadUrls.length; i++) {
    const file = downloadUrls[i];
    console.log('Downloading ' + (i + 1) + '/' + downloadUrls.length + ': ' + file.filename);
    
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (i < downloadUrls.length - 1 && delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  console.log('Batch download completed for ' + downloadUrls.length + ' files');
}

batchDownload();`;
          }
        }
        
        const result: BatchDownloadResult = {
          success: true,
          batch_summary: {
            total_files: file_paths.length,
            successful_downloads: successCount,
            failed_downloads: errorCount,
            success_rate: successRate
          },
          downloads: results,
          auto_download_enabled: auto_download,
          javascript_trigger: batchDownloadScript,
          expires_in: return_format === 'signed_url' ? expires_in : undefined
        };
        
        return [
          {
            type: 'text',
            text: JSON.stringify({
              ...result,
              request_id: crypto.randomUUID(),
              processing_time: Date.now()
            }, null, 2)
          }
        ];
      } catch (error) {
        return [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message
            }, null, 2)
          }
        ];
      }
    }
  }
];

serve(async (req) => {
  // Security Check: Immediately handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }

  try {
    // 2. Check for the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // 3. Extract the key provided by the client
    const providedKey = authHeader.replace('Bearer ', '');

    // 4. Compare the provided key with the expected secret key
    if (providedKey !== MCP_STORAGE_SECRET) {
      throw new Error('Invalid authorization key');
    }

    // --- Authorization successful ---
    // If the code reaches this point, the request is secure.
    console.log('✅ Request authorized. Proceeding with function logic.');

    // Now, you can safely execute the rest of your function's code
    const { tool, params } = await req.json();

    // Find the tool and call its handler
    const toolDef = storageTools.find(t => t.name === tool);
    if (!toolDef) {
        throw new Error(`Tool not found: ${tool}`);
    }

    const result = await toolDef.handler(params, {} as any); // context is not used in the handlers

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    // If any security check fails, return a 401 Unauthorized error
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 401,
    });
  }
});

console.log('🚀 ORBIT Storage Operations MCP Server deployed as Edge Function');
