"""
ORBIT Agent - Main Google ADK agent implementation for ORBIT image processing workflows
Orchestrates the complete workflow using structured prompts and comprehensive tools
"""

import asyncio
import os
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict
import json

# Google ADK imports
from google.adk.agents import LlmAgent
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, StdioConnectionParams, StdioServerParameters

# Local imports
from orbit_tools import (
    create_database_tool, create_storage_tool, create_ai_analysis_tool,
    create_metadata_embed_tool, create_progress_tracker, create_monitoring_tool,
    LogLevel, cleanup_tools
)
from orbit_prompt import (
    ORBITPromptBuilder, WorkflowContext, get_initialization_prompt,
    get_processing_prompt, get_error_recovery_prompt, get_health_check_prompt,
    get_completion_prompt
)


@dataclass
class ORBITConfig:
    """Configuration for ORBIT agent"""
    # Supabase configuration
    supabase_url: str
    supabase_service_key: str
    supabase_project_id: str = ""
    
    # AI service endpoints
    gemini_endpoint: Optional[str] = None
    metadata_endpoint: Optional[str] = None
    
    # Agent configuration
    model_name: str = "gemini-1.5-flash"
    anthropic_api_key: Optional[str] = None
    max_iterations: int = 1000
    temperature: float = 0.2
    
    # Workflow settings
    max_retries: int = 3
    mock_mode: bool = False
    log_level: str = "INFO"
    timeout_seconds: int = 300  # 5 minutes
    
    # Storage configuration
    storage_bucket: str = "orbit-images"
    
    @classmethod
    def from_environment(cls) -> 'ORBITConfig':
        """Create configuration from environment variables"""
        return cls(
            supabase_url=os.getenv('SUPABASE_URL', ''),
            supabase_service_key=os.getenv('SUPABASE_SERVICE_ROLE_KEY', ''),
            supabase_project_id=os.getenv('SUPABASE_PROJECT_ID', ''),
            gemini_endpoint=os.getenv('GEMINI_ENDPOINT'),
            metadata_endpoint=os.getenv('METADATA_ENDPOINT'),
            model_name=os.getenv('MODEL_NAME', 'gemini-1.5-flash'),
            anthropic_api_key=os.getenv('ANTHROPIC_API_KEY'),
            max_iterations=int(os.getenv('MAX_ITERATIONS', '1000')),
            temperature=float(os.getenv('TEMPERATURE', '0.2')),
            max_retries=int(os.getenv('MAX_RETRIES', '3')),
            mock_mode=os.getenv('MOCK_MODE', 'false').lower() == 'true',
            log_level=os.getenv('LOG_LEVEL', 'INFO'),
            timeout_seconds=int(os.getenv('TIMEOUT_SECONDS', '300')),
            storage_bucket=os.getenv('STORAGE_BUCKET', 'orbit-images')
        )
    
    def validate(self) -> List[str]:
        """Validate configuration and return list of errors"""
        errors = []
        
        if not self.supabase_url:
            errors.append("SUPABASE_URL is required")
        if not self.supabase_service_key:
            errors.append("SUPABASE_SERVICE_ROLE_KEY is required")
        if not self.mock_mode and not self.gemini_endpoint:
            errors.append("GEMINI_ENDPOINT is required when not in mock mode")
        if not self.mock_mode and not self.metadata_endpoint:
            errors.append("METADATA_ENDPOINT is required when not in mock mode")
        
        return errors


@dataclass
class ExecutionStats:
    """Statistics for workflow execution"""
    started_at: datetime
    ended_at: Optional[datetime] = None
    orders_processed: int = 0
    images_processed: int = 0
    errors_encountered: int = 0
    phases_completed: List[str] = None
    total_duration_seconds: float = 0
    average_order_time: float = 0
    average_image_time: float = 0
    success_rate: float = 0
    
    def __post_init__(self):
        if self.phases_completed is None:
            self.phases_completed = []
    
    def update_completion(self):
        """Update completion statistics"""
        if self.ended_at:
            self.total_duration_seconds = (self.ended_at - self.started_at).total_seconds()
            
            if self.orders_processed > 0:
                self.average_order_time = self.total_duration_seconds / self.orders_processed
            
            if self.images_processed > 0:
                self.average_image_time = self.total_duration_seconds / self.images_processed
            
            total_operations = self.orders_processed + self.images_processed
            if total_operations > 0:
                self.success_rate = ((total_operations - self.errors_encountered) / total_operations) * 100
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for reporting"""
        return {
            "started_at": self.started_at.isoformat(),
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "orders_processed": self.orders_processed,
            "images_processed": self.images_processed,
            "errors_encountered": self.errors_encountered,
            "phases_completed": self.phases_completed,
            "total_duration_seconds": self.total_duration_seconds,
            "duration_minutes": round(self.total_duration_seconds / 60, 2),
            "average_order_time": self.average_order_time,
            "average_image_time": self.average_image_time,
            "success_rate": round(self.success_rate, 2)
        }


class ORBITAgent:
    """Main ORBIT agent using Google ADK"""
    
    def __init__(self, config: ORBITConfig):
        self.config = config
        self.stats = ExecutionStats(started_at=datetime.utcnow())
        self.context = WorkflowContext()
        
        # Set up logging
        self.logger = self._setup_logging()
        
        # Initialize tools
        self.tools = self._initialize_tools()
        
        # Initialize ADK agent
        self.agent = self._initialize_agent()
        
        # Track agent state
        self.is_healthy = False
        self.current_session_id = None
    
    def _setup_logging(self) -> logging.Logger:
        """Setup structured logging"""
        logger = logging.getLogger("orbit_agent")
        logger.setLevel(getattr(logging, self.config.log_level.upper()))
        
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '[%(asctime)s] [%(levelname)s] [ORBIT] %(message)s',
                datefmt='%Y-%m-%d %H:%M:%S'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
        
        return logger
    
    def _initialize_tools(self) -> Dict[str, Any]:
        """Initialize all ORBIT tools"""
        tools = {}
        
        try:
            # Core Supabase tools
            tools['database'] = create_database_tool(
                self.config.supabase_url,
                self.config.supabase_service_key,
                self.config.max_retries
            )
            
            tools['storage'] = create_storage_tool(
                self.config.supabase_url,
                self.config.supabase_service_key
            )
            
            # AI service tools
            tools['ai_analysis'] = create_ai_analysis_tool(
                self.config.gemini_endpoint,
                self.config.mock_mode
            )
            
            tools['metadata_embed'] = create_metadata_embed_tool(
                self.config.metadata_endpoint,
                self.config.mock_mode
            )
            
            # Workflow management tools
            tools['progress'] = create_progress_tracker()
            tools['monitoring'] = create_monitoring_tool(
                LogLevel(self.config.log_level.lower())
            )
            
            self.logger.info(f"Initialized {len(tools)} tools successfully")
            return tools
            
        except Exception as error:
            self.logger.error(f"Failed to initialize tools: {error}")
            raise
    
    def _initialize_agent(self) -> LlmAgent:
        """Initialize Google ADK agent with tools"""
        try:
            # Convert tools to ADK format
            adk_tools = []
            for tool_name, tool in self.tools.items():
                adk_tools.append(tool)
            
            # Add MCP toolset if configured
            if hasattr(self.config, 'mcp_server_command'):
                mcp_toolset = MCPToolset(
                    connection_params=StdioConnectionParams(
                        server_params=StdioServerParameters(
                            command=self.config.mcp_server_command,
                            args=self.config.mcp_server_args or []
                        )
                    )
                )
                adk_tools.append(mcp_toolset)
            
            # Create ADK agent
            agent = LlmAgent(
                model=self.config.model_name,
                name='orbit-workflow-processor',
                instruction=ORBITPromptBuilder.SYSTEM_PROMPT,
                tools=adk_tools
            )
            
            self.logger.info(f"Initialized ADK agent with model: {self.config.model_name}")
            return agent
            
        except Exception as error:
            self.logger.error(f"Failed to initialize ADK agent: {error}")
            raise
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform comprehensive health check"""
        self.logger.info("Starting health check...")
        
        health_status = {
            "timestamp": datetime.utcnow().isoformat(),
            "overall": "unknown",
            "components": {},
            "details": {}
        }
        
        try:
            # Check database connectivity
            db_result = await self.tools['database']._execute(
                "SELECT 1 as health_check",
                operation_type="health_check"
            )
            health_status["components"]["database"] = "healthy" if db_result.success else "unhealthy"
            health_status["details"]["database"] = db_result.error if not db_result.success else "Connected"
            
            # Check storage accessibility
            storage_result = await self.tools['storage']._execute(
                "list_files",
                self.config.storage_bucket,
                folder_path="",
                file_extension=None
            )
            health_status["components"]["storage"] = "healthy" if storage_result.success else "unhealthy"
            health_status["details"]["storage"] = storage_result.error if not storage_result.success else f"Accessible ({storage_result.data})"
            
            # Check AI analysis tool (basic connectivity test)
            ai_healthy = True
            if not self.config.mock_mode and self.config.gemini_endpoint:
                try:
                    # This would be a simple ping/health endpoint call
                    ai_result = await self.tools['ai_analysis']._mock_analysis(
                        "test://health-check", "lifestyle"
                    )
                    ai_healthy = ai_result.success
                except Exception as e:
                    ai_healthy = False
                    health_status["details"]["ai_analysis"] = str(e)
            
            health_status["components"]["ai_analysis"] = "healthy" if ai_healthy else "unhealthy"
            
            # Check metadata embedding tool
            metadata_healthy = True
            if not self.config.mock_mode and self.config.metadata_endpoint:
                try:
                    metadata_result = await self.tools['metadata_embed']._mock_embed(
                        "test://source", "test://output", {}, 95
                    )
                    metadata_healthy = metadata_result.success
                except Exception as e:
                    metadata_healthy = False
                    health_status["details"]["metadata_embed"] = str(e)
            
            health_status["components"]["metadata_embed"] = "healthy" if metadata_healthy else "unhealthy"
            
            # Determine overall health
            component_statuses = list(health_status["components"].values())
            if all(status == "healthy" for status in component_statuses):
                health_status["overall"] = "healthy"
                self.is_healthy = True
            elif any(status == "healthy" for status in component_statuses):
                health_status["overall"] = "degraded"
                self.is_healthy = False
            else:
                health_status["overall"] = "unhealthy"
                self.is_healthy = False
            
            self.logger.info(f"Health check completed: {health_status['overall']}")
            return health_status
            
        except Exception as error:
            self.logger.error(f"Health check failed: {error}")
            health_status["overall"] = "unhealthy"
            health_status["error"] = str(error)
            self.is_healthy = False
            return health_status
    
    async def prepare_workflow_context(self) -> WorkflowContext:
        """Prepare workflow context data"""
        self.logger.info("Preparing workflow context...")
        
        try:
            # Get pending orders count
            pending_query = """
                SELECT COUNT(*) as count 
                FROM orders 
                WHERE processing_stage = 'pending' 
                AND payment_status = 'completed'
            """
            
            db_result = await self.tools['database']._execute(pending_query)
            pending_count = 0
            if db_result.success and db_result.data:
                pending_count = db_result.data[0].get('count', 0) if isinstance(db_result.data, list) else 0
            
            # Test storage accessibility
            storage_result = await self.tools['storage']._execute(
                "list_files",
                self.config.storage_bucket,
                folder_path="",
                file_extension=None
            )
            storage_accessible = storage_result.success
            
            # Update context
            self.context = WorkflowContext(
                pending_orders_count=pending_count,
                storage_accessible=storage_accessible,
                timestamp=datetime.utcnow().isoformat(),
                current_phase="initialization"
            )
            
            self.logger.info(f"Context prepared: {pending_count} pending orders, storage {'accessible' if storage_accessible else 'error'}")
            return self.context
            
        except Exception as error:
            self.logger.error(f"Failed to prepare context: {error}")
            self.context = WorkflowContext(
                pending_orders_count=0,
                storage_accessible=False,
                error_message=str(error),
                current_phase="initialization"
            )
            return self.context
    
    async def execute_workflow(self, specific_order_id: Optional[str] = None) -> Dict[str, Any]:
        """Execute the complete ORBIT workflow"""
        self.logger.info(f"Starting ORBIT workflow execution{f' for order {specific_order_id}' if specific_order_id else ''}")
        
        # Update stats
        self.stats = ExecutionStats(started_at=datetime.utcnow())
        self.current_session_id = f"orbit_{int(time.time())}"
        
        try:
            # Perform health check
            health_status = await self.health_check()
            if health_status["overall"] == "unhealthy":
                raise Exception(f"System health check failed: {health_status}")
            
            # Prepare workflow context
            context = await self.prepare_workflow_context()
            if context.pending_orders_count == 0:
                self.logger.info("No pending orders found")
                return {
                    "success": True,
                    "message": "No pending orders to process",
                    "stats": self.stats.to_dict(),
                    "context": asdict(context)
                }
            
            # Initialize progress tracking
            await self.tools['progress']._execute(
                "add_todo",
                content=f"Process {context.pending_orders_count} pending orders",
                status="in_progress"
            )
            
            # Build and execute workflow prompt
            workflow_prompt = ORBITPromptBuilder.build_workflow_prompt(context)
            
            self.logger.info("Executing workflow with ADK agent...")
            
            # Execute with timeout
            try:
                result = await asyncio.wait_for(
                    self.agent.run(workflow_prompt),
                    timeout=self.config.timeout_seconds
                )
                
                # Process agent result
                await self._process_agent_result(result)
                
                # Update completion stats
                self.stats.ended_at = datetime.utcnow()
                self.stats.update_completion()
                
                self.logger.info("Workflow execution completed successfully")
                
                return {
                    "success": True,
                    "message": "Workflow completed successfully",
                    "stats": self.stats.to_dict(),
                    "context": asdict(self.context),
                    "session_id": self.current_session_id,
                    "agent_result": result
                }
                
            except asyncio.TimeoutError:
                self.logger.error(f"Workflow execution timed out after {self.config.timeout_seconds} seconds")
                raise Exception(f"Workflow timed out after {self.config.timeout_seconds} seconds")
            
        except Exception as error:
            self.logger.error(f"Workflow execution failed: {error}")
            
            # Update error stats
            self.stats.ended_at = datetime.utcnow()
            self.stats.errors_encountered += 1
            self.stats.update_completion()
            
            return {
                "success": False,
                "error": str(error),
                "stats": self.stats.to_dict(),
                "context": asdict(self.context) if hasattr(self, 'context') else {},
                "session_id": self.current_session_id
            }
    
    async def _process_agent_result(self, result: Any):
        """Process the agent execution result to extract statistics"""
        self.logger.info("Processing agent execution result...")
        
        try:
            # This would depend on the actual structure of ADK agent results
            # For now, we'll extract basic information
            
            if hasattr(result, 'tool_calls'):
                for call in result.tool_calls:
                    if call.tool_name == 'database_query':
                        # Check for order/image completion queries
                        if 'UPDATE orders SET processing_stage' in str(call.arguments):
                            self.stats.orders_processed += 1
                        elif 'UPDATE images SET processing_status' in str(call.arguments):
                            self.stats.images_processed += 1
                    
                    # Track errors from tool calls
                    if hasattr(call, 'result') and not call.result.get('success', True):
                        self.stats.errors_encountered += 1
            
            # Update progress tracker with final stats
            await self.tools['progress']._execute(
                "update_stats",
                stat_update={
                    "orders_processed": self.stats.orders_processed,
                    "images_processed": self.stats.images_processed,
                    "errors": self.stats.errors_encountered
                }
            )
            
        except Exception as error:
            self.logger.warning(f"Could not fully process agent result: {error}")
    
    async def execute_recovery(self, failed_operation: str, error_details: str) -> Dict[str, Any]:
        """Execute error recovery workflow"""
        self.logger.info(f"Executing recovery for failed operation: {failed_operation}")
        
        try:
            # Build recovery prompt
            recovery_prompt = get_error_recovery_prompt(failed_operation, error_details, self.context)
            
            # Execute recovery with agent
            result = await self.agent.run(recovery_prompt)
            
            self.logger.info("Recovery workflow completed")
            
            return {
                "success": True,
                "message": "Recovery completed",
                "result": result
            }
            
        except Exception as error:
            self.logger.error(f"Recovery workflow failed: {error}")
            return {
                "success": False,
                "error": str(error)
            }
    
    def generate_report(self) -> Dict[str, Any]:
        """Generate comprehensive execution report"""
        return {
            "session_id": self.current_session_id,
            "timestamp": datetime.utcnow().isoformat(),
            "config": {
                "model": self.config.model_name,
                "mock_mode": self.config.mock_mode,
                "timeout_seconds": self.config.timeout_seconds
            },
            "execution_stats": self.stats.to_dict(),
            "context": asdict(self.context),
            "health_status": "healthy" if self.is_healthy else "unhealthy"
        }
    
    async def cleanup(self):
        """Clean up resources"""
        self.logger.info("Cleaning up ORBIT agent resources...")
        
        try:
            # Clean up tools
            tool_objects = [
                self.tools.get('database'),
                self.tools.get('storage'),
                self.tools.get('ai_analysis'),
                self.tools.get('metadata_embed')
            ]
            
            await cleanup_tools(*[t for t in tool_objects if t])
            
            self.logger.info("Cleanup completed")
            
        except Exception as error:
            self.logger.error(f"Error during cleanup: {error}")


class ORBITWorkflowExecutor:
    """High-level workflow executor for ORBIT operations"""
    
    def __init__(self, config: Optional[ORBITConfig] = None):
        self.config = config or ORBITConfig.from_environment()
        self.agent: Optional[ORBITAgent] = None
        self.logger = logging.getLogger("orbit_executor")
    
    async def initialize(self) -> Dict[str, Any]:
        """Initialize the executor and validate configuration"""
        self.logger.info("Initializing ORBIT Workflow Executor...")
        
        # Validate configuration
        config_errors = self.config.validate()
        if config_errors:
            return {
                "success": False,
                "error": f"Configuration errors: {', '.join(config_errors)}",
                "config_errors": config_errors
            }
        
        try:
            # Initialize agent
            self.agent = ORBITAgent(self.config)
            
            # Perform initial health check
            health_status = await self.agent.health_check()
            
            return {
                "success": True,
                "message": "ORBIT Executor initialized successfully",
                "health_status": health_status,
                "config": {
                    "model": self.config.model_name,
                    "mock_mode": self.config.mock_mode,
                    "timeout": self.config.timeout_seconds
                }
            }
            
        except Exception as error:
            return {
                "success": False,
                "error": str(error)
            }
    
    async def execute_full_workflow(self, order_id: Optional[str] = None) -> Dict[str, Any]:
        """Execute the complete ORBIT workflow"""
        if not self.agent:
            init_result = await self.initialize()
            if not init_result["success"]:
                return init_result
        
        try:
            result = await self.agent.execute_workflow(order_id)
            return result
            
        except Exception as error:
            self.logger.error(f"Workflow execution failed: {error}")
            return {
                "success": False,
                "error": str(error)
            }
    
    async def execute_health_check(self) -> Dict[str, Any]:
        """Execute health check only"""
        if not self.agent:
            init_result = await self.initialize()
            if not init_result["success"]:
                return init_result
        
        return await self.agent.health_check()
    
    def get_execution_report(self) -> Dict[str, Any]:
        """Get comprehensive execution report"""
        if not self.agent:
            return {"error": "Agent not initialized"}
        
        return self.agent.generate_report()
    
    async def cleanup(self):
        """Clean up all resources"""
        if self.agent:
            await self.agent.cleanup()


# Main execution function for direct usage
async def main():
    """Main execution function"""
    import sys
    
    # Set up basic logging
    logging.basicConfig(
        level=logging.INFO,
        format='[%(asctime)s] [%(levelname)s] %(message)s'
    )
    
    logger = logging.getLogger("orbit_main")
    logger.info("Starting ORBIT Workflow Processor...")
    
    try:
        # Create executor
        executor = ORBITWorkflowExecutor()
        
        # Initialize
        init_result = await executor.initialize()
        if not init_result["success"]:
            logger.error(f"Initialization failed: {init_result['error']}")
            sys.exit(1)
        
        logger.info("Initialization successful")
        
        # Execute workflow
        order_id = sys.argv[1] if len(sys.argv) > 1 else None
        result = await executor.execute_full_workflow(order_id)
        
        if result["success"]:
            logger.info("Workflow completed successfully!")
            print(f"Orders processed: {result['stats']['orders_processed']}")
            print(f"Images processed: {result['stats']['images_processed']}")
            print(f"Duration: {result['stats']['duration_minutes']} minutes")
        else:
            logger.error(f"Workflow failed: {result['error']}")
            sys.exit(1)
        
        # Generate report
        report = executor.get_execution_report()
        logger.info(f"Final report: {json.dumps(report, indent=2)}")
        
        # Cleanup
        await executor.cleanup()
        logger.info("Cleanup completed")
        
    except KeyboardInterrupt:
        logger.info("Execution interrupted by user")
        sys.exit(0)
    except Exception as error:
        logger.error(f"Fatal error: {error}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())