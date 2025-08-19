/**
 * ORBIT XMP Generator Module
 * Enhanced XMP packet generation with comprehensive ORBIT schema compliance
 * Supports lifestyle and product analysis metadata structures
 */

export interface XMPGeneratorOptions {
  includeFullAnalysis?: boolean;  // Include complete JSON in XMP
  includeTimestamp?: boolean;     // Include generation timestamp
  compressionLevel?: 'minimal' | 'standard' | 'verbose'; // How much detail to include
  customNamespace?: string;       // Custom namespace URI
}

export interface ORBITMetadata {
  // Core analysis data
  analysis_type: 'lifestyle' | 'product';
  confidence: number;
  processing_time_ms: number;
  
  // Analysis results
  metadata: any;
  
  // Technical info
  integrity_info?: {
    file_hash: string;
    file_size: number;
    mime_type: string;
  };
}

/**
 * Enhanced XMP Generator for ORBIT metadata
 */
export class ORBITXMPGenerator {
  private options: XMPGeneratorOptions;
  private orbitNamespace: string;
  
  constructor(options: XMPGeneratorOptions = {}) {
    this.options = {
      includeFullAnalysis: true,
      includeTimestamp: true,
      compressionLevel: 'standard',
      customNamespace: 'http://orbit.ai/metadata/1.0/',
      ...options
    };
    this.orbitNamespace = this.options.customNamespace!;
  }
  
  /**
   * Generate comprehensive XMP packet for ORBIT metadata
   */
  generateXMPPacket(metadata: ORBITMetadata, imageFilename: string): string {
    const timestamp = new Date().toISOString();
    const analysisData = metadata.metadata || {};
    
    // Build XMP packet with comprehensive ORBIT schema
    return `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="ORBIT Image Forge 2.0">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:orbit="${this.orbitNamespace}"
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/"
      xmlns:stEvt="http://ns.adobe.com/xap/1.0/sType/ResourceEvent#">
      
      ${this.generateBasicImageInfo(imageFilename, timestamp)}
      ${this.generateCoreAnalysisInfo(metadata)}
      ${this.generateAnalysisTypeSpecificMetadata(metadata)}
      ${this.generateTechnicalMetadata(metadata)}
      ${this.generateProcessingHistory(timestamp)}
      ${this.options.includeFullAnalysis ? this.generateFullAnalysisJSON(analysisData) : ''}
      
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>`;
  }
  
  /**
   * Generate basic Dublin Core and XMP image information
   */
  private generateBasicImageInfo(imageFilename: string, timestamp: string): string {
    return `
      <!-- Basic Image Information -->
      <dc:title>${this.escapeXML(imageFilename)}</dc:title>
      <dc:creator>ORBIT Image Forge AI Analysis</dc:creator>
      <dc:description>AI-enhanced image with embedded ORBIT metadata</dc:description>
      <dc:rights>Processed by ORBIT Image Forge</dc:rights>
      <dc:format>image/jpeg</dc:format>
      
      <xmp:CreatorTool>ORBIT Image Forge AI Analysis System v2.0</xmp:CreatorTool>
      <xmp:CreateDate>${timestamp}</xmp:CreateDate>
      <xmp:ModifyDate>${timestamp}</xmp:ModifyDate>
      <xmp:MetadataDate>${timestamp}</xmp:MetadataDate>`;
  }
  
  /**
   * Generate core ORBIT analysis metadata
   */
  private generateCoreAnalysisInfo(metadata: ORBITMetadata): string {
    return `
      <!-- ORBIT Core Analysis Results -->
      <orbit:analysisType>${metadata.analysis_type}</orbit:analysisType>
      <orbit:confidence>${metadata.confidence}</orbit:confidence>
      <orbit:processingTime>${metadata.processing_time_ms}</orbit:processingTime>
      <orbit:analysisVersion>2.0</orbit:analysisVersion>
      <orbit:schemaVersion>1.0</orbit:schemaVersion>`;
  }
  
  /**
   * Generate analysis-type specific metadata (lifestyle vs product)
   */
  private generateAnalysisTypeSpecificMetadata(metadata: ORBITMetadata): string {
    const analysisData = metadata.metadata || {};
    
    if (metadata.analysis_type === 'lifestyle') {
      return this.generateLifestyleMetadata(analysisData);
    } else if (metadata.analysis_type === 'product') {
      return this.generateProductMetadata(analysisData);
    }
    
    return '';
  }
  
  /**
   * Generate lifestyle-specific XMP metadata
   */
  private generateLifestyleMetadata(metadata: any): string {
    let xmp = `
      <!-- ORBIT Lifestyle Analysis -->`;
    
    // Scene Overview
    if (metadata.scene_overview) {
      xmp += `
      <orbit:sceneSetting>${this.escapeXML(metadata.scene_overview.setting || '')}</orbit:sceneSetting>
      <orbit:timeOfDay>${this.escapeXML(metadata.scene_overview.time_of_day || '')}</orbit:timeOfDay>
      <orbit:season>${this.escapeXML(metadata.scene_overview.season || '')}</orbit:season>
      <orbit:occasion>${this.escapeXML(metadata.scene_overview.occasion || '')}</orbit:occasion>
      <orbit:primaryActivity>${this.escapeXML(metadata.scene_overview.primary_activity || '')}</orbit:primaryActivity>`;
    }
    
    // Human Elements
    if (metadata.human_elements) {
      xmp += `
      <orbit:numberOfPeople>${metadata.human_elements.number_of_people || 0}</orbit:numberOfPeople>
      <orbit:clothingStyle>${this.escapeXML(metadata.human_elements.clothing_style || '')}</orbit:clothingStyle>
      <orbit:socialDynamics>${this.escapeXML(metadata.human_elements.social_dynamics || '')}</orbit:socialDynamics>`;
      
      // Demographics array
      if (metadata.human_elements.demographics && Array.isArray(metadata.human_elements.demographics)) {
        xmp += `
      <orbit:demographics>
        <rdf:Bag>
          ${metadata.human_elements.demographics.map((demo: string) => 
            `<rdf:li>${this.escapeXML(demo)}</rdf:li>`
          ).join('\n          ')}
        </rdf:Bag>
      </orbit:demographics>`;
      }
      
      // Emotional states array
      if (metadata.human_elements.emotional_states && Array.isArray(metadata.human_elements.emotional_states)) {
        xmp += `
      <orbit:emotionalStates>
        <rdf:Bag>
          ${metadata.human_elements.emotional_states.map((state: string) => 
            `<rdf:li>${this.escapeXML(state)}</rdf:li>`
          ).join('\n          ')}
        </rdf:Bag>
      </orbit:emotionalStates>`;
      }
    }
    
    // Environment
    if (metadata.environment) {
      xmp += `
      <orbit:locationType>${this.escapeXML(metadata.environment.location_type || '')}</orbit:locationType>
      <orbit:urbanContext>${this.escapeXML(metadata.environment.urban_context || '')}</orbit:urbanContext>
      <orbit:spatialArrangement>${this.escapeXML(metadata.environment.spatial_arrangement || '')}</orbit:spatialArrangement>`;
    }
    
    // Marketing Potential
    if (metadata.marketing_potential) {
      xmp += `
      <orbit:targetDemographic>${this.escapeXML(metadata.marketing_potential.target_demographic || '')}</orbit:targetDemographic>`;
      
      if (metadata.marketing_potential.emotional_hooks && Array.isArray(metadata.marketing_potential.emotional_hooks)) {
        xmp += `
      <orbit:emotionalHooks>
        <rdf:Bag>
          ${metadata.marketing_potential.emotional_hooks.map((hook: string) => 
            `<rdf:li>${this.escapeXML(hook)}</rdf:li>`
          ).join('\n          ')}
        </rdf:Bag>
      </orbit:emotionalHooks>`;
      }
      
      if (metadata.marketing_potential.brand_alignment_opportunities && Array.isArray(metadata.marketing_potential.brand_alignment_opportunities)) {
        xmp += `
      <orbit:brandOpportunities>
        <rdf:Bag>
          ${metadata.marketing_potential.brand_alignment_opportunities.map((opp: string) => 
            `<rdf:li>${this.escapeXML(opp)}</rdf:li>`
          ).join('\n          ')}
        </rdf:Bag>
      </orbit:brandOpportunities>`;
      }
    }
    
    return xmp;
  }
  
  /**
   * Generate product-specific XMP metadata
   */
  private generateProductMetadata(metadata: any): string {
    let xmp = `
      <!-- ORBIT Product Analysis -->`;
    
    // Product Identification
    if (metadata.product_identification) {
      xmp += `
      <orbit:productType>${this.escapeXML(metadata.product_identification.product_type || '')}</orbit:productType>
      <orbit:productCategory>${this.escapeXML(metadata.product_identification.product_category || '')}</orbit:productCategory>
      <orbit:designStyle>${this.escapeXML(metadata.product_identification.design_style || '')}</orbit:designStyle>`;
    }
    
    // Physical Characteristics
    if (metadata.physical_characteristics) {
      xmp += `
      <orbit:primaryColor>${this.escapeXML(metadata.physical_characteristics.primary_color || '')}</orbit:primaryColor>
      <orbit:material>${this.escapeXML(metadata.physical_characteristics.material || '')}</orbit:material>
      <orbit:patternType>${this.escapeXML(metadata.physical_characteristics.pattern_type || '')}</orbit:patternType>
      <orbit:surfaceTexture>${this.escapeXML(metadata.physical_characteristics.surface_texture || '')}</orbit:surfaceTexture>`;
    }
    
    // Commercial Analysis
    if (metadata.commercial_analysis) {
      xmp += `
      <orbit:marketPositioning>${this.escapeXML(metadata.commercial_analysis.market_positioning || '')}</orbit:marketPositioning>
      <orbit:pricePointIndication>${this.escapeXML(metadata.commercial_analysis.price_point_indication || '')}</orbit:pricePointIndication>
      <orbit:marketDifferentiation>${this.escapeXML(metadata.commercial_analysis.market_differentiation || '')}</orbit:marketDifferentiation>`;
      
      if (metadata.commercial_analysis.target_market && Array.isArray(metadata.commercial_analysis.target_market)) {
        xmp += `
      <orbit:targetMarkets>
        <rdf:Bag>
          ${metadata.commercial_analysis.target_market.map((market: string) => 
            `<rdf:li>${this.escapeXML(market)}</rdf:li>`
          ).join('\n          ')}
        </rdf:Bag>
      </orbit:targetMarkets>`;
      }
    }
    
    // Quality Assessment
    if (metadata.quality_assessment) {
      xmp += `
      <orbit:constructionQuality>${this.escapeXML(metadata.quality_assessment.construction_quality || '')}</orbit:constructionQuality>
      <orbit:materialQuality>${this.escapeXML(metadata.quality_assessment.material_quality || '')}</orbit:materialQuality>
      <orbit:craftsmanshipLevel>${this.escapeXML(metadata.quality_assessment.craftsmanship_level || '')}</orbit:craftsmanshipLevel>`;
    }
    
    return xmp;
  }
  
  /**
   * Generate technical metadata
   */
  private generateTechnicalMetadata(metadata: ORBITMetadata): string {
    let xmp = `
      <!-- Technical Processing Information -->`;
    
    if (metadata.integrity_info) {
      xmp += `
      <orbit:fileHash>${metadata.integrity_info.file_hash}</orbit:fileHash>
      <orbit:originalFileSize>${metadata.integrity_info.file_size}</orbit:originalFileSize>
      <orbit:originalMimeType>${metadata.integrity_info.mime_type}</orbit:originalMimeType>`;
    }
    
    return xmp;
  }
  
  /**
   * Generate XMP processing history for provenance tracking
   */
  private generateProcessingHistory(timestamp: string): string {
    return `
      <!-- Processing History -->
      <xmpMM:History>
        <rdf:Seq>
          <rdf:li rdf:parseType="Resource">
            <stEvt:action>processed</stEvt:action>
            <stEvt:when>${timestamp}</stEvt:when>
            <stEvt:softwareAgent>ORBIT Image Forge v2.0</stEvt:softwareAgent>
            <stEvt:changed>/metadata</stEvt:changed>
          </rdf:li>
        </rdf:Seq>
      </xmpMM:History>`;
  }
  
  /**
   * Generate full analysis JSON (if enabled)
   */
  private generateFullAnalysisJSON(metadata: any): string {
    return `
      <!-- Complete Analysis JSON -->
      <orbit:fullAnalysis>${this.escapeXML(JSON.stringify(metadata, null, 2))}</orbit:fullAnalysis>`;
  }
  
  /**
   * Escape XML special characters
   */
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
  
  /**
   * Validate XMP packet structure
   */
  validateXMPPacket(xmpPacket: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Basic XML structure validation
    if (!xmpPacket.includes('<?xml version="1.0"')) {
      errors.push('Missing XML declaration');
    }
    
    if (!xmpPacket.includes('x:xmpmeta')) {
      errors.push('Missing XMP meta wrapper');
    }
    
    if (!xmpPacket.includes('rdf:RDF')) {
      errors.push('Missing RDF wrapper');
    }
    
    if (!xmpPacket.includes('orbit:analysisType')) {
      errors.push('Missing required ORBIT analysis type');
    }
    
    // Check for proper escaping
    if (xmpPacket.includes('<') && !xmpPacket.includes('&lt;') && 
        !xmpPacket.match(/<[a-zA-Z][^>]*>/)) {
      errors.push('Potential unescaped XML characters detected');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Factory function for creating XMP generator instances
 */
export function createXMPGenerator(options?: XMPGeneratorOptions): ORBITXMPGenerator {
  return new ORBITXMPGenerator(options);
}

/**
 * Quick utility function for generating XMP packet with default settings
 */
export function generateORBITXMP(metadata: ORBITMetadata, imageFilename: string): string {
  const generator = new ORBITXMPGenerator();
  return generator.generateXMPPacket(metadata, imageFilename);
}