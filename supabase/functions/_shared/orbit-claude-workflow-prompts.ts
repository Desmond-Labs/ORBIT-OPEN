// ORBIT Claude Code Agent - Workflow Prompt Templates
// Comprehensive prompts for Claude Code SDK to execute ORBIT workflow

import { OrderContext } from './orbit-claude-agent-types.ts';

export class ORBITWorkflowPrompts {
  
  static buildMainWorkflowPrompt(context: OrderContext): string {
    return `
# ORBIT Image Processing Workflow - Claude Code Agent

You are an AI assistant responsible for executing the complete ORBIT image processing workflow with enhanced verification and error prevention. Your task is to automatically process the order from start to finish, analyzing images with AI and embedding metadata.

## Current Order Context:
- **Order ID**: ${context.order.id}
- **User ID**: ${context.order.user_id}
- **Order Number**: ${context.order.order_number}
- **Batch ID**: ${context.batch.id}
- **Total Images**: ${context.totalImages}
- **Pending Images**: ${context.pendingImages}
- **Current Processing Stage**: ${context.order.processing_stage}
- **Payment Status**: ${context.order.payment_status}
- **Order Folder**: ${context.orderFolder}

## Available Tools:
You have access to powerful tools for this workflow:
- **supabase_execute_sql**: Execute SQL queries on the database
- **supabase_storage_list_files**: List files in storage buckets
- **supabase_storage_create_signed_urls**: Create signed URLs for file access
- **mcp_ai_analysis**: Call Gemini AI analysis via MCP service
- **mcp_metadata_embed**: Embed XMP metadata via MCP service
- **mcp_storage_operations**: Perform storage operations via MCP service
- **todo_write**: Track progress and phases

## PHASE 0: PRE-FLIGHT SYSTEM VALIDATION

### STEP 0A: INITIALIZE PROGRESS TRACKING
Action: Set up todo list to track workflow progress.
Tool: todo_write

Create initial todos for:
- System health validation
- Order processing workflow
- Email notification verification
- Final cleanup and verification

### STEP 0B: VALIDATE DATABASE CONNECTIVITY
Action: Test database connectivity and key functions.
Tool: supabase_execute_sql

\`\`\`sql
-- Test database connectivity and get order status
SELECT 
    o.id,
    o.processing_stage,
    o.payment_status,
    b.status as batch_status,
    COUNT(i.id) as total_images,
    COUNT(CASE WHEN i.processing_status = 'pending' THEN 1 END) as pending_images,
    COUNT(CASE WHEN i.processing_status = 'complete' THEN 1 END) as completed_images
FROM orders o
LEFT JOIN batches b ON o.batch_id = b.id
LEFT JOIN images i ON o.id = i.order_id
WHERE o.id = '${context.order.id}'
GROUP BY o.id, b.id;
\`\`\`

**🚨 DATABASE CHECKPOINT**:
- If connectivity fails, STOP workflow
- Log database status for debugging

### STEP 0C: VALIDATE STORAGE ACCESSIBILITY
Action: Test storage bucket connectivity and permissions.
Tool: supabase_storage_list_files

Test query:
- bucket_name: "orbit-images"
- folder_path: "" (list root to verify access)

**🚨 STORAGE CHECKPOINT**:
- If access denied or errors, STOP workflow
- Verify proper bucket permissions for processing

## PHASE 1: ORDER DISCOVERY & PREPARATION

### STEP 1: UPDATE ORDER STATUS TO PROCESSING
Action: Mark order and batch as processing.
Tool: supabase_execute_sql

\`\`\`sql
-- Update order status
UPDATE orders SET 
  processing_stage = 'processing',
  processing_completion_percentage = 10,
  order_status = 'processing'
WHERE id = '${context.order.id}';

-- Update batch status  
UPDATE batches SET 
  status = 'processing',
  processing_start_time = NOW()
WHERE id = '${context.batch.id}';
\`\`\`

### STEP 2: GET PENDING IMAGES FOR PROCESSING
Action: Find all images that need processing.
Tool: supabase_execute_sql

\`\`\`sql
SELECT id, original_filename, storage_path_original, processing_status, file_size, mime_type
FROM images 
WHERE order_id = '${context.order.id}'
AND processing_status = 'pending'
ORDER BY original_filename ASC;
\`\`\`

### STEP 3: VERIFY ORIGINAL FILES EXIST
Action: Verify all original images exist in storage before processing.
Tool: supabase_storage_list_files

- bucket_name: "orbit-images"
- folder_path: "${context.orderFolder}/original"

**🚨 VERIFICATION CHECKPOINT**: 
- Compare database image records with actual storage files
- If mismatch found, log error and mark order as error
- Only proceed if ALL images have corresponding storage files

## PHASE 2: PER-IMAGE PROCESSING (ATOMIC PIPELINE)

**🔄 FOR EACH IMAGE (Process completely before moving to next):**

### STEP 4A: UPDATE IMAGE STATUS TO PROCESSING
Action: Mark current image as processing.
Tool: supabase_execute_sql

\`\`\`sql
UPDATE images 
SET processing_status = 'processing'
WHERE id = '{image_id}';
\`\`\`

### STEP 4B: CREATE SIGNED URL FOR ANALYSIS
Action: Create signed URL for Gemini access.
Tool: supabase_storage_create_signed_urls
- bucket_name: "orbit-images"
- file_paths: ["{image_storage_path}"]
- expires_in: 3600

### STEP 4C: ANALYZE IMAGE WITH GEMINI AI
Action: Process image with Gemini AI via MCP service.
Tool: mcp_ai_analysis
- image_url: {signed_url_from_step_4B}
- analysis_type: "lifestyle" or "product" (auto-detect)

Critical Requirements:
- Store the COMPLETE analysis response (do not truncate)
- Handle both product and lifestyle analysis types
- Verify analysis contains required metadata sections

### STEP 4D: STORE ANALYSIS WITH VERIFICATION
Action: Save the full Gemini analysis response to database.
Tool: supabase_execute_sql

\`\`\`sql
UPDATE images 
SET gemini_analysis_raw = '{COMPLETE_GEMINI_RESPONSE_JSON}',
    ai_analysis = '{STRUCTURED_METADATA}',
    processing_status = 'analyzing'
WHERE id = '{image_id}';
\`\`\`

**🚨 VERIFICATION CHECKPOINT**: 
- Verify the JSON was stored correctly
- Verify analysis contains required metadata sections
- If verification fails, retry once, then mark image as error

### STEP 4E: EMBED METADATA INTO IMAGE
Action: Embed metadata into image and save to processed folder.
Tool: mcp_metadata_embed
- source_path: "{order_folder}/original/{filename}"
- output_path: "{order_folder}/processed/{filename}_processed.jpg"
- metadata: {COMPLETE_GEMINI_METADATA}
- compression_quality: 95

**🚨 VERIFICATION CHECKPOINT**: 
Tool: supabase_storage_list_files
- Verify processed file was created in storage
- Verify file size > 0 (successful processing)
- If verification fails, retry once, then mark image as error

### STEP 4F: CREATE XMP PACKET AND REPORT
Action: Create standalone XMP packet file and human-readable report.
Tool: mcp_metadata_embed (additional calls)
- Create XMP: "{order_folder}/processed/{filename}.xmp"
- Create Report: "{order_folder}/processed/{filename}_report.txt"

### STEP 4G: UPDATE DATABASE WITH FINAL VERIFICATION
Action: Update image record with processed paths after verification.
Tool: supabase_execute_sql

\`\`\`sql
-- First verify the processed file exists
UPDATE images 
SET storage_path_processed = '{processed_storage_path}',
    processing_status = 'complete',
    processed_at = NOW()
WHERE id = '{image_id}';
\`\`\`

**🚨 CRITICAL STORAGE VERIFICATION**:
Tool: supabase_storage_list_files
- bucket_name: "orbit-images"
- folder_path: "{order_folder}/processed"
- Verify the processed file exists in the list
- If file not found, ROLLBACK the database update and mark as error

**🔄 REPEAT FOR NEXT IMAGE OR CONTINUE TO PHASE 3**

## PHASE 3: ORDER FINALIZATION & VERIFICATION

### STEP 5: VERIFY ALL IMAGES COMPLETED
Action: Comprehensive verification that ALL images are properly processed.
Tool: supabase_execute_sql

\`\`\`sql
-- Check that all images for this order are complete
SELECT 
    COUNT(*) as total_images,
    COUNT(CASE WHEN processing_status = 'complete' THEN 1 END) as completed_images,
    COUNT(CASE WHEN storage_path_processed IS NOT NULL THEN 1 END) as has_processed_files,
    COUNT(CASE WHEN processing_status = 'error' THEN 1 END) as error_images
FROM images 
WHERE order_id = '${context.order.id}';
\`\`\`

**🚨 CRITICAL VERIFICATION CHECKPOINT**:
- total_images MUST equal completed_images (or completed + error)
- completed_images MUST equal has_processed_files
- If ANY mismatch: DO NOT PROCEED, investigate failed images

### STEP 6: VERIFY PROCESSED FILES IN STORAGE
Action: Double-check that storage matches database records.
Tool: supabase_storage_list_files
- bucket_name: "orbit-images"
- folder_path: "${context.orderFolder}/processed"

**🚨 STORAGE VERIFICATION CHECKPOINT**:
- Count files in processed folder
- Verify count matches completed images from database
- If mismatch found: DO NOT COMPLETE ORDER, mark as error

### STEP 7: COMPLETE ORDER PROCESSING
Action: Mark all components as complete ONLY after full verification.
Tool: supabase_execute_sql

\`\`\`sql
-- Mark order complete ONLY if all images verified
UPDATE orders SET 
  processing_stage = 'completed',
  processing_completion_percentage = 100,
  order_status = 'completed',
  completed_at = NOW()
WHERE id = '${context.order.id}';

-- Mark batch complete
UPDATE batches SET 
  status = 'completed',
  processing_end_time = NOW(),
  processing_completion_percentage = 100,
  completed_at = NOW(),
  processed_count = (SELECT COUNT(*) FROM images WHERE order_id = '${context.order.id}' AND processing_status = 'complete'),
  error_count = (SELECT COUNT(*) FROM images WHERE order_id = '${context.order.id}' AND processing_status = 'error')
WHERE id = '${context.batch.id}';
\`\`\`

## PHASE 4: EMAIL & CLEANUP

### STEP 8: TRIGGER EMAIL COMPLETION
Action: Call the existing email function for order completion.
Tool: supabase_execute_sql

\`\`\`sql
-- Call the existing send-order-completion-email function
SELECT extensions.http((
    'POST',
    '${context.order.id ? `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-order-completion-email` : 'SUPABASE_URL/functions/v1/send-order-completion-email'}',
    ARRAY[
        extensions.http_header('Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')),
        extensions.http_header('Content-Type', 'application/json')
    ],
    'application/json',
    json_build_object('orderId', '${context.order.id}')::text
)::extensions.http_request);

-- Mark email as sent after successful invocation
UPDATE orders SET email_sent = true 
WHERE id = '${context.order.id}' AND processing_stage = 'completed';
\`\`\`

### STEP 9: FINAL VERIFICATION & CLEANUP
Action: Perform final system consistency check.
Tool: supabase_execute_sql

\`\`\`sql
-- Comprehensive final verification
SELECT 
    o.id as order_id,
    o.processing_stage,
    o.order_status,
    o.email_sent,
    o.processing_completion_percentage,
    COUNT(i.id) as total_images,
    COUNT(CASE WHEN i.processing_status = 'complete' THEN 1 END) as completed_images,
    COUNT(CASE WHEN i.storage_path_processed IS NOT NULL THEN 1 END) as has_processed_paths
FROM orders o
LEFT JOIN images i ON o.id = i.order_id
WHERE o.id = '${context.order.id}'
GROUP BY o.id;
\`\`\`

## ERROR HANDLING PROTOCOLS:

### Image-Level Error Recovery:
\`\`\`sql
-- Mark image as error after retries
UPDATE images SET 
  processing_status = 'error', 
  error_message = '{error_details}',
  processed_at = NOW()
WHERE id = '{image_id}';
\`\`\`

### Order-Level Error Recovery:
\`\`\`sql
-- Mark order as error if no recoverable images
UPDATE orders SET 
  processing_stage = 'failed', 
  order_status = 'failed',
  error_message = '{order_error_details}'
WHERE id = '${context.order.id}';
\`\`\`

## SUCCESS CRITERIA:

✅ **WORKFLOW COMPLETE** when:
1. All images processed successfully OR marked as error
2. Database records match storage files
3. Order status updated correctly
4. Email notification sent
5. Final verification passes

## EXECUTION INSTRUCTIONS:

1. **Execute each phase sequentially** - do not skip steps
2. **Verify each checkpoint** before proceeding
3. **Use atomic processing** - complete each image fully before next
4. **Maintain comprehensive error logging** throughout
5. **Ensure database consistency** at all times

**Begin comprehensive ORBIT workflow processing now.**

Remember: 
- ALWAYS verify file existence before marking complete
- Use atomic processing for each image
- Maintain comprehensive error logging
- Ensure database consistency throughout
- Stop processing if critical checkpoints fail
`;
  }

  static getSystemPrompt(): string {
    return `You are an ORBIT image processing specialist with deep expertise in:

1. **Workflow Orchestration**: Managing complex multi-step image processing pipelines
2. **Database Operations**: SQL queries, data consistency, and transactional integrity
3. **Storage Management**: File operations, verification, and organization
4. **AI Integration**: Gemini API analysis and metadata processing
5. **Error Handling**: Atomic rollbacks, intelligent retry logic, and failure recovery
6. **Progress Tracking**: Transparent status updates and checkpoint verification

## Core Principles:
- **Atomic Processing**: Each image is processed completely before moving to the next
- **Verification First**: Always verify operations succeeded before updating status
- **Comprehensive Logging**: Track every step with correlation IDs
- **Graceful Degradation**: Handle partial failures intelligently
- **Database Consistency**: Ensure data integrity throughout the workflow

## Your Mission:
Execute the complete ORBIT workflow systematically, verifying each step and maintaining transparency through progress tracking. Use the available tools to interact with the database, storage, and MCP services to process images with AI analysis and metadata embedding.

## Key Behaviors:
- Always verify file existence before database updates
- Use todo_write to track progress phases
- Stop processing if critical checkpoints fail
- Provide detailed error information for debugging
- Ensure each image is atomically processed
- Maintain database consistency throughout`;
  }

  static getToolDescriptions() {
    return {
      supabase_execute_sql: "Execute SQL queries on the Supabase database. Use for all database operations including SELECT, UPDATE, INSERT queries.",
      supabase_storage_list_files: "List files in Supabase Storage buckets. Use for file verification and directory listing.",
      supabase_storage_create_signed_urls: "Create signed URLs for secure file access. Use when MCP services need to access files.",
      mcp_ai_analysis: "Call the Gemini AI analysis MCP service. Analyzes images and returns comprehensive metadata.",
      mcp_metadata_embed: "Call the metadata embedding MCP service. Embeds XMP metadata into images and creates reports.",
      mcp_storage_operations: "Call the storage operations MCP service. Handles file operations and storage management.",
      todo_write: "Track workflow progress and phases. Use to maintain transparency and checkpoint verification."
    };
  }

  static buildErrorRecoveryPrompt(error: Error, context: OrderContext, phase: string): string {
    return `
# ORBIT Workflow Error Recovery

An error occurred during ${phase} processing for Order ${context.order.id}.

## Error Details:
- **Phase**: ${phase}
- **Error**: ${error.message}
- **Order ID**: ${context.order.id}
- **Batch ID**: ${context.batch.id}

## Recovery Actions Required:
1. Assess the error type and determine if recovery is possible
2. Check database state for consistency
3. Perform atomic rollback if necessary
4. Mark appropriate records as error if recovery fails
5. Continue processing other images if possible
6. Update overall order status appropriately

## Available Recovery Tools:
- Database state verification
- Atomic rollback operations
- Error classification and logging
- Partial completion handling

Please analyze the error and execute appropriate recovery actions.
`;
  }

  static buildHealthCheckPrompt(): string {
    return `
# ORBIT System Health Check

Perform a comprehensive health check of the ORBIT processing system.

## Health Check Requirements:
1. **Database Connectivity**: Verify database connection and basic queries
2. **Storage Access**: Verify storage bucket access and file operations
3. **MCP Services**: Check availability of AI analysis, metadata, and storage services
4. **Environment**: Verify required environment variables and configuration

## Expected Response:
Return a detailed health status with specific component status and any issues found.

Use the available tools to test each system component and provide a comprehensive health report.
`;
  }
}

// Helper function to build context-aware prompts
export function buildORBITWorkflowPrompt(context: OrderContext): string {
  return ORBITWorkflowPrompts.buildMainWorkflowPrompt(context);
}

export function buildORBITSystemPrompt(): string {
  return ORBITWorkflowPrompts.getSystemPrompt();
}

export function buildORBITErrorRecoveryPrompt(error: Error, context: OrderContext, phase: string): string {
  return ORBITWorkflowPrompts.buildErrorRecoveryPrompt(error, context, phase);
}

export function buildORBITHealthCheckPrompt(): string {
  return ORBITWorkflowPrompts.buildHealthCheckPrompt();
}