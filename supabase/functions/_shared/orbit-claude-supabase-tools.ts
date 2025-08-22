// ORBIT Claude Code Agent - Supabase Tools
// Claude Code compatible tools for database and storage operations

import { createClient, SupabaseClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SupabaseToolResult } from './orbit-claude-agent-types.ts';

export class ORBITSupabaseToolkit {
  private supabase: SupabaseClient;
  private enableLogging: boolean;

  constructor(supabaseUrl: string, serviceKey: string, enableLogging: boolean = false) {
    this.supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    this.enableLogging = enableLogging;
  }

  private log(message: string, data?: any) {
    if (this.enableLogging) {
      console.log(`[ORBITSupabaseToolkit] ${message}`, data || '');
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

  // Database Operations
  async executeSQL(query: string, params?: any[]): Promise<SupabaseToolResult> {
    try {
      this.log('Executing SQL query', { query: query.substring(0, 100) + '...', params });
      
      const { result, time } = await this.executeWithTiming(async () => {
        // For complex queries, use the rpc function if available
        if (query.toLowerCase().includes('select') || query.toLowerCase().includes('update') || query.toLowerCase().includes('insert')) {
          // Direct query execution - handle different query types
          if (query.toLowerCase().trim().startsWith('select')) {
            // For SELECT queries, use direct supabase query
            const { data, error } = await this.supabase.rpc('execute_custom_query', { 
              query_text: query,
              query_params: params || []
            });
            if (error) throw error;
            return data;
          } else {
            // For UPDATE/INSERT queries, use direct supabase query
            const { data, error } = await this.supabase.rpc('execute_custom_query', {
              query_text: query,
              query_params: params || []
            });
            if (error) throw error;
            return data;
          }
        } else {
          // Fallback for other operations
          const { data, error } = await this.supabase.rpc('execute_sql', {
            query: query,
            parameters: params || []
          });
          if (error) throw error;
          return data;
        }
      }, 'SQL Execution');

      return {
        success: true,
        data: result,
        execution_time_ms: time
      };
    } catch (error) {
      this.log('SQL execution error:', error.message);
      return {
        success: false,
        error: error.message,
        execution_time_ms: 0
      };
    }
  }

  // Simplified SQL operations for common patterns
  async selectFrom(table: string, columns: string = '*', conditions?: string, params?: any[]): Promise<SupabaseToolResult> {
    const query = conditions 
      ? `SELECT ${columns} FROM ${table} WHERE ${conditions}`
      : `SELECT ${columns} FROM ${table}`;
    return this.executeSQL(query, params);
  }

  async updateTable(table: string, updates: Record<string, any>, conditions: string, params?: any[]): Promise<SupabaseToolResult> {
    const setClause = Object.keys(updates).map((key, index) => `${key} = $${(params?.length || 0) + index + 1}`).join(', ');
    const updateParams = [...(params || []), ...Object.values(updates)];
    const query = `UPDATE ${table} SET ${setClause} WHERE ${conditions}`;
    return this.executeSQL(query, updateParams);
  }

  async insertInto(table: string, data: Record<string, any>): Promise<SupabaseToolResult> {
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map((_, index) => `$${index + 1}`).join(', ');
    const values = Object.values(data);
    const query = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
    return this.executeSQL(query, values);
  }

  // Storage Operations
  async listStorageFiles(bucketName: string, folderPath: string = ''): Promise<SupabaseToolResult> {
    try {
      this.log('Listing storage files', { bucketName, folderPath });
      
      const { result, time } = await this.executeWithTiming(async () => {
        const { data, error } = await this.supabase.storage
          .from(bucketName)
          .list(folderPath, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
        
        if (error) throw error;
        return data;
      }, 'Storage List');

      return {
        success: true,
        data: {
          bucket: bucketName,
          folder: folderPath,
          files: result?.map(file => file.name) || [],
          total_count: result?.length || 0
        },
        execution_time_ms: time
      };
    } catch (error) {
      this.log('Storage list error:', error.message);
      return {
        success: false,
        error: error.message,
        execution_time_ms: 0
      };
    }
  }

  async createSignedUrls(bucketName: string, filePaths: string[], expiresIn: number = 3600): Promise<SupabaseToolResult> {
    try {
      this.log('Creating signed URLs', { bucketName, fileCount: filePaths.length, expiresIn });
      
      const { result, time } = await this.executeWithTiming(async () => {
        const urls: string[] = [];
        
        for (const filePath of filePaths) {
          const { data, error } = await this.supabase.storage
            .from(bucketName)
            .createSignedUrl(filePath, expiresIn);
          
          if (error) {
            this.log(`Failed to create signed URL for ${filePath}:`, error.message);
            throw error;
          }
          
          urls.push(data.signedUrl);
        }
        
        return urls;
      }, 'Signed URL Creation');

      return {
        success: true,
        data: {
          bucket: bucketName,
          urls: result,
          expires_in: expiresIn
        },
        execution_time_ms: time
      };
    } catch (error) {
      this.log('Signed URL creation error:', error.message);
      return {
        success: false,
        error: error.message,
        execution_time_ms: 0
      };
    }
  }

  async checkStorageFileExists(bucketName: string, filePath: string): Promise<SupabaseToolResult> {
    try {
      this.log('Checking file existence', { bucketName, filePath });
      
      const { result, time } = await this.executeWithTiming(async () => {
        const { data, error } = await this.supabase.storage
          .from(bucketName)
          .list(filePath.split('/').slice(0, -1).join('/'));
        
        if (error) throw error;
        
        const fileName = filePath.split('/').pop();
        const exists = data?.some(file => file.name === fileName) || false;
        
        return exists;
      }, 'File Existence Check');

      return {
        success: true,
        data: {
          bucket: bucketName,
          file_path: filePath,
          exists: result
        },
        execution_time_ms: time
      };
    } catch (error) {
      this.log('File existence check error:', error.message);
      return {
        success: false,
        error: error.message,
        execution_time_ms: 0
      };
    }
  }

  // Health check operations
  async healthCheck(): Promise<SupabaseToolResult> {
    try {
      this.log('Performing health check');
      
      const { result, time } = await this.executeWithTiming(async () => {
        // Test database connection
        const { data: dbTest, error: dbError } = await this.supabase
          .from('orders')
          .select('count')
          .limit(1);

        // Test storage connection
        const { data: storageTest, error: storageError } = await this.supabase.storage
          .from('orbit-images')
          .list('', { limit: 1 });

        return {
          database: dbError ? 'error' : 'connected',
          storage: storageError ? 'error' : 'connected',
          database_error: dbError?.message,
          storage_error: storageError?.message
        };
      }, 'Health Check');

      const isHealthy = result.database === 'connected' && result.storage === 'connected';

      return {
        success: isHealthy,
        data: {
          status: isHealthy ? 'healthy' : 'degraded',
          details: result,
          timestamp: new Date().toISOString()
        },
        execution_time_ms: time
      };
    } catch (error) {
      this.log('Health check error:', error.message);
      return {
        success: false,
        error: error.message,
        execution_time_ms: 0
      };
    }
  }

  // Order-specific operations
  async getOrderDetails(orderId: string): Promise<SupabaseToolResult> {
    const query = `
      SELECT 
        o.*,
        b.status as batch_status,
        b.processed_count,
        b.error_count,
        COUNT(i.id) as total_images,
        COUNT(CASE WHEN i.processing_status = 'complete' THEN 1 END) as completed_images,
        COUNT(CASE WHEN i.processing_status = 'pending' THEN 1 END) as pending_images
      FROM orders o
      LEFT JOIN batches b ON o.batch_id = b.id
      LEFT JOIN images i ON o.id = i.order_id
      WHERE o.id = $1
      GROUP BY o.id, b.id
    `;
    return this.executeSQL(query, [orderId]);
  }

  async getOrderImages(orderId: string, status?: string): Promise<SupabaseToolResult> {
    const query = status 
      ? `SELECT * FROM images WHERE order_id = $1 AND processing_status = $2 ORDER BY original_filename`
      : `SELECT * FROM images WHERE order_id = $1 ORDER BY original_filename`;
    const params = status ? [orderId, status] : [orderId];
    return this.executeSQL(query, params);
  }

  async updateOrderStatus(orderId: string, status: string, stage: string, percentage?: number): Promise<SupabaseToolResult> {
    const updates: Record<string, any> = {
      order_status: status,
      processing_stage: stage
    };
    
    if (percentage !== undefined) {
      updates.processing_completion_percentage = percentage;
    }
    
    if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }
    
    return this.updateTable('orders', updates, 'id = $1', [orderId]);
  }

  async updateImageStatus(imageId: string, status: string, errorMessage?: string): Promise<SupabaseToolResult> {
    const updates: Record<string, any> = {
      processing_status: status,
      processed_at: new Date().toISOString()
    };
    
    if (errorMessage) {
      updates.error_message = errorMessage;
    }
    
    return this.updateTable('images', updates, 'id = $1', [imageId]);
  }

  // Batch operations
  async updateBatchStatus(batchId: string, status: string, processedCount?: number, errorCount?: number): Promise<SupabaseToolResult> {
    const updates: Record<string, any> = { status };
    
    if (processedCount !== undefined) updates.processed_count = processedCount;
    if (errorCount !== undefined) updates.error_count = errorCount;
    
    if (status === 'completed' || status === 'completed_with_errors') {
      updates.completed_at = new Date().toISOString();
      updates.processing_end_time = new Date().toISOString();
    }
    
    return this.updateTable('batches', updates, 'id = $1', [batchId]);
  }

  // Verification operations
  async verifyOrderCompletion(orderId: string): Promise<SupabaseToolResult> {
    const query = `
      SELECT 
        COUNT(*) as total_images,
        COUNT(CASE WHEN processing_status = 'complete' THEN 1 END) as completed_images,
        COUNT(CASE WHEN storage_path_processed IS NOT NULL THEN 1 END) as has_processed_files,
        COUNT(CASE WHEN processing_status = 'error' THEN 1 END) as error_images
      FROM images 
      WHERE order_id = $1
    `;
    return this.executeSQL(query, [orderId]);
  }

  // Get database connection for direct access if needed
  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }
}