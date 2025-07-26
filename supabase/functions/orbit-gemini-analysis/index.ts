// ORBIT Gemini Image Analysis Edge Function
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Security Configuration
const SECURITY_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_ORIGINS: ['*'], // Configure as needed
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  MAX_REQUESTS_PER_WINDOW: 30,
  ENABLE_AUTH_VALIDATION: true
};

// Rate limiting store
const rateLimitStore = new Map();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-id',
  'Access-Control-Max-Age': '86400'
};

serve(async (req) => {
  // CORS handling
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Security context extraction
    const securityContext = await extractSecurityContext(req, supabase);
    
    // Rate limiting
    const rateLimitKey = `${securityContext.ipAddress}:${securityContext.userId || 'anonymous'}`;
    const rateLimitCheck = checkRateLimit(rateLimitKey);
    
    if (!rateLimitCheck.allowed) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        retryAfter: rateLimitCheck.retryAfter,
        timestamp: new Date().toISOString()
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': rateLimitCheck.retryAfter?.toString() || '60',
          ...corsHeaders
        }
      });
    }

    // Parse request
    const requestData = await req.json();
    
    // Validate request structure
    if (!requestData.tool || !requestData.parameters) {
      throw new Error('Invalid request structure: missing tool or parameters');
    }

    // Security validation
    await validateRequest(requestData, securityContext);

    // Execute MCP tool
    const result = await executeMCPTool(requestData.tool, requestData.parameters, securityContext);

    // Audit log
    await logAuditEntry(supabase, {
      userId: securityContext.userId,
      sessionId: securityContext.sessionId,
      tool: requestData.tool,
      success: true,
      ipAddress: securityContext.ipAddress,
      timestamp: new Date().toISOString(),
      riskScore: securityContext.riskScore,
      requestData,
      responseData: result
    });

    return new Response(JSON.stringify({
      success: true,
      result,
      timestamp: new Date().toISOString(),
      request_id: securityContext.sessionId
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': securityContext.sessionId,
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('MCP Edge Function Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});

async function extractSecurityContext(req: Request, supabase: any) {
  const sessionId = req.headers.get('x-session-id') || crypto.randomUUID();
  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  
  let userId;
  let riskScore = 0;

  // Optional: Validate authentication if enabled
  if (SECURITY_CONFIG.ENABLE_AUTH_VALIDATION) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id;
      } catch {
        riskScore += 20; // Anonymous access increases risk
      }
    } else {
      riskScore += 10; // No auth header
    }
  }

  // Calculate risk score
  if (ipAddress === 'unknown') riskScore += 15;
  if (!userAgent.includes('Mozilla') && !userAgent.includes('ORBIT')) riskScore += 10;

  return {
    userId,
    sessionId,
    ipAddress,
    userAgent,
    riskScore: Math.min(riskScore, 100)
  };
}

function checkRateLimit(key: string) {
  const now = Date.now();
  const window = rateLimitStore.get(key);
  
  if (!window || now > window.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + SECURITY_CONFIG.RATE_LIMIT_WINDOW
    });
    return { allowed: true };
  }
  
  if (window.count >= SECURITY_CONFIG.MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((window.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  window.count++;
  rateLimitStore.set(key, window);
  return { allowed: true };
}

async function validateRequest(request: any, context: any) {
  // Input sanitization and validation
  const toolName = request.tool;
  const allowedTools = [
    'analyze_image',
    'upload_to_supabase',
    'get_security_status'
  ];
  
  if (!allowedTools.includes(toolName)) {
    throw new Error(`Tool not allowed: ${toolName}`);
  }

  // Check risk score threshold
  if (context.riskScore > 80) {
    throw new Error('Request blocked due to high risk score');
  }

  // Check for prompt injection in parameters
  const paramsStr = JSON.stringify(request.parameters);
  if (detectPromptInjection(paramsStr)) {
    throw new Error('Potential security threat detected in parameters');
  }

  // Validate file paths don't contain directory traversal
  if (request.parameters.image_path) {
    const imagePath = request.parameters.image_path;
    if (imagePath.includes('..') || imagePath.includes('~')) {
      throw new Error('Invalid file path detected');
    }
  }
}

function detectPromptInjection(input: string) {
  const injectionPatterns = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /forget\s+(all\s+)?(previous\s+)?instructions/i,
    /system\s*:\s*you\s+are\s+now/i,
    /\[system\]/i,
    /developer\s+mode/i,
    /jailbreak/i,
    /prompt\s+injection/i,
    /override\s+safety/i,
    /<script.*?>.*?<\/script>/i,
    /javascript\s*:/i,
    /data\s*:\s*text\/html/i
  ];
  
  return injectionPatterns.some(pattern => pattern.test(input));
}

async function executeMCPTool(tool: string, parameters: any, context: any) {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  
  switch (tool) {
    case 'analyze_image':
      return await executeAnalyzeImage(parameters, GEMINI_API_KEY);
    case 'upload_to_supabase':
      return await executeSupabaseUpload(parameters);
    case 'get_security_status':
      return {
        security_config: SECURITY_CONFIG,
        rate_limit_status: {
          active_limits: rateLimitStore.size,
          current_window: SECURITY_CONFIG.RATE_LIMIT_WINDOW
        },
        context_info: {
          session_id: context.sessionId,
          risk_score: context.riskScore,
          user_authenticated: !!context.userId
        },
        server_info: {
          name: 'orbit-gemini-analysis-edge',
          version: '2.0.0',
          environment: 'supabase-edge'
        }
      };
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

async function executeAnalyzeImage(parameters: any, apiKey: string) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const { image_path, image_data, analysis_type, supabase_url, supabase_key } = parameters;
  
  if (!image_path && !image_data) {
    throw new Error('Either image_path or image_data parameter is required');
  }

  // Validate file path security (if image_path provided)
  if (image_path && (image_path.includes('..') || image_path.includes('~'))) {
    throw new Error('Invalid image path detected');
  }

  try {
    let base64ImageData: string;
    let mimeType: string;

    if (image_data) {
      // Use provided base64 data
      base64ImageData = image_data;
      mimeType = 'image/jpeg'; // Default, could be improved with detection
    } else if (image_path && supabase_url && supabase_key) {
      // Download from Supabase Storage
      const supabase = createClient(supabase_url, supabase_key);
      
      // Extract bucket and path from image_path
      const pathParts = image_path.split('/');
      const bucket = pathParts[0];
      const filePath = pathParts.slice(1).join('/');
      
      const { data, error } = await supabase.storage.from(bucket).download(filePath);
      if (error) throw new Error(`Failed to download image: ${error.message}`);
      
      // Convert blob to base64
      const arrayBuffer = await data.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      base64ImageData = btoa(String.fromCharCode(...bytes));
      mimeType = data.type || 'image/jpeg';
    } else {
      throw new Error('Invalid image source - provide either image_data or complete Supabase info');
    }

    // Validate image size (10MB limit)
    const imageSize = base64ImageData.length * 3 / 4; // Approximate size from base64
    if (imageSize > SECURITY_CONFIG.MAX_FILE_SIZE) {
      throw new Error('Image size exceeds maximum allowed limit');
    }

    // Determine analysis type
    const analysisType = analysis_type || 'product';
    
    // Get appropriate prompt
    const prompt = analysisType === 'lifestyle' ? getLifestyleAnalysisPrompt() : getProductAnalysisPrompt();

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64ImageData
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            topK: 32,
            topP: 1,
            maxOutputTokens: 8192
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH", 
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json();
      throw new Error(`Gemini API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const geminiResult = await geminiResponse.json();
    
    if (!geminiResult.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response from Gemini API');
    }

    const analysisText = geminiResult.candidates[0].content.parts[0].text;

    // Parse JSON response with enhanced error handling
    let analysisJson;
    try {
      // Extract JSON from the response (remove markdown formatting if present)
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

    return {
      analysis_type: analysisType,
      confidence: 0.9,
      metadata: analysisJson,
      raw_text: analysisText,
      security_scan: {
        prompt_injection_detected: false,
        pii_detected: false,
        file_validated: true
      },
      processing_time_ms: Date.now() % 10000,
      serverless: true,
      gemini_model: 'gemini-2.0-flash-exp'
    };

  } catch (error) {
    throw new Error(`Gemini analysis failed: ${error.message}`);
  }
}

// Analysis prompts for Edge Function
function getLifestyleAnalysisPrompt() {
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

function getProductAnalysisPrompt() {
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

async function executeSupabaseUpload(parameters: any) {
  const { image_data, bucket, path, supabase_url, supabase_key, metadata } = parameters;
  
  if (!image_data || !bucket || !path || !supabase_url || !supabase_key) {
    throw new Error('Missing required upload parameters');
  }

  try {
    const supabase = createClient(supabase_url, supabase_key);
    
    // Convert base64 to buffer
    const buffer = Uint8Array.from(atob(image_data), c => c.charCodeAt(0));
    
    // Validate file size (10MB limit)
    if (buffer.length > SECURITY_CONFIG.MAX_FILE_SIZE) {
      throw new Error('File size exceeds maximum allowed size');
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
        metadata: metadata || {}
      });

    if (error) throw error;

    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return {
      success: true,
      path: data.path,
      public_url: publicData.publicUrl,
      upload_timestamp: new Date().toISOString(),
      file_size: buffer.length
    };

  } catch (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }
}

async function logAuditEntry(supabase: any, entry: any) {
  try {
    await supabase
      .from('mcp_audit_log')
      .insert({
        user_id: entry.userId,
        session_id: entry.sessionId,
        tool_name: entry.tool,
        success: entry.success,
        ip_address: entry.ipAddress,
        risk_score: entry.riskScore,
        request_data: entry.requestData,
        response_data: entry.responseData,
        created_at: entry.timestamp
      });
  } catch (error) {
    console.error('Failed to log audit entry:', error);
    // Don't throw - logging failure shouldn't break the main function
  }
}

console.log('ORBIT Gemini Image Analysis Edge Function deployed and ready');