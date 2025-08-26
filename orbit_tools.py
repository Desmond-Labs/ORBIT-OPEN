"""
ORBIT Tools - Core tool implementations for Google ADK agent
Handles database operations, storage management, AI analysis, and workflow orchestration
"""

import asyncio
import json
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict
from enum import Enum
import httpx
import base64
from google.adk import Tool


class ToolResult:
    """Standard result format for all tools"""
    def __init__(self, success: bool, data: Any = None, error: str = None, metadata: Dict = None):
        self.success = success
        self.data = data
        self.error = error
        self.metadata = metadata or {}
        self.timestamp = datetime.utcnow().isoformat()
    
    def to_dict(self) -> Dict:
        return {
            'success': self.success,
            'data': self.data,
            'error': self.error,
            'metadata': self.metadata,
            'timestamp': self.timestamp
        }


class LogLevel(Enum):
    DEBUG = "debug"
    INFO = "info" 
    WARN = "warn"
    ERROR = "error"


class DatabaseTool(Tool):
    """Enhanced database operations with retry logic and transaction support"""
    
    def __init__(self, supabase_url: str, supabase_key: str, max_retries: int = 3):
        super().__init__(
            name="database_query",
            description="Execute SQL queries against Supabase with retry logic and transaction support",
            func=self._execute
        )
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.max_retries = max_retries
        self.client = httpx.AsyncClient(
            headers={
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": "application/json",
                "apikey": supabase_key
            },
            timeout=30.0
        )
    
    async def _execute(self, query: str, params: Optional[List] = None, 
                      retry_on_error: bool = True, operation_type: str = "query") -> ToolResult:
        """Execute database operation with retry logic"""
        attempts = 0
        last_error = None
        
        while attempts < (self.max_retries if retry_on_error else 1):
            try:
                start_time = time.time()
                
                # Call Supabase RPC function
                response = await self.client.post(
                    f"{self.supabase_url}/rest/v1/rpc/execute_sql",
                    json={
                        "query": query,
                        "params": params or []
                    }
                )
                
                duration = time.time() - start_time
                
                if response.status_code != 200:
                    raise Exception(f"Database error: {response.status_code} - {response.text}")
                
                data = response.json()
                
                return ToolResult(
                    success=True,
                    data=data,
                    metadata={
                        "query": query[:100] + "..." if len(query) > 100 else query,
                        "row_count": len(data) if isinstance(data, list) else 1,
                        "duration_seconds": round(duration, 3),
                        "attempts": attempts + 1,
                        "operation_type": operation_type
                    }
                )
                
            except Exception as error:
                last_error = error
                attempts += 1
                
                if attempts < self.max_retries and retry_on_error:
                    # Exponential backoff
                    await asyncio.sleep(2 ** attempts)
        
        return ToolResult(
            success=False,
            error=str(last_error),
            metadata={
                "query": query[:100] + "..." if len(query) > 100 else query,
                "attempts": attempts,
                "operation_type": operation_type
            }
        )
    
    async def execute_transaction(self, queries: List[Dict[str, Any]]) -> ToolResult:
        """Execute multiple queries in a transaction"""
        transaction_id = str(uuid.uuid4())
        start_time = time.time()
        
        try:
            # Begin transaction
            await self._execute("BEGIN", operation_type="transaction_begin")
            
            results = []
            for i, query_data in enumerate(queries):
                query = query_data.get('sql') or query_data.get('query')
                params = query_data.get('params', [])
                
                result = await self._execute(query, params, retry_on_error=False)
                
                if not result.success:
                    # Rollback on any failure
                    await self._execute("ROLLBACK", operation_type="transaction_rollback")
                    raise Exception(f"Query {i+1} failed: {result.error}")
                
                results.append(result.to_dict())
            
            # Commit transaction
            await self._execute("COMMIT", operation_type="transaction_commit")
            
            duration = time.time() - start_time
            
            return ToolResult(
                success=True,
                data=results,
                metadata={
                    "transaction_id": transaction_id,
                    "queries_executed": len(queries),
                    "duration_seconds": round(duration, 3)
                }
            )
            
        except Exception as error:
            # Ensure rollback
            try:
                await self._execute("ROLLBACK", operation_type="transaction_rollback")
            except:
                pass  # Rollback might fail if transaction already failed
            
            return ToolResult(
                success=False,
                error=str(error),
                metadata={
                    "transaction_id": transaction_id,
                    "queries_attempted": len(queries)
                }
            )
    
    async def close(self):
        """Clean up resources"""
        await self.client.aclose()


class StorageTool(Tool):
    """Enhanced storage operations for file management"""
    
    def __init__(self, supabase_url: str, supabase_key: str):
        super().__init__(
            name="storage_operations",
            description="Comprehensive storage operations for file management",
            func=self._execute
        )
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.client = httpx.AsyncClient(
            headers={
                "Authorization": f"Bearer {supabase_key}",
                "apikey": supabase_key
            },
            timeout=60.0  # Longer timeout for file operations
        )
    
    async def _execute(self, operation: str, bucket: str, path: str = None, 
                      content: str = None, content_type: str = None,
                      file_paths: List[str] = None, expires_in: int = 3600,
                      folder_path: str = "", file_extension: str = None) -> ToolResult:
        """Execute storage operation"""
        
        try:
            if operation == "list_files":
                return await self._list_files(bucket, folder_path, file_extension)
            elif operation == "create_signed_urls":
                return await self._create_signed_urls(bucket, file_paths, expires_in)
            elif operation == "upload_file":
                return await self._upload_file(bucket, path, content, content_type)
            elif operation == "download_file":
                return await self._download_file(bucket, path)
            elif operation == "delete_file":
                return await self._delete_file(bucket, path)
            elif operation == "verify_file":
                return await self._verify_file(bucket, path)
            else:
                return ToolResult(success=False, error=f"Unknown operation: {operation}")
                
        except Exception as error:
            return ToolResult(success=False, error=str(error))
    
    async def _list_files(self, bucket: str, folder_path: str, file_extension: str = None) -> ToolResult:
        """List files in storage bucket"""
        response = await self.client.get(
            f"{self.supabase_url}/storage/v1/object/list/{bucket}",
            params={
                "prefix": folder_path,
                "limit": 1000,
                "offset": 0
            }
        )
        
        if response.status_code != 200:
            raise Exception(f"Storage list error: {response.status_code} - {response.text}")
        
        files = response.json()
        
        # Filter by extension if provided
        if file_extension:
            files = [f for f in files if f.get('name', '').endswith(file_extension)]
        
        processed_files = []
        for file in files:
            processed_files.append({
                'name': file.get('name'),
                'size': file.get('metadata', {}).get('size'),
                'last_modified': file.get('updated_at'),
                'path': f"{folder_path}/{file.get('name')}" if folder_path else file.get('name'),
                'mime_type': file.get('metadata', {}).get('mimetype')
            })
        
        return ToolResult(
            success=True,
            data=processed_files,
            metadata={
                "bucket": bucket,
                "folder_path": folder_path,
                "file_count": len(processed_files),
                "filter_extension": file_extension
            }
        )
    
    async def _create_signed_urls(self, bucket: str, file_paths: List[str], expires_in: int) -> ToolResult:
        """Create signed URLs for file access"""
        urls = []
        
        for file_path in file_paths:
            response = await self.client.post(
                f"{self.supabase_url}/storage/v1/object/sign/{bucket}/{file_path}",
                json={"expiresIn": expires_in}
            )
            
            if response.status_code == 200:
                data = response.json()
                urls.append({
                    'path': file_path,
                    'signed_url': data.get('signedURL'),
                    'expires_at': (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
                })
            else:
                urls.append({
                    'path': file_path,
                    'error': f"Failed to create signed URL: {response.status_code}"
                })
        
        return ToolResult(
            success=True,
            data=urls,
            metadata={
                "bucket": bucket,
                "url_count": len(urls),
                "expires_in_seconds": expires_in
            }
        )
    
    async def _upload_file(self, bucket: str, path: str, content: str, content_type: str) -> ToolResult:
        """Upload file to storage"""
        # Handle base64 content
        if content.startswith('data:'):
            # Extract base64 data
            header, encoded = content.split(',', 1)
            file_data = base64.b64decode(encoded)
        elif content.startswith('base64:'):
            file_data = base64.b64decode(content[7:])  # Remove 'base64:' prefix
        else:
            file_data = content.encode() if isinstance(content, str) else content
        
        response = await self.client.post(
            f"{self.supabase_url}/storage/v1/object/{bucket}/{path}",
            content=file_data,
            headers={"Content-Type": content_type or "application/octet-stream"}
        )
        
        if response.status_code not in [200, 201]:
            raise Exception(f"Upload failed: {response.status_code} - {response.text}")
        
        return ToolResult(
            success=True,
            data={"path": path, "size": len(file_data)},
            metadata={
                "bucket": bucket,
                "content_type": content_type,
                "file_size_bytes": len(file_data)
            }
        )
    
    async def _download_file(self, bucket: str, path: str) -> ToolResult:
        """Download file from storage"""
        response = await self.client.get(f"{self.supabase_url}/storage/v1/object/{bucket}/{path}")
        
        if response.status_code != 200:
            raise Exception(f"Download failed: {response.status_code} - {response.text}")
        
        content = base64.b64encode(response.content).decode()
        
        return ToolResult(
            success=True,
            data={
                "content": content,
                "path": path,
                "size": len(response.content),
                "content_type": response.headers.get("content-type")
            },
            metadata={
                "bucket": bucket,
                "file_size_bytes": len(response.content)
            }
        )
    
    async def _verify_file(self, bucket: str, path: str) -> ToolResult:
        """Verify file exists and get metadata"""
        response = await self.client.head(f"{self.supabase_url}/storage/v1/object/{bucket}/{path}")
        
        exists = response.status_code == 200
        
        return ToolResult(
            success=True,
            data={
                "exists": exists,
                "path": path,
                "size": int(response.headers.get("content-length", 0)) if exists else None,
                "last_modified": response.headers.get("last-modified") if exists else None,
                "content_type": response.headers.get("content-type") if exists else None
            },
            metadata={"bucket": bucket}
        )
    
    async def _delete_file(self, bucket: str, path: str) -> ToolResult:
        """Delete file from storage"""
        response = await self.client.delete(f"{self.supabase_url}/storage/v1/object/{bucket}/{path}")
        
        if response.status_code != 200:
            raise Exception(f"Delete failed: {response.status_code} - {response.text}")
        
        return ToolResult(
            success=True,
            data={"deleted": path},
            metadata={"bucket": bucket}
        )
    
    async def close(self):
        """Clean up resources"""
        await self.client.aclose()


class AIAnalysisTool(Tool):
    """AI image analysis tool with fallback to mock for testing"""
    
    def __init__(self, gemini_endpoint: str = None, mock_mode: bool = False):
        super().__init__(
            name="ai_analyze_image",
            description="Analyze images with AI (supports mock mode for testing)",
            func=self._execute
        )
        self.gemini_endpoint = gemini_endpoint
        self.mock_mode = mock_mode
        self.client = httpx.AsyncClient(timeout=120.0) if not mock_mode else None
    
    async def _execute(self, image_url: str, analysis_type: str = "lifestyle") -> ToolResult:
        """Execute image analysis"""
        
        if self.mock_mode:
            return await self._mock_analysis(image_url, analysis_type)
        
        try:
            start_time = time.time()
            
            response = await self.client.post(
                self.gemini_endpoint,
                json={
                    "image_url": image_url,
                    "analysis_type": analysis_type
                }
            )
            
            duration = time.time() - start_time
            
            if response.status_code != 200:
                raise Exception(f"AI analysis failed: {response.status_code} - {response.text}")
            
            analysis_data = response.json()
            
            return ToolResult(
                success=True,
                data=analysis_data,
                metadata={
                    "image_url": image_url,
                    "analysis_type": analysis_type,
                    "duration_seconds": round(duration, 3),
                    "analysis_size_bytes": len(json.dumps(analysis_data))
                }
            )
            
        except Exception as error:
            return ToolResult(
                success=False,
                error=str(error),
                metadata={
                    "image_url": image_url,
                    "analysis_type": analysis_type
                }
            )
    
    async def _mock_analysis(self, image_url: str, analysis_type: str) -> ToolResult:
        """Generate mock analysis for testing"""
        # Simulate processing time
        await asyncio.sleep(0.5)
        
        mock_data = {
            "analysis_type": analysis_type,
            "metadata": {
                "title": f"{analysis_type.title()} Image Analysis",
                "description": f"Mock analysis for {analysis_type} image from {image_url}",
                "tags": ["mock", "test", analysis_type, "ai-generated"],
                "colors": ["#FF5733", "#33FF57", "#3357FF", "#FFD700"],
                "objects": (
                    ["product", "packaging", "label", "brand"] 
                    if analysis_type == "product" 
                    else ["person", "environment", "activity", "lifestyle"]
                ),
                "scene": {
                    "setting": "studio" if analysis_type == "product" else "outdoor",
                    "lighting": "professional",
                    "mood": "positive",
                    "composition": "centered"
                },
                "technical": {
                    "resolution": "1920x1080",
                    "quality": "high",
                    "format": "JPEG"
                }
            },
            "confidence": 0.94,
            "processing_time": "0.5s",
            "model_version": "mock-v1.0",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return ToolResult(
            success=True,
            data=mock_data,
            metadata={
                "image_url": image_url,
                "analysis_type": analysis_type,
                "mock_mode": True,
                "duration_seconds": 0.5
            }
        )
    
    async def close(self):
        """Clean up resources"""
        if self.client:
            await self.client.aclose()


class MetadataEmbedTool(Tool):
    """Metadata embedding tool with fallback to mock for testing"""
    
    def __init__(self, metadata_endpoint: str = None, mock_mode: bool = False):
        super().__init__(
            name="metadata_embed",
            description="Embed metadata into images (supports mock mode for testing)",
            func=self._execute
        )
        self.metadata_endpoint = metadata_endpoint
        self.mock_mode = mock_mode
        self.client = httpx.AsyncClient(timeout=60.0) if not mock_mode else None
    
    async def _execute(self, source_path: str, output_path: str, metadata: Dict,
                      compression_quality: int = 95) -> ToolResult:
        """Execute metadata embedding"""
        
        if self.mock_mode:
            return await self._mock_embed(source_path, output_path, metadata, compression_quality)
        
        try:
            start_time = time.time()
            
            response = await self.client.post(
                self.metadata_endpoint,
                json={
                    "source_path": source_path,
                    "output_path": output_path,
                    "metadata": metadata,
                    "compression_quality": compression_quality
                }
            )
            
            duration = time.time() - start_time
            
            if response.status_code != 200:
                raise Exception(f"Metadata embedding failed: {response.status_code} - {response.text}")
            
            result_data = response.json()
            
            return ToolResult(
                success=True,
                data=result_data,
                metadata={
                    "source_path": source_path,
                    "output_path": output_path,
                    "compression_quality": compression_quality,
                    "duration_seconds": round(duration, 3),
                    "metadata_size_bytes": len(json.dumps(metadata))
                }
            )
            
        except Exception as error:
            return ToolResult(
                success=False,
                error=str(error),
                metadata={
                    "source_path": source_path,
                    "output_path": output_path
                }
            )
    
    async def _mock_embed(self, source_path: str, output_path: str, 
                         metadata: Dict, compression_quality: int) -> ToolResult:
        """Generate mock embedding result for testing"""
        # Simulate processing time
        await asyncio.sleep(0.3)
        
        mock_result = {
            "processed_path": output_path,
            "original_size": 1024000,  # 1MB original
            "processed_size": 1124000,  # Slightly larger with metadata
            "metadata_size": 100000,   # ~100KB metadata
            "compression_quality": compression_quality,
            "format": "JPEG",
            "embedded_fields": list(metadata.keys()) if metadata else [],
            "processing_time": "0.3s",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return ToolResult(
            success=True,
            data=mock_result,
            metadata={
                "source_path": source_path,
                "output_path": output_path,
                "mock_mode": True,
                "duration_seconds": 0.3
            }
        )
    
    async def close(self):
        """Clean up resources"""
        if self.client:
            await self.client.aclose()


class ProgressTrackerTool(Tool):
    """Workflow progress tracking with todo management"""
    
    def __init__(self):
        super().__init__(
            name="progress_tracker",
            description="Track workflow progress with todo items and statistics",
            func=self._execute
        )
        self.todos = []
        self.next_id = 1
        self.workflow_stats = {
            "started_at": None,
            "orders_processed": 0,
            "images_processed": 0,
            "errors": 0
        }
    
    async def _execute(self, action: str, content: str = None, todo_id: int = None,
                      status: str = None, stat_update: Dict = None) -> ToolResult:
        """Execute progress tracking operation"""
        
        try:
            if action == "add_todo":
                return await self._add_todo(content, status or "pending")
            elif action == "update_todo":
                return await self._update_todo(todo_id, status)
            elif action == "list_todos":
                return await self._list_todos()
            elif action == "get_progress":
                return await self._get_progress()
            elif action == "update_stats":
                return await self._update_stats(stat_update or {})
            elif action == "reset":
                return await self._reset()
            else:
                return ToolResult(success=False, error=f"Unknown action: {action}")
                
        except Exception as error:
            return ToolResult(success=False, error=str(error))
    
    async def _add_todo(self, content: str, status: str) -> ToolResult:
        """Add new todo item"""
        todo = {
            "id": self.next_id,
            "content": content,
            "status": status,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        self.todos.append(todo)
        self.next_id += 1
        
        return ToolResult(
            success=True,
            data=todo,
            metadata={"total_todos": len(self.todos)}
        )
    
    async def _update_todo(self, todo_id: int, status: str) -> ToolResult:
        """Update todo status"""
        todo = next((t for t in self.todos if t["id"] == todo_id), None)
        
        if not todo:
            return ToolResult(success=False, error=f"Todo {todo_id} not found")
        
        todo["status"] = status
        todo["updated_at"] = datetime.utcnow().isoformat()
        
        return ToolResult(
            success=True,
            data=todo,
            metadata={"total_todos": len(self.todos)}
        )
    
    async def _list_todos(self) -> ToolResult:
        """List all todos"""
        return ToolResult(
            success=True,
            data=self.todos,
            metadata={
                "total_todos": len(self.todos),
                "by_status": self._get_status_counts()
            }
        )
    
    async def _get_progress(self) -> ToolResult:
        """Get progress statistics"""
        total = len(self.todos)
        status_counts = self._get_status_counts()
        
        progress = {
            "total_todos": total,
            "completed": status_counts.get("completed", 0),
            "in_progress": status_counts.get("in_progress", 0),
            "pending": status_counts.get("pending", 0),
            "percent_complete": round((status_counts.get("completed", 0) / total * 100), 2) if total > 0 else 0,
            "workflow_stats": self.workflow_stats
        }
        
        return ToolResult(success=True, data=progress)
    
    async def _update_stats(self, updates: Dict) -> ToolResult:
        """Update workflow statistics"""
        self.workflow_stats.update(updates)
        
        if "started_at" in updates and not self.workflow_stats["started_at"]:
            self.workflow_stats["started_at"] = datetime.utcnow().isoformat()
        
        return ToolResult(
            success=True,
            data=self.workflow_stats
        )
    
    async def _reset(self) -> ToolResult:
        """Reset all progress tracking"""
        self.todos = []
        self.next_id = 1
        self.workflow_stats = {
            "started_at": None,
            "orders_processed": 0,
            "images_processed": 0,
            "errors": 0
        }
        
        return ToolResult(success=True, data="Reset complete")
    
    def _get_status_counts(self) -> Dict[str, int]:
        """Get count of todos by status"""
        counts = {}
        for todo in self.todos:
            status = todo["status"]
            counts[status] = counts.get(status, 0) + 1
        return counts


class MonitoringTool(Tool):
    """Comprehensive monitoring with logging, metrics, and alerting"""
    
    def __init__(self, log_level: LogLevel = LogLevel.INFO):
        super().__init__(
            name="monitoring",
            description="Monitor workflow execution with logging, metrics, and alerting",
            func=self._execute
        )
        self.log_level = log_level
        self.logs = []
        self.metrics = {}
        self.alerts = []
        self.start_time = datetime.utcnow()
    
    async def _execute(self, action: str, level: str = None, message: str = None,
                      metric_name: str = None, metric_value: float = None,
                      metric_unit: str = None, alert_severity: str = None) -> ToolResult:
        """Execute monitoring operation"""
        
        try:
            if action == "log":
                return await self._log(LogLevel(level), message)
            elif action == "metric":
                return await self._record_metric(metric_name, metric_value, metric_unit)
            elif action == "alert":
                return await self._create_alert(alert_severity, message)
            elif action == "report":
                return await self._generate_report()
            else:
                return ToolResult(success=False, error=f"Unknown action: {action}")
                
        except Exception as error:
            return ToolResult(success=False, error=str(error))
    
    async def _log(self, level: LogLevel, message: str) -> ToolResult:
        """Log message with level"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": level.value,
            "message": message
        }
        
        self.logs.append(log_entry)
        
        # Print to console if level is appropriate
        if self._should_log(level):
            print(f"[{level.value.upper()}] {message}")
        
        return ToolResult(
            success=True,
            data=log_entry,
            metadata={"total_logs": len(self.logs)}
        )
    
    async def _record_metric(self, name: str, value: float, unit: str = None) -> ToolResult:
        """Record metric value"""
        if name not in self.metrics:
            self.metrics[name] = []
        
        metric_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "value": value,
            "unit": unit
        }
        
        self.metrics[name].append(metric_entry)
        
        return ToolResult(
            success=True,
            data={"metric": name, **metric_entry},
            metadata={"metric_count": len(self.metrics[name])}
        )
    
    async def _create_alert(self, severity: str, message: str) -> ToolResult:
        """Create alert"""
        alert = {
            "id": f"alert_{int(time.time() * 1000)}",
            "timestamp": datetime.utcnow().isoformat(),
            "severity": severity,
            "message": message
        }
        
        self.alerts.append(alert)
        
        # Print alert to console
        print(f"[ALERT-{severity.upper()}] {message}")
        
        return ToolResult(
            success=True,
            data=alert,
            metadata={"total_alerts": len(self.alerts)}
        )
    
    async def _generate_report(self) -> ToolResult:
        """Generate comprehensive monitoring report"""
        uptime = datetime.utcnow() - self.start_time
        
        # Calculate metric summaries
        metric_summaries = {}
        for name, values in self.metrics.items():
            if values:
                metric_values = [v["value"] for v in values]
                metric_summaries[name] = {
                    "count": len(metric_values),
                    "min": min(metric_values),
                    "max": max(metric_values),
                    "avg": sum(metric_values) / len(metric_values),
                    "latest": values[-1]
                }
        
        # Calculate log summaries
        log_summary = {}
        for log in self.logs:
            level = log["level"]
            log_summary[level] = log_summary.get(level, 0) + 1
        
        # Calculate alert summaries
        alert_summary = {}
        for alert in self.alerts:
            severity = alert["severity"]
            alert_summary[severity] = alert_summary.get(severity, 0) + 1
        
        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "uptime_seconds": uptime.total_seconds(),
            "logs": {
                "total": len(self.logs),
                "by_level": log_summary,
                "recent": self.logs[-10:] if self.logs else []
            },
            "metrics": {
                "total_metrics": len(self.metrics),
                "summaries": metric_summaries
            },
            "alerts": {
                "total": len(self.alerts),
                "by_severity": alert_summary,
                "recent": self.alerts[-5:] if self.alerts else []
            }
        }
        
        return ToolResult(success=True, data=report)
    
    def _should_log(self, level: LogLevel) -> bool:
        """Check if message should be logged based on current log level"""
        level_hierarchy = {
            LogLevel.DEBUG: 0,
            LogLevel.INFO: 1,
            LogLevel.WARN: 2,
            LogLevel.ERROR: 3
        }
        
        return level_hierarchy[level] >= level_hierarchy[self.log_level]


# Tool factory functions for easy instantiation
def create_database_tool(supabase_url: str, supabase_key: str, max_retries: int = 3) -> DatabaseTool:
    """Create configured database tool"""
    return DatabaseTool(supabase_url, supabase_key, max_retries)


def create_storage_tool(supabase_url: str, supabase_key: str) -> StorageTool:
    """Create configured storage tool"""
    return StorageTool(supabase_url, supabase_key)


def create_ai_analysis_tool(gemini_endpoint: str = None, mock_mode: bool = False) -> AIAnalysisTool:
    """Create configured AI analysis tool"""
    return AIAnalysisTool(gemini_endpoint, mock_mode)


def create_metadata_embed_tool(metadata_endpoint: str = None, mock_mode: bool = False) -> MetadataEmbedTool:
    """Create configured metadata embedding tool"""
    return MetadataEmbedTool(metadata_endpoint, mock_mode)


def create_progress_tracker() -> ProgressTrackerTool:
    """Create progress tracker tool"""
    return ProgressTrackerTool()


def create_monitoring_tool(log_level: LogLevel = LogLevel.INFO) -> MonitoringTool:
    """Create monitoring tool"""
    return MonitoringTool(log_level)


# Cleanup utility for all tools
async def cleanup_tools(*tools):
    """Clean up resources for multiple tools"""
    for tool in tools:
        if hasattr(tool, 'close'):
            try:
                await tool.close()
            except Exception as e:
                print(f"Error closing tool {tool.name}: {e}")