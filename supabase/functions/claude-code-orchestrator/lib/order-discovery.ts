/**
 * Order Discovery Service
 * 
 * Enables automatic discovery of pending orders instead of requiring external orderId input.
 * Supports both single-order and queue processing modes with proper status transitions.
 * 
 * This service transforms the orchestrator from reactive (requires orderId) to proactive 
 * (finds orders automatically) enabling continuous processing automation.
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { OrbitOrder } from '../types/orbit-types.ts';

export interface OrderDiscoveryOptions {
  maxOrdersPerBatch?: number;
  prioritizeOlderOrders?: boolean;
  filterByUserTier?: string;
  processingTimeout?: number; // Minutes before considering an order stuck
}

export interface DiscoveryResults {
  foundOrders: OrbitOrder[];
  skippedOrders: number;
  stuckOrders: number;
  totalPendingOrders: number;
}

export interface ProcessingProgress {
  orderId: string;
  percentage: number;
  currentPhase: string;
  estimatedTimeRemaining?: number;
}

export class OrderDiscoveryService {
  private supabase: any;
  private options: Required<OrderDiscoveryOptions>;

  constructor(options: OrderDiscoveryOptions = {}) {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('sb_secret_key') || Deno.env.get('SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration required for Order Discovery Service');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);

    // Set default options
    this.options = {
      maxOrdersPerBatch: options.maxOrdersPerBatch || 1,
      prioritizeOlderOrders: options.prioritizeOlderOrders ?? true,
      filterByUserTier: options.filterByUserTier || '',
      processingTimeout: options.processingTimeout || 30 // 30 minutes default
    };

    console.log('🔍 Order Discovery Service initialized');
    console.log(`⚙️ Config: maxBatch=${this.options.maxOrdersPerBatch}, timeout=${this.options.processingTimeout}min`);
  }

  /**
   * Find pending orders ready for processing
   * Following ORBIT workflow: processing_stage = 'initializing' AND payment_status = 'completed'
   */
  async findPendingOrders(options?: OrderDiscoveryOptions): Promise<DiscoveryResults> {
    const searchOptions = { ...this.options, ...options };
    
    console.log('🔍 Searching for pending orders...');

    try {
      // First, identify and handle stuck orders (processing too long)
      await this.handleStuckOrders();

      // Build the query for pending orders following ORBIT pattern
      let query = this.supabase
        .from('orders')
        .select(`
          id,
          user_id,
          batch_id,
          order_number,
          image_count,
          payment_status,
          processing_stage,
          processing_completion_percentage,
          created_at,
          updated_at,
          metadata
        `)
        .eq('payment_status', 'completed')
        .eq('processing_stage', 'initializing');

      // Add user tier filtering if specified
      if (searchOptions.filterByUserTier) {
        query = query.eq('user_tier', searchOptions.filterByUserTier);
      }

      // Add ordering
      if (searchOptions.prioritizeOlderOrders) {
        query = query.order('created_at', { ascending: true });
      } else {
        query = query.order('updated_at', { ascending: false });
      }

      // Add limit
      query = query.limit(searchOptions.maxOrdersPerBatch);

      const { data: orders, error } = await query;

      if (error) {
        throw new Error(`Failed to discover orders: ${error.message}`);
      }

      // Get additional statistics for monitoring
      const { data: statsData, error: statsError } = await this.supabase
        .from('orders')
        .select('processing_stage, count(*)', { count: 'exact' })
        .eq('payment_status', 'completed')
        .in('processing_stage', ['initializing', 'processing', 'completed']);

      const stats = {
        totalPendingOrders: 0,
        processingOrders: 0,
        completedOrders: 0
      };

      if (!statsError && statsData) {
        statsData.forEach((stat: any) => {
          if (stat.processing_stage === 'initializing') stats.totalPendingOrders = stat.count;
          if (stat.processing_stage === 'processing') stats.processingOrders = stat.count;
          if (stat.processing_stage === 'completed') stats.completedOrders = stat.count;
        });
      }

      const results: DiscoveryResults = {
        foundOrders: orders || [],
        skippedOrders: Math.max(0, stats.totalPendingOrders - (orders?.length || 0)),
        stuckOrders: stats.processingOrders,
        totalPendingOrders: stats.totalPendingOrders
      };

      console.log(`✅ Discovery complete: ${results.foundOrders.length} orders found, ${results.totalPendingOrders} total pending`);
      
      if (results.foundOrders.length > 0) {
        console.log(`📋 Next order: ${results.foundOrders[0].order_number} (${results.foundOrders[0].id})`);
      }

      return results;

    } catch (error) {
      console.error('❌ Order discovery failed:', error);
      throw error;
    }
  }

  /**
   * Mark order as processing and update status
   * Following ORBIT pattern: initializing → processing
   */
  async markOrderProcessing(orderId: string): Promise<void> {
    console.log(`🚀 Marking order ${orderId} as processing...`);

    try {
      // Update order status to processing
      const { error: orderError } = await this.supabase
        .from('orders')
        .update({
          processing_stage: 'processing',
          order_status: 'processing',
          processing_completion_percentage: 0,
          processing_started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .eq('processing_stage', 'initializing'); // Only update if still in initializing stage

      if (orderError) {
        throw new Error(`Failed to mark order as processing: ${orderError.message}`);
      }

      // Also update the batch status if needed
      const { error: batchError } = await this.supabase
        .from('batches')
        .update({
          status: 'processing',
          processing_stage: 'processing',
          processing_completion_percentage: 0,
          processing_start_time: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', `(SELECT batch_id FROM orders WHERE id = '${orderId}')`)
        .in('status', ['pending', 'created']);

      // Don't fail on batch error as it might not exist
      if (batchError) {
        console.warn(`⚠️ Batch status update failed (non-critical): ${batchError.message}`);
      }

      console.log(`✅ Order ${orderId} marked as processing`);

    } catch (error) {
      console.error(`❌ Failed to mark order ${orderId} as processing:`, error);
      throw error;
    }
  }

  /**
   * Update processing completion percentage
   * Used for frontend progress tracking
   */
  async updateProcessingProgress(orderId: string, percentage: number, currentPhase?: string): Promise<void> {
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    
    try {
      const updateData: any = {
        processing_completion_percentage: clampedPercentage,
        updated_at: new Date().toISOString()
      };

      if (currentPhase) {
        updateData.current_processing_phase = currentPhase;
      }

      const { error } = await this.supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) {
        console.warn(`⚠️ Failed to update progress for order ${orderId}: ${error.message}`);
      } else {
        console.log(`📊 Progress updated: ${orderId} → ${clampedPercentage}% ${currentPhase ? `(${currentPhase})` : ''}`);
      }

      // Also update batch progress
      const { error: batchError } = await this.supabase
        .from('batches')
        .update({
          processing_completion_percentage: clampedPercentage,
          updated_at: new Date().toISOString()
        })
        .eq('id', `(SELECT batch_id FROM orders WHERE id = '${orderId}')`);

      if (batchError) {
        console.warn(`⚠️ Batch progress update failed (non-critical): ${batchError.message}`);
      }

    } catch (error) {
      console.warn(`⚠️ Progress update failed for order ${orderId}:`, error);
      // Don't throw - progress updates are non-critical
    }
  }

  /**
   * Mark order as completed with full status update
   * Following ORBIT pattern: processing → completed
   */
  async markOrderCompleted(orderId: string, results?: any): Promise<void> {
    console.log(`✅ Marking order ${orderId} as completed...`);

    try {
      const updateData: any = {
        processing_stage: 'completed',
        order_status: 'completed',
        processing_completion_percentage: 100,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (results) {
        updateData.processing_metadata = results;
      }

      // Update order status
      const { error: orderError } = await this.supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (orderError) {
        throw new Error(`Failed to mark order as completed: ${orderError.message}`);
      }

      // Update batch status
      const { error: batchError } = await this.supabase
        .from('batches')
        .update({
          status: 'complete',
          processing_completion_percentage: 100,
          processing_end_time: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', `(SELECT batch_id FROM orders WHERE id = '${orderId}')`);

      if (batchError) {
        console.warn(`⚠️ Batch completion update failed (non-critical): ${batchError.message}`);
      }

      console.log(`✅ Order ${orderId} marked as completed`);

    } catch (error) {
      console.error(`❌ Failed to mark order ${orderId} as completed:`, error);
      throw error;
    }
  }

  /**
   * Get order processing status for monitoring
   */
  async getOrderStatus(orderId: string): Promise<{
    processing_stage: string;
    processing_completion_percentage: number;
    current_processing_phase?: string;
    processing_started_at?: string;
  } | null> {
    try {
      const { data, error } = await this.supabase
        .from('orders')
        .select(`
          processing_stage,
          processing_completion_percentage,
          current_processing_phase,
          processing_started_at
        `)
        .eq('id', orderId)
        .single();

      if (error) {
        console.warn(`⚠️ Failed to get order status: ${error.message}`);
        return null;
      }

      return data;
    } catch (error) {
      console.warn(`⚠️ Error getting order status:`, error);
      return null;
    }
  }

  /**
   * Handle orders that have been processing too long (stuck orders)
   * Resets them to initializing status for retry
   */
  private async handleStuckOrders(): Promise<number> {
    const timeoutMinutes = this.options.processingTimeout;
    const timeoutThreshold = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();

    try {
      // Find stuck orders
      const { data: stuckOrders, error: findError } = await this.supabase
        .from('orders')
        .select('id, order_number, processing_started_at')
        .eq('processing_stage', 'processing')
        .lt('processing_started_at', timeoutThreshold);

      if (findError) {
        console.warn(`⚠️ Failed to find stuck orders: ${findError.message}`);
        return 0;
      }

      if (!stuckOrders || stuckOrders.length === 0) {
        return 0;
      }

      console.log(`⏰ Found ${stuckOrders.length} stuck orders (processing > ${timeoutMinutes} minutes)`);

      // Reset stuck orders to initializing
      const { error: resetError } = await this.supabase
        .from('orders')
        .update({
          processing_stage: 'initializing',
          order_status: 'pending',
          processing_completion_percentage: 0,
          current_processing_phase: null,
          error_message: `Reset from stuck processing state after ${timeoutMinutes} minutes timeout`,
          updated_at: new Date().toISOString()
        })
        .in('id', stuckOrders.map(o => o.id));

      if (resetError) {
        console.error(`❌ Failed to reset stuck orders: ${resetError.message}`);
        return 0;
      }

      console.log(`🔄 Reset ${stuckOrders.length} stuck orders to initializing state`);
      return stuckOrders.length;

    } catch (error) {
      console.warn(`⚠️ Error handling stuck orders:`, error);
      return 0;
    }
  }

  /**
   * Get discovery service statistics for monitoring
   */
  async getDiscoveryStats(): Promise<{
    totalPendingOrders: number;
    processingOrders: number;
    completedOrders: number;
    errorOrders: number;
    averageProcessingTime?: number;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('orders')
        .select('processing_stage')
        .eq('payment_status', 'completed');

      if (error) {
        throw new Error(`Failed to get discovery stats: ${error.message}`);
      }

      const stats = {
        totalPendingOrders: 0,
        processingOrders: 0,
        completedOrders: 0,
        errorOrders: 0
      };

      data?.forEach((order: any) => {
        switch (order.processing_stage) {
          case 'initializing':
            stats.totalPendingOrders++;
            break;
          case 'processing':
            stats.processingOrders++;
            break;
          case 'completed':
            stats.completedOrders++;
            break;
          case 'error':
            stats.errorOrders++;
            break;
        }
      });

      return stats;

    } catch (error) {
      console.error('❌ Failed to get discovery stats:', error);
      return {
        totalPendingOrders: 0,
        processingOrders: 0,
        completedOrders: 0,
        errorOrders: 0
      };
    }
  }

  /**
   * Find next single order for processing (used by single-order mode)
   */
  async findNextOrder(): Promise<OrbitOrder | null> {
    const results = await this.findPendingOrders({ maxOrdersPerBatch: 1 });
    return results.foundOrders.length > 0 ? results.foundOrders[0] : null;
  }
}