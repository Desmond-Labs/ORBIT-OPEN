/**
 * Unit tests for MCP Client Library
 */

import { assertEquals, assertExists, assertRejects } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { 
  MCPClient, 
  MCPClientError,
  createORBITMCPClient,
  MCPConnectionPool,
  getGlobalMCPPool,
} from '../mcp-client.ts';
import {
  MCPErrorCode,
  MCPMethod,
  MCPTool,
  MCPToolResult,
  JsonRpcRequest,
  JsonRpcResponse,
} from '../mcp-types.ts';
import {
  MCPTestFactory,
  MCPTestAssertions,
  MockMCPServer,
  MCPPerformanceTest,
  MCPTestEnvironment,
  MCPLoadTest,
} from './test-utils.ts';

// Set up test environment
MCPTestEnvironment.setupTestEnv();

// Mock fetch for testing
const originalFetch = globalThis.fetch;
let mockServer: MockMCPServer;

function setupMockFetch(mockServer: MockMCPServer): void {
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const body = init?.body as string;
    const request = JSON.parse(body);
    
    let response;
    if (Array.isArray(request)) {
      // Batch request
      const responses = [];
      for (const req of request) {
        const res = await mockServer.handleRequest(req);
        responses.push(res);
      }
      response = responses;
    } else {
      response = await mockServer.handleRequest(request);
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

function restoreFetch(): void {
  globalThis.fetch = originalFetch;
}

Deno.test("MCP Client - Initialize", async () => {
  mockServer = new MockMCPServer();
  mockServer.mockInitialize("test-server");
  setupMockFetch(mockServer);

  try {
    const client = createORBITMCPClient("https://test.example.com/mcp");
    const result = await client.initialize();

    assertEquals(result.serverInfo.name, "test-server");
    assertEquals(result.protocolVersion, "2024-11-05");
    assertEquals(client.isInitialized(), true);

    const lastRequest = mockServer.getLastRequest();
    assertEquals(lastRequest?.method, MCPMethod.Initialize);
  } finally {
    restoreFetch();
  }
});

Deno.test("MCP Client - List Tools", async () => {
  mockServer = new MockMCPServer();
  mockServer.mockInitialize("test-server");
  
  const testTools = [
    MCPTestFactory.createTestTool("tool1"),
    MCPTestFactory.createTestTool("tool2"),
  ];
  mockServer.mockToolsList(testTools);
  
  setupMockFetch(mockServer);

  try {
    const client = createORBITMCPClient("https://test.example.com/mcp");
    const tools = await client.listTools();

    assertEquals(tools.length, 2);
    assertEquals(tools[0].name, "tool1");
    assertEquals(tools[1].name, "tool2");

    const requests = mockServer.getRequestLog();
    assertEquals(requests.length, 2); // Initialize + ListTools
    assertEquals(requests[1].method, MCPMethod.ToolsList);
  } finally {
    restoreFetch();
  }
});

Deno.test("MCP Client - Call Tool Success", async () => {
  mockServer = new MockMCPServer();
  mockServer.mockInitialize("test-server");
  
  const testTools = [MCPTestFactory.createTestTool("test-tool")];
  mockServer.mockToolsList(testTools);
  
  const mockResult: MCPToolResult[] = [
    {
      type: "text",
      text: "Tool executed successfully",
      metadata: { success: true },
    },
  ];
  mockServer.mockToolCall("test-tool", mockResult);
  
  setupMockFetch(mockServer);

  try {
    const client = createORBITMCPClient("https://test.example.com/mcp");
    const results = await client.callTool("test-tool", { input: "test-value" });

    assertEquals(results.length, 1);
    assertEquals(results[0].type, "text");
    assertEquals(results[0].text, "Tool executed successfully");

    const requests = mockServer.getRequestLog();
    const toolCallRequest = requests.find(r => r.method === MCPMethod.ToolsCall);
    assertExists(toolCallRequest);
    assertEquals(toolCallRequest.params?.name, "test-tool");
    assertEquals(toolCallRequest.params?.arguments.input, "test-value");
  } finally {
    restoreFetch();
  }
});

Deno.test("MCP Client - Call Non-existent Tool", async () => {
  mockServer = new MockMCPServer();
  mockServer.mockInitialize("test-server");
  mockServer.mockToolsList([]); // No tools available
  
  setupMockFetch(mockServer);

  try {
    const client = createORBITMCPClient("https://test.example.com/mcp");
    
    await assertRejects(
      async () => {
        await client.callTool("nonexistent-tool", {});
      },
      MCPClientError,
      "Tool not found: nonexistent-tool"
    );
  } finally {
    restoreFetch();
  }
});

Deno.test("MCP Client - Server Error Handling", async () => {
  mockServer = new MockMCPServer();
  mockServer.mockInitialize("test-server");
  mockServer.mockError(MCPMethod.ToolsList, MCPErrorCode.InternalError, "Server error");
  
  setupMockFetch(mockServer);

  try {
    const client = createORBITMCPClient("https://test.example.com/mcp");
    
    await assertRejects(
      async () => {
        await client.listTools();
      },
      MCPClientError,
      "List tools failed"
    );
  } finally {
    restoreFetch();
  }
});

Deno.test("MCP Client - Ping", async () => {
  mockServer = new MockMCPServer();
  mockServer.mockResponse(MCPMethod.Ping, {
    jsonrpc: "2.0",
    result: {
      status: "ok",
      timestamp: "2024-01-01T00:00:00Z",
    },
    id: null,
  });
  
  setupMockFetch(mockServer);

  try {
    const client = createORBITMCPClient("https://test.example.com/mcp");
    const result = await client.ping();

    assertEquals(result.status, "ok");
    assertExists(result.timestamp);
  } finally {
    restoreFetch();
  }
});

Deno.test("MCP Client - Retry Logic", async () => {
  let attemptCount = 0;
  
  globalThis.fetch = async (): Promise<Response> => {
    attemptCount++;
    if (attemptCount < 3) {
      throw new Error("Network error");
    }
    
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      result: {
        status: "ok",
      },
      id: 1,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const client = createORBITMCPClient("https://test.example.com/mcp", {
      retries: 3,
      retryDelay: 10, // Short delay for testing
    });
    
    const result = await client.ping();
    assertEquals(result.status, "ok");
    assertEquals(attemptCount, 3); // Should have retried twice
  } finally {
    restoreFetch();
  }
});

Deno.test("MCP Client - Timeout Handling", async () => {
  globalThis.fetch = async (): Promise<Response> => {
    // Simulate slow response
    await new Promise(resolve => setTimeout(resolve, 100));
    return new Response(JSON.stringify({ result: "too late" }));
  };

  try {
    const client = createORBITMCPClient("https://test.example.com/mcp", {
      timeout: 50, // 50ms timeout
      retries: 0,
    });
    
    await assertRejects(
      async () => {
        await client.ping();
      },
      MCPClientError,
      "Request timeout"
    );
  } finally {
    restoreFetch();
  }
});

Deno.test("MCP Client - Batch Requests", async () => {
  mockServer = new MockMCPServer();
  const requests = [
    MCPTestFactory.createInitializeRequest(),
    MCPTestFactory.createToolsListRequest(),
  ];

  // Mock responses for batch
  mockServer.mockInitialize("test-server");
  mockServer.mockToolsList([]);
  
  setupMockFetch(mockServer);

  try {
    const client = createORBITMCPClient("https://test.example.com/mcp");
    const responses = await client.sendBatch(requests);

    assertEquals(responses.length, 2);
    MCPTestAssertions.assertSuccessResponse(responses[0]);
    MCPTestAssertions.assertSuccessResponse(responses[1]);
  } finally {
    restoreFetch();
  }
});

Deno.test("MCP Client - Performance Test", async () => {
  mockServer = new MockMCPServer();
  mockServer.mockResponse(MCPMethod.Ping, {
    jsonrpc: "2.0",
    result: { status: "ok" },
    id: null,
  });
  
  setupMockFetch(mockServer);

  try {
    const client = createORBITMCPClient("https://test.example.com/mcp");
    
    const perfTest = new MCPPerformanceTest();
    perfTest.start();
    
    await client.ping();
    
    // Assert response time is under 100ms target
    perfTest.assertResponseTime(100);
  } finally {
    restoreFetch();
  }
});

Deno.test("MCP Client - Connection State", async () => {
  mockServer = new MockMCPServer();
  mockServer.mockInitialize("test-server");
  setupMockFetch(mockServer);

  try {
    const client = createORBITMCPClient("https://test.example.com/mcp");
    
    // Before initialization
    assertEquals(client.isInitialized(), false);
    assertEquals(client.getAvailableTools().length, 0);

    await client.initialize();
    
    // After initialization
    assertEquals(client.isInitialized(), true);
    
    const state = client.getConnectionState();
    assertEquals(state.initialized, true);
    assertExists(state.serverInfo);
  } finally {
    restoreFetch();
  }
});

Deno.test("MCP Connection Pool - Basic Operations", async () => {
  mockServer = new MockMCPServer();
  mockServer.mockInitialize("test-server");
  setupMockFetch(mockServer);

  try {
    const pool = new MCPConnectionPool();
    
    const client1 = pool.getClient("service1", "https://test.example.com/service1");
    const client2 = pool.getClient("service2", "https://test.example.com/service2");
    
    // Should return same instance for same service name
    const client1Again = pool.getClient("service1", "https://test.example.com/service1");
    assertEquals(client1, client1Again);
    
    await pool.initializeAll();
    
    const states = pool.getAllStates();
    assertEquals(Object.keys(states).length, 2);
    assertEquals(states.service1.initialized, true);
    assertEquals(states.service2.initialized, true);
  } finally {
    restoreFetch();
  }
});

Deno.test("MCP Connection Pool - Ping All", async () => {
  mockServer = new MockMCPServer();
  mockServer.mockResponse(MCPMethod.Ping, {
    jsonrpc: "2.0",
    result: { status: "ok" },
    id: null,
  });
  setupMockFetch(mockServer);

  try {
    const pool = new MCPConnectionPool();
    
    pool.getClient("service1", "https://test.example.com/service1");
    pool.getClient("service2", "https://test.example.com/service2");
    
    const pingResults = await pool.pingAll();
    
    assertEquals(Object.keys(pingResults).length, 2);
    assertEquals(pingResults.service1.status, "ok");
    assertEquals(pingResults.service2.status, "ok");
  } finally {
    restoreFetch();
  }
});

Deno.test("MCP Global Pool", async () => {
  const pool1 = getGlobalMCPPool();
  const pool2 = getGlobalMCPPool();
  
  // Should return same instance
  assertEquals(pool1, pool2);
});

Deno.test("MCP Client - Load Testing", async () => {
  mockServer = new MockMCPServer();
  mockServer.mockResponse(MCPMethod.Ping, {
    jsonrpc: "2.0",
    result: { status: "ok" },
    id: null,
  });
  setupMockFetch(mockServer);

  try {
    const client = createORBITMCPClient("https://test.example.com/mcp");
    
    const loadTest = await MCPLoadTest.concurrentRequests(
      () => client.ping(),
      5, // 5 concurrent requests
      20  // 20 total requests
    );

    assertEquals(loadTest.results.length, 20);
    assertEquals(loadTest.errors.length, 0);
    
    // Should complete within reasonable time (5 seconds)
    assertEquals(loadTest.duration < 5000, true);
  } finally {
    restoreFetch();
  }
});

Deno.test("MCP Client - Invalid Response Format", async () => {
  globalThis.fetch = async (): Promise<Response> => {
    return new Response("invalid json response", {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const client = createORBITMCPClient("https://test.example.com/mcp", {
      retries: 0,
    });
    
    await assertRejects(
      async () => {
        await client.ping();
      },
      Error,
      "Unexpected token"
    );
  } finally {
    restoreFetch();
  }
});

Deno.test("MCP Client - HTTP Error Status", async () => {
  globalThis.fetch = async (): Promise<Response> => {
    return new Response("Server Error", {
      status: 500,
      statusText: "Internal Server Error",
    });
  };

  try {
    const client = createORBITMCPClient("https://test.example.com/mcp", {
      retries: 0,
    });
    
    await assertRejects(
      async () => {
        await client.ping();
      },
      Error,
      "HTTP 500: Internal Server Error"
    );
  } finally {
    restoreFetch();
  }
});

Deno.test("MCP Client - Custom Configuration", async () => {
  const client = new MCPClient({
    baseUrl: "https://custom.example.com",
    timeout: 5000,
    retries: 2,
    retryDelay: 500,
    authToken: "custom-token",
    clientInfo: {
      name: "custom-client",
      version: "2.0.0",
    },
  });

  assertEquals(client.isInitialized(), false);
});

// Cleanup test environment
Deno.test("Cleanup Test Environment", () => {
  MCPTestEnvironment.cleanupTestEnv();
  restoreFetch();
});