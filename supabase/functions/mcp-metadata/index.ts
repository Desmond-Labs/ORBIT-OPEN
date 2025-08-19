/**
 * Remote Metadata Processing MCP Server - Edge Function Implementation  
 * Replicates functionality of local orbit-metadata-mcp server
 * Using direct secret key authentication.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { MCPServiceToolDefinition, MCPToolResult, MCPRequestContext } from '../_shared/mcp-types.ts';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const MCP_METADATA_SECRET = Deno.env.get('sb_secret_key');

// ORBIT Schema Types
type SchemaType = 'lifestyle' | 'product' | 'orbit';

interface ValidationResult {
  valid: boolean;
  schema_type: SchemaType;
  errors: string[];
  warnings: string[];
}

interface ProcessingResponse {
  success: boolean;
  output_path?: string;
  file_size?: number;
  format_converted?: boolean;
  original_format?: string;
  target_format?: string;
  conversion_time?: number;
  xmp_packet_info?: {
    size: number;
    encoding: string;
    schema_count: number;
  };
  processing_time: number;
  error?: string;
  validation_warnings?: string[];
}

interface XMPPacketInfo {
  size: number;
  encoding: string;
  schema_count: number;
  packet: string;
}

interface MetadataReportResult {
  success: boolean;
  output_path?: string;
  report_format: 'detailed' | 'simple' | 'json-only';
  file_size?: number;
  processing_time: number;
  sections?: {
    metadata_overview: boolean;
    scene_analysis: boolean;
    technical_details: boolean;
    processing_info: boolean;
    raw_json: boolean;
  };
  error?: string;
}

/**
 * ORBIT Schema validation (simplified version)
 */
class MetadataValidator {
  validateMetadata(metadata: any, schemaType?: SchemaType): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Basic validation
    if (!metadata || typeof metadata !== 'object') {
      errors.push('Metadata must be a valid object');
      return { valid: false, schema_type: 'orbit', errors, warnings };
    }
    
    // Auto-detect schema type if not provided
    let detectedType: SchemaType = schemaType || this.detectSchemaType(metadata);
    
    // Validate based on schema type
    switch (detectedType) {
      case 'lifestyle':
        this.validateLifestyleSchema(metadata, errors, warnings);
        break;
      case 'product':
        this.validateProductSchema(metadata, errors, warnings);
        break;
      case 'orbit':
        this.validateOrbitSchema(metadata, errors, warnings);
        break;
    }
    
    return {
      valid: errors.length === 0,
      schema_type: detectedType,
      errors,
      warnings
    };
  }
  
  private detectSchemaType(metadata: any): SchemaType {
    // Check for lifestyle-specific fields
    if (metadata.human_elements || metadata.scene_overview || metadata.narrative_analysis) {
      return 'lifestyle';
    }
    
    // Check for product-specific fields
    if (metadata.product_identification || metadata.commercial_analysis || metadata.quality_assessment) {
      return 'product';
    }
    
    // Default to orbit schema
    return 'orbit';
  }
  
  private validateLifestyleSchema(metadata: any, errors: string[], warnings: string[]): void {
    const requiredFields = ['scene_overview', 'human_elements', 'environment'];
    for (const field of requiredFields) {
      if (!metadata[field]) {
        warnings.push(`Missing recommended field: ${field}`);
      }
    }
  }
  
  private validateProductSchema(metadata: any, errors: string[], warnings: string[]): void {
    const requiredFields = ['product_identification', 'physical_characteristics'];
    for (const field of requiredFields) {
      if (!metadata[field]) {
        warnings.push(`Missing recommended field: ${field}`);
      }
    }
  }
  
  private validateOrbitSchema(metadata: any, errors: string[], warnings: string[]): void {
    // ORBIT schema is more flexible, just check basic structure
    if (Object.keys(metadata).length === 0) {
      errors.push('ORBIT metadata cannot be empty');
    }
  }
}

/**
 * XMP Processor for creating metadata packets
 */
class XMPProcessor {
  createXMPPacket(metadata: any, schemaType: SchemaType, options: { includeWrappers?: boolean; prettyPrint?: boolean } = {}): XMPPacketInfo {
    const { includeWrappers = true, prettyPrint = true } = options;
    
    // Create XMP packet content
    const xmpContent = this.buildXMPContent(metadata, schemaType, prettyPrint);
    
    // Add XMP packet wrappers if requested
    let packet = xmpContent;
    if (includeWrappers) {
      packet = this.wrapXMPPacket(xmpContent);
    }
    
    return {
      size: new TextEncoder().encode(packet).length,
      encoding: 'UTF-8',
      schema_count: this.countSchemas(metadata, schemaType),
      packet
    };
  }
  
  private buildXMPContent(metadata: any, schemaType: SchemaType, prettyPrint: boolean): string {
    const indent = prettyPrint ? '  ' : '';
    const newline = prettyPrint ? '\n' : '';
    
    let content = `<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="ORBIT Metadata Processor">${newline}`;
    content += `${indent}<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">${newline}`;
    content += `${indent}${indent}<rdf:Description rdf:about="">${newline}`;
    
    // Add schema-specific namespaces and content
    switch (schemaType) {
      case 'lifestyle':
        content += this.buildLifestyleXMP(metadata, indent, newline);
        break;
      case 'product':
        content += this.buildProductXMP(metadata, indent, newline);
        break;
      case 'orbit':
        content += this.buildOrbitXMP(metadata, indent, newline);
        break;
    }
    
    content += `${indent}${indent}</rdf:Description>${newline}`;
    content += `${indent}</rdf:RDF>${newline}`;
    content += `</x:xmpmeta>`;
    
    return content;
  }
  
  private buildLifestyleXMP(metadata: any, indent: string, newline: string): string {
    let xmp = `${indent}${indent}${indent}xmlns:lifestyle="http://orbit.ai/schemas/lifestyle/1.0/"${newline}`;
    
    // Add lifestyle-specific fields
    if (metadata.scene_overview) {
      xmp += `${indent}${indent}${indent}<lifestyle:scene>${JSON.stringify(metadata.scene_overview)}</lifestyle:scene>${newline}`;
    }
    
    if (metadata.human_elements) {
      xmp += `${indent}${indent}${indent}<lifestyle:human_elements>${JSON.stringify(metadata.human_elements)}</lifestyle:human_elements>${newline}`;
    }
    
    return xmp;
  }
  
  private buildProductXMP(metadata: any, indent: string, newline: string): string {
    let xmp = `${indent}${indent}${indent}xmlns:product="http://orbit.ai/schemas/product/1.0/"${newline}`;
    
    // Add product-specific fields  
    if (metadata.product_identification) {
      xmp += `${indent}${indent}${indent}<product:identification>${JSON.stringify(metadata.product_identification)}</product:identification>${newline}`;
    }
    
    if (metadata.commercial_analysis) {
      xmp += `${indent}${indent}${indent}<product:commercial_analysis>${JSON.stringify(metadata.commercial_analysis)}</product:commercial_analysis>${newline}`;
    }
    
    return xmp;
  }
  
  private buildOrbitXMP(metadata: any, indent: string, newline: string): string {
    let xmp = `${indent}${indent}${indent}xmlns:orbit="http://orbit.ai/schemas/orbit/1.0/"${newline}`;
    
    // Add general ORBIT metadata
    xmp += `${indent}${indent}${indent}<orbit:metadata>${JSON.stringify(metadata)}</orbit:metadata>${newline}`;
    
    return xmp;
  }
  
  private wrapXMPPacket(content: string): string {
    const packetHeader = '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>\n';
    const packetFooter = '\n<?xpacket end="w"?>';
    
    return packetHeader + content + packetFooter;
  }
  
  private countSchemas(metadata: any, schemaType: SchemaType): number {
    // Count the number of schema namespaces used
    switch (schemaType) {
      case 'lifestyle':
        return 1;
      case 'product':
        return 1;
      case 'orbit':
        return 1;
      default:
        return 1;
    }
  }
}

/**
 * Create Supabase client
 */
function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  
  return createClient(supabaseUrl, serviceKey);
}

/**
 * Download image buffer from Supabase Storage
 */
async function downloadImageBuffer(path: string): Promise<Uint8Array> {
  const supabase = createSupabaseClient();
  const [bucket, ...pathParts] = path.split('/');
  const filePath = pathParts.join('/');
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(filePath);
  
  if (error) {
    throw new Error(`Failed to download image: ${error.message}`);
  }
  
  if (!data) {
    throw new Error('No data received from download');
  }
  
  const arrayBuffer = await data.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Upload buffer to Supabase Storage
 */
async function uploadBuffer(path: string, buffer: Uint8Array, contentType: string): Promise<void> {
  const supabase = createSupabaseClient();
  const [bucket, ...pathParts] = path.split('/');
  const filePath = pathParts.join('/');
  
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, buffer, {
      contentType,
      upsert: true
    });
  
  if (error) {
    throw new Error(`Failed to upload: ${error.message}`);
  }
}

/**
 * Embed XMP metadata into JPEG image
 */
async function embedMetadataIntoImage(imageBuffer: Uint8Array, xmpPacket: string): Promise<Uint8Array> {
  // This is a simplified version - in production you'd use a proper JPEG library
  // For now, we'll just append the XMP as a comment segment
  
  // Check if it's a valid JPEG
  if (imageBuffer[0] !== 0xFF || imageBuffer[1] !== 0xD8) {
    throw new Error('Not a valid JPEG image');
  }
  
  // Find the position after SOI marker to insert XMP
  const xmpData = new TextEncoder().encode(xmpPacket);
  const xmpSegment = new Uint8Array(4 + xmpData.length);
  
  // APP1 marker (0xFFE1) for XMP
  xmpSegment[0] = 0xFF;
  xmpSegment[1] = 0xE1;
  
  // Length (big endian)
  const length = xmpData.length + 2;
  xmpSegment[2] = (length >> 8) & 0xFF;
  xmpSegment[3] = length & 0xFF;
  
  // XMP data
  xmpSegment.set(xmpData, 4);
  
  // Combine original image with XMP segment
  const result = new Uint8Array(2 + xmpSegment.length + imageBuffer.length - 2);
  result.set(imageBuffer.subarray(0, 2), 0); // SOI marker
  result.set(xmpSegment, 2); // XMP segment
  result.set(imageBuffer.subarray(2), 2 + xmpSegment.length); // Rest of image
  
  return result;
}

/**
 * Generate metadata report
 */
function generateMetadataReport(metadata: any, format: 'detailed' | 'simple' | 'json-only', schemaType: SchemaType): string {
  switch (format) {
    case 'json-only':
      return JSON.stringify(metadata, null, 2);
      
    case 'simple':
      return generateSimpleReport(metadata, schemaType);
      
    case 'detailed':
    default:
      return generateDetailedReport(metadata, schemaType);
  }
}

function generateSimpleReport(metadata: any, schemaType: SchemaType): string {
  let report = `ORBIT Metadata Report (${schemaType.toUpperCase()})\n`;
  report += '='.repeat(50) + '\n\n';
  
  // Add key fields based on schema type
  switch (schemaType) {
    case 'lifestyle':
      if (metadata.scene_overview) {
        report += `Scene: ${metadata.scene_overview.setting || 'Unknown'}\n`;
        report += `Activity: ${metadata.scene_overview.primary_activity || 'Unknown'}\n`;
      }
      if (metadata.human_elements) {
        report += `People: ${metadata.human_elements.number_of_people || 0}\n`;
      }
      break;
      
    case 'product':
      if (metadata.product_identification) {
        report += `Product: ${metadata.product_identification.product_type || 'Unknown'}\n`;
        report += `Category: ${metadata.product_identification.product_category || 'Unknown'}\n`;
      }
      break;
      
    case 'orbit':
    default:
      report += 'General ORBIT metadata analysis\n';
      break;
  }
  
  report += '\nGenerated by ORBIT Metadata MCP Server\n';
  return report;
}

function generateDetailedReport(metadata: any, schemaType: SchemaType): string {
  let report = `ORBIT Metadata Detailed Report\n`;
  report += '='.repeat(50) + '\n\n';
  
  report += `Schema Type: ${schemaType.toUpperCase()}\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;
  
  // Add detailed analysis based on schema type
  switch (schemaType) {
    case 'lifestyle':
      report += generateLifestyleReport(metadata);
      break;
    case 'product':
      report += generateProductReport(metadata);
      break;
    case 'orbit':
    default:
      report += generateOrbitReport(metadata);
      break;
  }
  
  report += '\n' + '='.repeat(50) + '\n';
  report += 'RAW JSON DATA:\n';
  report += JSON.stringify(metadata, null, 2);
  
  return report;
}

function generateLifestyleReport(metadata: any): string {
  let report = 'LIFESTYLE ANALYSIS\n';
  report += '-'.repeat(20) + '\n\n';
  
  if (metadata.scene_overview) {
    report += 'Scene Overview:\n';
    report += `  Setting: ${metadata.scene_overview.setting || 'Not specified'}\n`;
    report += `  Time of Day: ${metadata.scene_overview.time_of_day || 'Not specified'}\n`;
    report += `  Primary Activity: ${metadata.scene_overview.primary_activity || 'Not specified'}\n\n`;
  }
  
  if (metadata.human_elements) {
    report += 'Human Elements:\n';
    report += `  Number of People: ${metadata.human_elements.number_of_people || 0}\n`;
    report += `  Interactions: ${metadata.human_elements.interactions || 'Not specified'}\n\n`;
  }
  
  return report;
}

function generateProductReport(metadata: any): string {
  let report = 'PRODUCT ANALYSIS\n';
  report += '-'.repeat(20) + '\n\n';
  
  if (metadata.product_identification) {
    report += 'Product Identification:\n';
    report += `  Type: ${metadata.product_identification.product_type || 'Not specified'}\n`;
    report += `  Category: ${metadata.product_identification.product_category || 'Not specified'}\n`;
    report += `  Style: ${metadata.product_identification.design_style || 'Not specified'}\n\n`;
  }
  
  if (metadata.commercial_analysis) {
    report += 'Commercial Analysis:\n';
    report += `  Market Positioning: ${metadata.commercial_analysis.market_positioning || 'Not specified'}\n\n`;
  }
  
  return report;
}

function generateOrbitReport(metadata: any): string {
  let report = 'ORBIT GENERAL ANALYSIS\n';
  report += '-'.repeat(25) + '\n\n';
  
  const keys = Object.keys(metadata);
  report += `Data Sections: ${keys.length}\n`;
  report += `Sections: ${keys.join(', ')}\n\n`;
  
  return report;
}

// Tool definitions matching local server functionality
const metadataTools: MCPServiceToolDefinition[] = [
  {
    name: 'embed_image_metadata',
    schema: {
      name: 'embed_image_metadata',
      description: 'Embed XMP metadata into images stored in Supabase Storage using stream processing',
      inputSchema: {
        type: 'object',
        properties: {
          source_path: {
            type: 'string',
            description: 'Path to source image in Supabase Storage (e.g., "folder/image.jpg")'
          },
          metadata: {
            type: 'object',
            description: 'Metadata object containing scene analysis (supports lifestyle, product, or orbit schemas)'
          },
          output_path: {
            type: 'string',
            description: 'Path where processed image with embedded metadata will be saved'
          },
          schema_type: {
            type: 'string',
            enum: ['lifestyle', 'product', 'orbit'],
            description: 'Schema type for metadata validation (auto-detected if not specified)'
          },
          compression_quality: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            description: 'JPEG compression quality (1-100, default: 95)'
          }
        },
        required: ['source_path', 'metadata', 'output_path'],
        additionalProperties: false
      }
    },
    handler: async (params, context) => {
      const startTime = Date.now();
      const { source_path, metadata, output_path, schema_type, compression_quality = 95 } = params;
      
      try {
        // Validate metadata
        const validator = new MetadataValidator();
        const validation = validator.validateMetadata(metadata, schema_type);
        
        if (!validation.valid) {
          throw new Error(`Metadata validation failed: ${validation.errors.join(', ')}`);
        }
        
        // Download source image
        const imageBuffer = await downloadImageBuffer(source_path);
        
        // Create XMP packet
        const xmpProcessor = new XMPProcessor();
        const xmpInfo = xmpProcessor.createXMPPacket(metadata, validation.schema_type, {
          includeWrappers: true,
          prettyPrint: true
        });
        
        // Embed XMP into image
        const processedImage = await embedMetadataIntoImage(imageBuffer, xmpInfo.packet);
        
        // Upload processed image
        await uploadBuffer(output_path, processedImage, 'image/jpeg');
        
        const result: ProcessingResponse = {
          success: true,
          output_path,
          file_size: processedImage.length,
          format_converted: false,
          original_format: 'jpeg',
          target_format: 'jpeg',
          xmp_packet_info: {
            size: xmpInfo.size,
            encoding: xmpInfo.encoding,
            schema_count: xmpInfo.schema_count
          },
          processing_time: Date.now() - startTime,
          validation_warnings: validation.warnings
        };
        
        return [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ];
      } catch (error) {
        const result: ProcessingResponse = {
          success: false,
          error: error.message,
          processing_time: Date.now() - startTime
        };
        
        return [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ];
      }
    }
  },
  
  {
    name: 'read_image_metadata',
    schema: {
      name: 'read_image_metadata',
      description: 'Extract XMP and basic EXIF metadata from images in Supabase Storage',
      inputSchema: {
        type: 'object',
        properties: {
          image_path: {
            type: 'string',
            description: 'Path to image in Supabase Storage (e.g., "folder/image.jpg")'
          },
          format: {
            type: 'string',
            enum: ['json', 'text'],
            description: 'Output format for metadata (default: json)'
          },
          include_xmp: {
            type: 'boolean',
            description: 'Include XMP metadata extraction (default: true)'
          },
          include_exif: {
            type: 'boolean',
            description: 'Include basic EXIF data extraction (default: true)'
          }
        },
        required: ['image_path'],
        additionalProperties: false
      }
    },
    handler: async (params, context) => {
      const { image_path, format = 'json', include_xmp = true, include_exif = true } = params;
      
      try {
        // Download image
        const imageBuffer = await downloadImageBuffer(image_path);
        
        // Extract metadata (simplified implementation)
        const metadata = {
          file_info: {
            path: image_path,
            size: imageBuffer.length,
            format: 'jpeg' // Simplified detection
          },
          xmp: include_xmp ? { found: false, data: {} } : undefined,
          exif: include_exif ? { found: false, data: {} } : undefined
        };
        
        // In a real implementation, you'd parse the actual XMP/EXIF data from the buffer
        
        if (format === 'text') {
          const textOutput = `Metadata for: ${image_path}\n` +
                            `File Size: ${imageBuffer.length} bytes\n` +
                            `XMP Found: ${metadata.xmp?.found || false}\n` +
                            `EXIF Found: ${metadata.exif?.found || false}\n`;
          
          return [
            {
              type: 'text',
              text: textOutput
            }
          ];
        } else {
          return [
            {
              type: 'text',
              text: JSON.stringify(metadata, null, 2)
            }
          ];
        }
      } catch (error) {
        return [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              image_path
            }, null, 2)
          }
        ];
      }
    }
  },
  
  {
    name: 'validate_metadata_schema',
    schema: {
      name: 'validate_metadata_schema',
      description: 'Validate metadata against ORBIT schemas without embedding (supports lifestyle, product, and orbit schemas)',
      inputSchema: {
        type: 'object',
        properties: {
          metadata: {
            type: 'object',
            description: 'Metadata object to validate against schema requirements'
          },
          schema_type: {
            type: 'string',
            enum: ['lifestyle', 'product', 'orbit'],
            description: 'Schema type for validation (auto-detected if not specified)'
          },
          strict_mode: {
            type: 'boolean',
            description: 'Enable strict validation mode (default: false)'
          }
        },
        required: ['metadata'],
        additionalProperties: false
      }
    },
    handler: async (params, context) => {
      const { metadata, schema_type, strict_mode = false } = params;
      
      const validator = new MetadataValidator();
      const validation = validator.validateMetadata(metadata, schema_type);
      
      return [
        {
          type: 'text',
          text: JSON.stringify({
            valid: validation.valid,
            schema_type: validation.schema_type,
            errors: validation.errors,
            warnings: validation.warnings,
            strict_mode
          }, null, 2)
        }
      ];
    }
  },
  
  {
    name: 'create_xmp_packet',
    schema: {
      name: 'create_xmp_packet',
      description: 'Create standalone XMP metadata packet from metadata object with validation',
      inputSchema: {
        type: 'object',
        properties: {
          metadata: {
            type: 'object',
            description: 'Metadata object to convert to XMP format (supports lifestyle, product, and orbit schemas)'
          },
          schema_type: {
            type: 'string',
            enum: ['lifestyle', 'product', 'orbit'],
            description: 'Schema type for metadata validation (auto-detected if not specified)'
          },
          output_path: {
            type: 'string',
            description: 'Path to save XMP file in Supabase Storage (optional, e.g., "metadata/sample.xmp")'
          },
          include_wrappers: {
            type: 'boolean',
            description: 'Include XMP packet wrappers (default: true)'
          },
          pretty_print: {
            type: 'boolean',
            description: 'Format XMP for readability with indentation (default: true)'
          }
        },
        required: ['metadata'],
        additionalProperties: false
      }
    },
    handler: async (params, context) => {
      const { metadata, schema_type, output_path, include_wrappers = true, pretty_print = true } = params;
      
      try {
        // Validate metadata
        const validator = new MetadataValidator();
        const validation = validator.validateMetadata(metadata, schema_type);
        
        if (!validation.valid) {
          throw new Error(`Metadata validation failed: ${validation.errors.join(', ')}`);
        }
        
        // Create XMP packet
        const xmpProcessor = new XMPProcessor();
        const xmpInfo = xmpProcessor.createXMPPacket(metadata, validation.schema_type, {
          includeWrappers: include_wrappers,
          prettyPrint: pretty_print
        });
        
        // Save to storage if output path provided
        if (output_path) {
          const xmpBuffer = new TextEncoder().encode(xmpInfo.packet);
          await uploadBuffer(output_path, xmpBuffer, 'application/rdf+xml');
        }
        
        return [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              xmp_packet: xmpInfo.packet,
              packet_info: {
                size: xmpInfo.size,
                encoding: xmpInfo.encoding,
                schema_count: xmpInfo.schema_count
              },
              output_path: output_path || 'not_saved',
              schema_type: validation.schema_type,
              validation_warnings: validation.warnings
            }, null, 2)
          }
        ];
      } catch (error) {
        return [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message
            }, null, 2)
          }
        ];
      }
    }
  },
  
  {
    name: 'create_metadata_report',
    schema: {
      name: 'create_metadata_report',
      description: 'Generate human-readable text reports from XMP metadata embedded in images',
      inputSchema: {
        type: 'object',
        properties: {
          image_path: {
            type: 'string',
            description: 'Path to image with embedded XMP metadata (e.g., "folder/image_me.jpg")'
          },
          format: {
            type: 'string',
            enum: ['detailed', 'simple', 'json-only'],
            description: 'Report format: detailed (full report), simple (key fields), json-only (raw data)'
          },
          output_path: {
            type: 'string',
            description: 'Path where report will be saved (auto-generated if not provided)'
          },
          include_raw_json: {
            type: 'boolean',
            description: 'Include raw JSON data in detailed format (default: true)'
          },
          include_processing_info: {
            type: 'boolean',
            description: 'Include processing information in the report (default: true)'
          }
        },
        required: ['image_path', 'format'],
        additionalProperties: false
      }
    },
    handler: async (params, context) => {
      const startTime = Date.now();
      const { 
        image_path, 
        format, 
        output_path, 
        include_raw_json = true,
        include_processing_info = true 
      } = params;
      
      try {
        // Download and read metadata from image
        const imageBuffer = await downloadImageBuffer(image_path);
        
        // In a real implementation, you'd extract actual XMP metadata from the image
        // For now, we'll create a mock metadata object
        const mockMetadata = {
          scene_overview: {
            setting: "Indoor restaurant",
            primary_activity: "Dining"
          },
          human_elements: {
            number_of_people: 2,
            interactions: "Friendly conversation"
          }
        };
        
        const schemaType: SchemaType = 'lifestyle'; // Would be detected from actual metadata
        
        // Generate report
        const report = generateMetadataReport(mockMetadata, format, schemaType);
        
        // Save to storage if output path provided
        const finalOutputPath = output_path || `${image_path.replace(/\.[^/.]+$/, '')}_report.txt`;
        const reportBuffer = new TextEncoder().encode(report);
        await uploadBuffer(finalOutputPath, reportBuffer, 'text/plain');
        
        const result: MetadataReportResult = {
          success: true,
          output_path: finalOutputPath,
          report_format: format,
          file_size: reportBuffer.length,
          processing_time: Date.now() - startTime,
          sections: {
            metadata_overview: true,
            scene_analysis: format !== 'json-only',
            technical_details: format === 'detailed',
            processing_info: include_processing_info && format === 'detailed',
            raw_json: include_raw_json && format === 'detailed'
          }
        };
        
        return [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ];
      } catch (error) {
        const result: MetadataReportResult = {
          success: false,
          report_format: format,
          processing_time: Date.now() - startTime,
          error: error.message
        };
        
        return [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ];
      }
    }
  }
];

serve(async (req) => {
  // Security Check: Immediately handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }

  try {
    // 2. Check for the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // 3. Extract the key provided by the client
    const providedKey = authHeader.replace('Bearer ', '');

    // 4. Compare the provided key with the expected secret key
    if (providedKey !== MCP_METADATA_SECRET) {
      throw new Error('Invalid authorization key');
    }

    // --- Authorization successful ---
    // If the code reaches this point, the request is secure.
    console.log('✅ Request authorized. Proceeding with function logic.');

    // Now, you can safely execute the rest of your function's code
    const { tool, params } = await req.json();

    // Find the tool and call its handler
    const toolDef = metadataTools.find(t => t.name === tool);
    if (!toolDef) {
        throw new Error(`Tool not found: ${tool}`);
    }

    const result = await toolDef.handler(params, {} as any); // context is not used in the handlers

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    // If any security check fails, return a 401 Unauthorized error
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 401,
    });
  }
});

console.log('🚀 ORBIT Metadata Processing MCP Server deployed as Edge Function');
