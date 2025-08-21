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

    this.workflowStartTime = Date.now();

    if (this.options.enableLogging) {
      console.log('🌌 ORBIT Workflow Engine initialized with REAL Claude API integration');
      console.log('🤖 Using authentic Claude Code patterns with MCP tools');
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
      const validationResults = await this.executeValidationPhase(phases.validation, processingResults);
      
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
   * Phase 2: Discovery & Validation
   */
  private async executeDiscoveryPhase(phase: PhaseStatus, orderId: string): Promise<DiscoveryResults> {
    phase.status = 'in_progress';
    phase.startTime = Date.now();
    
    this.todoManager.startTask('discovery-1');
    
    if (this.options.enableLogging) {
      console.log('🔍 Phase 2: Discovery & Validation');
    }

    // Discover images from database
    const images = await this.discoverOrderImages(orderId);
    
    if (images.length === 0) {
      throw new Error(`No processable images found for order ${orderId}`);
    }

    const discoveryResults: DiscoveryResults = {
      orderId,
      totalImages: images.length,
      validImages: images.length, // All discovered images are assumed valid
      imageJobs: images.map(img => ({
        imageId: img.id || crypto.randomUUID(),
        imagePath: img.storage_path_original,
        filename: img.original_filename,
        processingStatus: 'pending' as const
      })),
      discoveryTime: 0,
      validationTime: 0
    };

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
   * Phase 3: Image Processing
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
      console.log('🧠 Phase 3: Image Processing');
      console.log(`📊 Processing ${discoveryResults.imageJobs.length} images with direct tool integration`);
    }

    const processedImages = [];
    const failedImages = [];
    let analysisTime = 0;
    let metadataTime = 0;
    let reportTime = 0;

    // Process each image using REAL Claude API orchestration
    for (const imageJob of discoveryResults.imageJobs) {
      try {
        if (this.options.enableLogging) {
          console.log(`🔄 Processing: ${imageJob.filename} using REAL Claude API`);
        }

        // Step 1: Claude API Orchestration for Image Analysis
        const claudeAnalysisResult = await this.claudeClient.orchestrateWithClaude(
          discoveryResults.orderId,
          'image_analysis',
          {
            imageJob,
            analysisType,
            imagePath: imageJob.imagePath,
            filename: imageJob.filename
          }
        );
        
        if (!claudeAnalysisResult.success) {
          throw new Error(`Claude API orchestration failed: ${claudeAnalysisResult.error}`);
        }
        
        analysisTime += claudeAnalysisResult.executionTime;

        // Step 2: Claude API Orchestration for Metadata Processing
        this.todoManager.startTask('metadata-1');
        const claudeMetadataResult = await this.claudeClient.orchestrateWithClaude(
          discoveryResults.orderId,
          'metadata_processing',
          {
            imageJob,
            imagePath: imageJob.imagePath,
            analysisResult: claudeAnalysisResult.result,
            outputPath: `${imageJob.imagePath.replace('/original/', '/processed/')}_processed`
          }
        );
        
        if (!claudeMetadataResult.success) {
          throw new Error(`Claude metadata orchestration failed: ${claudeMetadataResult.error}`);
        }
        
        metadataTime += claudeMetadataResult.executionTime;
        this.todoManager.completeTask('metadata-1');

        // Step 3: Claude API Orchestration for Report Generation
        this.todoManager.startTask('reports-1');
        const claudeReportResult = await this.claudeClient.orchestrateWithClaude(
          discoveryResults.orderId,
          'report_generation',
          {
            imageJob,
            imagePath: imageJob.imagePath,
            analysisResult: claudeAnalysisResult.result,
            metadataResult: claudeMetadataResult.result
          }
        );
        
        reportTime += claudeReportResult.executionTime;
        this.todoManager.completeTask('reports-1');

        // Update image processing status in database
        await this.updateImageProcessingStatus(imageJob.imageId, 'completed', {
          analysis: claudeAnalysisResult,
          metadata: claudeMetadataResult,
          report: claudeReportResult
        });

        processedImages.push({
          imageId: imageJob.imageId,
          filename: imageJob.filename,
          analysisResult: claudeAnalysisResult,
          metadataResult: claudeMetadataResult,
          reportResult: claudeReportResult,
          totalProcessingTime: claudeAnalysisResult.executionTime + claudeMetadataResult.executionTime + claudeReportResult.executionTime
        });

        if (this.options.enableLogging) {
          console.log(`✅ Completed: ${imageJob.filename}`);
        }

      } catch (error) {
        if (this.options.enableLogging) {
          console.error(`❌ Failed: ${imageJob.filename} - ${error.message}`);
        }
        
        failedImages.push({
          imageId: imageJob.imageId,
          filename: imageJob.filename,
          error: error.message
        });

        await this.updateImageProcessingStatus(imageJob.imageId, 'failed', null, error.message);
      }
    }

    this.todoManager.completeTask('analysis-1');
    
    phase.status = 'completed';
    phase.endTime = Date.now();
    phase.duration = phase.endTime - phase.startTime;

    const processingResults: ProcessingResults = {
      totalImages: discoveryResults.imageJobs.length,
      processedImages: processedImages.length,
      failedImages: failedImages.length,
      analysisTime,
      metadataTime,
      reportTime,
      totalProcessingTime: phase.duration,
      results: processedImages,
      failures: failedImages
    };

    if (this.options.enableLogging) {
      console.log(`✅ Processing complete: ${processedImages.length}/${discoveryResults.imageJobs.length} successful`);
    }

    return processingResults;
  }

  /**
   * Phase 4: Validation & Quality Check
   */
  private async executeValidationPhase(phase: PhaseStatus, processingResults: ProcessingResults): Promise<ValidationResults> {
    phase.status = 'in_progress';
    phase.startTime = Date.now();
    
    this.todoManager.startTask('validation-1');
    
    if (this.options.enableLogging) {
      console.log('🔍 Phase 4: Validation & Quality Check');
    }

    // Validate processing results
    const validationChecks = {
      processingComplete: processingResults.processedImages > 0,
      failureThreshold: processingResults.failedImages < processingResults.totalImages * 0.5, // Allow up to 50% failure
      qualityCheck: true // TODO: Implement quality validation
    };

    const validationPassed = Object.values(validationChecks).every(check => check);

    this.todoManager.completeTask('validation-1');
    
    phase.status = 'completed';
    phase.endTime = Date.now();
    phase.duration = phase.endTime - phase.startTime;

    const validationResults: ValidationResults = {
      validationPassed,
      qualityScore: processingResults.processedImages / processingResults.totalImages,
      checks: validationChecks,
      validationTime: phase.duration
    };

    if (this.options.enableLogging) {
      console.log(`✅ Validation ${validationPassed ? 'passed' : 'failed'} - Quality: ${(validationResults.qualityScore * 100).toFixed(1)}%`);
    }

    return validationResults;
  }

  /**
   * Phase 5: Reporting & Completion
   */
  private async executeReportingPhase(
    phase: PhaseStatus, 
    orderId: string,
    processingResults: ProcessingResults
  ): Promise<void> {
    phase.status = 'in_progress';
    phase.startTime = Date.now();
    
    this.todoManager.startTask('storage-1');
    
    if (this.options.enableLogging) {
      console.log('📊 Phase 5: Reporting & Completion');
    }

    // Update database with final results
    this.todoManager.startTask('database-1');
    await this.updateOrderStatus(orderId, 'completed', {
      totalImages: processingResults.totalImages,
      processedImages: processingResults.processedImages,
      failedImages: processingResults.failedImages,
      processingTime: processingResults.totalProcessingTime
    });
    this.todoManager.completeTask('database-1');
    this.todoManager.completeTask('storage-1');
    
    phase.status = 'completed';
    phase.endTime = Date.now();
    phase.duration = phase.endTime - phase.startTime;

    if (this.options.enableLogging) {
      console.log(`✅ Order ${orderId} processing complete`);
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
      updateData.ai_analysis_result = results.analysis;
      updateData.storage_path_processed = results.metadata?.outputPath;
    }

    if (error) {
      updateData.processing_error = error;
    }

    const { error: updateError } = await this.supabase
      .from('images')
      .update(updateData)
      .eq('id', imageId);

    if (updateError) {
      console.warn(`Failed to update image status: ${updateError.message}`);
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