/**
 * Direct Storage Manager Tool
 * 
 * Replicates the exact functionality of mcp-storage Edge Function
 * but as a direct tool call instead of HTTP request.
 * 
 * This provides significant performance improvements while maintaining
 * full compatibility with existing storage operations capabilities.
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { StorageOperationResult } from '../types/orbit-types.ts';

// Security configuration matching mcp-storage
const SECURITY_CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 100,
  MAX_BATCH_SIZE: 500,
  MAX_BATCH_DOWNLOAD_SIZE: 50,
  MAX_SIGNED_URLS: 100
};

// Result interfaces matching mcp-storage
interface FileInfo {
  name: string;
  path: string;
  size: number;
  mime_type: string;
  last_modified: string;
  metadata?: any;
}

interface FileListResult {
  files: FileInfo[];
  total_count: number;
  total_size: number;
}

interface SignedUrlResult {
  signedUrl: string;
  expiresAt: string;
  fileSize: number;
  mimeType: string;
}

interface BatchUploadResult {
  total: number;
  success_count: number;
  error_count: number;
  successful: Array<{
    original_filename: string;
    storage_path: string;
    file_size: number;
    mime_type: string;
    upload_timestamp: number;
  }>;
  failed: Array<{
    filename: string;
    error: string;
  }>;
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

export class StorageManagerTool {
  private supabase: any;

  constructor() {
    // Initialize Supabase client for storage operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('sb_secret_key') || Deno.env.get('SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration required for storage operations');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log('💾 Direct Storage Manager Tool initialized');
  }

  /**
   * Upload batch of images directly (replicates upload_image_batch MCP tool)
   */
  async uploadImageBatch(
    bucketName: string,
    batchId: string,
    folderPrefix: string,
    userId: string,
    imageData: Array<{
      filename: string;
      content: string; // base64
      mime_type: string;
    }>
  ): Promise<StorageOperationResult> {
    const startTime = Date.now();

    try {
      console.log(`🔄 Direct Storage Upload: ${imageData.length} files to ${bucketName}`);
      console.log(`📁 Batch ID: ${batchId}, Folder: ${folderPrefix}`);

      // Validate batch size
      if (imageData.length > SECURITY_CONFIG.MAX_BATCH_SIZE) {
        throw new Error(`Cannot upload more than ${SECURITY_CONFIG.MAX_BATCH_SIZE} files in a single batch`);
      }

      // Process batch upload
      const uploadResult = await this.processBatchUpload(imageData, {
        bucketName,
        batchId,
        folderPrefix,
        userId
      });

      const processingTime = Date.now() - startTime;
      const successRate = uploadResult.total > 0 ? 
        `${Math.round((uploadResult.success_count / uploadResult.total) * 100)}%` : '0%';

      const result: StorageOperationResult = {
        imageId: batchId,
        filename: `batch_${batchId}`,
        operation: 'upload_batch',
        storage: {
          result: {
            content: [{
              text: JSON.stringify({
                success: true,
                batch_id: batchId,
                summary: {
                  total_files: uploadResult.total,
                  successful_uploads: uploadResult.success_count,
                  failed_uploads: uploadResult.error_count,
                  success_rate: successRate
                },
                results: uploadResult
              }),
              type: 'text'
            }]
          }
        },
        processingTime,
        success: true
      };

      console.log(`✅ Direct Storage Upload completed in ${processingTime}ms`);
      console.log(`📊 Success: ${uploadResult.success_count}/${uploadResult.total} files`);
      
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('❌ Direct Storage Upload failed:', error.message);

      return {
        imageId: batchId,
        filename: `batch_${batchId}`,
        operation: 'upload_batch',
        storage: {},
        processingTime,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List files in bucket directly (replicates list_files MCP tool)
   */
  async listFiles(
    bucketName: string,
    folderPath?: string,
    fileExtension?: string
  ): Promise<StorageOperationResult> {
    const startTime = Date.now();

    try {
      console.log(`📋 Direct File List: ${bucketName}${folderPath ? '/' + folderPath : ''}`);
      
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .list(folderPath || '', {
          limit: 1000,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (error) {
        throw new Error(`Failed to list files: ${error.message}`);
      }

      let files = data || [];

      // Filter by file extension if specified (case-insensitive)
      if (fileExtension) {
        files = files.filter(file => 
          file.name.toLowerCase().endsWith(fileExtension.toLowerCase())
        );
      }

      const totalSize = files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);

      const fileList: FileListResult = {
        files: files.map(file => ({
          name: file.name,
          path: folderPath ? `${folderPath}/${file.name}` : file.name,
          size: file.metadata?.size || 0,
          mime_type: file.metadata?.mimetype || 'unknown',
          last_modified: file.updated_at || file.created_at || new Date().toISOString(),
          metadata: file.metadata
        })),
        total_count: files.length,
        total_size: totalSize
      };

      const processingTime = Date.now() - startTime;

      const result: StorageOperationResult = {
        imageId: 'file_list',
        filename: 'list_operation',
        operation: 'list_files',
        storage: {
          result: {
            content: [{
              text: JSON.stringify(fileList),
              type: 'text'
            }]
          }
        },
        processingTime,
        success: true
      };

      console.log(`✅ Direct File List completed in ${processingTime}ms`);
      console.log(`📊 Found: ${files.length} files (${totalSize} bytes)`);
      
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('❌ Direct File List failed:', error.message);

      return {
        imageId: 'file_list',
        filename: 'list_operation',
        operation: 'list_files',
        storage: {},
        processingTime,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create signed URLs directly (replicates create_signed_urls MCP tool)
   */
  async createSignedUrls(
    bucketName: string,
    filePaths: string[],
    expiresIn: number = 3600
  ): Promise<StorageOperationResult> {
    const startTime = Date.now();

    try {
      console.log(`🔗 Direct Signed URLs: ${filePaths.length} URLs for ${bucketName}`);

      if (filePaths.length > SECURITY_CONFIG.MAX_SIGNED_URLS) {
        throw new Error(`Cannot generate more than ${SECURITY_CONFIG.MAX_SIGNED_URLS} URLs in a single request`);
      }

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const filePath of filePaths) {
        try {
          const { data, error } = await this.supabase.storage
            .from(bucketName)
            .createSignedUrl(filePath, expiresIn);

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
            const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
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

      const successRate = filePaths.length > 0 ? 
        `${Math.round((successCount / filePaths.length) * 100)}%` : '0%';

      const signedUrlBatch = {
        urls: results,
        total_files: filePaths.length,
        successful_urls: successCount,
        failed_urls: errorCount,
        success_rate: successRate,
        expires_in: expiresIn
      };

      const processingTime = Date.now() - startTime;

      const result: StorageOperationResult = {
        imageId: 'signed_urls',
        filename: 'url_batch',
        operation: 'create_signed_urls',
        storage: {
          result: {
            content: [{
              text: JSON.stringify(signedUrlBatch),
              type: 'text'
            }]
          }
        },
        processingTime,
        success: true
      };

      console.log(`✅ Direct Signed URLs completed in ${processingTime}ms`);
      console.log(`🔗 Generated: ${successCount}/${filePaths.length} URLs`);
      
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('❌ Direct Signed URLs failed:', error.message);

      return {
        imageId: 'signed_urls',
        filename: 'url_batch',
        operation: 'create_signed_urls',
        storage: {},
        processingTime,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Download file directly (replicates download_file MCP tool)
   */
  async downloadFile(
    bucketName: string,
    filePath: string,
    returnFormat: 'base64' | 'binary' = 'base64',
    transformOptions?: {
      width?: number;
      height?: number;
      quality?: number;
    }
  ): Promise<StorageOperationResult> {
    const startTime = Date.now();

    try {
      console.log(`📥 Direct File Download: ${bucketName}/${filePath}`);
      console.log(`📊 Format: ${returnFormat}`);

      // Prepare download options with transformations
      const downloadOptions: any = {};
      
      if (transformOptions && typeof transformOptions === 'object') {
        const { width, height, quality } = transformOptions;
        
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

      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .download(filePath, downloadOptions);

      if (error) {
        throw new Error(`Failed to download file: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data received from download');
      }

      const buffer = await data.arrayBuffer();
      const fileBuffer = new Uint8Array(buffer);

      let content: string;
      if (returnFormat === 'base64') {
        content = btoa(String.fromCharCode(...fileBuffer));
      } else {
        content = String.fromCharCode(...fileBuffer);
      }

      const fileName = filePath.split('/').pop() || 'unknown';
      const contentType = data.type || 'application/octet-stream';

      const downloadResult: DownloadFileResult = {
        success: true,
        file_path: filePath,
        file_name: fileName,
        content,
        content_type: contentType,
        file_size: fileBuffer.length,
        format: returnFormat,
        transformed: !!(transformOptions && Object.keys(transformOptions).length > 0),
        transform_options: transformOptions || undefined,
        metadata: {
          last_modified: new Date().toISOString(),
          cache_control: 'no-cache'
        }
      };

      const processingTime = Date.now() - startTime;

      const result: StorageOperationResult = {
        imageId: this.extractImageIdFromPath(filePath),
        filename: fileName,
        operation: 'download_file',
        storage: {
          result: {
            content: [{
              text: JSON.stringify(downloadResult),
              type: 'text'
            }]
          }
        },
        processingTime,
        success: true
      };

      console.log(`✅ Direct File Download completed in ${processingTime}ms`);
      console.log(`📦 Downloaded: ${fileBuffer.length} bytes`);
      
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('❌ Direct File Download failed:', error.message);

      return {
        imageId: this.extractImageIdFromPath(filePath),
        filename: filePath.split('/').pop() || 'unknown',
        operation: 'download_file',
        storage: {},
        processingTime,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process batch upload of files
   */
  private async processBatchUpload(
    fileData: Array<{
      filename: string;
      content: string; // base64
      mime_type: string;
    }>,
    options: {
      bucketName: string;
      batchId: string;
      folderPrefix: string;
      userId: string;
    }
  ): Promise<BatchUploadResult> {
    const { bucketName, batchId, folderPrefix, userId } = options;
    const results: BatchUploadResult = { 
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
        const validation = this.validateFileData(fileItem);
        if (!validation.valid) {
          results.failed.push({
            filename: fileItem.filename || `file_${i}`,
            error: validation.error || 'Validation failed'
          });
          results.error_count++;
          continue;
        }
        
        // Create storage path
        const timestamp = Date.now();
        const fileName = fileItem.filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const storagePath = `${batchId}_${userId}/${folderPrefix}/${fileName}`;
        
        // Upload file
        const uploadResult = await this.uploadFileFromBase64(
          bucketName,
          storagePath,
          fileItem.content,
          fileItem.mime_type
        );
        
        if (uploadResult.success) {
          results.successful.push({
            original_filename: fileItem.filename,
            storage_path: uploadResult.path || storagePath,
            file_size: uploadResult.size || 0,
            mime_type: fileItem.mime_type,
            upload_timestamp: timestamp
          });
          results.success_count++;
        } else {
          results.failed.push({
            filename: fileItem.filename,
            error: uploadResult.error || 'Upload failed'
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

  /**
   * Upload file from base64 data
   */
  private async uploadFileFromBase64(
    bucket: string, 
    path: string, 
    base64Content: string, 
    mimeType: string
  ): Promise<{ success: boolean; path?: string; size?: number; error?: string }> {
    try {
      const buffer = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));
      
      const { data, error } = await this.supabase.storage
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
   * Validate file upload data
   */
  private validateFileData(data: any): { valid: boolean; error?: string; size?: number } {
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

  // Utility methods
  private extractImageIdFromPath(filePath: string): string {
    const pathParts = filePath.split('/');
    if (pathParts.length >= 2) {
      const folderPart = pathParts[0];
      const parts = folderPart.split('_');
      if (parts.length >= 2) {
        return parts[0];
      }
    }
    return 'unknown';
  }

  /**
   * Health check for Storage Manager Tool
   */
  async healthCheck(): Promise<boolean> {
    try {
      console.log('🔍 Storage Manager Tool Health Check');
      
      // Check Supabase connection
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      // Test storage access
      const { data, error } = await this.supabase.storage.listBuckets();
      if (error) {
        throw new Error(`Storage access failed: ${error.message}`);
      }

      console.log('✅ Storage Manager Tool Health Check Passed');
      return true;
      
    } catch (error) {
      console.error('❌ Storage Manager Tool Health Check Failed:', error.message);
      return false;
    }
  }
}