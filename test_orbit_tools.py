"""
Unit Tests for ORBIT Tools
Comprehensive test suite for all ORBIT tool implementations with mocking
"""

import asyncio
import pytest
import json
import time
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, Any

# Import the tools to test
from orbit_tools import (
    DatabaseTool, StorageTool, AIAnalysisTool, MetadataEmbedTool,
    ProgressTrackerTool, MonitoringTool, ToolResult, LogLevel,
    create_database_tool, create_storage_tool, create_ai_analysis_tool,
    create_metadata_embed_tool, create_progress_tracker, create_monitoring_tool
)


class TestToolResult:
    """Test the ToolResult utility class"""
    
    def test_tool_result_success(self):
        """Test successful ToolResult creation"""
        result = ToolResult(success=True, data={"test": "data"}, metadata={"key": "value"})
        
        assert result.success is True
        assert result.data == {"test": "data"}
        assert result.error is None
        assert result.metadata == {"key": "value"}
        assert result.timestamp is not None
    
    def test_tool_result_failure(self):
        """Test failed ToolResult creation"""
        result = ToolResult(success=False, error="Test error")
        
        assert result.success is False
        assert result.data is None
        assert result.error == "Test error"
        assert result.timestamp is not None
    
    def test_tool_result_to_dict(self):
        """Test ToolResult dictionary conversion"""
        result = ToolResult(success=True, data={"key": "value"})
        result_dict = result.to_dict()
        
        assert isinstance(result_dict, dict)
        assert result_dict["success"] is True
        assert result_dict["data"] == {"key": "value"}
        assert "timestamp" in result_dict


class TestDatabaseTool:
    """Test DatabaseTool functionality"""
    
    @pytest.fixture
    def mock_http_client(self):
        """Create mock HTTP client"""
        client = AsyncMock()
        return client
    
    @pytest.fixture
    def database_tool(self, mock_http_client):
        """Create DatabaseTool with mocked client"""
        tool = DatabaseTool("http://test.supabase.co", "test-key")
        tool.client = mock_http_client
        return tool
    
    @pytest.mark.asyncio
    async def test_successful_query(self, database_tool, mock_http_client):
        """Test successful database query execution"""
        # Mock successful response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = [{"id": 1, "name": "test"}]
        mock_http_client.post.return_value = mock_response
        
        result = await database_tool._execute(
            "SELECT * FROM test_table",
            operation_type="test"
        )
        
        assert result.success is True
        assert result.data == [{"id": 1, "name": "test"}]
        assert result.metadata["row_count"] == 2
        assert result.metadata["operation_type"] == "test"
    
    @pytest.mark.asyncio
    async def test_database_error(self, database_tool, mock_http_client):
        """Test database error handling"""
        # Mock error response
        mock_response = Mock()
        mock_response.status_code = 400
        mock_response.text = "Bad Request"
        mock_http_client.post.return_value = mock_response
        
        result = await database_tool._execute(
            "INVALID SQL",
            retry_on_error=False
        )
        
        assert result.success is False
        assert "Database error: 400" in result.error
        assert result.metadata["attempts"] == 1
    
    @pytest.mark.asyncio
    async def test_retry_logic(self, database_tool, mock_http_client):
        """Test retry logic on transient failures"""
        # Mock failing then succeeding responses
        responses = [
            Mock(status_code=500, text="Internal Server Error"),
            Mock(status_code=500, text="Internal Server Error"),
            Mock(status_code=200)
        ]
        responses[2].json.return_value = [{"success": True}]
        
        mock_http_client.post.side_effect = responses
        
        with patch('asyncio.sleep'):  # Speed up test by mocking sleep
            result = await database_tool._execute(
                "SELECT 1",
                retry_on_error=True
            )
        
        assert result.success is True
        assert result.metadata["attempts"] == 3
    
    @pytest.mark.asyncio
    async def test_transaction_success(self, database_tool):
        """Test successful transaction execution"""
        # Mock successful query execution
        database_tool._execute = AsyncMock()
        database_tool._execute.side_effect = [
            ToolResult(True, "BEGIN"),  # BEGIN
            ToolResult(True, [{"id": 1}]),  # First query
            ToolResult(True, [{"id": 2}]),  # Second query
            ToolResult(True, "COMMIT")  # COMMIT
        ]
        
        queries = [
            {"sql": "INSERT INTO table1 VALUES (1)", "params": []},
            {"sql": "INSERT INTO table2 VALUES (2)", "params": []}
        ]
        
        result = await database_tool.execute_transaction(queries)
        
        assert result.success is True
        assert result.metadata["queries_executed"] == 2
        assert len(result.data) == 2
    
    @pytest.mark.asyncio
    async def test_transaction_rollback(self, database_tool):
        """Test transaction rollback on failure"""
        # Mock queries with failure
        database_tool._execute = AsyncMock()
        database_tool._execute.side_effect = [
            ToolResult(True, "BEGIN"),  # BEGIN
            ToolResult(True, [{"id": 1}]),  # First query succeeds
            ToolResult(False, error="Query failed"),  # Second query fails
            ToolResult(True, "ROLLBACK")  # ROLLBACK
        ]
        
        queries = [
            {"sql": "INSERT INTO table1 VALUES (1)", "params": []},
            {"sql": "INVALID SQL", "params": []}
        ]
        
        result = await database_tool.execute_transaction(queries)
        
        assert result.success is False
        assert "Query failed" in result.error
        assert result.metadata["queries_attempted"] == 2


class TestStorageTool:
    """Test StorageTool functionality"""
    
    @pytest.fixture
    def mock_http_client(self):
        """Create mock HTTP client"""
        client = AsyncMock()
        return client
    
    @pytest.fixture
    def storage_tool(self, mock_http_client):
        """Create StorageTool with mocked client"""
        tool = StorageTool("http://test.supabase.co", "test-key")
        tool.client = mock_http_client
        return tool
    
    @pytest.mark.asyncio
    async def test_list_files_success(self, storage_tool, mock_http_client):
        """Test successful file listing"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"name": "image1.jpg", "updated_at": "2023-01-01", "metadata": {"size": 1024}},
            {"name": "image2.png", "updated_at": "2023-01-02", "metadata": {"size": 2048}}
        ]
        mock_http_client.get.return_value = mock_response
        
        result = await storage_tool._execute(
            operation="list_files",
            bucket="test-bucket",
            folder_path="images"
        )
        
        assert result.success is True
        assert len(result.data) == 2
        assert result.metadata["file_count"] == 2
        assert result.metadata["bucket"] == "test-bucket"
    
    @pytest.mark.asyncio
    async def test_list_files_with_extension_filter(self, storage_tool, mock_http_client):
        """Test file listing with extension filter"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"name": "image1.jpg", "updated_at": "2023-01-01"},
            {"name": "document.pdf", "updated_at": "2023-01-02"},
            {"name": "image2.jpg", "updated_at": "2023-01-03"}
        ]
        mock_http_client.get.return_value = mock_response
        
        result = await storage_tool._execute(
            operation="list_files",
            bucket="test-bucket",
            file_extension=".jpg"
        )
        
        assert result.success is True
        assert len(result.data) == 2  # Only JPG files
        assert all(f["name"].endswith(".jpg") for f in result.data)
    
    @pytest.mark.asyncio
    async def test_create_signed_urls_success(self, storage_tool, mock_http_client):
        """Test successful signed URL creation"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"signedURL": "https://signed.url/test"}
        mock_http_client.post.return_value = mock_response
        
        result = await storage_tool._execute(
            operation="create_signed_urls",
            bucket="test-bucket",
            file_paths=["image1.jpg", "image2.jpg"],
            expires_in=3600
        )
        
        assert result.success is True
        assert len(result.data) == 2
        assert all(url["signed_url"] == "https://signed.url/test" for url in result.data)
        assert result.metadata["url_count"] == 2
    
    @pytest.mark.asyncio
    async def test_upload_file_success(self, storage_tool, mock_http_client):
        """Test successful file upload"""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_http_client.post.return_value = mock_response
        
        result = await storage_tool._execute(
            operation="upload_file",
            bucket="test-bucket",
            path="test/image.jpg",
            content="base64:dGVzdCBjb250ZW50",  # "test content" in base64
            content_type="image/jpeg"
        )
        
        assert result.success is True
        assert result.data["path"] == "test/image.jpg"
        assert result.metadata["content_type"] == "image/jpeg"
    
    @pytest.mark.asyncio
    async def test_verify_file_exists(self, storage_tool, mock_http_client):
        """Test file verification when file exists"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {
            "content-length": "1024",
            "last-modified": "2023-01-01",
            "content-type": "image/jpeg"
        }
        mock_http_client.head.return_value = mock_response
        
        result = await storage_tool._execute(
            operation="verify_file",
            bucket="test-bucket",
            path="test/image.jpg"
        )
        
        assert result.success is True
        assert result.data["exists"] is True
        assert result.data["size"] == 1024
        assert result.data["content_type"] == "image/jpeg"
    
    @pytest.mark.asyncio
    async def test_verify_file_not_exists(self, storage_tool, mock_http_client):
        """Test file verification when file doesn't exist"""
        mock_response = Mock()
        mock_response.status_code = 404
        mock_http_client.head.return_value = mock_response
        
        result = await storage_tool._execute(
            operation="verify_file",
            bucket="test-bucket",
            path="nonexistent.jpg"
        )
        
        assert result.success is True
        assert result.data["exists"] is False
        assert result.data["size"] is None


class TestAIAnalysisTool:
    """Test AIAnalysisTool functionality"""
    
    @pytest.fixture
    def mock_ai_tool(self):
        """Create AI analysis tool in mock mode"""
        return AIAnalysisTool(mock_mode=True)
    
    @pytest.fixture
    def real_ai_tool(self):
        """Create AI analysis tool with real endpoint"""
        return AIAnalysisTool("http://test.gemini.endpoint", mock_mode=False)
    
    @pytest.mark.asyncio
    async def test_mock_analysis_lifestyle(self, mock_ai_tool):
        """Test mock lifestyle image analysis"""
        result = await mock_ai_tool._execute(
            image_url="https://example.com/image.jpg",
            analysis_type="lifestyle"
        )
        
        assert result.success is True
        assert result.data["analysis_type"] == "lifestyle"
        assert "lifestyle" in result.data["metadata"]["objects"]
        assert result.metadata["mock_mode"] is True
        assert result.metadata["duration_seconds"] == 0.5
    
    @pytest.mark.asyncio
    async def test_mock_analysis_product(self, mock_ai_tool):
        """Test mock product image analysis"""
        result = await mock_ai_tool._execute(
            image_url="https://example.com/product.jpg",
            analysis_type="product"
        )
        
        assert result.success is True
        assert result.data["analysis_type"] == "product"
        assert "product" in result.data["metadata"]["objects"]
        assert result.data["metadata"]["scene"]["setting"] == "studio"
    
    @pytest.mark.asyncio
    async def test_real_analysis_success(self, real_ai_tool):
        """Test real AI analysis with successful response"""
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "analysis": {"type": "lifestyle", "confidence": 0.9}
        }
        mock_client.post.return_value = mock_response
        real_ai_tool.client = mock_client
        
        result = await real_ai_tool._execute(
            image_url="https://example.com/image.jpg",
            analysis_type="lifestyle"
        )
        
        assert result.success is True
        assert result.data == {"analysis": {"type": "lifestyle", "confidence": 0.9}}
        assert result.metadata["analysis_type"] == "lifestyle"
    
    @pytest.mark.asyncio
    async def test_real_analysis_failure(self, real_ai_tool):
        """Test real AI analysis with API failure"""
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_client.post.return_value = mock_response
        real_ai_tool.client = mock_client
        
        result = await real_ai_tool._execute(
            image_url="https://example.com/image.jpg",
            analysis_type="lifestyle"
        )
        
        assert result.success is False
        assert "AI analysis failed: 500" in result.error


class TestMetadataEmbedTool:
    """Test MetadataEmbedTool functionality"""
    
    @pytest.fixture
    def mock_metadata_tool(self):
        """Create metadata tool in mock mode"""
        return MetadataEmbedTool(mock_mode=True)
    
    @pytest.fixture
    def real_metadata_tool(self):
        """Create metadata tool with real endpoint"""
        return MetadataEmbedTool("http://test.metadata.endpoint", mock_mode=False)
    
    @pytest.mark.asyncio
    async def test_mock_embed_success(self, mock_metadata_tool):
        """Test mock metadata embedding"""
        metadata = {
            "title": "Test Image",
            "description": "Test description",
            "tags": ["test", "mock"]
        }
        
        result = await mock_metadata_tool._execute(
            source_path="source/image.jpg",
            output_path="processed/image.jpg",
            metadata=metadata,
            compression_quality=90
        )
        
        assert result.success is True
        assert result.data["processed_path"] == "processed/image.jpg"
        assert result.data["compression_quality"] == 90
        assert result.data["processed_size"] > result.data["original_size"]  # Metadata adds size
        assert result.metadata["mock_mode"] is True
    
    @pytest.mark.asyncio
    async def test_real_embed_success(self, real_metadata_tool):
        """Test real metadata embedding with successful response"""
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "processed_path": "output/image.jpg",
            "size": 2048000
        }
        mock_client.post.return_value = mock_response
        real_metadata_tool.client = mock_client
        
        metadata = {"title": "Test"}
        
        result = await real_metadata_tool._execute(
            source_path="input/image.jpg",
            output_path="output/image.jpg",
            metadata=metadata
        )
        
        assert result.success is True
        assert result.data == {"processed_path": "output/image.jpg", "size": 2048000}
        assert result.metadata["metadata_size_bytes"] > 0
    
    @pytest.mark.asyncio
    async def test_real_embed_failure(self, real_metadata_tool):
        """Test real metadata embedding with API failure"""
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.status_code = 422
        mock_response.text = "Unprocessable Entity"
        mock_client.post.return_value = mock_response
        real_metadata_tool.client = mock_client
        
        result = await real_metadata_tool._execute(
            source_path="input/bad.jpg",
            output_path="output/bad.jpg",
            metadata={"invalid": "data"}
        )
        
        assert result.success is False
        assert "Metadata embedding failed: 422" in result.error


class TestProgressTrackerTool:
    """Test ProgressTrackerTool functionality"""
    
    @pytest.fixture
    def progress_tool(self):
        """Create progress tracker tool"""
        return ProgressTrackerTool()
    
    @pytest.mark.asyncio
    async def test_add_todo(self, progress_tool):
        """Test adding a todo item"""
        result = await progress_tool._execute(
            action="add_todo",
            content="Process first order",
            status="pending"
        )
        
        assert result.success is True
        assert result.data["id"] == 1
        assert result.data["content"] == "Process first order"
        assert result.data["status"] == "pending"
        assert result.metadata["total_todos"] == 1
    
    @pytest.mark.asyncio
    async def test_update_todo(self, progress_tool):
        """Test updating todo status"""
        # First add a todo
        await progress_tool._execute("add_todo", content="Test todo")
        
        # Then update it
        result = await progress_tool._execute(
            action="update_todo",
            todo_id=1,
            status="completed"
        )
        
        assert result.success is True
        assert result.data["status"] == "completed"
        assert "updated_at" in result.data
    
    @pytest.mark.asyncio
    async def test_list_todos(self, progress_tool):
        """Test listing all todos"""
        # Add multiple todos
        await progress_tool._execute("add_todo", content="Todo 1", status="pending")
        await progress_tool._execute("add_todo", content="Todo 2", status="completed")
        await progress_tool._execute("add_todo", content="Todo 3", status="in_progress")
        
        result = await progress_tool._execute(action="list_todos")
        
        assert result.success is True
        assert len(result.data) == 3
        assert result.metadata["by_status"]["pending"] == 1
        assert result.metadata["by_status"]["completed"] == 1
        assert result.metadata["by_status"]["in_progress"] == 1
    
    @pytest.mark.asyncio
    async def test_get_progress(self, progress_tool):
        """Test getting progress statistics"""
        # Add todos with different statuses
        await progress_tool._execute("add_todo", content="Todo 1", status="completed")
        await progress_tool._execute("add_todo", content="Todo 2", status="completed")
        await progress_tool._execute("add_todo", content="Todo 3", status="pending")
        await progress_tool._execute("add_todo", content="Todo 4", status="in_progress")
        
        result = await progress_tool._execute(action="get_progress")
        
        assert result.success is True
        assert result.data["total_todos"] == 4
        assert result.data["completed"] == 2
        assert result.data["pending"] == 1
        assert result.data["in_progress"] == 1
        assert result.data["percent_complete"] == 50.0
    
    @pytest.mark.asyncio
    async def test_update_stats(self, progress_tool):
        """Test updating workflow statistics"""
        stats_update = {
            "orders_processed": 5,
            "images_processed": 20,
            "errors": 1
        }
        
        result = await progress_tool._execute(
            action="update_stats",
            stat_update=stats_update
        )
        
        assert result.success is True
        assert result.data["orders_processed"] == 5
        assert result.data["images_processed"] == 20
        assert result.data["errors"] == 1
        assert "started_at" in result.data
    
    @pytest.mark.asyncio
    async def test_reset(self, progress_tool):
        """Test resetting progress tracker"""
        # Add some todos and stats first
        await progress_tool._execute("add_todo", content="Test")
        await progress_tool._execute("update_stats", stat_update={"orders_processed": 5})
        
        # Reset
        result = await progress_tool._execute(action="reset")
        
        assert result.success is True
        assert len(progress_tool.todos) == 0
        assert progress_tool.workflow_stats["orders_processed"] == 0


class TestMonitoringTool:
    """Test MonitoringTool functionality"""
    
    @pytest.fixture
    def monitoring_tool(self):
        """Create monitoring tool with INFO level"""
        return MonitoringTool(LogLevel.INFO)
    
    @pytest.mark.asyncio
    async def test_log_message(self, monitoring_tool):
        """Test logging a message"""
        result = await monitoring_tool._execute(
            action="log",
            level="info",
            message="Test log message"
        )
        
        assert result.success is True
        assert result.data["level"] == "info"
        assert result.data["message"] == "Test log message"
        assert result.metadata["total_logs"] == 1
    
    @pytest.mark.asyncio
    async def test_record_metric(self, monitoring_tool):
        """Test recording a metric"""
        result = await monitoring_tool._execute(
            action="metric",
            metric_name="processing_time",
            metric_value=1.5,
            metric_unit="seconds"
        )
        
        assert result.success is True
        assert result.data["metric"] == "processing_time"
        assert result.data["value"] == 1.5
        assert result.data["unit"] == "seconds"
        assert result.metadata["metric_count"] == 1
    
    @pytest.mark.asyncio
    async def test_create_alert(self, monitoring_tool):
        """Test creating an alert"""
        result = await monitoring_tool._execute(
            action="alert",
            alert_severity="high",
            message="System overload detected"
        )
        
        assert result.success is True
        assert result.data["severity"] == "high"
        assert result.data["message"] == "System overload detected"
        assert "id" in result.data
        assert result.metadata["total_alerts"] == 1
    
    @pytest.mark.asyncio
    async def test_generate_report(self, monitoring_tool):
        """Test generating monitoring report"""
        # Add some test data first
        await monitoring_tool._execute("log", level="info", message="Test 1")
        await monitoring_tool._execute("log", level="error", message="Test 2")
        await monitoring_tool._execute("metric", metric_name="cpu", metric_value=75.0)
        await monitoring_tool._execute("metric", metric_name="cpu", metric_value=80.0)
        await monitoring_tool._execute("alert", alert_severity="medium", message="Alert 1")
        
        result = await monitoring_tool._execute(action="report")
        
        assert result.success is True
        report = result.data
        
        assert report["logs"]["total"] == 2
        assert report["logs"]["by_level"]["info"] == 1
        assert report["logs"]["by_level"]["error"] == 1
        assert report["metrics"]["total_metrics"] == 1
        assert report["metrics"]["summaries"]["cpu"]["count"] == 2
        assert report["metrics"]["summaries"]["cpu"]["avg"] == 77.5
        assert report["alerts"]["total"] == 1
        assert report["alerts"]["by_severity"]["medium"] == 1
    
    def test_should_log_levels(self):
        """Test log level filtering"""
        # INFO level tool should log INFO and above
        info_tool = MonitoringTool(LogLevel.INFO)
        assert info_tool._should_log(LogLevel.INFO) is True
        assert info_tool._should_log(LogLevel.WARN) is True
        assert info_tool._should_log(LogLevel.ERROR) is True
        assert info_tool._should_log(LogLevel.DEBUG) is False
        
        # ERROR level tool should only log ERROR
        error_tool = MonitoringTool(LogLevel.ERROR)
        assert error_tool._should_log(LogLevel.ERROR) is True
        assert error_tool._should_log(LogLevel.WARN) is False
        assert error_tool._should_log(LogLevel.INFO) is False
        assert error_tool._should_log(LogLevel.DEBUG) is False


class TestToolFactories:
    """Test tool factory functions"""
    
    def test_create_database_tool(self):
        """Test database tool factory"""
        tool = create_database_tool("http://test.supabase.co", "test-key", 5)
        
        assert isinstance(tool, DatabaseTool)
        assert tool.supabase_url == "http://test.supabase.co"
        assert tool.supabase_key == "test-key"
        assert tool.max_retries == 5
    
    def test_create_storage_tool(self):
        """Test storage tool factory"""
        tool = create_storage_tool("http://test.supabase.co", "test-key")
        
        assert isinstance(tool, StorageTool)
        assert tool.supabase_url == "http://test.supabase.co"
        assert tool.supabase_key == "test-key"
    
    def test_create_ai_analysis_tool(self):
        """Test AI analysis tool factory"""
        tool = create_ai_analysis_tool("http://gemini.endpoint", mock_mode=True)
        
        assert isinstance(tool, AIAnalysisTool)
        assert tool.gemini_endpoint == "http://gemini.endpoint"
        assert tool.mock_mode is True
    
    def test_create_metadata_embed_tool(self):
        """Test metadata embed tool factory"""
        tool = create_metadata_embed_tool("http://metadata.endpoint", mock_mode=False)
        
        assert isinstance(tool, MetadataEmbedTool)
        assert tool.metadata_endpoint == "http://metadata.endpoint"
        assert tool.mock_mode is False
    
    def test_create_progress_tracker(self):
        """Test progress tracker factory"""
        tool = create_progress_tracker()
        
        assert isinstance(tool, ProgressTrackerTool)
        assert len(tool.todos) == 0
        assert tool.next_id == 1
    
    def test_create_monitoring_tool(self):
        """Test monitoring tool factory"""
        tool = create_monitoring_tool(LogLevel.DEBUG)
        
        assert isinstance(tool, MonitoringTool)
        assert tool.log_level == LogLevel.DEBUG


class TestIntegration:
    """Integration tests combining multiple tools"""
    
    @pytest.mark.asyncio
    async def test_workflow_simulation(self):
        """Test simulated workflow using multiple tools"""
        # Create tools
        progress = create_progress_tracker()
        monitoring = create_monitoring_tool(LogLevel.INFO)
        ai_tool = create_ai_analysis_tool(mock_mode=True)
        
        # Start workflow
        await monitoring._execute("log", level="info", message="Starting workflow")
        await progress._execute("add_todo", content="Analyze image", status="pending")
        
        # Process image
        await progress._execute("update_todo", todo_id=1, status="in_progress")
        
        start_time = time.time()
        analysis_result = await ai_tool._execute(
            image_url="https://example.com/test.jpg",
            analysis_type="lifestyle"
        )
        duration = time.time() - start_time
        
        await monitoring._execute("metric", metric_name="analysis_time", 
                                 metric_value=duration, metric_unit="seconds")
        
        # Complete workflow
        if analysis_result.success:
            await progress._execute("update_todo", todo_id=1, status="completed")
            await monitoring._execute("log", level="info", message="Workflow completed successfully")
        else:
            await monitoring._execute("alert", alert_severity="high", 
                                    message="Analysis failed")
        
        # Check results
        progress_result = await progress._execute("get_progress")
        report_result = await monitoring._execute("report")
        
        assert progress_result.data["completed"] == 1
        assert report_result.data["logs"]["total"] >= 2
        assert "analysis_time" in report_result.data["metrics"]["summaries"]
    
    @pytest.mark.asyncio
    async def test_error_recovery_simulation(self):
        """Test error recovery workflow"""
        monitoring = create_monitoring_tool(LogLevel.DEBUG)
        progress = create_progress_tracker()
        
        # Simulate failed operation
        await monitoring._execute("log", level="error", message="Database connection failed")
        await monitoring._execute("alert", alert_severity="high", 
                                message="Database unavailable")
        await progress._execute("add_todo", content="Retry database connection", 
                               status="pending")
        
        # Simulate retry attempts
        for attempt in range(3):
            await monitoring._execute("log", level="debug", 
                                    message=f"Retry attempt {attempt + 1}")
            await asyncio.sleep(0.01)  # Small delay to simulate retry backoff
        
        # Simulate successful recovery
        await monitoring._execute("log", level="info", message="Database connection restored")
        await progress._execute("update_todo", todo_id=1, status="completed")
        
        # Generate final report
        report = await monitoring._execute("report")
        progress_report = await progress._execute("get_progress")
        
        assert report.data["logs"]["by_level"]["error"] >= 1
        assert report.data["logs"]["by_level"]["debug"] >= 3
        assert report.data["alerts"]["by_severity"]["high"] >= 1
        assert progress_report.data["completed"] == 1


# Test runner configuration
if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--tb=short"])
    
    # Or run specific test classes
    # pytest.main([__file__ + "::TestDatabaseTool", "-v"])