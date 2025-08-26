import 'dotenv/config';
import { createORBITProcessor } from './src/agents/orbit-claude-agent';

async function test() {
  console.log('Testing ORBIT agent with basic setup...');
  
  if (!process.env.ANTHROPIC_API_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error("Please set required environment variables.");
    process.exit(1);
  }

  const processor = createORBITProcessor({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
  });

  console.log("Running health check...");
  const health = await processor.healthCheck();
  console.log("Health check result:", health);
  
  if (health.status === 'healthy') {
    console.log("Starting basic workflow test...");
    const result = await processor.triggerWorkflow();
    console.log("Workflow test result:", result);
  }
}

test().catch(console.error);