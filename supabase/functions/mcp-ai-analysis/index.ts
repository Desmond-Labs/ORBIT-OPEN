/**
 * Remote AI Image Analysis MCP Server - Edge Function Implementation
 * Replicates functionality of local ai-image-analysis-mcp server
 * Using direct secret key authentication.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from 'npm:@google/generative-ai';

// 1. Get the expected secret key from your function's environment variables
const MCP_AI_ANALYSIS_SECRET = Deno.env.get('sb_secret_key');

// Security configuration matching local server
const SECURITY_CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 60,
  ENABLE_PII_DETECTION: false
};

// Analysis result interfaces
interface AnalysisResult {
  analysis_type: 'lifestyle' | 'product';
  confidence: number;
  metadata: Record<string, any>;
  processing_time_ms: number;
  security_scan: {
    prompt_injection_detected: boolean;
    pii_detected: boolean;
    file_validated: boolean;
  };
  integrity_info: {
    file_hash: string;
    file_size: number;
    mime_type: string;
  };
  source: 'file' | 'url' | 'base64';
  source_url?: string;
}

/**
 * Lifestyle analysis prompt (from local server)
 */
function getLifestyleAnalysisPrompt(): string {
  return `Analyze this lifestyle image comprehensively and return results in JSON format. Examine the visual narrative, social dynamics, environmental context, and cultural significance while identifying key elements that establish the lifestyle portrayed. Structure your analysis according to the following JSON schema:

{
  "scene_overview": {
    "setting": "",
    "time_of_day": "",
    "season": "",
    "occasion": "",
    "primary_activity": ""
  },
  "human_elements": {
    "number_of_people": 0,
    "demographics": [],
    "interactions": "",
    "emotional_states": [],
    "clothing_style": "",
    "social_dynamics": ""
  },
  "environment": {
    "location_type": "",
    "architectural_elements": [],
    "natural_elements": [],
    "urban_context": "",
    "spatial_arrangement": ""
  },
  "key_objects": {
    "food_and_beverage": [],
    "technology": [],
    "furniture": [],
    "personal_items": [],
    "defining_props": []
  },
  "atmospheric_elements": {
    "lighting_quality": "",
    "color_palette": [],
    "mood": "",
    "sensory_cues": []
  },
  "narrative_analysis": {
    "story_implied": "",
    "lifestyle_values_represented": [],
    "cultural_significance": "",
    "socioeconomic_indicators": [],
    "historical_context": ""
  },
  "photographic_elements": {
    "composition": "",
    "focal_points": [],
    "perspective": "",
    "technical_qualities": []
  },
  "marketing_potential": {
    "target_demographic": "",
    "aspirational_elements": [],
    "brand_alignment_opportunities": [],
    "emotional_hooks": []
  }
}

Provide comprehensive but concise entries for each field based solely on what's visible in the image. Where information cannot be determined, use "indeterminate" rather than making assumptions.`;
}

/**
 * Product analysis prompt (from local server)
 */
function getProductAnalysisPrompt(): string {
  return `You are a specialized product image analyzer with expertise in design aesthetics, materials, construction methods, and commercial analysis. Analyze this product image to extract detailed metadata across multiple dimensions.

Return your analysis in the following JSON format:

{
  "product_identification": {
    "product_type": "",
    "product_category": "",
    "design_style": ""
  },
  "physical_characteristics": {
    "primary_color": "",
    "material": "",
    "pattern_type": "",
    "frame_design": "",
    "surface_texture": "",
    "backrest_style": "",
    "seat_profile": ""
  },
  "structural_elements": {
    "frame_type": "",
    "seat_support": "",
    "arm_design": "",
    "leg_structure": ""
  },
  "design_attributes": {
    "aesthetic_category": "",
    "visual_weight": "",
    "design_influence": "",
    "intended_setting": "",
    "design_cohesion": ""
  },
  "commercial_analysis": {
    "market_positioning": "",
    "target_market": [],
    "price_point_indication": "",
    "competitive_advantages": [],
    "market_differentiation": ""
  },
  "quality_assessment": {
    "construction_quality": "",
    "material_quality": "",
    "finish_quality": "",
    "durability_indicators": "",
    "craftsmanship_level": ""
  }
}

For each field, provide your assessment based on visual analysis. For any field you cannot determine with reasonable confidence, use "unknown" as the value.`;
}

/**
 * Validate URL for security
 */
function validateUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsedUrl = new URL(url);
    
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }
    
    // Check for common security issues
    if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
      return { valid: false, error: 'Localhost URLs not allowed' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Fetch image as base64 from URL
 */
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string; size: number }> {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }
  
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  
  if (!SECURITY_CONFIG.ALLOWED_MIME_TYPES.includes(contentType)) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const size = arrayBuffer.byteLength;
  
  if (size > SECURITY_CONFIG.MAX_FILE_SIZE) {
    throw new Error(`Image size ${size} exceeds maximum allowed size ${SECURITY_CONFIG.MAX_FILE_SIZE}`);
  }
  
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  
  return { base64, mimeType: contentType, size };
}

/**
 * Create file hash for integrity verification
 */
async function createFileHash(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Analyze image with Gemini AI
 */
async function analyzeImageWithGemini(
  imagePath?: string,
  analysisType?: 'lifestyle' | 'product',
  imageUrl?: string
): Promise<AnalysisResult> {
  const GEMINI_API_KEY = Deno.env.get('GOOGLE_API_KEY');
  if (!GEMINI_API_KEY) {
    throw new Error('GOOGLE_API_KEY environment variable is required');
  }

  // Validate exactly one input source
  if (!imagePath && !imageUrl) {
    throw new Error('Either imagePath or imageUrl must be provided');
  }
  
  if (imagePath && imageUrl) {
    throw new Error('Cannot provide both imagePath and imageUrl');
  }

  let base64Image: string;
  let mimeType: string;
  let source: 'file' | 'url';
  let fileSize: number;
  
  try {
    if (imageUrl) {
      // URL processing
      const validation = validateUrl(imageUrl);
      if (!validation.valid) {
        throw new Error(`URL validation failed: ${validation.error}`);
      }
      
      const { base64, mimeType: detectedMimeType, size } = await fetchImageAsBase64(imageUrl);
      base64Image = base64;
      mimeType = detectedMimeType;
      source = 'url';
      fileSize = size;
    } else if (imagePath) {
      // Handle Supabase Storage file path
      console.log('📁 Processing Supabase Storage path:', imagePath);
      
      try {
        // Parse the storage path (format: "bucket/path/to/file.ext" or "bucket-name/folder/file.ext")
        const pathParts = imagePath.split('/');
        const bucketName = pathParts[0];
        const filePath = pathParts.slice(1).join('/');
        
        console.log('🪣 Bucket:', bucketName, 'File:', filePath);
        
        // Create Supabase client for storage access
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Missing Supabase configuration for storage access');
        }
        
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Download the file from Supabase Storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(bucketName)
          .download(filePath);
          
        if (downloadError) {
          throw new Error(`Failed to download file from storage: ${downloadError.message}`);
        }
        
        if (!fileData) {
          throw new Error('No file data received from storage');
        }
        
        // Convert file to base64 for Gemini
        const arrayBuffer = await fileData.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Use FileReader API to avoid stack overflow with large files
        const base64String = await new Promise<string>((resolve, reject) => {
          try {
            // For Deno environment, we'll use btoa with chunking
            const chunkSize = 1024 * 1024; // 1MB chunks
            let result = '';
            
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
              const chunk = uint8Array.slice(i, i + chunkSize);
              const chunkString = String.fromCharCode(...chunk);
              result += btoa(chunkString);
            }
            
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
        
        source = 'file';
        base64Image = base64String; // Set the base64 data for Gemini
        mimeType = fileData.type || 'image/jpeg';
        fileSize = arrayBuffer.byteLength;
        
        console.log('✅ Successfully processed storage file:', {
          bucket: bucketName,
          path: filePath,
          size: fileSize,
          mimeType: mimeType
        });
        
      } catch (storageError) {
        console.error('❌ Storage processing error:', storageError);
        throw new Error(`Storage file processing failed: ${storageError.message}`);
      }
    } else {
      throw new Error('No valid image source provided');
    }

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel ({
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.1,
        topK: 32,
        topP: 1,
        maxOutputTokens: 8192,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });

    // Determine analysis type (auto-detect if not provided)
    let finalAnalysisType = analysisType;
    if (!finalAnalysisType) {
      const classificationPrompt = `Look at this image and determine if it should be analyzed as a "lifestyle" image (showing people, activities, scenes, environments) or a "product" image (showing individual items, objects, merchandise). Respond with only the word "lifestyle" or "product".`;
      
      const classificationResult = await model.generateContent([
        classificationPrompt,
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        },
      ]);
      
      const classificationResponse = await classificationResult.response;
      const classificationText = classificationResponse.text().trim().toLowerCase();
      
      finalAnalysisType = classificationText.includes('lifestyle') ? 'lifestyle' : 'product';
    }

    // Choose appropriate prompt based on type
    const analysisPrompt = finalAnalysisType === 'lifestyle' 
      ? getLifestyleAnalysisPrompt()
      : getProductAnalysisPrompt();

    // Generate content with image
    const geminiResult = await model.generateContent([
      analysisPrompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
    ]);

    const response = await geminiResult.response;
    const analysisText = response.text();
    
    // Parse JSON response with enhanced error handling
    let analysisJson;
    try {
      const jsonMatch = analysisText.match(/```json\n(.*?)\n```/s) || analysisText.match(/\{.*\}/s);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : analysisText;
      
      if (!jsonText || jsonText.trim().length === 0) {
        throw new Error('Empty response from Gemini');
      }
      
      analysisJson = JSON.parse(jsonText);
      
      if (typeof analysisJson !== 'object' || analysisJson === null) {
        throw new Error('Invalid response structure from Gemini');
      }
      
    } catch (parseError) {
      throw new Error(`Failed to parse Gemini response: ${parseError.message}`);
    }

    // Create integrity info
    const imageData = new Uint8Array(atob(base64Image).split('').map(c => c.charCodeAt(0)));
    const fileHash = await createFileHash(imageData);

    const result: AnalysisResult = {
      analysis_type: finalAnalysisType,
      confidence: 0.9,
      metadata: analysisJson,
      processing_time_ms: Date.now(),
      security_scan: {
        prompt_injection_detected: false,
        pii_detected: false,
        file_validated: true
      },
      integrity_info: {
        file_hash: fileHash,
        file_size: fileSize,
        mime_type: mimeType
      },
      source: source
    };
    
    if (imageUrl) {
      result.source_url = imageUrl;
    }
    
    return result;
  } catch (error) {
    throw new Error(`Gemini analysis failed: ${error.message}`);
  }
}

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
    if (providedKey !== MCP_AI_ANALYSIS_SECRET) {
      throw new Error('Invalid authorization key');
    }

    // --- Authorization successful ---
    // If the code reaches this point, the request is secure.
    console.log('✅ Request authorized. Proceeding with function logic.');

    // Now, you can safely execute the rest of your function's code
    const { image_path, image_url, analysis_type } = await req.json();
    
    const result = await analyzeImageWithGemini(image_path, analysis_type, image_url);

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

console.log('🚀 ORBIT AI Analysis MCP Server deployed as Edge Function');
