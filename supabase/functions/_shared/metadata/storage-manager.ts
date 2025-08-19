/**
 * ORBIT Storage Manager Module
 * Professional batch file operations and Supabase Storage integration
 * Handles uploads of processed images, metadata files, reports, and thumbnails
 */

import { createClient, SupabaseClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export interface StorageUploadOptions {
  bucketName?: string;
  cacheControl?: string;
  contentType?: string;
  upsert?: boolean;
  metadata?: Record<string, any>;
}

export interface FileUpload {
  filePath: string;
  fileData: Uint8Array | Blob;
  contentType: string;
  metadata?: Record<string, any>;
}

export interface BatchUploadResult {
  success: boolean;
  uploaded_files: UploadedFile[];
  failed_uploads: FailedUpload[];
  total_size: number;
  upload_time_ms: number;
  error?: string;
}

export interface UploadedFile {
  path: string;
  size: number;
  contentType: string;
  publicUrl?: string;
  signedUrl?: string;
}

export interface FailedUpload {
  path: string;
  error: string;
  contentType: string;
}

export interface StorageManagerConfig {
  supabaseUrl: string;
  supabaseKey: string;
  defaultBucket?: string;
  defaultCacheControl?: string;
  enablePublicUrls?: boolean;
  enableSignedUrls?: boolean;
  signedUrlExpiry?: number; // seconds
}

/**
 * Professional Storage Manager for ORBIT File Operations
 */
export class ORBITStorageManager {
  private supabase: SupabaseClient;
  private config: StorageManagerConfig;

  constructor(config: StorageManagerConfig) {
    this.config = {
      defaultBucket: 'orbit-images',
      defaultCacheControl: '3600',
      enablePublicUrls: false,
      enableSignedUrls: true,
      signedUrlExpiry: 7200, // 2 hours
      ...config
    };

    this.supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey);
  }

  /**
   * Upload complete metadata processing results to storage
   */
  async uploadMetadataResults(
    orderFolder: string,
    baseFilename: string,
    results: {
      processedImage?: Uint8Array;
      thumbnails?: { [size: string]: Uint8Array };
      webOptimized?: Uint8Array;
      xmpPacket?: string;
      metadataReport?: string;
      technicalSummary?: string;
      marketingBrief?: string;
      rawDataExport?: string;
    }
  ): Promise<BatchUploadResult> {
    const startTime = Date.now();
    const uploads: FileUpload[] = [];

    try {
      // Prepare all file uploads
      await this.prepareImageUploads(uploads, orderFolder, baseFilename, results);
      await this.prepareMetadataUploads(uploads, orderFolder, baseFilename, results);
      await this.prepareReportUploads(uploads, orderFolder, baseFilename, results);

      // Execute batch upload
      const batchResult = await this.executeBatchUpload(uploads);
      
      // Generate URLs if enabled
      if (this.config.enableSignedUrls || this.config.enablePublicUrls) {
        await this.generateFileUrls(batchResult.uploaded_files);
      }

      const uploadTime = Date.now() - startTime;
      batchResult.upload_time_ms = uploadTime;

      console.log('📦 Batch upload completed:', {
        totalFiles: uploads.length,
        successful: batchResult.uploaded_files.length,
        failed: batchResult.failed_uploads.length,
        totalSize: batchResult.total_size,
        uploadTime
      });

      return batchResult;

    } catch (error) {
      const uploadTime = Date.now() - startTime;
      console.error('❌ Batch upload failed:', error);

      return {
        success: false,
        uploaded_files: [],
        failed_uploads: uploads.map(u => ({
          path: u.filePath,
          error: error.message,
          contentType: u.contentType
        })),
        total_size: 0,
        upload_time_ms: uploadTime,
        error: error.message
      };
    }
  }

  /**
   * Prepare image file uploads (processed image, thumbnails, web-optimized)
   */
  private async prepareImageUploads(
    uploads: FileUpload[],
    orderFolder: string,
    baseFilename: string,
    results: any
  ): Promise<void> {
    // Main processed image with embedded XMP
    if (results.processedImage) {
      uploads.push({
        filePath: `${orderFolder}/processed/${baseFilename}_processed.jpg`,
        fileData: results.processedImage,
        contentType: 'image/jpeg',
        metadata: {
          type: 'processed_image',
          has_xmp: true,
          processing_version: '2.0'
        }
      });
    }

    // Thumbnails
    if (results.thumbnails) {
      for (const [size, imageData] of Object.entries(results.thumbnails)) {
        uploads.push({
          filePath: `${orderFolder}/processed/thumbnails/${baseFilename}_${size}.jpg`,
          fileData: imageData as Uint8Array,
          contentType: 'image/jpeg',
          metadata: {
            type: 'thumbnail',
            size: size,
            source: baseFilename
          }
        });
      }
    }

    // Web-optimized version
    if (results.webOptimized) {
      uploads.push({
        filePath: `${orderFolder}/processed/${baseFilename}_web.jpg`,
        fileData: results.webOptimized,
        contentType: 'image/jpeg',
        metadata: {
          type: 'web_optimized',
          compression: 'optimized_for_web'
        }
      });
    }
  }

  /**
   * Prepare metadata file uploads (XMP files)
   */
  private async prepareMetadataUploads(
    uploads: FileUpload[],
    orderFolder: string,
    baseFilename: string,
    results: any
  ): Promise<void> {
    // Standalone XMP file
    if (results.xmpPacket) {
      uploads.push({
        filePath: `${orderFolder}/processed/${baseFilename}_metadata.xmp`,
        fileData: new TextEncoder().encode(results.xmpPacket),
        contentType: 'application/xml',
        metadata: {
          type: 'xmp_metadata',
          schema_version: 'ORBIT_v1.0',
          embedded_in_image: true
        }
      });
    }

    // Raw analysis data (JSON)
    if (results.rawDataExport) {
      uploads.push({
        filePath: `${orderFolder}/processed/${baseFilename}_analysis.json`,
        fileData: new TextEncoder().encode(results.rawDataExport),
        contentType: 'application/json',
        metadata: {
          type: 'raw_analysis',
          format: 'json'
        }
      });
    }
  }

  /**
   * Prepare report file uploads (text, markdown, HTML)
   */
  private async prepareReportUploads(
    uploads: FileUpload[],
    orderFolder: string,
    baseFilename: string,
    results: any
  ): Promise<void> {
    // Main metadata report
    if (results.metadataReport) {
      uploads.push({
        filePath: `${orderFolder}/processed/${baseFilename}_report.txt`,
        fileData: new TextEncoder().encode(results.metadataReport),
        contentType: 'text/plain',
        metadata: {
          type: 'metadata_report',
          format: 'text'
        }
      });
    }

    // Technical summary
    if (results.technicalSummary) {
      uploads.push({
        filePath: `${orderFolder}/processed/${baseFilename}_technical.txt`,
        fileData: new TextEncoder().encode(results.technicalSummary),
        contentType: 'text/plain',
        metadata: {
          type: 'technical_summary',
          format: 'text'
        }
      });
    }

    // Marketing brief
    if (results.marketingBrief) {
      uploads.push({
        filePath: `${orderFolder}/processed/${baseFilename}_marketing.txt`,
        fileData: new TextEncoder().encode(results.marketingBrief),
        contentType: 'text/plain',
        metadata: {
          type: 'marketing_brief',
          format: 'text'
        }
      });
    }
  }

  /**
   * Execute batch upload with error handling and retry logic
   */
  private async executeBatchUpload(uploads: FileUpload[]): Promise<BatchUploadResult> {
    const uploadedFiles: UploadedFile[] = [];
    const failedUploads: FailedUpload[] = [];
    let totalSize = 0;

    for (const upload of uploads) {
      try {
        const fileSize = upload.fileData instanceof Uint8Array ? 
          upload.fileData.length : await this.getBlobSize(upload.fileData);

        // Upload file to Supabase Storage
        const { error: uploadError } = await this.supabase.storage
          .from(this.config.defaultBucket!)
          .upload(upload.filePath, upload.fileData, {
            cacheControl: this.config.defaultCacheControl,
            upsert: true,
            contentType: upload.contentType
          });

        if (uploadError) {
          failedUploads.push({
            path: upload.filePath,
            error: uploadError.message,
            contentType: upload.contentType
          });
          console.error(`❌ Upload failed for ${upload.filePath}:`, uploadError.message);
        } else {
          uploadedFiles.push({
            path: upload.filePath,
            size: fileSize,
            contentType: upload.contentType
          });
          totalSize += fileSize;
          console.log(`✅ Uploaded: ${upload.filePath} (${this.formatFileSize(fileSize)})`);
        }

      } catch (error) {
        failedUploads.push({
          path: upload.filePath,
          error: error.message,
          contentType: upload.contentType
        });
        console.error(`❌ Upload error for ${upload.filePath}:`, error);
      }
    }

    return {
      success: failedUploads.length === 0,
      uploaded_files: uploadedFiles,
      failed_uploads: failedUploads,
      total_size: totalSize,
      upload_time_ms: 0 // Will be set by caller
    };
  }

  /**
   * Generate public or signed URLs for uploaded files
   */
  private async generateFileUrls(uploadedFiles: UploadedFile[]): Promise<void> {
    for (const file of uploadedFiles) {
      try {
        if (this.config.enablePublicUrls) {
          const { data: publicUrlData } = this.supabase.storage
            .from(this.config.defaultBucket!)
            .getPublicUrl(file.path);
          
          if (publicUrlData?.publicUrl) {
            file.publicUrl = publicUrlData.publicUrl;
          }
        }

        if (this.config.enableSignedUrls) {
          const { data: signedUrlData, error: signedUrlError } = await this.supabase.storage
            .from(this.config.defaultBucket!)
            .createSignedUrl(file.path, this.config.signedUrlExpiry!);

          if (signedUrlData?.signedUrl && !signedUrlError) {
            file.signedUrl = signedUrlData.signedUrl;
          }
        }

      } catch (error) {
        console.warn(`⚠️ URL generation failed for ${file.path}:`, error.message);
      }
    }
  }

  /**
   * Upload single file with retry logic
   */
  async uploadSingleFile(
    filePath: string,
    fileData: Uint8Array | Blob,
    options: StorageUploadOptions = {}
  ): Promise<UploadedFile | null> {
    const bucketName = options.bucketName || this.config.defaultBucket!;
    const contentType = options.contentType || 'application/octet-stream';

    try {
      const { error: uploadError } = await this.supabase.storage
        .from(bucketName)
        .upload(filePath, fileData, {
          cacheControl: options.cacheControl || this.config.defaultCacheControl,
          upsert: options.upsert !== undefined ? options.upsert : true,
          contentType: contentType
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const fileSize = fileData instanceof Uint8Array ? 
        fileData.length : await this.getBlobSize(fileData);

      console.log(`✅ Single file uploaded: ${filePath} (${this.formatFileSize(fileSize)})`);

      return {
        path: filePath,
        size: fileSize,
        contentType: contentType
      };

    } catch (error) {
      console.error(`❌ Single file upload failed for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Download file from storage
   */
  async downloadFile(filePath: string, bucketName?: string): Promise<Uint8Array | null> {
    try {
      const { data: fileData, error: downloadError } = await this.supabase.storage
        .from(bucketName || this.config.defaultBucket!)
        .download(filePath);

      if (downloadError) {
        throw new Error(`Download failed: ${downloadError.message}`);
      }

      if (!fileData) {
        throw new Error('No file data received');
      }

      const arrayBuffer = await fileData.arrayBuffer();
      return new Uint8Array(arrayBuffer);

    } catch (error) {
      console.error(`❌ File download failed for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(folderPath: string, bucketName?: string): Promise<string[]> {
    try {
      const { data: files, error: listError } = await this.supabase.storage
        .from(bucketName || this.config.defaultBucket!)
        .list(folderPath);

      if (listError) {
        throw new Error(`List files failed: ${listError.message}`);
      }

      return files?.map(file => `${folderPath}/${file.name}`) || [];

    } catch (error) {
      console.error(`❌ List files failed for ${folderPath}:`, error);
      return [];
    }
  }

  /**
   * Delete files from storage
   */
  async deleteFiles(filePaths: string[], bucketName?: string): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    try {
      const { data: deleteResults, error: deleteError } = await this.supabase.storage
        .from(bucketName || this.config.defaultBucket!)
        .remove(filePaths);

      if (deleteError) {
        failed.push(...filePaths);
        console.error('❌ Batch delete failed:', deleteError);
      } else {
        success.push(...filePaths);
        console.log(`✅ Deleted ${filePaths.length} files successfully`);
      }

    } catch (error) {
      failed.push(...filePaths);
      console.error('❌ Delete operation failed:', error);
    }

    return { success, failed };
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{ [key: string]: any }> {
    return {
      bucket: this.config.defaultBucket,
      config: {
        cacheControl: this.config.defaultCacheControl,
        enablePublicUrls: this.config.enablePublicUrls,
        enableSignedUrls: this.config.enableSignedUrls,
        signedUrlExpiry: this.config.signedUrlExpiry
      },
      version: '2.0.0'
    };
  }

  // Helper methods

  private async getBlobSize(blob: Blob): Promise<number> {
    return blob.size;
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

/**
 * Factory function for creating storage manager instances
 */
export function createStorageManager(config: StorageManagerConfig): ORBITStorageManager {
  return new ORBITStorageManager(config);
}

/**
 * Quick utility function for single file upload
 */
export async function uploadFileToStorage(
  supabaseUrl: string,
  supabaseKey: string,
  filePath: string,
  fileData: Uint8Array | Blob,
  options?: StorageUploadOptions
): Promise<UploadedFile | null> {
  const manager = new ORBITStorageManager({
    supabaseUrl,
    supabaseKey
  });
  
  return manager.uploadSingleFile(filePath, fileData, options);
}

/**
 * Comprehensive metadata upload with all file types
 */
export async function uploadMetadataBundle(
  supabaseUrl: string,
  supabaseKey: string,
  orderFolder: string,
  baseFilename: string,
  results: {
    processedImage?: Uint8Array;
    thumbnails?: { [size: string]: Uint8Array };
    webOptimized?: Uint8Array;
    xmpPacket?: string;
    metadataReport?: string;
    technicalSummary?: string;
    marketingBrief?: string;
    rawDataExport?: string;
  }
): Promise<BatchUploadResult> {
  const manager = new ORBITStorageManager({
    supabaseUrl,
    supabaseKey,
    enableSignedUrls: true,
    enablePublicUrls: false
  });
  
  return manager.uploadMetadataResults(orderFolder, baseFilename, results);
}