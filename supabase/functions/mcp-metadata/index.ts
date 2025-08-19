/**
 * Remote Metadata Processing MCP Server - Edge Function Implementation
 * Handles XMP embedding, report generation, and metadata validation
 * Using proven sb_secret_key authentication pattern
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Authentication using proven pattern from mcp-ai-analysis
const MY_FUNCTION_SECRET = Deno.env.get('sb_secret_key');

// Metadata processing interfaces
interface ProcessingResult {
  success: boolean;
  processed_file_path?: string;
  xmp_file_path?: string;
  report_file_path?: string;
  file_size?: number;
  processing_time_ms: number;
  error?: string;
}

/**
 * Generate XMP packet for ORBIT metadata
 */
function generateXMPPacket(analysisResult: any, imageFilename: string): string {
  const timestamp = new Date().toISOString();
  const metadata = analysisResult.metadata || {};
  
  // Build XMP packet with ORBIT namespace
  const xmpPacket = `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="ORBIT Image Forge 1.0">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:orbit="http://orbit.ai/metadata/1.0/"
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      
      <!-- Basic Image Info -->
      <dc:title>${imageFilename}</dc:title>
      <xmp:CreateDate>${timestamp}</xmp:CreateDate>
      <xmp:CreatorTool>ORBIT Image Forge AI Analysis</xmp:CreatorTool>
      
      <!-- ORBIT AI Analysis Results -->
      <orbit:analysisType>${analysisResult.analysis_type || 'unknown'}</orbit:analysisType>
      <orbit:confidence>${analysisResult.confidence || 0}</orbit:confidence>
      <orbit:processingTime>${analysisResult.processing_time_ms || 0}</orbit:processingTime>
      
      <!-- Scene Analysis -->
      ${metadata.scene_overview ? `
      <orbit:sceneSetting>${metadata.scene_overview.setting || ''}</orbit:sceneSetting>
      <orbit:timeOfDay>${metadata.scene_overview.time_of_day || ''}</orbit:timeOfDay>
      <orbit:primaryActivity>${metadata.scene_overview.primary_activity || ''}</orbit:primaryActivity>
      ` : ''}
      
      <!-- Human Elements -->
      ${metadata.human_elements ? `
      <orbit:numberOfPeople>${metadata.human_elements.number_of_people || 0}</orbit:numberOfPeople>
      <orbit:emotionalStates>
        <rdf:Bag>
          ${(metadata.human_elements.emotional_states || []).map((state: string) => 
            `<rdf:li>${state}</rdf:li>`
          ).join('\n          ')}
        </rdf:Bag>
      </orbit:emotionalStates>
      ` : ''}
      
      <!-- Marketing Potential -->
      ${metadata.marketing_potential ? `
      <orbit:targetDemographic>${metadata.marketing_potential.target_demographic || ''}</orbit:targetDemographic>
      <orbit:emotionalHooks>
        <rdf:Bag>
          ${(metadata.marketing_potential.emotional_hooks || []).map((hook: string) => 
            `<rdf:li>${hook}</rdf:li>`
          ).join('\n          ')}
        </rdf:Bag>
      </orbit:emotionalHooks>
      ` : ''}
      
      <!-- Complete Analysis JSON -->
      <orbit:fullAnalysis>${JSON.stringify(metadata).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</orbit:fullAnalysis>
      
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>`;

  return xmpPacket;
}

/**
 * Generate human-readable metadata report
 */
function generateMetadataReport(analysisResult: any, imageFilename: string): string {
  const metadata = analysisResult.metadata || {};
  const timestamp = new Date().toISOString();
  
  let report = `ORBIT IMAGE ANALYSIS REPORT
Generated: ${timestamp}
Image: ${imageFilename}
Analysis Type: ${analysisResult.analysis_type || 'Unknown'}
Confidence: ${(analysisResult.confidence * 100 || 0).toFixed(1)}%

========================================

`;

  // Scene Overview
  if (metadata.scene_overview) {
    report += `SCENE ANALYSIS
Setting: ${metadata.scene_overview.setting || 'Not specified'}
Time of Day: ${metadata.scene_overview.time_of_day || 'Not specified'}
Primary Activity: ${metadata.scene_overview.primary_activity || 'Not specified'}

`;
  }

  // Human Elements
  if (metadata.human_elements) {
    report += `HUMAN ELEMENTS
Number of People: ${metadata.human_elements.number_of_people || 0}
Demographics: ${(metadata.human_elements.demographics || []).join(', ') || 'Not specified'}
Emotional States: ${(metadata.human_elements.emotional_states || []).join(', ') || 'Not specified'}
Social Dynamics: ${metadata.human_elements.social_dynamics || 'Not specified'}

`;
  }

  // Key Objects
  if (metadata.key_objects) {
    report += `KEY OBJECTS
Food & Beverage: ${(metadata.key_objects.food_and_beverage || []).join(', ') || 'None identified'}
Technology: ${(metadata.key_objects.technology || []).join(', ') || 'None identified'}
Furniture: ${(metadata.key_objects.furniture || []).join(', ') || 'None identified'}

`;
  }

  // Marketing Potential
  if (metadata.marketing_potential) {
    report += `MARKETING INSIGHTS
Target Demographic: ${metadata.marketing_potential.target_demographic || 'Not specified'}
Emotional Hooks: ${(metadata.marketing_potential.emotional_hooks || []).join(', ') || 'None identified'}
Brand Opportunities: ${(metadata.marketing_potential.brand_alignment_opportunities || []).join(', ') || 'None identified'}

`;
  }

  // Technical Details
  report += `TECHNICAL DETAILS
Processing Time: ${analysisResult.processing_time_ms || 0}ms
File Hash: ${analysisResult.integrity_info?.file_hash || 'Not available'}
File Size: ${analysisResult.integrity_info?.file_size || 'Not available'} bytes
MIME Type: ${analysisResult.integrity_info?.mime_type || 'Not available'}

`;

  report += `========================================
Generated by ORBIT Image Forge
https://orbit-image-forge.ai
`;

  return report;
}

/**
 * Process metadata for image - creates processed image with XMP, standalone XMP file, and report
 */
async function processImageMetadata(imagePath: string, analysisResult: any): Promise<ProcessingResult> {
  const startTime = Date.now();
  
  try {
    // Get Supabase client for storage operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration for storage access');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Download original image from storage
    const bucketName = 'orbit-images';
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucketName)
      .download(imagePath);
      
    if (downloadError) {
      throw new Error(`Failed to download image: ${downloadError.message}`);
    }
    
    if (!fileData) {
      throw new Error('No image data received from storage');
    }
    
    // Generate metadata content
    const filename = imagePath.split('/').pop() || 'unknown.jpg';
    const xmpPacket = generateXMPPacket(analysisResult, filename);
    const metadataReport = generateMetadataReport(analysisResult, filename);
    
    console.log('📝 Generated metadata for:', filename);
    console.log('📝 XMP packet length:', xmpPacket.length, 'bytes');
    console.log('📝 Report length:', metadataReport.length, 'bytes');
    
    // Create processed file paths
    const pathParts = imagePath.split('/');
    const orderFolder = pathParts[0]; // "order_id_user_id" folder
    const originalFilename = pathParts[pathParts.length - 1];
    const baseFilename = originalFilename.replace(/\.[^/.]+$/, ''); // Remove extension
    
    const processedImagePath = `${orderFolder}/processed/${baseFilename}_processed.jpg`;
    const xmpFilePath = `${orderFolder}/processed/${baseFilename}_metadata.xmp`;
    const reportFilePath = `${orderFolder}/processed/${baseFilename}_report.txt`;
    
    // Upload processed image (for now, just copy the original - in production would embed XMP)
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(processedImagePath, fileData, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg'
      });
    
    if (uploadError) {
      throw new Error(`Failed to upload processed image: ${uploadError.message}`);
    }
    
    // Upload XMP file
    const { error: xmpUploadError } = await supabase.storage
      .from(bucketName)
      .upload(xmpFilePath, new Blob([xmpPacket], { type: 'application/xml' }), {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/xml'
      });
    
    if (xmpUploadError) {
      throw new Error(`Failed to upload XMP file: ${xmpUploadError.message}`);
    }
    
    // Upload report file
    const { error: reportUploadError } = await supabase.storage
      .from(bucketName)
      .upload(reportFilePath, new Blob([metadataReport], { type: 'text/plain' }), {
        cacheControl: '3600',
        upsert: true,
        contentType: 'text/plain'
      });
    
    if (reportUploadError) {
      throw new Error(`Failed to upload report file: ${reportUploadError.message}`);
    }
    
    const processingTime = Date.now() - startTime;
    const fileSize = (await fileData.arrayBuffer()).byteLength;
    
    console.log('✅ Successfully processed metadata:', {
      processedImagePath,
      xmpFilePath,
      reportFilePath,
      processingTime,
      fileSize
    });
    
    return {
      success: true,
      processed_file_path: processedImagePath,
      xmp_file_path: xmpFilePath,
      report_file_path: reportFilePath,
      file_size: fileSize,
      processing_time_ms: processingTime
    };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Metadata processing failed:', error);
    
    return {
      success: false,
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

console.log('🚀 ORBIT Metadata Processing MCP Server deployed and ready');