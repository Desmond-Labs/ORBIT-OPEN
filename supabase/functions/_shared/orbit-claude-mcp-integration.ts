// ORBIT Claude Code Agent - MCP Service Integration
// Handles communication with MCP services for AI analysis, metadata, and storage

import { MCPServiceCall, MCPServiceResult } from './orbit-claude-agent-types.ts';

export class ORBITMCPServiceIntegration {
  private supabaseUrl: string;
  private serviceKey: string;
  private enableLogging: boolean;

  constructor(supabaseUrl: string, serviceKey: string, enableLogging: boolean = false) {
    this.supabaseUrl = supabaseUrl;
    this.serviceKey = serviceKey;
    this.enableLogging = enableLogging;
  }

  private log(message: string, data?: any) {
    if (this.enableLogging) {
      console.log(`[ORBITMCPIntegration] ${message}`, data || '');
    }
  }

  private async executeWithTiming<T>(operation: () => Promise<T>, operationName: string): Promise<{ result: T; time: number }> {
    const startTime = Date.now();
    try {
      const result = await operation();
      const time = Date.now() - startTime;
      this.log(`${operationName} completed in ${time}ms`);
      return { result, time };
    } catch (error) {
      const time = Date.now() - startTime;
      this.log(`${operationName} failed after ${time}ms:`, error.message);
      throw error;
    }
  }

  // AI Analysis Service Integration
  async callAIAnalysisService(imageUrl: string, analysisType?: string): Promise<MCPServiceResult> {
    try {
      this.log('Calling AI Analysis MCP service', { imageUrl: imageUrl.substring(0, 50) + '...', analysisType });

      const { result, time } = await this.executeWithTiming(async () => {
        const response = await fetch(`${this.supabaseUrl}/functions/v1/mcp-ai-analysis`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.serviceKey}`,
            'Content-Type': 'application/json',
            'apikey': this.serviceKey
          },
          body: JSON.stringify({
            method: 'analyze_image',
            params: {
              image_url: imageUrl,
              analysis_type: analysisType || 'auto'
            }
          })
        });

        if (!response.ok) {
          throw new Error(`AI Analysis service error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      }, 'AI Analysis Service Call');

      return {
        success: true,
        data: result,
        service: 'mcp-ai-analysis',
        processing_time_ms: time
      };

    } catch (error) {
      this.log('AI Analysis service error:', error.message);
      return {
        success: false,
        error: error.message,
        service: 'mcp-ai-analysis',
        processing_time_ms: 0
      };
    }
  }

  // Metadata Service Integration
  async callMetadataService(operation: string, params: any): Promise<MCPServiceResult> {
    try {
      this.log('Calling Metadata MCP service', { operation, params: JSON.stringify(params).substring(0, 100) + '...' });

      const { result, time } = await this.executeWithTiming(async () => {
        const response = await fetch(`${this.supabaseUrl}/functions/v1/mcp-metadata`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.serviceKey}`,
            'Content-Type': 'application/json',
            'apikey': this.serviceKey
          },
          body: JSON.stringify({
            method: operation,
            params: params
          })
        });

        if (!response.ok) {
          throw new Error(`Metadata service error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      }, 'Metadata Service Call');

      return {
        success: true,
        data: result,
        service: 'mcp-metadata',
        processing_time_ms: time
      };

    } catch (error) {
      this.log('Metadata service error:', error.message);
      return {
        success: false,
        error: error.message,
        service: 'mcp-metadata',
        processing_time_ms: 0
      };
    }
  }

  // Storage Service Integration
  async callStorageService(operation: string, params: any): Promise<MCPServiceResult> {
    try {
      this.log('Calling Storage MCP service', { operation, params: JSON.stringify(params).substring(0, 100) + '...' });

      const { result, time } = await this.executeWithTiming(async () => {
        const response = await fetch(`${this.supabaseUrl}/functions/v1/mcp-storage`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.serviceKey}`,
            'Content-Type': 'application/json',
            'apikey': this.serviceKey
          },
          body: JSON.stringify({
            method: operation,
            params: params
          })
        });

        if (!response.ok) {
          throw new Error(`Storage service error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      }, 'Storage Service Call');

      return {
        success: true,
        data: result,
        service: 'mcp-storage',
        processing_time_ms: time
      };

    } catch (error) {
      this.log('Storage service error:', error.message);
      return {
        success: false,
        error: error.message,
        service: 'mcp-storage',
        processing_time_ms: 0
      };
    }
  }

  // Specific method implementations for common operations

  // AI Analysis specific methods
  async analyzeImage(imageUrl: string, analysisType?: 'lifestyle' | 'product'): Promise<MCPServiceResult> {
    return await this.callAIAnalysisService(imageUrl, analysisType);
  }

  // Metadata specific methods
  async embedImageMetadata(sourcePath: string, outputPath: string, metadata: any, compressionQuality: number = 95): Promise<MCPServiceResult> {
    return await this.callMetadataService('embed_image_metadata', {
      source_path: sourcePath,
      output_path: outputPath,
      metadata: metadata,
      compression_quality: compressionQuality
    });
  }

  async createXMPPacket(metadata: any, outputPath?: string): Promise<MCPServiceResult> {
    return await this.callMetadataService('create_xmp_packet', {
      metadata: metadata,
      output_path: outputPath,
      include_wrappers: true,
      pretty_print: true
    });
  }

  async createMetadataReport(imagePath: string, format: 'detailed' | 'simple' = 'detailed'): Promise<MCPServiceResult> {
    return await this.callMetadataService('create_metadata_report', {
      image_path: imagePath,
      format: format,
      include_processing_info: true,
      include_raw_json: true
    });
  }

  async readImageMetadata(imagePath: string): Promise<MCPServiceResult> {
    return await this.callMetadataService('read_image_metadata', {
      image_path: imagePath,
      include_xmp: true,
      include_exif: true,
      format: 'json'
    });
  }

  async validateMetadata(metadata: any, schemaType?: 'lifestyle' | 'product' | 'orbit'): Promise<MCPServiceResult> {
    return await this.callMetadataService('validate_metadata_schema', {
      metadata: metadata,
      schema_type: schemaType,
      strict_mode: false
    });
  }

  // Storage specific methods
  async listFiles(bucketName: string, folderPath?: string, fileExtension?: string): Promise<MCPServiceResult> {
    return await this.callStorageService('list_files', {
      bucket_name: bucketName,
      folder_path: folderPath,
      file_extension: fileExtension
    });
  }

  async createSignedUrls(bucketName: string, filePaths: string[], expiresIn: number = 3600): Promise<MCPServiceResult> {
    return await this.callStorageService('create_signed_urls', {
      bucket_name: bucketName,
      file_paths: filePaths,
      expires_in: expiresIn
    });
  }

  async downloadFile(bucketName: string, filePath: string, returnFormat: 'base64' | 'binary' = 'base64'): Promise<MCPServiceResult> {
    return await this.callStorageService('download_file', {
      bucket_name: bucketName,
      file_path: filePath,
      return_format: returnFormat
    });
  }

  async getFileUrl(bucketName: string, storagePath: string, expiresIn: number = 7200): Promise<MCPServiceResult> {
    return await this.callStorageService('get_file_url', {
      bucket_name: bucketName,
      storage_path: storagePath,
      expires_in: expiresIn
    });
  }

  // Batch operations for efficiency
  async batchDownload(bucketName: string, filePaths: string[], returnFormat: 'signed_url' | 'base64' = 'signed_url'): Promise<MCPServiceResult> {
    return await this.callStorageService('batch_download', {
      bucket_name: bucketName,
      file_paths: filePaths,
      return_format: returnFormat,
      expires_in: 3600
    });
  }

  // Health check for MCP services
  async checkMCPServicesHealth(): Promise<{ [service: string]: MCPServiceResult }> {
    const services = ['mcp-ai-analysis', 'mcp-metadata', 'mcp-storage'];
    const healthResults: { [service: string]: MCPServiceResult } = {};

    for (const service of services) {
      try {
        const response = await fetch(`${this.supabaseUrl}/functions/v1/${service}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.serviceKey}`,
            'Content-Type': 'application/json',
            'apikey': this.serviceKey
          },
          body: JSON.stringify({
            method: 'health_check',
            params: {}
          })
        });

        if (response.ok) {
          healthResults[service] = {
            success: true,
            data: { status: 'healthy' },
            service: service,
            processing_time_ms: 0
          };
        } else {
          healthResults[service] = {
            success: false,
            error: `Service unavailable: ${response.status}`,
            service: service,
            processing_time_ms: 0
          };
        }
      } catch (error) {
        healthResults[service] = {
          success: false,
          error: error.message,
          service: service,
          processing_time_ms: 0
        };
      }
    }

    return healthResults;
  }

  // Generic MCP call for custom operations
  async callMCPService(service: 'ai-analysis' | 'metadata' | 'storage', method: string, params: any, correlationId?: string): Promise<MCPServiceResult> {
    const serviceMap = {
      'ai-analysis': 'mcp-ai-analysis',
      'metadata': 'mcp-metadata',
      'storage': 'mcp-storage'
    };

    const serviceName = serviceMap[service];
    
    try {
      this.log(`Calling MCP service: ${serviceName}.${method}`, { params, correlationId });

      const { result, time } = await this.executeWithTiming(async () => {
        const response = await fetch(`${this.supabaseUrl}/functions/v1/${serviceName}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.serviceKey}`,
            'Content-Type': 'application/json',
            'apikey': this.serviceKey,
            ...(correlationId && { 'X-Correlation-ID': correlationId })
          },
          body: JSON.stringify({
            method: method,
            params: params
          })
        });

        if (!response.ok) {
          throw new Error(`MCP service ${serviceName} error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      }, `MCP ${serviceName} Call`);

      return {
        success: true,
        data: result,
        service: serviceName,
        processing_time_ms: time,
        correlation_id: correlationId
      };

    } catch (error) {
      this.log(`MCP service error: ${serviceName}.${method}`, error.message);
      return {
        success: false,
        error: error.message,
        service: serviceName,
        processing_time_ms: 0,
        correlation_id: correlationId
      };
    }
  }
}

// Factory function for creating MCP integration
export function createORBITMCPIntegration(supabaseUrl: string, serviceKey: string, enableLogging: boolean = false): ORBITMCPServiceIntegration {
  return new ORBITMCPServiceIntegration(supabaseUrl, serviceKey, enableLogging);
}