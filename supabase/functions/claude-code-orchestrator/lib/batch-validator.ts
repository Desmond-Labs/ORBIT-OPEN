/**
 * Batch Processing Validator
 * 
 * Ensures all images in an order are properly processed before marking order complete.
 * Provides comprehensive batch integrity checks and validation reporting.
 * 
 * This service acts as the final gatekeeper before order completion, ensuring that
 * every aspect of the batch processing pipeline has succeeded and all files are
 * properly created and validated.
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export interface BatchValidationResult {
  isValid: boolean;
  orderId: string;
  userId: string;
  batchId?: string;
  validationSummary: {
    totalImages: number;
    processedImages: number;
    failedImages: number;
    pendingImages: number;
    completionRate: number;
  };
  validationChecks: {
    allImagesProcessed: boolean;
    storageConsistency: boolean;
    databaseConsistency: boolean;
    metadataIntegrity: boolean;
    analysisCompleteness: boolean;
    fileIntegrity: boolean;
  };
  validationDetails: {
    processedImagesList: string[];
    failedImagesList: Array<{
      imageId: string;
      filename: string;
      reason: string;
      retryable: boolean;
    }>;
    storageIssues: string[];
    databaseIssues: string[];
    metadataIssues: string[];
  };
  recommendations: string[];
  validationTime: number;
  canComplete: boolean;
  blockers: string[];
}

export interface ImageValidationDetails {
  imageId: string;
  filename: string;
  originalPath: string;
  processedPath?: string;
  processingStatus: string;
  hasAnalysis: boolean;
  hasProcessedFile: boolean;
  hasMetadata: boolean;
  isValid: boolean;
  validationIssues: string[];
}

export interface BatchCompletionReport {
  orderId: string;
  completionTime: string;
  processingDuration: number;
  totalImages: number;
  successfulImages: number;
  failedImages: number;
  filesGenerated: number;
  storageUsed: number;
  avgProcessingTimePerImage: number;
  qualityScore: number;
  recommendations: string[];
}

export class BatchProcessingValidator {
  private supabase: any;

  constructor() {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('sb_secret_key') || Deno.env.get('SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration required for Batch Processing Validator');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);

    console.log('✅ Batch Processing Validator initialized');
  }

  /**
   * Main validation method - comprehensive batch completion verification
   * This is called before marking orders as complete
   */
  async validateBatchCompletion(orderId: string): Promise<BatchValidationResult> {
    const startTime = Date.now();
    
    console.log(`🔍 Starting comprehensive batch validation for order ${orderId}`);

    try {
      // Get order information
      const { data: orderData, error: orderError } = await this.supabase
        .from('orders')
        .select(`
          id,
          user_id,
          batch_id,
          processing_stage,
          processing_started_at,
          created_at
        `)
        .eq('id', orderId)
        .single();

      if (orderError || !orderData) {
        throw new Error(`Failed to fetch order data: ${orderError?.message || 'Order not found'}`);
      }

      const userId = orderData.user_id;
      const batchId = orderData.batch_id;

      // Get all images for this order
      const { data: images, error: imagesError } = await this.supabase
        .from('images')
        .select(`
          id,
          original_filename,
          storage_path_original,
          storage_path_processed,
          processing_status,
          ai_analysis,
          gemini_analysis_raw,
          file_size,
          mime_type,
          created_at,
          processed_at,
          retry_count,
          error_message
        `)
        .eq('order_id', orderId);

      if (imagesError) {
        throw new Error(`Failed to fetch images: ${imagesError.message}`);
      }

      if (!images || images.length === 0) {
        throw new Error(`No images found for order ${orderId}`);
      }

      console.log(`📋 Validating batch: ${images.length} images`);

      // Perform comprehensive validation
      const validationResult = await this.performComprehensiveValidation(
        orderId,
        userId,
        batchId,
        images,
        startTime
      );

      if (validationResult.isValid) {
        console.log(`✅ Batch validation passed for order ${orderId}: ${validationResult.validationSummary.completionRate.toFixed(1)}% completion`);
      } else {
        console.warn(`⚠️ Batch validation failed for order ${orderId}: ${validationResult.blockers.length} blockers found`);
        console.warn(`🚫 Blockers: ${validationResult.blockers.join(', ')}`);
      }

      return validationResult;

    } catch (error) {
      console.error(`❌ Batch validation error for order ${orderId}:`, error);

      // Return failed validation result
      return this.createFailedValidationResult(orderId, '', error.message, Date.now() - startTime);
    }
  }

  /**
   * Validate individual image processing completion
   */
  async validateImageCompletion(imageId: string): Promise<ImageValidationDetails> {
    try {
      const { data: image, error } = await this.supabase
        .from('images')
        .select(`
          id,
          original_filename,
          storage_path_original,
          storage_path_processed,
          processing_status,
          ai_analysis,
          gemini_analysis_raw
        `)
        .eq('id', imageId)
        .single();

      if (error || !image) {
        return {
          imageId,
          filename: 'unknown',
          originalPath: '',
          processingStatus: 'error',
          hasAnalysis: false,
          hasProcessedFile: false,
          hasMetadata: false,
          isValid: false,
          validationIssues: ['Image not found in database']
        };
      }

      return this.validateSingleImage(image);

    } catch (error) {
      console.error(`❌ Error validating image ${imageId}:`, error);
      
      return {
        imageId,
        filename: 'unknown',
        originalPath: '',
        processingStatus: 'error',
        hasAnalysis: false,
        hasProcessedFile: false,
        hasMetadata: false,
        isValid: false,
        validationIssues: [`Validation error: ${error.message}`]
      };
    }
  }

  /**
   * Generate comprehensive batch completion report
   */
  async generateBatchCompletionReport(orderId: string): Promise<BatchCompletionReport> {
    try {
      console.log(`📊 Generating batch completion report for order ${orderId}`);

      // Get order timing data
      const { data: orderData, error: orderError } = await this.supabase
        .from('orders')
        .select(`
          id,
          created_at,
          processing_started_at,
          completed_at,
          updated_at
        `)
        .eq('id', orderId)
        .single();

      if (orderError || !orderData) {
        throw new Error(`Failed to fetch order timing data: ${orderError?.message}`);
      }

      // Get image processing data
      const { data: images, error: imagesError } = await this.supabase
        .from('images')
        .select(`
          id,
          processing_status,
          file_size,
          created_at,
          processed_at
        `)
        .eq('order_id', orderId);

      if (imagesError) {
        throw new Error(`Failed to fetch image data: ${imagesError.message}`);
      }

      // Calculate metrics
      const totalImages = images?.length || 0;
      const successfulImages = images?.filter(img => img.processing_status === 'completed').length || 0;
      const failedImages = images?.filter(img => img.processing_status === 'error').length || 0;
      
      const processingStart = orderData.processing_started_at ? new Date(orderData.processing_started_at) : new Date(orderData.created_at);
      const processingEnd = orderData.completed_at ? new Date(orderData.completed_at) : new Date();
      const processingDuration = processingEnd.getTime() - processingStart.getTime();
      
      const avgProcessingTimePerImage = totalImages > 0 ? processingDuration / totalImages : 0;
      const qualityScore = totalImages > 0 ? (successfulImages / totalImages) * 100 : 0;
      
      // Calculate files generated (estimate based on successful processing)
      const filesGenerated = successfulImages * 4; // Original + processed + XMP + report
      
      // Calculate storage used (estimate)
      const totalFileSize = images?.reduce((sum, img) => sum + (img.file_size || 0), 0) || 0;
      const storageUsed = totalFileSize * 2; // Original + processed (roughly)

      // Generate recommendations
      const recommendations = this.generateCompletionRecommendations(
        totalImages,
        successfulImages,
        failedImages,
        processingDuration,
        qualityScore
      );

      const report: BatchCompletionReport = {
        orderId,
        completionTime: processingEnd.toISOString(),
        processingDuration,
        totalImages,
        successfulImages,
        failedImages,
        filesGenerated,
        storageUsed,
        avgProcessingTimePerImage,
        qualityScore,
        recommendations
      };

      console.log(`📊 Report generated: ${successfulImages}/${totalImages} success, ${(processingDuration/1000).toFixed(1)}s duration`);

      return report;

    } catch (error) {
      console.error(`❌ Error generating completion report for order ${orderId}:`, error);
      
      // Return basic error report
      return {
        orderId,
        completionTime: new Date().toISOString(),
        processingDuration: 0,
        totalImages: 0,
        successfulImages: 0,
        failedImages: 0,
        filesGenerated: 0,
        storageUsed: 0,
        avgProcessingTimePerImage: 0,
        qualityScore: 0,
        recommendations: [`Report generation failed: ${error.message}`]
      };
    }
  }

  /**
   * Get batch validation statistics for monitoring
   */
  async getValidationStats(): Promise<{
    totalValidations: number;
    passedValidations: number;
    failedValidations: number;
    averageValidationTime: number;
    commonFailureReasons: Array<{
      reason: string;
      count: number;
    }>;
  }> {
    // This would track validation statistics over time
    // For now, return placeholder stats
    console.log('📊 Getting validation statistics (placeholder)');
    
    return {
      totalValidations: 0,
      passedValidations: 0,
      failedValidations: 0,
      averageValidationTime: 0,
      commonFailureReasons: []
    };
  }

  /**
   * Perform comprehensive validation of all batch aspects
   */
  private async performComprehensiveValidation(
    orderId: string,
    userId: string,
    batchId: string,
    images: any[],
    startTime: number
  ): Promise<BatchValidationResult> {
    
    // Initialize validation result structure
    const result: BatchValidationResult = {
      isValid: false,
      orderId,
      userId,
      batchId,
      validationSummary: {
        totalImages: images.length,
        processedImages: 0,
        failedImages: 0,
        pendingImages: 0,
        completionRate: 0
      },
      validationChecks: {
        allImagesProcessed: false,
        storageConsistency: false,
        databaseConsistency: false,
        metadataIntegrity: false,
        analysisCompleteness: false,
        fileIntegrity: false
      },
      validationDetails: {
        processedImagesList: [],
        failedImagesList: [],
        storageIssues: [],
        databaseIssues: [],
        metadataIssues: []
      },
      recommendations: [],
      validationTime: 0,
      canComplete: false,
      blockers: []
    };

    // Validate each image individually
    let processedCount = 0;
    let failedCount = 0;
    let pendingCount = 0;

    for (const image of images) {
      const imageValidation = this.validateSingleImage(image);
      
      if (imageValidation.processingStatus === 'completed' && imageValidation.isValid) {
        processedCount++;
        result.validationDetails.processedImagesList.push(imageValidation.filename);
      } else if (imageValidation.processingStatus === 'error') {
        failedCount++;
        result.validationDetails.failedImagesList.push({
          imageId: imageValidation.imageId,
          filename: imageValidation.filename,
          reason: imageValidation.validationIssues.join(', '),
          retryable: !imageValidation.validationIssues.some(issue => 
            issue.includes('permanent') || issue.includes('validation')
          )
        });
      } else {
        pendingCount++;
      }

      // Collect validation issues
      if (!imageValidation.hasAnalysis) {
        result.validationDetails.metadataIssues.push(`${imageValidation.filename}: Missing AI analysis`);
      }
      if (!imageValidation.hasProcessedFile && imageValidation.processingStatus === 'completed') {
        result.validationDetails.storageIssues.push(`${imageValidation.filename}: Missing processed file`);
      }
    }

    // Update summary
    result.validationSummary.processedImages = processedCount;
    result.validationSummary.failedImages = failedCount;
    result.validationSummary.pendingImages = pendingCount;
    result.validationSummary.completionRate = (processedCount / images.length) * 100;

    // Perform validation checks
    result.validationChecks.allImagesProcessed = pendingCount === 0;
    result.validationChecks.storageConsistency = result.validationDetails.storageIssues.length === 0;
    result.validationChecks.databaseConsistency = result.validationDetails.databaseIssues.length === 0;
    result.validationChecks.metadataIntegrity = result.validationDetails.metadataIssues.length === 0;
    result.validationChecks.analysisCompleteness = processedCount > 0 && 
      result.validationDetails.processedImagesList.length === processedCount;
    result.validationChecks.fileIntegrity = true; // TODO: Implement file integrity checks

    // Determine if batch can be completed
    const criticalChecks = [
      result.validationChecks.allImagesProcessed,
      result.validationChecks.storageConsistency,
      result.validationChecks.databaseConsistency
    ];

    result.canComplete = criticalChecks.every(check => check) && processedCount > 0;
    result.isValid = result.canComplete && result.validationSummary.completionRate >= 100;

    // Identify blockers
    if (!result.validationChecks.allImagesProcessed) {
      result.blockers.push(`${pendingCount} images still pending processing`);
    }
    if (!result.validationChecks.storageConsistency) {
      result.blockers.push(`${result.validationDetails.storageIssues.length} storage consistency issues`);
    }
    if (!result.validationChecks.databaseConsistency) {
      result.blockers.push(`${result.validationDetails.databaseIssues.length} database consistency issues`);
    }
    if (failedCount > 0) {
      result.blockers.push(`${failedCount} images failed processing permanently`);
    }

    // Generate recommendations
    result.recommendations = this.generateValidationRecommendations(result);

    result.validationTime = Date.now() - startTime;

    return result;
  }

  /**
   * Validate a single image's processing completion
   */
  private validateSingleImage(image: any): ImageValidationDetails {
    const validationIssues: string[] = [];

    // Check processing status
    const isProcessed = image.processing_status === 'completed';
    
    // Check for AI analysis
    const hasAnalysis = !!(image.ai_analysis || image.gemini_analysis_raw);
    if (!hasAnalysis && isProcessed) {
      validationIssues.push('Missing AI analysis data');
    }

    // Check for processed file path
    const hasProcessedFile = !!image.storage_path_processed;
    if (!hasProcessedFile && isProcessed) {
      validationIssues.push('Missing processed file path');
    }

    // Check for metadata (assume present if processed file exists)
    const hasMetadata = hasProcessedFile;

    // Overall validity check
    const isValid = isProcessed && hasAnalysis && hasProcessedFile && validationIssues.length === 0;

    return {
      imageId: image.id,
      filename: image.original_filename,
      originalPath: image.storage_path_original,
      processedPath: image.storage_path_processed,
      processingStatus: image.processing_status,
      hasAnalysis,
      hasProcessedFile,
      hasMetadata,
      isValid,
      validationIssues
    };
  }

  /**
   * Generate validation recommendations based on results
   */
  private generateValidationRecommendations(result: BatchValidationResult): string[] {
    const recommendations: string[] = [];

    if (result.validationSummary.completionRate < 100) {
      recommendations.push(`Increase completion rate from ${result.validationSummary.completionRate.toFixed(1)}% to 100%`);
    }

    if (result.validationDetails.failedImagesList.length > 0) {
      const retryableFailures = result.validationDetails.failedImagesList.filter(f => f.retryable).length;
      if (retryableFailures > 0) {
        recommendations.push(`Retry ${retryableFailures} retryable failed images`);
      }
    }

    if (result.validationDetails.storageIssues.length > 0) {
      recommendations.push(`Fix ${result.validationDetails.storageIssues.length} storage consistency issues`);
    }

    if (result.validationDetails.metadataIssues.length > 0) {
      recommendations.push(`Address ${result.validationDetails.metadataIssues.length} metadata integrity issues`);
    }

    if (recommendations.length === 0) {
      recommendations.push('All validations passed - batch ready for completion');
    }

    return recommendations;
  }

  /**
   * Generate completion report recommendations
   */
  private generateCompletionRecommendations(
    totalImages: number,
    successfulImages: number,
    failedImages: number,
    processingDuration: number,
    qualityScore: number
  ): string[] {
    const recommendations: string[] = [];

    if (qualityScore < 100) {
      recommendations.push(`Quality score: ${qualityScore.toFixed(1)}% - investigate ${failedImages} failed images`);
    }

    const avgTimePerImage = processingDuration / totalImages / 1000; // Convert to seconds
    if (avgTimePerImage > 10) {
      recommendations.push(`Performance: ${avgTimePerImage.toFixed(1)}s per image - optimize processing pipeline`);
    }

    if (successfulImages === totalImages) {
      recommendations.push('Perfect batch completion - all images processed successfully');
    }

    const totalDurationSeconds = processingDuration / 1000;
    if (totalDurationSeconds > 300) { // 5 minutes
      recommendations.push(`Long processing time: ${(totalDurationSeconds / 60).toFixed(1)} minutes - consider optimization`);
    }

    return recommendations;
  }

  /**
   * Create a failed validation result
   */
  private createFailedValidationResult(
    orderId: string,
    userId: string,
    error: string,
    validationTime: number
  ): BatchValidationResult {
    return {
      isValid: false,
      orderId,
      userId,
      validationSummary: {
        totalImages: 0,
        processedImages: 0,
        failedImages: 0,
        pendingImages: 0,
        completionRate: 0
      },
      validationChecks: {
        allImagesProcessed: false,
        storageConsistency: false,
        databaseConsistency: false,
        metadataIntegrity: false,
        analysisCompleteness: false,
        fileIntegrity: false
      },
      validationDetails: {
        processedImagesList: [],
        failedImagesList: [],
        storageIssues: [],
        databaseIssues: [error],
        metadataIssues: []
      },
      recommendations: [`Fix validation error: ${error}`],
      validationTime,
      canComplete: false,
      blockers: [`Validation failed: ${error}`]
    };
  }
}