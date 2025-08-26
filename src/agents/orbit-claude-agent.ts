import 'dotenv/config'
import { query } from '@anthropic-ai/claude-code';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';

// Types for our workflow
interface Order {
  id: string;
  user_id: string;
  order_number: string;
  batch_id: string;
  processing_stage: string;
  payment_status: string;
}

interface Image {
  id: string;
  order_id: string;
  original_filename: string;
  storage_path_original: string;
  storage_path_processed?: string;
  processing_status: string;
  gemini_analysis_raw?: string;
}

interface WorkflowResult {
  success: boolean;
  processed_orders: number;
  failed_orders: string[];
  error?: string;
}

// Supabase operations helper
class SupabaseHelper {
  private supabase: SupabaseClient;
  private serviceKey: string;

  constructor(supabase: SupabaseClient, serviceKey: string) {
    this.supabase = supabase;
    this.serviceKey = serviceKey;
  }

  async executeSQL(query: string): Promise<any> {
    const { data, error } = await this.supabase.rpc('execute_sql', {
      query: query,
    });
    if (error) throw new Error(`Database error: ${error.message}`);
    return data;
  }

  async listFiles(bucketName: string, folderPath?: string): Promise<any[]> {
    const { data, error } = await this.supabase.storage
      .from(bucketName)
      .list(folderPath || '', { limit: 1000 });
    if (error) throw new Error(`Storage error: ${error.message}`);
    return data || [];
  }

  async invokeAIAnalysis(image_path: string): Promise<any> {
    console.log(`Invoking AI analysis for: ${image_path}`);
    const { data, error } = await this.supabase.functions.invoke('mcp-ai-analysis', {
        body: { image_path },
        headers: {
            'Authorization': `Bearer ${this.serviceKey}`
        }
    });
    if (error) {
        console.error('AI analysis function invocation failed:', error);
        throw new Error(`AI analysis function invocation failed: ${error.message}`);
    }
    return data;
  }

  async invokeMetadataProcessing(image_path: string, analysis_result: any): Promise<any> {
    console.log(`Invoking metadata processing for: ${image_path}`);
    const { data, error } = await this.supabase.functions.invoke('mcp-metadata', {
        body: {
            tool_name: 'process_image_metadata',
            parameters: { image_path, analysis_result },
        },
        headers: {
            'Authorization': `Bearer ${this.serviceKey}`
        }
    });
    if (error) {
        console.error('Metadata processing function invocation failed:', error);
        throw new Error(`Metadata processing function invocation failed: ${error.message}`);
    }
    return data;
  }
}

// Main ORBIT Workflow Processor Agent
export class ORBITWorkflowProcessor extends EventEmitter {
  private supabase: SupabaseClient;
  private supabaseHelper: SupabaseHelper;
  private anthropicApiKey: string;

  constructor(
    anthropicApiKey: string,
    supabaseUrl: string,
    supabaseServiceKey: string
  ) {
    super();
    this.anthropicApiKey = anthropicApiKey;
    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    this.supabaseHelper = new SupabaseHelper(this.supabase, supabaseServiceKey);
  }

  async processOrders(): Promise<WorkflowResult> {
    try {
      console.log('🚀 Starting ORBIT workflow processor...');
      this.emit('workflow:started');
      const contextData = await this.prepareWorkflowContext();
      let processedOrders = 0;
      let failedOrders: string[] = [];

      const toolImplementations = {
        supabase_execute_sql: (args: any) => this.supabaseHelper.executeSQL(args.query),
        supabase_storage_list_files: (args: any) => this.supabaseHelper.listFiles(args.bucket_name, args.folder_path),
        invoke_ai_analysis: (args: any) => this.supabaseHelper.invokeAIAnalysis(args.image_path),
        invoke_metadata_processing: (args: any) => this.supabaseHelper.invokeMetadataProcessing(args.image_path, args.analysis_result),
      };

      for await (const message of query({
        prompt: this.buildWorkflowPrompt(contextData),
        options: {
          systemPrompt: "You are an ORBIT image processing specialist. You have direct access to a suite of Supabase tools to execute the workflow. Use these tools systematically and verify each step.",
        },
      })) {
        if (message.type === 'text') {
          console.log('📝 Claude:', message.content);
        } else if (message.type === 'tool_use') {
          console.log('🔧 Tool used:', message.name, 'with input:', message.input);
        }
      }

      console.log('✅ Workflow completed successfully');
      this.emit('workflow:completed', { processedOrders, failedOrders });
      return { success: true, processed_orders: processedOrders, failed_orders: failedOrders };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('💥 Workflow crashed:', errorMessage);
      this.emit('workflow:error', errorMessage);
      return { success: false, processed_orders: 0, failed_orders: [], error: errorMessage };
    }
  }

  private async prepareWorkflowContext(): Promise<any> {
    try {
      const pendingOrders = await this.supabaseHelper.executeSQL(
        `SELECT COUNT(*) as count FROM orders WHERE processing_stage = 'pending' AND payment_status = 'completed'`
      );
      const storageTest = await this.supabaseHelper.listFiles('orbit-images', '');
      return {
        pending_orders_count: pendingOrders[0]?.count || 0,
        storage_accessible: storageTest.length >= 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.warn('Context preparation failed:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private buildWorkflowPrompt(context: any): string {
    return `
# ORBIT Image Processing Workflow - Enhanced Version

You are an AI assistant responsible for executing the complete ORBIT image processing workflow. Your task is to automatically process pending orders from start to finish by calling the available tools. For any step requiring SQL, generate the necessary SQL query based on the natural language instruction.

## Workflow Context:
- Pending Orders: ${context.pending_orders_count || 0}
- Storage Status: ${context.storage_accessible ? 'Accessible' : 'Error'}
- Timestamp: ${context.timestamp}

## Available Tools:
You have direct access to the following tools. Call them with the specified parameters.

- **supabase_execute_sql(query: string)**: Executes a SQL query. You must generate the SQL string for the 'query' parameter.
- **supabase_storage_list_files(bucket_name: string, folder_path?: string)**: Lists files in storage.
- **invoke_ai_analysis(image_path: string)**: Calls the remote AI analysis function.
- **invoke_metadata_processing(image_path: string, analysis_result: object)**: Calls the remote metadata processing function.

## Your Mission:
Execute the following phases and steps sequentially using the provided tools.

## PHASE 1: ORDER DISCOVERY & PREPARATION

### STEP 1: FIND PENDING ORDERS
Action: Find the oldest pending order from the 'orders' table that has a 'completed' payment status.
Tool: supabase_execute_sql
Instruction: "Generate a SQL query to select the id, user_id, order_number, and batch_id for the oldest order where processing_stage is 'pending' and payment_status is 'completed'."

### STEP 2: START PROCESSING
Action: Mark the order and its corresponding batch as 'processing'.
Tool: supabase_execute_sql
Instruction: "Generate two SQL queries. First, for the order ID from the previous step, update its 'processing_stage' and 'order_status' to 'processing' and set 'processing_started_at' to the current timestamp. Second, do the same for the batch associated with the order, updating its 'status' and 'processing_stage' to 'processing'."

### STEP 3: DISCOVER IMAGES
Action: Find all images associated with the current order that are pending processing.
Tool: supabase_execute_sql
Instruction: "Generate a SQL query to select the id, original_filename, and storage_path_original from the 'images' table for all images where the 'order_id' matches the one from Step 1 and the 'processing_status' is 'pending'."

### STEP 4: VERIFY ORIGINAL FILES EXIST
Action: Verify all original images exist in storage.
Tool: supabase_storage_list_files
Tool Input:
{
  "bucket_name": "orbit-images",
  "folder_path": "{order_id}_{user_id}/original"
}
Instruction: "Compare the list of files from storage with the list of images from the database in the previous step. If any are missing, stop and report an error."

## PHASE 2: PER-IMAGE PROCESSING (ATOMIC PIPELINE)

**🔄 FOR EACH IMAGE:**

### STEP 5A: ANALYZE IMAGE WITH GEMINI
Action: Process the image with the remote Gemini AI analysis function.
Tool: invoke_ai_analysis
Tool Input:
{
  "image_path": "{storage_path_original}"
}

### STEP 5B: STORE ANALYSIS WITH VERIFICATION
Action: Save the full Gemini analysis response to the database.
Tool: supabase_execute_sql
Instruction: "Generate a SQL query to update the current image record in the 'images' table. Set the 'gemini_analysis_raw' column to the full JSON result from the AI analysis (ensure the JSON is properly escaped for SQL), and update the 'processing_status' to 'processing'."

### STEP 5C: PROCESS AND EMBED METADATA
Action: Call the remote metadata processing server.
Tool: invoke_metadata_processing
Tool Input:
{
  "image_path": "{storage_path_original}",
  "analysis_result": {COMPLETE_GEMINI_RESPONSE_JSON}
}

### STEP 5D: UPDATE DATABASE WITH VERIFICATION
Action: Update the image record with the path to the processed file.
Tool: supabase_execute_sql
Instruction: "Generate a SQL query to update the current image record in the 'images' table. Set the 'storage_path_processed' column to the 'processed_file_path' value from the result of the previous step. Set 'processing_status' to 'complete' and 'processed_at' to the current timestamp."

### STEP 5E: VERIFY PROCESSED FILE
Action: Verify the processed file from the metadata step exists in storage.
Tool: supabase_storage_list_files
Instruction: "List the files in the processed folder and confirm the file with the path 'processed_file_path' from step 5C exists."

## PHASE 3 & 4: FINALIZATION AND CLEANUP
(Continue using the tools as needed to complete the order and trigger emails, generating SQL from natural language instructions.)
`;
  }

  // Event-driven triggers
  async onOrderCreated(orderId: string) {
    console.log(`📨 Order created event received: ${orderId}`);
    this.emit('order:created', orderId);
    return await this.processOrders();
  }

  async onPaymentCompleted(orderId: string) {
    console.log(`💳 Payment completed event received: ${orderId}`);
    this.emit('payment:completed', orderId);
    return await this.processOrders();
  }

  async onBatchReady(batchId: string) {
    console.log(`📦 Batch ready event received: ${batchId}`);
    this.emit('batch:ready', batchId);
    return await this.processOrders();
  }

  // Manual trigger
  async triggerWorkflow() {
    console.log('🔧 Manual workflow trigger');
    this.emit('workflow:manual_trigger');
    return await this.processOrders();
  }

  // Health check
  async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      const { data: dbTest } = await this.supabase.from('orders').select('count').limit(1);
      const { data: storageTest } = await this.supabase.storage.from('orbit-images').list('', { limit: 1 });
      return {
        status: 'healthy',
        details: {
          database: dbTest ? 'connected' : 'error',
          storage: storageTest ? 'connected' : 'error',
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }
}

// Usage example and configuration
export const createORBITProcessor = (config: {
  anthropicApiKey: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
}) => {
  const processor = new ORBITWorkflowProcessor(
    config.anthropicApiKey,
    config.supabaseUrl,
    config.supabaseServiceKey
  );

  processor.on('workflow:started', () => console.log('🚀 ORBIT workflow started'));
  processor.on('workflow:completed', (result) => console.log('✅ ORBIT workflow completed:', result));
  processor.on('workflow:error', (error) => console.error('💥 ORBIT workflow error:', error));

  return processor;
};

// Main execution block
async function main() {
  if (!process.env.ANTHROPIC_API_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error("Please set ANTHROPIC_API_KEY, SUPABASE_URL, and SUPABASE_SERVICE_KEY environment variables.");
    process.exit(1);
  }

  const processor = createORBITProcessor({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
  });

  console.log("Triggering ORBIT workflow processor...");
  const result = await processor.triggerWorkflow();
  console.log("Workflow finished.", result);
}

main().catch(error => {
  console.error("Error running workflow processor:", error);
  process.exit(1);
});
