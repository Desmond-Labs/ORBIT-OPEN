/**
 * Unit tests for MCP Server Library
 */

import { assertEquals, assertExists, assertRejects } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { MCPServer, createORBITMCPServer, corsHeaders } from '../mcp-server.ts';
import {
  MCPErrorCode,
  MCPMethod,
  MCPServerConfig,
  MCPServiceToolDefinition,
  JsonRpcRequest,
  JsonRpcResponse,
  createMCPError,
} from '../mcp-types.ts';
import {
  MCPTestFactory,
  MCPTestAssertions,
  MCPPerformanceTest,
  MCPTestEnvironment,
  MCPTestValidation,
} from './test-utils.ts';

// Set up test environment
MCPTestEnvironment.setupTestEnv();

Deno.test("MCP Server - Initialize", async () => {
  const server = new MCPServer({
    name: "test-server",
    version: "1.0.0",
    tools: [],
    authRequired: false,
  });

  const initRequest = MCPTestFactory.createInitializeRequest();
  const mockRequest = new Request("https://test.example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(initRequest),
  });

  const response = await server.handleRequest(mockRequest);
  const responseData = await response.json();

  MCPTestAssertions.assertSuccessResponse(responseData);
  assertEquals(responseData.result.serverInfo.name, "test-server");
  assertEquals(responseData.result.protocolVersion, "2024-11-05");
  assertExists(responseData.result.capabilities);
});

Deno.test("MCP Server - Tools List", async () => {
  const testTool = MCPTestFactory.createTestToolDefinition("list-test-tool");
  const server = createORBITMCPServer("test-server", [testTool]);

  const listRequest = MCPTestFactory.createToolsListRequest();
  const mockRequest = new Request("https://test.example.com", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify(listRequest),
  });

  const response = await server.handleRequest(mockRequest);
  const responseData = await response.json();

  MCPTestAssertions.assertSuccessResponse(responseData);
  assertEquals(responseData.result.tools.length, 1);
  assertEquals(responseData.result.tools[0].name, "list-test-tool");
});

Deno.test("MCP Server - Tool Call Success", async () => {
  const testTool = MCPTestFactory.createTestToolDefinition("call-test-tool");
  const server = createORBITMCPServer("test-server", [testTool]);

  const callRequest = MCPTestFactory.createToolsCallRequest("call-test-tool", {
    input: "test-value",
  });

  const mockRequest = new Request("https://test.example.com", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify(callRequest),
  });

  const response = await server.handleRequest(mockRequest);
  const responseData = await response.json();

  MCPTestAssertions.assertSuccessResponse(responseData);
  assertEquals(responseData.result.isError, false);
  assertEquals(responseData.result.content.length, 1);
  assertEquals(responseData.result.content[0].type, "text");
  assertEquals(responseData.result.content[0].text.includes("test-value"), true);
});

Deno.test("MCP Server - Tool Call - Tool Not Found", async () => {
  const server = createORBITMCPServer("test-server", []);

  const callRequest = MCPTestFactory.createToolsCallRequest("nonexistent-tool");
  const mockRequest = new Request("https://test.example.com", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify(callRequest),
  });

  const response = await server.handleRequest(mockRequest);
  const responseData = await response.json();

  MCPTestAssertions.assertErrorResponse(responseData, MCPErrorCode.MethodNotFound);
});

Deno.test("MCP Server - Invalid Method", async () => {
  const server = createORBITMCPServer("test-server", []);

  const invalidRequest: JsonRpcRequest = {
    jsonrpc: "2.0",
    method: "invalid-method",
    id: 1,
  };

  const mockRequest = new Request("https://test.example.com", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify(invalidRequest),
  });

  const response = await server.handleRequest(mockRequest);
  const responseData = await response.json();

  MCPTestAssertions.assertErrorResponse(responseData, MCPErrorCode.MethodNotFound);
});

Deno.test("MCP Server - Invalid JSON", async () => {
  const server = createORBITMCPServer("test-server", []);

  const mockRequest = new Request("https://test.example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "invalid-json-{",
  });

  const response = await server.handleRequest(mockRequest);
  const responseData = await response.json();

  MCPTestAssertions.assertErrorResponse(responseData, MCPErrorCode.ParseError);
});

Deno.test("MCP Server - CORS Preflight", async () => {
  const server = createORBITMCPServer("test-server", []);

  const mockRequest = new Request("https://test.example.com", {
    method: "OPTIONS",
  });

  const response = await server.handleRequest(mockRequest);
  
  assertEquals(response.status, 200);
  MCPTestValidation.validateCORSHeaders(response.headers);
});

Deno.test("MCP Server - Authentication Required", async () => {
  const testTool = MCPTestFactory.createTestToolDefinition("auth-test-tool");
  const server = createORBITMCPServer("auth-server", [testTool]);

  const callRequest = MCPTestFactory.createToolsCallRequest("auth-test-tool", {
    input: "test",
  });

  const mockRequest = new Request("https://test.example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // No authorization header
    body: JSON.stringify(callRequest),
  });

  const response = await server.handleRequest(mockRequest);
  const responseData = await response.json();

  MCPTestAssertions.assertErrorResponse(responseData, MCPErrorCode.AuthenticationError);
});

Deno.test("MCP Server - Invalid Tool Arguments", async () => {
  const testTool = MCPTestFactory.createTestToolDefinition("validation-test-tool");
  const server = createORBITMCPServer("test-server", [testTool]);

  const callRequest = MCPTestFactory.createToolsCallRequest("validation-test-tool", {
    // Missing required 'input' parameter
    wrongParam: "test",
  });

  const mockRequest = new Request("https://test.example.com", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify(callRequest),
  });

  const response = await server.handleRequest(mockRequest);
  const responseData = await response.json();

  MCPTestAssertions.assertErrorResponse(responseData, MCPErrorCode.InvalidParams);
});

Deno.test("MCP Server - Batch Request", async () => {
  const testTool = MCPTestFactory.createTestToolDefinition("batch-test-tool");
  const server = createORBITMCPServer("test-server", [testTool]);

  const batchRequest = [
    MCPTestFactory.createInitializeRequest(),
    MCPTestFactory.createToolsListRequest(),
  ];

  const mockRequest = new Request("https://test.example.com", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify(batchRequest),
  });

  const response = await server.handleRequest(mockRequest);
  const responseData = await response.json();

  assertEquals(Array.isArray(responseData), true);
  assertEquals(responseData.length, 2);
  
  MCPTestAssertions.assertSuccessResponse(responseData[0]);
  MCPTestAssertions.assertSuccessResponse(responseData[1]);
});

Deno.test("MCP Server - Ping Method", async () => {
  const server = createORBITMCPServer("test-server", []);

  const pingRequest: JsonRpcRequest = {
    jsonrpc: "2.0",
    method: "ping",
    id: 1,
  };

  const mockRequest = new Request("https://test.example.com", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify(pingRequest),
  });

  const response = await server.handleRequest(mockRequest);
  const responseData = await response.json();

  MCPTestAssertions.assertSuccessResponse(responseData);
  assertEquals(responseData.result.status, "ok");
  assertExists(responseData.result.timestamp);
});

Deno.test("MCP Server - Performance Test", async () => {
  const testTool = MCPTestFactory.createTestToolDefinition("perf-test-tool");
  const server = createORBITMCPServer("test-server", [testTool]);

  const callRequest = MCPTestFactory.createToolsCallRequest("perf-test-tool", {
    input: "performance-test",
  });

  const mockRequest = new Request("https://test.example.com", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify(callRequest),
  });

  const perfTest = new MCPPerformanceTest();
  perfTest.start();
  
  const response = await server.handleRequest(mockRequest);
  const responseData = await response.json();
  
  // Assert response time is under 100ms (target from plan)
  perfTest.assertResponseTime(100);

  MCPTestAssertions.assertSuccessResponse(responseData);
});

Deno.test("MCP Server - Tool Execution Error Handling", async () => {
  const errorTool: MCPServiceToolDefinition = {
    name: "error-tool",
    schema: MCPTestFactory.createTestTool("error-tool"),
    handler: async () => {
      throw new Error("Simulated tool error");
    },
  };

  const server = createORBITMCPServer("test-server", [errorTool]);

  const callRequest = MCPTestFactory.createToolsCallRequest("error-tool", {
    input: "test",
  });

  const mockRequest = new Request("https://test.example.com", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify(callRequest),
  });

  const response = await server.handleRequest(mockRequest);
  const responseData = await response.json();

  MCPTestAssertions.assertSuccessResponse(responseData);
  assertEquals(responseData.result.isError, true);
  assertEquals(responseData.result.content[0].text.includes("Tool execution failed"), true);
});

Deno.test("MCP Server - HTTP Method Validation", async () => {
  const server = createORBITMCPServer("test-server", []);

  const mockRequest = new Request("https://test.example.com", {
    method: "GET", // Should only accept POST
  });

  const response = await server.handleRequest(mockRequest);
  const responseData = await response.json();

  MCPTestAssertions.assertErrorResponse(responseData, MCPErrorCode.InvalidRequest);
});

Deno.test("MCP Server - Protocol Compliance Validation", async () => {
  const server = createORBITMCPServer("test-server", []);

  const initRequest = MCPTestFactory.createInitializeRequest();
  const mockRequest = new Request("https://test.example.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(initRequest),
  });

  const response = await server.handleRequest(mockRequest);
  const responseData = await response.json();

  // Validate protocol compliance
  assertEquals(MCPTestValidation.validateProtocolCompliance(responseData), true);
  assertEquals(MCPTestValidation.validateCORSHeaders(response.headers), true);
  assertEquals(MCPTestValidation.validateSecurityHeaders(response.headers), true);
});

Deno.test("MCP Server - Service Role Authentication", async () => {
  const testTool = MCPTestFactory.createTestToolDefinition("service-role-tool");
  const server = createORBITMCPServer("test-server", [testTool]);

  const callRequest = MCPTestFactory.createToolsCallRequest("service-role-tool", {
    input: "service-test",
  });

  const mockRequest = new Request("https://test.example.com", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify(callRequest),
  });

  const response = await server.handleRequest(mockRequest);
  const responseData = await response.json();

  MCPTestAssertions.assertSuccessResponse(responseData);
  assertEquals(responseData.result.content[0].text.includes("service-test"), true);
});

// Cleanup test environment
Deno.test("Cleanup Test Environment", () => {
  MCPTestEnvironment.cleanupTestEnv();
});