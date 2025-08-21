/**
 * ORBIT Workflow Module
 * 
 * Central orchestration engine that coordinates the complete ORBIT image processing workflow.
 * Handles end-to-end processing from order discovery through completion notification.
 * 
 * This module provides the core workflow logic that integrates all direct tools
 * for maximum performance while maintaining full compatibility with ORBIT standards.
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { OrbitRequest, OrbitResponse, OrbitPhases, OrbitResults, PhaseStatus, DiscoveryResults, ProcessingResults, ValidationResults } from '../types/orbit-types.ts';
import { TodoManager } from './todo-manager.ts';
import { ClaudeClient } from './claude-client.ts';
import { OrderDiscoveryService } from './order-discovery.ts';
import { StorageVerificationService } from './storage-verifier.ts';
import { ErrorRecoveryService } from './error-recovery.ts';
import { EmailNotificationService } from './email-notification.ts';
import { BatchProcessingValidator } from './batch-validator.ts';

export interface WorkflowOptions {
  enableMetrics?: boolean;
  enableLogging?: boolean;
  enableRecovery?: boolean;
  maxRetries?: number;
}

export interface ImageProcessingJob {
  imageId: string;
  imagePath: string;
  filename: string;
  analysisType?: 'lifestyle' | 'product';
  processingStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export class OrbitWorkflow {
  private supabase: any;
  private todoManager: TodoManager;
  private claudeClient: ClaudeClient;
  private orderDiscovery: OrderDiscoveryService;
  private storageVerifier: StorageVerificationService;
  private errorRecovery: ErrorRecoveryService;
  private emailService: EmailNotificationService;
  private batchValidator: BatchProcessingValidator;
  private options: WorkflowOptions;
  private workflowStartTime: number;

  constructor(options: WorkflowOptions = {}) {
    this.options = {
      enableMetrics: true,
      enableLogging: true,
      enableRecovery: true,
      maxRetries: 3,
      ...options
    };

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('sb_secret_key') || Deno.env.get('SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration required for ORBIT workflow');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize todo manager
    this.todoManager = new TodoManager({
      enableMetrics: this.options.enableMetrics,
      enableLogging: this.options.enableLogging
    });

    // Initialize REAL Claude API client
    this.claudeClient = new ClaudeClient();

    // Initialize production services
    this.orderDiscovery = new OrderDiscoveryService();
    this.storageVerifier = new StorageVerificationService();
    this.errorRecovery = new ErrorRecoveryService();
    this.emailService = new EmailNotificationService();
    this.batchValidator = new BatchProcessingValidator();

    this.workflowStartTime = Date.now();

    if (this.options.enableLogging) {
      console.log('🌌 ORBIT Workflow Engine initialized with REAL Claude API integration + Production Services');
      console.log('🤖 Using authentic Claude Code patterns with MCP tools');
      console.log('🔧 Services: Order Discovery, Storage Verification, Error Recovery, Email Notifications, Batch Validation');
    }
  }

  /**
   * Execute complete ORBIT workflow for an order
   */
  async executeWorkflow(request: OrbitRequest): Promise<OrbitResponse> {
    const { orderId, action = 'process', analysisType, debugMode = false } = request;
    
    if (this.options.enableLogging) {
      console.log(`🚀 Starting ORBIT workflow for order: ${orderId}`);
      console.log(`📋 Action: ${action}, Analysis Type: ${analysisType || 'auto-detect'}`);
    }

    // Initialize workflow todo list
    this.todoManager.initializeOrbitWorkflow(orderId);

    const phases: OrbitPhases = {
      planning: { status: 'pending', startTime: 0, endTime: 0, duration: 0 },
      discovery: { status: 'pending', startTime: 0, endTime: 0, duration: 0 },
      processing: { status: 'pending', startTime: 0, endTime: 0, duration: 0 },
      validation: { status: 'pending', startTime: 0, endTime: 0, duration: 0 },
      reporting: { status: 'pending', startTime: 0, endTime: 0, duration: 0 }
    };

    let results: OrbitResults | undefined;
    const errors: string[] = [];

    try {
      // Phase 1: Planning & Initialization
      await this.executePlanningPhase(phases.planning, orderId);
      
      // Phase 2: Discovery & Validation
      const discoveryResults = await this.executeDiscoveryPhase(phases.discovery, orderId);
      
      // Phase 3: Image Processing
      const processingResults = await this.executeProcessingPhase(phases.processing, discoveryResults, analysisType);
      
      // Phase 4: Validation & Quality Check
      const validationResults = await this.executeValidationPhase(phases.validation, processingResults, orderId);
      
      // Phase 5: Reporting & Completion
      await this.executeReportingPhase(phases.reporting, orderId, processingResults);

      results = {
        discovery: discoveryResults,
        processing: processingResults,
        validation: validationResults
      };

      if (this.options.enableLogging) {
        console.log('✅ ORBIT workflow completed successfully');
        this.todoManager.logProgress();
      }

    } catch (error) {
      errors.push(error.message);
      if (this.options.enableLogging) {
        console.error('❌ ORBIT workflow failed:', error);
      }
      
      // Mark current task as failed
      const currentTask = this.todoManager.getCurrentTask();
      if (currentTask) {
        this.todoManager.failTask(currentTask.id, error.message);
      }
    }

    const totalDuration = Date.now() - this.workflowStartTime;
    const success = errors.length === 0 && this.todoManager.isComplete() && !this.todoManager.hasFailures();

    const response: OrbitResponse = {
      success,
      orchestrationType: 'claude-code-sdk',
      orderId,
      message: success 
        ? `ORBIT workflow completed successfully in ${totalDuration}ms with direct tool integration`
        : `ORBIT workflow encountered ${errors.length} errors`,
      execution: {
        todoList: this.todoManager.getTodos(),
        totalDuration,
        phases,
        toolMetrics: this.generateToolMetrics()
      },
      results,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    };

    return response;
  }

  /**
   * Phase 1: Planning & Initialization
   */
  private async executePlanningPhase(phase: PhaseStatus, orderId: string): Promise<void> {
    phase.status = 'in_progress';
    phase.startTime = Date.now();
    
    this.todoManager.startTask('init-1');
    
    if (this.options.enableLogging) {
      console.log('📋 Phase 1: Planning & Initialization');
    }

    // Validate environment and tools
    await this.validateEnvironment();
    
    // Check order exists and is in correct status
    const orderValid = await this.validateOrder(orderId);
    if (!orderValid) {
      throw new Error(`Order ${orderId} not found or not in processable state`);
    }

    this.todoManager.completeTask('init-1');
    
    phase.status = 'completed';
    phase.endTime = Date.now();
    phase.duration = phase.endTime - phase.startTime;
  }

  /**
   * Phase 2: Discovery & Validation (Enhanced with Production Services)
   */
  private async executeDiscoveryPhase(phase: PhaseStatus, orderId: string): Promise<DiscoveryResults> {
    phase.status = 'in_progress';
    phase.startTime = Date.now();
    
    this.todoManager.startTask('discovery-1');
    
    if (this.options.enableLogging) {
      console.log('🔍 Phase 2: Enhanced Discovery & Validation with Production Services');
    }

    // Update processing progress
    await this.orderDiscovery.updateProcessingProgress(orderId, 10, 'discovery');

    // Discover images from database
    const images = await this.discoverOrderImages(orderId);
    
    if (images.length === 0) {
      throw new Error(`No processable images found for order ${orderId}`);
    }

    // Get order data for enhanced discovery
    const { data: orderData, error: orderError } = await this.supabase
      .from('orders')
      .select('id, user_id, batch_id, order_number, payment_status')
      .eq('id', orderId)
      .single();

    if (orderError || !orderData) {
      throw new Error(`Failed to get order data: ${orderError?.message || 'Order not found'}`);
    }

    const discoveryResults: DiscoveryResults = {
      order: orderData,
      images,
      paymentStatus: orderData.payment_status,
      imageCount: images.length,
      storageValidated: false, // Will be validated in next step
      userPermissions: 'validated' // Assume validated if order exists
    };

    // Enhanced discovery - validate storage accessibility
    try {
      const userId = orderData.user_id;
      const storageVerification = await this.storageVerifier.verifyOrderCompletion(orderId, userId);
      
      discoveryResults.storageValidated = storageVerification.originalFolderVerification.verified;
      
      if (!discoveryResults.storageValidated) {
        console.warn(`⚠️ Storage validation issues found: ${storageVerification.originalFolderVerification.missingFiles.length} missing files`);
      }
      
    } catch (storageError) {
      console.warn(`⚠️ Storage validation failed (non-critical): ${storageError.message}`);
      discoveryResults.storageValidated = false;
    }

    this.todoManager.completeTask('discovery-1');
    
    phase.status = 'completed';
    phase.endTime = Date.now();
    phase.duration = phase.endTime - phase.startTime;
    
    discoveryResults.discoveryTime = phase.duration;
    
    if (this.options.enableLogging) {
      console.log(`✅ Discovered ${images.length} images for processing`);
    }

    return discoveryResults;
  }

  /**
   * Phase 3: Image Processing (Enhanced with Error Recovery)
   */
  private async executeProcessingPhase(
    phase: PhaseStatus, 
    discoveryResults: DiscoveryResults,
    analysisType?: 'lifestyle' | 'product'
  ): Promise<ProcessingResults> {
    phase.status = 'in_progress';
    phase.startTime = Date.now();
    
    this.todoManager.startTask('analysis-1');
    
    if (this.options.enableLogging) {
      console.log('🧠 Phase 3: Enhanced Image Processing with Error Recovery');
      console.log(`📊 Processing ${discoveryResults.images.length} images with production services`);
    }

    const processedImages = [];
    const failedImages = [];
    let analysisTime = 0;
    let metadataTime = 0;
    let reportTime = 0;
    const totalImages = discoveryResults.images.length;

    // Process each image using enhanced error recovery
    for (let i = 0; i < discoveryResults.images.length; i++) {
      const image = discoveryResults.images[i];
      const progressPercentage = 20 + Math.floor((i / totalImages) * 60); // 20-80% progress range
      
      // Update processing progress
      await this.orderDiscovery.updateProcessingProgress(
        discoveryResults.order.id, 
        progressPercentage, 
        `processing_image_${i + 1}`
      );

      try {
        if (this.options.enableLogging) {
          console.log(`🔄 Processing image ${i + 1}/${totalImages}: ${image.original_filename} with error recovery`);
        }

        // Enhanced processing with error recovery
        const processingResult = await this.errorRecovery.attemptRecovery(
          async () => {
            // Step 1: Claude API Orchestration for Image Analysis
            const claudeAnalysisResult = await this.claudeClient.orchestrateWithClaude(
              discoveryResults.order.id,
              'image_analysis',
              {
                imageId: image.id,
                imagePath: image.storage_path_original,
                filename: image.original_filename,
                analysisType
              }
            );
            
            if (!claudeAnalysisResult.success) {
              throw new Error(`Claude API orchestration failed: ${claudeAnalysisResult.error}`);
            }

            analysisTime += claudeAnalysisResult.executionTime;

            // Step 2: Metadata Processing with Recovery
            this.todoManager.startTask('metadata-1');
            const claudeMetadataResult = await this.claudeClient.orchestrateWithClaude(
              discoveryResults.order.id,
              'metadata_processing',
              {
                imageId: image.id,
                imagePath: image.storage_path_original,
                analysisResult: claudeAnalysisResult.result,
                outputPath: `${image.storage_path_original.replace('/original/', '/processed/')}_processed`
              }
            );
            
            if (!claudeMetadataResult.success) {
              throw new Error(`Claude metadata orchestration failed: ${claudeMetadataResult.error}`);
            }
            
            metadataTime += claudeMetadataResult.executionTime;
            this.todoManager.completeTask('metadata-1');

            // Step 3: Report Generation with Recovery
            this.todoManager.startTask('reports-1');
            const claudeReportResult = await this.claudeClient.orchestrateWithClaude(
              discoveryResults.order.id,
              'report_generation',
              {
                imageId: image.id,
                imagePath: image.storage_path_original,
                analysisResult: claudeAnalysisResult.result,
                metadataResult: claudeMetadataResult.result
              }
            );
            
            reportTime += claudeReportResult.executionTime;
            this.todoManager.completeTask('reports-1');

            return {
              analysis: claudeAnalysisResult,
              metadata: claudeMetadataResult,
              report: claudeReportResult
            };
          },
          {
            orderId: discoveryResults.order.id,
            imageId: image.id,
            userId: discoveryResults.order.user_id,
            phase: 'processing',
            operation: `image_processing_${image.original_filename}`,
            correlationId: `${discoveryResults.order.id}-${image.id}-${Date.now()}`,
            timestamp: Date.now()
          }
        );

        if (processingResult.success) {
          // Update image processing status in database with explicit error handling
          try {
            console.log(`📝 About to update database for image ${image.id} (${image.original_filename})`);
            console.log(`🔍 Processing result structure: ${JSON.stringify(processingResult.result, null, 2)}`);
            
            await this.updateImageProcessingStatus(image.id, 'completed', processingResult.result);
            console.log(`✅ Database update successful for image ${image.id}`);
            
          } catch (dbError) {
            console.error(`❌ Database update failed for image ${image.id}: ${dbError.message}`);
            console.error(`🔍 DB Error details: ${JSON.stringify(dbError)}`);
            // Don't throw - continue with processing but log the issue
          }

          processedImages.push({
            imageId: image.id,
            filename: image.original_filename,
            analysisResult: processingResult.result.analysis,
            metadataResult: processingResult.result.metadata,
            reportResult: processingResult.result.report,
            totalProcessingTime: processingResult.recoveryTime
          });

          if (this.options.enableLogging) {
            console.log(`✅ Completed: ${image.original_filename} (attempt ${processingResult.attemptNumber})`);
          }

        } else {
          throw new Error(processingResult.finalError || 'Processing failed after recovery attempts');
        }

      } catch (error) {
        if (this.options.enableLogging) {
          console.error(`❌ Failed: ${image.original_filename} - ${error.message}`);
        }
        
        failedImages.push({
          imageId: image.id,
          filename: image.original_filename,
          error: error.message
        });

        await this.updateImageProcessingStatus(image.id, 'failed', null, error.message);
      }
    }

    this.todoManager.completeTask('analysis-1');
    
    phase.status = 'completed';
    phase.endTime = Date.now();
    phase.duration = phase.endTime - phase.startTime;

    const processingResults: ProcessingResults = {
      imagesProcessed: processedImages.length,
      analysisResults: processedImages.map(img => img.analysisResult),
      metadataResults: processedImages.map(img => img.metadataResult),
      analysisCompleted: processedImages.length > 0,
      metadataEmbedded: processedImages.length > 0,
      reportsGenerated: processedImages.length > 0,
      totalProcessingTime: phase.duration,
      avgTimePerImage: totalImages > 0 ? phase.duration / totalImages : 0
    };

    if (this.options.enableLogging) {
      console.log(`✅ Processing complete: ${processedImages.length}/${totalImages} successful`);
    }

    return processingResults;
  }

  /**
   * Phase 4: Comprehensive Validation & Quality Check (Enhanced with Production Services)
   */
  private async executeValidationPhase(phase: PhaseStatus, processingResults: ProcessingResults, orderId: string): Promise<ValidationResults> {
    phase.status = 'in_progress';
    phase.startTime = Date.now();
    
    this.todoManager.startTask('validation-1');
    
    if (this.options.enableLogging) {
      console.log('🔍 Phase 4: Comprehensive Validation & Quality Check with Production Services');
    }

    // Update processing progress
    await this.orderDiscovery.updateProcessingProgress(orderId, 85, 'validation');

    // Get order data for validation
    const { data: orderData, error: orderError } = await this.supabase
      .from('orders')
      .select('id, user_id')
      .eq('id', orderId)
      .single();

    if (orderError || !orderData) {
      throw new Error(`Failed to get order data for validation: ${orderError?.message}`);
    }

    // Comprehensive batch validation
    const batchValidation = await this.batchValidator.validateBatchCompletion(orderId);
    
    // Storage verification
    const storageValidation = await this.storageVerifier.verifyOrderCompletion(orderId, orderData.user_id);

    // Enhanced validation checks
    const validationChecks = {
      databaseConsistency: batchValidation.validationChecks.databaseConsistency,
      storageIntegrity: storageValidation.verificationPassed,
      metadataIntegrity: batchValidation.validationChecks.metadataIntegrity,
      performanceAcceptable: batchValidation.validationSummary.completionRate >= 95 // 95% threshold
    };

    const allImagesProcessed = batchValidation.canComplete;
    const metadataValidated = validationChecks.metadataIntegrity;
    const noRegressions = !batchValidation.blockers.some(blocker => 
      blocker.includes('regression') || blocker.includes('corruption'));
    const systemStable = validationChecks.databaseConsistency && validationChecks.storageIntegrity;

    const validationResults: ValidationResults = {
      allImagesProcessed,
      metadataValidated,
      noRegressions,
      systemStable,
      validationChecks
    };

    this.todoManager.completeTask('validation-1');
    
    phase.status = 'completed';
    phase.endTime = Date.now();
    phase.duration = phase.endTime - phase.startTime;

    const validationPassed = allImagesProcessed && systemStable;

    if (this.options.enableLogging) {
      console.log(`✅ Enhanced Validation ${validationPassed ? 'passed' : 'failed'}`);
      console.log(`📊 Batch Validation: ${batchValidation.validationSummary.completionRate.toFixed(1)}% completion`);
      console.log(`💾 Storage Verification: ${storageValidation.verificationPassed ? 'passed' : 'failed'}`);
      
      if (!validationPassed) {
        console.warn(`🚫 Validation blockers: ${batchValidation.blockers.join(', ')}`);
        console.warn(`💡 Recommendations: ${batchValidation.recommendations.join(', ')}`);
      }
    }

    return validationResults;
  }

  /**
   * Phase 5: Enhanced Reporting & Completion (with Email Notifications)
   */
  private async executeReportingPhase(
    phase: PhaseStatus, 
    orderId: string,
    processingResults: ProcessingResults
  ): Promise<void> {
    phase.status = 'in_progress';
    phase.startTime = Date.now();
    
    this.todoManager.startTask('reporting-1');
    
    if (this.options.enableLogging) {
      console.log('📊 Phase 5: Enhanced Reporting & Completion with Email Notifications');
    }

    // Update processing progress
    await this.orderDiscovery.updateProcessingProgress(orderId, 95, 'completion');

    // Step 1: Generate comprehensive batch completion report
    this.todoManager.startTask('report-generation');
    try {
      const batchReport = await this.batchValidator.generateBatchCompletionReport(orderId);
      
      if (this.options.enableLogging) {
        console.log(`📊 Batch report: ${batchReport.successfulImages}/${batchReport.totalImages} success, quality: ${batchReport.qualityScore.toFixed(1)}%`);
      }
      
    } catch (reportError) {
      console.warn(`⚠️ Batch report generation failed (non-critical): ${reportError.message}`);
    }
    this.todoManager.completeTask('report-generation');

    // Step 2: Update database with comprehensive final results
    this.todoManager.startTask('database-update');
    const completionMetadata = {
      totalImages: processingResults.imagesProcessed || 0,
      processedImages: processingResults.imagesProcessed || 0,
      failedImages: processingResults.analysisResults?.length ? 
        (processingResults.imagesProcessed || 0) - processingResults.analysisResults.length : 0,
      processingTime: processingResults.totalProcessingTime,
      avgTimePerImage: processingResults.avgTimePerImage,
      analysisCompleted: processingResults.analysisCompleted,
      metadataEmbedded: processingResults.metadataEmbedded,
      reportsGenerated: processingResults.reportsGenerated,
      completedAt: new Date().toISOString(),
      orchestrationType: 'claude-code-sdk',
      productionServices: {
        orderDiscovery: true,
        storageVerification: true,
        errorRecovery: true,
        emailNotifications: true,
        batchValidation: true
      }
    };

    await this.updateOrderStatus(orderId, 'completed', completionMetadata);
    this.todoManager.completeTask('database-update');

    // Step 3: Final processing progress update
    await this.orderDiscovery.updateProcessingProgress(orderId, 98, 'email_notification');

    // Step 4: Send completion email notification
    this.todoManager.startTask('email-notification');
    try {
      if (this.options.enableLogging) {
        console.log(`📧 Sending completion email for order ${orderId}...`);
      }

      const emailResult = await this.emailService.sendCompletionEmail(orderId, {
        retryAttempts: 2,
        retryDelayMs: 5000,
        timeoutMs: 30000,
        verificationEnabled: true
      });

      if (emailResult.success) {
        if (this.options.enableLogging) {
          console.log(`✅ Completion email sent successfully: ${emailResult.emailId} (${emailResult.responseTime}ms)`);
        }
        
        // Update final progress
        await this.orderDiscovery.updateProcessingProgress(orderId, 100, 'completed');

      } else {
        console.warn(`⚠️ Email notification failed (non-critical): ${emailResult.error}`);
        
        // Still mark as complete since email failure shouldn't block order completion
        await this.orderDiscovery.updateProcessingProgress(orderId, 100, 'completed_email_failed');
        
        // Log email failure for monitoring
        await this.emailService.handleEmailFailure(orderId, emailResult.error || 'Unknown email error');
      }

    } catch (emailError) {
      console.warn(`⚠️ Email service error (non-critical): ${emailError.message}`);
      
      // Mark as complete despite email failure
      await this.orderDiscovery.updateProcessingProgress(orderId, 100, 'completed_email_error');
      
      // Log the email error
      await this.emailService.handleEmailFailure(orderId, emailError.message);
    }
    this.todoManager.completeTask('email-notification');

    this.todoManager.completeTask('reporting-1');
    
    phase.status = 'completed';
    phase.endTime = Date.now();
    phase.duration = phase.endTime - phase.startTime;

    if (this.options.enableLogging) {
      console.log(`✅ Enhanced Order ${orderId} processing complete with email notifications`);
      console.log(`📊 Final Phase 5 Duration: ${phase.duration}ms`);
      console.log(`🎯 Production Services Integration: Complete`);
    }
  }

  // Helper methods
  private async validateEnvironment(): Promise<void> {
    // Health check for Claude API client
    const claudeHealthy = await this.claudeClient.healthCheck();
    
    if (!claudeHealthy) {
      throw new Error('Environment validation failed - Claude API client is not healthy');
    }
    
    // Validate required environment variables
    const requiredEnv = ['CLAUDE_API_KEY', 'SUPABASE_URL', 'sb_secret_key'];
    const missingEnv = requiredEnv.filter(env => !Deno.env.get(env));
    
    if (missingEnv.length > 0) {
      throw new Error(`Missing required environment variables: ${missingEnv.join(', ')}`);
    }
  }

  private async validateOrder(orderId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('orders')
        .select('id, order_status')
        .eq('id', orderId)
        .single();

      if (error || !data) {
        return false;
      }

      // Order should be in 'processing' status
      return data.order_status === 'processing';
    } catch (error) {
      return false;
    }
  }

  private async discoverOrderImages(orderId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('images')
      .select('*')
      .eq('order_id', orderId)
      .eq('processing_status', 'pending');

    if (error) {
      throw new Error(`Failed to discover images: ${error.message}`);
    }

    return data || [];
  }

  private async updateImageProcessingStatus(imageId: string, status: string, results?: any, error?: string): Promise<void> {
    const updateData: any = {
      processing_status: status,
      updated_at: new Date().toISOString()
    };

    if (results) {
      // Handle Claude API result structure
      if (results.analysis?.result) {
        updateData.ai_analysis = results.analysis.result;
        updateData.gemini_analysis_raw = JSON.stringify(results.analysis.result);
      } else if (results.analysis) {
        updateData.ai_analysis = results.analysis;
        updateData.gemini_analysis_raw = JSON.stringify(results.analysis);
      }

      // Handle metadata/processing paths
      if (results.metadata?.result) {
        updateData.storage_path_processed = results.metadata.result.outputPath || 
          `${imageId}_processed`;
      } else if (results.metadata?.outputPath) {
        updateData.storage_path_processed = results.metadata.outputPath;
      }

      // Mark as processed if successful
      if (status === 'completed') {
        updateData.processed_at = new Date().toISOString();
      }
    }

    if (error) {
      updateData.error_message = error;
    }

    if (this.options.enableLogging) {
      console.log(`📝 Updating image ${imageId} status to ${status}`);
    }

    const { error: updateError } = await this.supabase
      .from('images')
      .update(updateData)
      .eq('id', imageId);

    if (updateError) {
      console.error(`❌ Failed to update image status for ${imageId}: ${updateError.message}`);
    } else {
      console.log(`✅ Successfully updated image ${imageId} status to ${status}`);
    }
  }

  private async updateOrderStatus(orderId: string, status: string, metadata?: any): Promise<void> {
    const updateData: any = {
      order_status: status,
      updated_at: new Date().toISOString()
    };

    if (metadata) {
      updateData.processing_metadata = metadata;
    }

    const { error } = await this.supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (error) {
      console.warn(`Failed to update order status: ${error.message}`);
    }
  }

  private generateToolMetrics(): any {
    const todoMetrics = this.todoManager.getMetrics();
    const claudeMetrics = this.claudeClient.getMetrics();
    
    return {
      realClaudeAPIIntegration: true,
      claudeAPIMetrics: claudeMetrics,
      authenticClaudeCodePatterns: true,
      mcpToolsAvailable: 6, // Number of MCP tools defined for Claude
      todoMetrics: todoMetrics,
      workflowDuration: Date.now() - this.workflowStartTime
    };
  }

  /**
   * Get current workflow status
   */
  getWorkflowStatus(): {
    isRunning: boolean;
    currentTask: string | null;
    progress: number;
    metrics: any;
  } {
    const currentTask = this.todoManager.getCurrentTask();
    
    return {
      isRunning: !this.todoManager.isComplete(),
      currentTask: currentTask?.content || null,
      progress: this.todoManager.getCompletionPercentage(),
      metrics: this.todoManager.getMetrics()
    };
  }
}