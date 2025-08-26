# ORBIT Python ADK Setup Guide

## Overview
This is a Python implementation of the ORBIT image processing workflow using Google's Agent Development Kit (ADK). It bridges to your existing Supabase Edge Functions via Model Context Protocol (MCP).

## Architecture
- **orbit_agent.py**: Main ADK agent and workflow executor
- **orbit_tools.py**: Core tool implementations with error handling
- **orbit_prompt.py**: Structured workflow prompts and templates  
- **orbit_mcp_server.py**: MCP server bridging to Supabase functions
- **test_orbit_tools.py**: Comprehensive unit test suite

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables in `.env`:
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google AI Configuration  
GOOGLE_AI_API_KEY=your-google-ai-api-key

# Optional: Development settings
MOCK_MODE=false
DEBUG_LOGGING=true
MAX_RETRIES=3
```

## Running Tests

Run the complete test suite:
```bash
python -m pytest test_orbit_tools.py -v
```

Run specific test classes:
```bash
python -m pytest test_orbit_tools.py::TestDatabaseTool -v
python -m pytest test_orbit_tools.py::TestStorageTool -v
```

Run with coverage:
```bash
python -m pytest test_orbit_tools.py --cov=orbit_tools --cov-report=html
```

## Usage

### Direct Tool Usage
```python
from orbit_tools import create_database_tool, create_ai_analysis_tool

# Create tools
db_tool = create_database_tool(supabase_url, supabase_key)
ai_tool = create_ai_analysis_tool(google_api_key)

# Execute operations
result = await db_tool._execute("SELECT * FROM pending_orders")
analysis = await ai_tool._execute("https://example.com/image.jpg")
```

### Complete Workflow Execution
```python
from orbit_agent import ORBITWorkflowExecutor, ORBITConfig

# Configure
config = ORBITConfig(
    supabase_url="https://your-project.supabase.co",
    supabase_key="your-key",
    google_api_key="your-google-key"
)

# Execute workflow
executor = ORBITWorkflowExecutor(config)
stats = await executor.run_complete_workflow()
print(f"Processed {stats.orders_completed} orders")
```

### MCP Server (Optional)
```python
# Start MCP bridge server
python orbit_mcp_server.py
```

## Integration with Existing ORBIT System

This Python implementation is designed to work alongside your existing Node.js/Supabase infrastructure:

1. **Database**: Uses existing Supabase database schema
2. **Storage**: Works with existing bucket structure  
3. **Functions**: Can call existing Edge Functions via HTTP
4. **MCP Bridge**: Exposes Python tools to other systems

## Monitoring and Debugging

The implementation includes comprehensive logging:
- Progress tracking with todo lists
- Execution metrics and timing
- Error handling with retry logic
- Mock modes for testing

## Next Steps

1. Test database connectivity with your Supabase instance
2. Verify storage bucket access and permissions
3. Test AI analysis with sample images
4. Run integration tests against real data
5. Monitor performance vs existing Node.js agent

## Troubleshooting

- **Connection errors**: Check SUPABASE_URL and API keys
- **Permission errors**: Verify service role key has required permissions
- **Mock mode**: Set MOCK_MODE=true for testing without external APIs
- **Logging**: Enable DEBUG_LOGGING=true for detailed operation logs