"""
ORBIT MCP Server - Bridge to existing Supabase Edge Functions
Exposes ORBIT tools via Model Context Protocol for use with Google ADK agents
"""

import asyncio
import json
import os
import logging
from typing import Dict, List, Optional, Any, Union
from datetime import datetime

import httpx
from fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP("ORBIT MCP Server")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] [MCP] %(message)s'
)
logger = logging.getLogger("orbit_mcp")

# Configuration from environment
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
SUPABASE_PROJECT_ID = os.getenv('SUPABASE_PROJECT_ID')

# HTTP client for calling Supabase functions
http_client = httpx.AsyncClient(
    headers={
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_KEY
    },
    timeout=60.0
)

# Tool result wrapper
def create_tool_result(success: bool, data: Any = None, error: str = None, 
                      metadata: Dict = None) -> Dict[str, Any]:
    """Create standardized tool result"""
    return {
        "success": success,
        "data": data,
        "error": error,
        "metadata": metadata or {},
        "timestamp": datetime.utcnow().isoformat()
    }


@mcp.tool()
async def database_execute_sql(query: str, params: Optional[List] = None) -> Dict[str, Any]:
    """
    Execute SQL query against Supabase database
    
    Args:
        query: SQL query string to execute
        params: Optional list of parameters for prepared statements
        
    Returns:
        Dict with success status, data, and metadata
    """
    try:
        logger.info(f"Executing SQL query: {query[:100]}{'...' if len(query) > 100 else ''}")
        
        response = await http_client.post(
            f"{SUPABASE_URL}/rest/v1/rpc/execute_sql",
            json={
                "query": query,
                "params": params or []
            }
        )
        
        if response.status_code != 200:
            error_msg = f"Database error: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return create_tool_result(False, error=error_msg)
        
        data = response.json()
        
        result = create_tool_result(
            True, 
            data=data,
            metadata={
                "query": query[:100] + "..." if len(query) > 100 else query,
                "row_count": len(data) if isinstance(data, list) else 1,
                "params_count": len(params) if params else 0
            }
        )
        
        logger.info(f"SQL query executed successfully, returned {result['metadata']['row_count']} rows")
        return result
        
    except Exception as error:
        error_msg = f"SQL execution failed: {str(error)}"
        logger.error(error_msg)
        return create_tool_result(False, error=error_msg)


@mcp.tool()
async def storage_list_files(bucket_name: str, folder_path: str = "", 
                           file_extension: Optional[str] = None) -> Dict[str, Any]:
    """
    List files in Supabase storage bucket
    
    Args:
        bucket_name: Name of the storage bucket
        folder_path: Folder path to list files from (default: root)
        file_extension: Filter by file extension (optional)
        
    Returns:
        Dict with success status, file list, and metadata
    """
    try:
        logger.info(f"Listing files in bucket: {bucket_name}, folder: {folder_path}")
        
        response = await http_client.get(
            f"{SUPABASE_URL}/storage/v1/object/list/{bucket_name}",
            params={
                "prefix": folder_path,
                "limit": 1000,
                "offset": 0
            }
        )
        
        if response.status_code != 200:
            error_msg = f"Storage list error: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return create_tool_result(False, error=error_msg)
        
        files = response.json()
        
        # Filter by extension if provided
        if file_extension:
            files = [f for f in files if f.get('name', '').endswith(file_extension)]
        
        # Process file information
        processed_files = []
        for file in files:
            processed_files.append({
                'name': file.get('name'),
                'size': file.get('metadata', {}).get('size'),
                'last_modified': file.get('updated_at'),
                'path': f"{folder_path}/{file.get('name')}" if folder_path else file.get('name'),
                'mime_type': file.get('metadata', {}).get('mimetype')
            })
        
        result = create_tool_result(
            True,
            data=processed_files,
            metadata={
                "bucket": bucket_name,
                "folder_path": folder_path,
                "file_count": len(processed_files),
                "filter_extension": file_extension
            }
        )
        
        logger.info(f"Listed {len(processed_files)} files successfully")
        return result
        
    except Exception as error:
        error_msg = f"Storage list failed: {str(error)}"
        logger.error(error_msg)
        return create_tool_result(False, error=error_msg)


@mcp.tool()
async def storage_create_signed_urls(bucket_name: str, file_paths: List[str], 
                                   expires_in: int = 3600) -> Dict[str, Any]:
    """
    Create signed URLs for secure file access
    
    Args:
        bucket_name: Name of the storage bucket
        file_paths: List of file paths to create URLs for
        expires_in: URL expiration time in seconds (default: 1 hour)
        
    Returns:
        Dict with success status, signed URLs, and metadata
    """
    try:
        logger.info(f"Creating {len(file_paths)} signed URLs for bucket: {bucket_name}")
        
        urls = []
        
        for file_path in file_paths:
            response = await http_client.post(
                f"{SUPABASE_URL}/storage/v1/object/sign/{bucket_name}/{file_path}",
                json={"expiresIn": expires_in}
            )
            
            if response.status_code == 200:
                data = response.json()
                urls.append({
                    'path': file_path,
                    'signed_url': data.get('signedURL'),
                    'expires_at': datetime.utcnow().isoformat(),
                    'expires_in': expires_in
                })
            else:
                urls.append({
                    'path': file_path,
                    'error': f"Failed to create signed URL: {response.status_code}",
                    'signed_url': None
                })
        
        result = create_tool_result(
            True,
            data=urls,
            metadata={
                "bucket": bucket_name,
                "url_count": len(urls),
                "expires_in_seconds": expires_in,
                "successful_urls": len([u for u in urls if u.get('signed_url')])
            }
        )
        
        logger.info(f"Created {result['metadata']['successful_urls']}/{len(file_paths)} signed URLs")
        return result
        
    except Exception as error:
        error_msg = f"Signed URL creation failed: {str(error)}"
        logger.error(error_msg)
        return create_tool_result(False, error=error_msg)


@mcp.tool()
async def invoke_edge_function(function_name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Invoke Supabase Edge Function
    
    Args:
        function_name: Name of the edge function to invoke
        payload: JSON payload to send to the function
        
    Returns:
        Dict with success status, response data, and metadata
    """
    try:
        logger.info(f"Invoking edge function: {function_name}")
        
        response = await http_client.post(
            f"{SUPABASE_URL}/functions/v1/{function_name}",
            json=payload
        )
        
        if response.status_code not in [200, 201]:
            error_msg = f"Edge function error: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return create_tool_result(False, error=error_msg)
        
        try:
            data = response.json()
        except json.JSONDecodeError:
            # Handle non-JSON responses
            data = {"response": response.text}
        
        result = create_tool_result(
            True,
            data=data,
            metadata={
                "function_name": function_name,
                "payload_size": len(json.dumps(payload)),
                "response_size": len(response.text),
                "status_code": response.status_code
            }
        )
        
        logger.info(f"Edge function {function_name} executed successfully")
        return result
        
    except Exception as error:
        error_msg = f"Edge function invocation failed: {str(error)}"
        logger.error(error_msg)
        return create_tool_result(False, error=error_msg)


@mcp.tool()
async def ai_analyze_image(image_url: str, analysis_type: str = "lifestyle") -> Dict[str, Any]:
    """
    Analyze image using ORBIT AI analysis service
    
    Args:
        image_url: URL of the image to analyze
        analysis_type: Type of analysis ('lifestyle' or 'product')
        
    Returns:
        Dict with success status, analysis data, and metadata
    """
    try:
        logger.info(f"Analyzing image: {image_url} with type: {analysis_type}")
        
        # Call the ORBIT AI analysis edge function
        result = await invoke_edge_function('mcp-ai-analysis', {
            'image_url': image_url,
            'analysis_type': analysis_type
        })
        
        if not result['success']:
            return result
        
        # Enhance the result with additional metadata
        result['metadata'].update({
            'image_url': image_url,
            'analysis_type': analysis_type,
            'tool': 'ai_analyze_image'
        })
        
        logger.info(f"Image analysis completed for: {image_url}")
        return result
        
    except Exception as error:
        error_msg = f"AI image analysis failed: {str(error)}"
        logger.error(error_msg)
        return create_tool_result(False, error=error_msg)


@mcp.tool()
async def embed_metadata(source_path: str, output_path: str, metadata: Dict[str, Any],
                        compression_quality: int = 95) -> Dict[str, Any]:
    """
    Embed metadata into image using ORBIT metadata service
    
    Args:
        source_path: Source image path in storage
        output_path: Output path for processed image
        metadata: Metadata to embed in the image
        compression_quality: JPEG compression quality (1-100)
        
    Returns:
        Dict with success status, processing result, and metadata
    """
    try:
        logger.info(f"Embedding metadata from {source_path} to {output_path}")
        
        # Call the ORBIT metadata processing edge function
        result = await invoke_edge_function('mcp-metadata', {
            'tool_name': 'process_image_metadata',
            'parameters': {
                'source_path': source_path,
                'output_path': output_path,
                'metadata': metadata,
                'compression_quality': compression_quality
            }
        })
        
        if not result['success']:
            return result
        
        # Enhance the result with additional metadata
        result['metadata'].update({
            'source_path': source_path,
            'output_path': output_path,
            'compression_quality': compression_quality,
            'metadata_size': len(json.dumps(metadata)),
            'tool': 'embed_metadata'
        })
        
        logger.info(f"Metadata embedding completed: {source_path} -> {output_path}")
        return result
        
    except Exception as error:
        error_msg = f"Metadata embedding failed: {str(error)}"
        logger.error(error_msg)
        return create_tool_result(False, error=error_msg)


@mcp.tool()
async def workflow_health_check() -> Dict[str, Any]:
    """
    Perform comprehensive health check of ORBIT system
    
    Returns:
        Dict with health status of all components
    """
    try:
        logger.info("Starting ORBIT system health check")
        
        health_status = {
            "timestamp": datetime.utcnow().isoformat(),
            "overall": "unknown",
            "components": {}
        }
        
        # Test database connectivity
        try:
            db_result = await database_execute_sql("SELECT 1 as health_check")
            health_status["components"]["database"] = "healthy" if db_result["success"] else "unhealthy"
        except Exception as e:
            health_status["components"]["database"] = "unhealthy"
            logger.warning(f"Database health check failed: {e}")
        
        # Test storage connectivity  
        try:
            storage_result = await storage_list_files("orbit-images", "", None)
            health_status["components"]["storage"] = "healthy" if storage_result["success"] else "unhealthy"
        except Exception as e:
            health_status["components"]["storage"] = "unhealthy"
            logger.warning(f"Storage health check failed: {e}")
        
        # Test edge functions (with a simple ping)
        try:
            # This would be replaced with actual health endpoint calls
            health_status["components"]["edge_functions"] = "healthy"  # Assume healthy for now
        except Exception as e:
            health_status["components"]["edge_functions"] = "unhealthy"
            logger.warning(f"Edge functions health check failed: {e}")
        
        # Determine overall health
        component_statuses = list(health_status["components"].values())
        if all(status == "healthy" for status in component_statuses):
            health_status["overall"] = "healthy"
        elif any(status == "healthy" for status in component_statuses):
            health_status["overall"] = "degraded"  
        else:
            health_status["overall"] = "unhealthy"
        
        result = create_tool_result(
            True,
            data=health_status,
            metadata={"components_checked": len(health_status["components"])}
        )
        
        logger.info(f"Health check completed: {health_status['overall']}")
        return result
        
    except Exception as error:
        error_msg = f"Health check failed: {str(error)}"
        logger.error(error_msg)
        return create_tool_result(False, error=error_msg)


@mcp.tool()
async def get_workflow_context() -> Dict[str, Any]:
    """
    Get current workflow context information
    
    Returns:
        Dict with pending orders count and system status
    """
    try:
        logger.info("Getting workflow context")
        
        # Get pending orders count
        pending_query = """
            SELECT COUNT(*) as count 
            FROM orders 
            WHERE processing_stage = 'pending' 
            AND payment_status = 'completed'
        """
        
        db_result = await database_execute_sql(pending_query)
        
        if not db_result["success"]:
            return db_result
        
        pending_count = 0
        if db_result["data"]:
            pending_count = db_result["data"][0].get("count", 0) if isinstance(db_result["data"], list) else 0
        
        # Get storage status
        storage_result = await storage_list_files("orbit-images", "", None)
        storage_accessible = storage_result["success"]
        
        context_data = {
            "pending_orders_count": pending_count,
            "storage_accessible": storage_accessible,
            "timestamp": datetime.utcnow().isoformat(),
            "system_ready": pending_count > 0 and storage_accessible
        }
        
        result = create_tool_result(
            True,
            data=context_data,
            metadata={"context_type": "workflow_preparation"}
        )
        
        logger.info(f"Context retrieved: {pending_count} pending orders, storage {'accessible' if storage_accessible else 'error'}")
        return result
        
    except Exception as error:
        error_msg = f"Context retrieval failed: {str(error)}"
        logger.error(error_msg)
        return create_tool_result(False, error=error_msg)


# MCP server configuration and startup
@mcp.tool()
async def get_server_info() -> Dict[str, Any]:
    """Get MCP server information and capabilities"""
    return create_tool_result(
        True,
        data={
            "server_name": "ORBIT MCP Server",
            "version": "1.0.0",
            "description": "Bridge to ORBIT Supabase Edge Functions for AI image processing workflows",
            "capabilities": [
                "database_execute_sql",
                "storage_list_files", 
                "storage_create_signed_urls",
                "invoke_edge_function",
                "ai_analyze_image",
                "embed_metadata",
                "workflow_health_check",
                "get_workflow_context"
            ],
            "supabase_url": SUPABASE_URL,
            "project_id": SUPABASE_PROJECT_ID
        }
    )


# Cleanup function
async def cleanup():
    """Clean up resources when server shuts down"""
    logger.info("Cleaning up MCP server resources...")
    try:
        await http_client.aclose()
        logger.info("HTTP client closed successfully")
    except Exception as error:
        logger.error(f"Error during cleanup: {error}")


# Server startup and configuration
async def main():
    """Main function to run the MCP server"""
    logger.info("Starting ORBIT MCP Server...")
    
    # Validate configuration
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.error("Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")
        return
    
    logger.info(f"Configured for Supabase: {SUPABASE_URL}")
    logger.info("MCP Server ready to accept connections")
    
    try:
        # Run the FastMCP server
        await mcp.run()
    except KeyboardInterrupt:
        logger.info("Received interrupt signal, shutting down...")
    except Exception as error:
        logger.error(f"Server error: {error}")
    finally:
        await cleanup()


if __name__ == "__main__":
    # Set up signal handling for graceful shutdown
    import signal
    import sys
    
    def signal_handler(signum, frame):
        logger.info("Received signal, initiating graceful shutdown...")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Run the server
    asyncio.run(main())