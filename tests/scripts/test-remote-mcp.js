// Test script to call remote MCP servers
const SUPABASE_URL = 'https://ufdcvxmizlzlnyyqpfck.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmZGN2eG1pemx6bG55eXFwZmNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTI5NzQ0NSwiZXhwIjoyMDUwODczNDQ1fQ.b5CZAS2XuT1fTwDM7t0qEEFSdpAG8P1EZlkjvKJKqtI';

// Test remote AI analysis MCP server
async function testRemoteAIAnalysis() {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/mcp-ai-analysis`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'analyze_image',
        arguments: {
          image_path: 'orbit-images/1dac9808-f7dd-4bec-8312-c8b0d0121898_2191eee9-780f-4f80-8bf8-1d2a6a785df2/original/1755541944283_0_Golden_Hour_Patio_Scene.png'
        }
      },
      id: 'test-analysis-1'
    })
  });

  const result = await response.text();
  console.log('Response Status:', response.status);
  console.log('Response Body:', result);
  
  if (response.status === 200) {
    try {
      const parsedResult = JSON.parse(result);
      console.log('✅ Remote AI Analysis MCP Server is working!');
      console.log('Analysis Result:', JSON.stringify(parsedResult, null, 2));
      return parsedResult;
    } catch (e) {
      console.log('Failed to parse JSON:', e.message);
    }
  } else {
    console.log('❌ Remote AI Analysis MCP Server failed');
  }
}

testRemoteAIAnalysis().catch(console.error);