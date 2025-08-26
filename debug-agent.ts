import 'dotenv/config';

console.log("=== ORBIT Agent Debug Session ===");
console.log(`Timestamp: ${new Date().toISOString()}`);
console.log(`Node version: ${process.version}`);
console.log(`Platform: ${process.platform}`);
console.log(`Working directory: ${process.cwd()}`);

console.log("\n=== Environment Variables Check ===");
const envVars = ['ANTHROPIC_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
envVars.forEach(varName => {
  const value = process.env[varName];
  console.log(`${varName}: ${value ? `[SET - ${value.length} chars]` : '[NOT SET]'}`);
});

console.log("\n=== Module Import Test ===");
try {
  console.log("Importing @anthropic-ai/claude-code...");
  const { query } = require('@anthropic-ai/claude-code');
  console.log("✅ Claude Code SDK imported successfully");
  
  console.log("Importing @supabase/supabase-js...");
  const { createClient } = require('@supabase/supabase-js');
  console.log("✅ Supabase SDK imported successfully");
  
  console.log("Importing EventEmitter...");
  const { EventEmitter } = require('events');
  console.log("✅ EventEmitter imported successfully");
  
} catch (error) {
  console.error("❌ Module import failed:", error);
}

console.log("\n=== Test Complete ===");
console.log("If this completes successfully, the issue is in the agent logic, not the imports.");