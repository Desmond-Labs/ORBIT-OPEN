/**
 * Remote Metadata Processing MCP Server - Enhanced Modular Implementation
 * Professional XMP embedding, report generation, and metadata validation
 * Using modular architecture with ORBIT enhanced processing capabilities
 * 
 * Features:
 * - Real XMP embedding into JPEG files (not just file copying)
 * - Professional report generation with rich formatting
 * - Multiple output formats (processed images, thumbnails, reports)
 * - Batch storage operations with error handling
 * - Enhanced ORBIT schema compliance
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Import modular architecture components
import { ORBITXMPGenerator, createXMPGenerator, type ORBITMetadata } from '../_shared/metadata/xmp-generator.ts';
import { ORBITImageProcessor, createImageProcessor, type ProcessedImageResult } from '../_shared/metadata/image-processor.ts';
import { ORBITReportGenerator, createReportGenerator, type ReportContent, type AnalysisMetadata } from '../_shared/metadata/report-generator.ts';
import { ORBITStorageManager, createStorageManager, type BatchUploadResult } from '../_shared/metadata/storage-manager.ts';

// Authentication using proven pattern from mcp-ai-analysis
const MY_FUNCTION_SECRET = Deno.env.get('sb_secret_key');

// Enhanced metadata processing interfaces
interface ProcessingResult {
  success: boolean;
  processed_file_path?: string;
  xmp_file_path?: string;
  report_file_path?: string;
  technical_summary_path?: string;
  marketing_brief_path?: string;
  thumbnail_paths?: string[];
  web_optimized_path?: string;
  total_files_uploaded: number;
  file_size?: number;
  processing_time_ms: number;
  upload_results?: BatchUploadResult;
  error?: string;
}

/**
 * Initialize modular components for enhanced processing
 */
function initializeProcessingModules() {
  const xmpGenerator = createXMPGenerator({
    includeFullAnalysis: true,
    includeTimestamp: true,
    compressionLevel: 'standard'
  });

  const imageProcessor = createImageProcessor({
    enableThumbnails: true,
    thumbnailSizes: [150, 300, 600],
    webOptimized: true,
    compressionQuality: 85,
    outputFormats: ['jpg']
  });

  const reportGenerator = createReportGenerator({
    includeRawData: false,
    includeTechnicalDetails: true,
    includeMarketingInsights: true,
    format: 'text',
    templateStyle: 'professional'
  });

  return { xmpGenerator, imageProcessor, reportGenerator };
}

/**
 * Enhanced metadata processing with modular architecture
 * Features real XMP embedding, professional reports, and batch uploads
 */
async function processImageMetadata(imagePath: string, analysisResult: any): Promise<ProcessingResult> {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Starting enhanced metadata processing for:', imagePath);
    
    // Initialize modular components
    const { xmpGenerator, imageProcessor, reportGenerator } = initializeProcessingModules();
    
    // Get Supabase configuration
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration for storage access');
    }
    
    // Initialize storage manager
    const storageManager = createStorageManager({
      supabaseUrl,
      supabaseKey,
      enableSignedUrls: true,
      enablePublicUrls: false
    });
    
    console.log('📦 Storage manager initialized');
    
    // Download original image from storage
    const originalImageData = await storageManager.downloadFile(imagePath);
    if (!originalImageData) {
      throw new Error('Failed to download original image from storage');
    }
    
    console.log('📥 Downloaded original image:', {
      path: imagePath,
      size: originalImageData.length
    });
    
    // Prepare enhanced metadata structure
    const filename = imagePath.split('/').pop() || 'unknown.jpg';
    const pathParts = imagePath.split('/');
    const orderFolder = pathParts[0];
    const baseFilename = filename.replace(/\.[^/.]+$/, '');
    
    // Transform analysis result to ORBIT metadata format
    const orbitMetadata: ORBITMetadata = {
      analysis_type: analysisResult.analysis_type || 'lifestyle',
      confidence: analysisResult.confidence || 0,
      processing_time_ms: analysisResult.processing_time_ms || 0,
      metadata: analysisResult.metadata || analysisResult,
      integrity_info: {
        file_hash: 'calculated_on_processing',
        file_size: originalImageData.length,
        mime_type: 'image/jpeg'
      }
    };
    
    // Transform to report format
    const reportMetadata: AnalysisMetadata = {
      analysis_type: orbitMetadata.analysis_type,
      confidence: orbitMetadata.confidence,
      processing_time_ms: orbitMetadata.processing_time_ms,
      metadata: orbitMetadata.metadata,
      integrity_info: orbitMetadata.integrity_info
    };
    
    console.log('🔄 Generating enhanced XMP packet...');
    
    // STEP 1: Generate enhanced XMP packet with ORBIT schema
    const xmpPacket = xmpGenerator.generateXMPPacket(orbitMetadata, filename);
    console.log('✅ Enhanced XMP packet generated:', {
      length: xmpPacket.length,
      analysisType: orbitMetadata.analysis_type,
      confidence: orbitMetadata.confidence
    });
    
    // STEP 2: Embed XMP into image with real processing
    console.log('🔄 Embedding XMP metadata into image...');
    const imageProcessingResult: ProcessedImageResult = await imageProcessor.embedXMPIntoImage(originalImageData, xmpPacket);
    
    if (!imageProcessingResult.success) {
      throw new Error(`XMP embedding failed: ${imageProcessingResult.error}`);
    }
    
    console.log('✅ XMP embedding completed:', {
      originalSize: originalImageData.length,
      processedSize: imageProcessingResult.processed_image_size,
      thumbnailCount: Object.keys(imageProcessingResult.thumbnail_data || {}).length,
      hasWebOptimized: !!imageProcessingResult.web_optimized_data,
      processingTime: imageProcessingResult.processing_time_ms
    });
    
    // STEP 3: Generate comprehensive reports
    console.log('🔄 Generating professional reports...');
    const reportContent: ReportContent = reportGenerator.generateComprehensiveReport(reportMetadata, filename);
    
    console.log('✅ Professional reports generated:', {
      mainReportSize: reportContent.metadata_report.length,
      hasTechnicalSummary: !!reportContent.technical_summary,
      hasMarketingBrief: !!reportContent.marketing_brief,
      generationTime: reportContent.generation_time_ms
    });
    
    // STEP 4: Batch upload all generated files
    console.log('🔄 Uploading processed files to storage...');
    const uploadResults: BatchUploadResult = await storageManager.uploadMetadataResults(
      orderFolder,
      baseFilename,
      {
        processedImage: imageProcessingResult.processed_image_data,
        thumbnails: imageProcessingResult.thumbnail_data,
        webOptimized: imageProcessingResult.web_optimized_data,
        xmpPacket: xmpPacket,
        metadataReport: reportContent.metadata_report,
        technicalSummary: reportContent.technical_summary,
        marketingBrief: reportContent.marketing_brief,
        rawDataExport: reportContent.raw_data_export
      }
    );
    
    if (!uploadResults.success) {
      throw new Error(`Batch upload failed: ${uploadResults.error}`);
    }
    
    console.log('✅ Batch upload completed:', {
      totalFiles: uploadResults.uploaded_files.length,
      failedUploads: uploadResults.failed_uploads.length,
      totalSize: uploadResults.total_size,
      uploadTime: uploadResults.upload_time_ms
    });
    
    // Extract file paths from upload results
    const filePaths = {
      processed: uploadResults.uploaded_files.find(f => f.path.includes('_processed.jpg'))?.path,
      xmp: uploadResults.uploaded_files.find(f => f.path.includes('_metadata.xmp'))?.path,
      report: uploadResults.uploaded_files.find(f => f.path.includes('_report.txt'))?.path,
      technical: uploadResults.uploaded_files.find(f => f.path.includes('_technical.txt'))?.path,
      marketing: uploadResults.uploaded_files.find(f => f.path.includes('_marketing.txt'))?.path,
      thumbnails: uploadResults.uploaded_files.filter(f => f.path.includes('/thumbnails/')).map(f => f.path),
      webOptimized: uploadResults.uploaded_files.find(f => f.path.includes('_web.jpg'))?.path
    };
    
    const totalProcessingTime = Date.now() - startTime;
    
    console.log('🎉 Enhanced metadata processing completed successfully:', {
      totalProcessingTime,
      imageProcessingTime: imageProcessingResult.processing_time_ms,
      reportGenerationTime: reportContent.generation_time_ms,
      uploadTime: uploadResults.upload_time_ms,
      totalFilesGenerated: uploadResults.uploaded_files.length
    });
    
    return {
      success: true,
      processed_file_path: filePaths.processed,
      xmp_file_path: filePaths.xmp,
      report_file_path: filePaths.report,
      technical_summary_path: filePaths.technical,
      marketing_brief_path: filePaths.marketing,
      thumbnail_paths: filePaths.thumbnails,
      web_optimized_path: filePaths.webOptimized,
      total_files_uploaded: uploadResults.uploaded_files.length,
      file_size: uploadResults.total_size,
      processing_time_ms: totalProcessingTime,
      upload_results: uploadResults
    };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Enhanced metadata processing failed:', error);
    console.error('❌ Error stack:', error.stack);
    
    return {
      success: false,
      total_files_uploaded: 0,
      processing_time_ms: processingTime,
      error: error.message
    };
  }
}

serve(async (req) => {
  // Security Check: Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }

  try {
    // Authentication using proven pattern
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const providedKey = authHeader.replace('Bearer ', '');
    if (providedKey !== MY_FUNCTION_SECRET) {
      throw new Error('Invalid authorization key');
    }

    console.log('✅ MCP Metadata Server: Request authorized');

    // Parse request body
    const requestBody = await req.json();
    const { tool_name, parameters } = requestBody;
    
    if (!tool_name) {
      throw new Error('Missing tool_name in request');
    }
    
    let result: ProcessingResult;
    
    // Route to appropriate MCP tool
    switch (tool_name) {
      case 'process_image_metadata':
        const { image_path, analysis_result } = parameters;
        if (!image_path || !analysis_result) {
          throw new Error('Missing required parameters: image_path, analysis_result');
        }
        result = await processImageMetadata(image_path, analysis_result);
        break;
        
      default:
        throw new Error(`Unknown tool: ${tool_name}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error('❌ MCP Metadata Server error:', err);
    return new Response(JSON.stringify({ 
      success: false,
      error: err.message,
      processing_time_ms: 0
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 401,
    });
  }
});

console.log('🚀 ORBIT Enhanced Metadata Processing MCP Server deployed and ready');
console.log('✨ Features: Real XMP Embedding • Professional Reports • Modular Architecture');
console.log('🔧 Modules: XMP Generator • Image Processor • Report Generator • Storage Manager');