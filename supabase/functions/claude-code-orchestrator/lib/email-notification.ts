/**
 * Email Notification Service
 * 
 * Integrates with the existing send-order-completion-email Edge Function to provide
 * comprehensive email notification capabilities for order completion.
 * 
 * This service completes the user experience loop by ensuring customers receive
 * timely notifications when their orders are processed, with proper retry logic
 * and status tracking.
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export interface EmailResult {
  success: boolean;
  emailId?: string;
  deliveryStatus?: 'sent' | 'delivered' | 'failed';
  error?: string;
  retryable?: boolean;
  responseTime: number;
}

export interface EmailVerificationResult {
  emailSent: boolean;
  emailId?: string;
  sentAt?: string;
  deliveryConfirmed?: boolean;
  verificationTime: number;
}

export interface EmailNotificationOptions {
  orderId: string;
  retryAttempts?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  verificationEnabled?: boolean;
}

export interface EmailStatus {
  orderId: string;
  emailSent: boolean;
  emailId?: string;
  sentAt?: string;
  deliveryStatus?: string;
  lastAttemptAt?: string;
  attemptCount: number;
  lastError?: string;
}

export class EmailNotificationService {
  private supabase: any;
  private functionUrl: string;
  private serviceKey: string;

  constructor() {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('sb_secret_key') || Deno.env.get('SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration required for Email Notification Service');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.functionUrl = `${supabaseUrl}/functions/v1/send-order-completion-email`;
    this.serviceKey = supabaseKey;

    console.log('📧 Email Notification Service initialized');
    console.log(`🔗 Function URL: ${this.functionUrl}`);
  }

  /**
   * Send completion email via existing Edge Function
   * This is the main method called when orders are completed
   */
  async sendCompletionEmail(
    orderId: string,
    options: Partial<EmailNotificationOptions> = {}
  ): Promise<EmailResult> {
    const startTime = Date.now();
    const finalOptions: EmailNotificationOptions = {
      orderId,
      retryAttempts: 2,
      retryDelayMs: 5000,
      timeoutMs: 30000,
      verificationEnabled: true,
      ...options
    };

    console.log(`📧 Sending completion email for order ${orderId}...`);

    try {
      // Check if email was already sent
      const existingStatus = await this.getEmailStatus(orderId);
      if (existingStatus.emailSent && existingStatus.emailId) {
        console.log(`✅ Email already sent for order ${orderId} (${existingStatus.emailId})`);
        
        return {
          success: true,
          emailId: existingStatus.emailId,
          deliveryStatus: 'sent',
          responseTime: Date.now() - startTime
        };
      }

      // Attempt to send email with retry logic
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= (finalOptions.retryAttempts! + 1); attempt++) {
        try {
          console.log(`📤 Email attempt ${attempt} for order ${orderId}`);
          
          const result = await this.callEmailFunction(orderId, finalOptions.timeoutMs!);
          
          if (result.success) {
            // Update database with successful email send
            await this.updateEmailStatus(orderId, true, result.emailId, null);
            
            console.log(`✅ Email sent successfully for order ${orderId} (${result.emailId})`);
            
            // Verify delivery if enabled
            if (finalOptions.verificationEnabled && result.emailId) {
              const verification = await this.verifyEmailDelivery(orderId, result.emailId);
              console.log(`📋 Email verification: ${verification.deliveryConfirmed ? 'confirmed' : 'pending'}`);
            }
            
            return {
              success: true,
              emailId: result.emailId,
              deliveryStatus: result.deliveryStatus || 'sent',
              responseTime: Date.now() - startTime
            };
          } else {
            throw new Error(result.error || 'Unknown email function error');
          }

        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.warn(`⚠️ Email attempt ${attempt} failed for order ${orderId}: ${lastError.message}`);
          
          // Update attempt count in database
          await this.updateEmailAttempt(orderId, attempt, lastError.message);
          
          // Wait before retry (except on last attempt)
          if (attempt <= finalOptions.retryAttempts!) {
            console.log(`⏱️ Waiting ${finalOptions.retryDelayMs}ms before retry...`);
            await this.sleep(finalOptions.retryDelayMs!);
          }
        }
      }

      // All attempts failed
      console.error(`❌ Email failed for order ${orderId} after ${finalOptions.retryAttempts! + 1} attempts`);
      
      await this.updateEmailStatus(orderId, false, undefined, lastError!.message);
      
      return {
        success: false,
        error: `Email failed after ${finalOptions.retryAttempts! + 1} attempts: ${lastError!.message}`,
        retryable: this.isRetryableError(lastError!),
        responseTime: Date.now() - startTime
      };

    } catch (error) {
      console.error(`❌ Email service error for order ${orderId}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.updateEmailStatus(orderId, false, undefined, errorMessage);
      
      return {
        success: false,
        error: `Email service error: ${errorMessage}`,
        retryable: false,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Verify email was sent and update database status
   */
  async verifyEmailDelivery(orderId: string, emailId?: string): Promise<EmailVerificationResult> {
    const startTime = Date.now();
    
    console.log(`🔍 Verifying email delivery for order ${orderId}${emailId ? ` (${emailId})` : ''}`);

    try {
      // Check current database status
      const status = await this.getEmailStatus(orderId);
      
      const result: EmailVerificationResult = {
        emailSent: status.emailSent,
        emailId: status.emailId,
        sentAt: status.sentAt,
        deliveryConfirmed: status.emailSent && !!status.emailId,
        verificationTime: Date.now() - startTime
      };

      if (result.deliveryConfirmed) {
        console.log(`✅ Email delivery verified for order ${orderId}`);
      } else {
        console.warn(`⚠️ Email delivery not confirmed for order ${orderId}`);
      }

      return result;

    } catch (error) {
      console.error(`❌ Email verification error for order ${orderId}:`, error);
      
      return {
        emailSent: false,
        deliveryConfirmed: false,
        verificationTime: Date.now() - startTime
      };
    }
  }

  /**
   * Handle email failures with retry logic integration
   */
  async handleEmailFailure(orderId: string, error: string): Promise<void> {
    console.warn(`⚠️ Handling email failure for order ${orderId}: ${error}`);

    try {
      // Get current attempt count
      const status = await this.getEmailStatus(orderId);
      const nextAttemptCount = status.attemptCount + 1;
      
      // Update failure status
      await this.updateEmailAttempt(orderId, nextAttemptCount, error);
      
      // Log for monitoring
      console.warn(`📊 Email failure logged: order=${orderId}, attempt=${nextAttemptCount}, error=${error}`);
      
    } catch (updateError) {
      console.error(`❌ Failed to log email failure for order ${orderId}:`, updateError);
    }
  }

  /**
   * Get email status for an order
   */
  async getEmailStatus(orderId: string): Promise<EmailStatus> {
    try {
      const { data, error } = await this.supabase
        .from('orders')
        .select(`
          id,
          email_sent,
          email_sent_at,
          email_id,
          email_delivery_status,
          email_attempt_count,
          email_last_error,
          email_last_attempt_at
        `)
        .eq('id', orderId)
        .single();

      if (error || !data) {
        // Return default status if order not found
        return {
          orderId,
          emailSent: false,
          attemptCount: 0
        };
      }

      return {
        orderId,
        emailSent: data.email_sent || false,
        emailId: data.email_id,
        sentAt: data.email_sent_at,
        deliveryStatus: data.email_delivery_status,
        lastAttemptAt: data.email_last_attempt_at,
        attemptCount: data.email_attempt_count || 0,
        lastError: data.email_last_error
      };

    } catch (error) {
      console.error(`❌ Error getting email status for order ${orderId}:`, error);
      
      return {
        orderId,
        emailSent: false,
        attemptCount: 0,
        lastError: `Status check error: ${error}`
      };
    }
  }

  /**
   * Get email notification statistics
   */
  async getEmailStats(): Promise<{
    totalOrders: number;
    emailsSent: number;
    emailsFailed: number;
    emailsPending: number;
    averageResponseTime: number;
    successRate: number;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('orders')
        .select('email_sent, email_last_error, processing_stage')
        .eq('processing_stage', 'completed');

      if (error || !data) {
        return this.getEmptyEmailStats();
      }

      const totalOrders = data.length;
      const emailsSent = data.filter((order: any) => order.email_sent).length;
      const emailsFailed = data.filter((order: any) => order.email_last_error).length;
      const emailsPending = totalOrders - emailsSent - emailsFailed;
      const successRate = totalOrders > 0 ? (emailsSent / totalOrders) * 100 : 0;

      return {
        totalOrders,
        emailsSent,
        emailsFailed,
        emailsPending,
        averageResponseTime: 0, // TODO: Calculate from logs
        successRate
      };

    } catch (error) {
      console.error('❌ Error getting email stats:', error);
      return this.getEmptyEmailStats();
    }
  }

  /**
   * Call the send-order-completion-email Edge Function
   */
  private async callEmailFunction(orderId: string, timeoutMs: number): Promise<{
    success: boolean;
    emailId?: string;
    deliveryStatus?: string;
    error?: string;
  }> {
    console.log(`📞 Calling email function for order ${orderId}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(this.functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.serviceKey}`,
          'Content-Type': 'application/json',
          'x-source-function': 'claude-tier2-orchestrator'
        },
        body: JSON.stringify({ orderId }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log(`📧 Email function response: ${JSON.stringify(result)}`);

      return {
        success: result.success || false,
        emailId: result.emailId,
        deliveryStatus: result.deliveryStatus,
        error: result.error
      };

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Email function timeout after ${timeoutMs}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Update email status in the database
   */
  private async updateEmailStatus(
    orderId: string,
    sent: boolean,
    emailId?: string,
    error?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        email_sent: sent,
        email_sent_at: sent ? new Date().toISOString() : null,
        email_last_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (emailId) {
        updateData.email_id = emailId;
        updateData.email_delivery_status = 'sent';
      }

      if (error) {
        updateData.email_last_error = error;
      } else if (sent) {
        // Clear error on success
        updateData.email_last_error = null;
      }

      const { error: updateError } = await this.supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (updateError) {
        console.error(`❌ Failed to update email status: ${updateError.message}`);
      } else {
        console.log(`✅ Email status updated for order ${orderId}: sent=${sent}${emailId ? `, id=${emailId}` : ''}`);
      }

    } catch (error) {
      console.error(`❌ Error updating email status for order ${orderId}:`, error);
    }
  }

  /**
   * Update email attempt count
   */
  private async updateEmailAttempt(orderId: string, attemptCount: number, error: string): Promise<void> {
    try {
      const { error: updateError } = await this.supabase
        .from('orders')
        .update({
          email_attempt_count: attemptCount,
          email_last_attempt_at: new Date().toISOString(),
          email_last_error: error,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) {
        console.warn(`⚠️ Failed to update email attempt: ${updateError.message}`);
      }

    } catch (error) {
      console.warn(`⚠️ Error updating email attempt:`, error);
    }
  }

  /**
   * Determine if an email error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // Network and temporary errors are retryable
    if (message.includes('timeout') || 
        message.includes('network') || 
        message.includes('503') || 
        message.includes('502') || 
        message.includes('500')) {
      return true;
    }
    
    // Client errors are generally not retryable
    if (message.includes('400') || 
        message.includes('401') || 
        message.includes('403') || 
        message.includes('404')) {
      return false;
    }
    
    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Get empty email statistics
   */
  private getEmptyEmailStats() {
    return {
      totalOrders: 0,
      emailsSent: 0,
      emailsFailed: 0,
      emailsPending: 0,
      averageResponseTime: 0,
      successRate: 0
    };
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}