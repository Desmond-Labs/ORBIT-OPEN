"""
ORBIT Prompt Templates - Structured prompts for Google ADK agent
Handles system instructions, workflow phases, and dynamic prompt generation
"""

from typing import Dict, List, Optional, Any
from datetime import datetime
from dataclasses import dataclass


@dataclass
class WorkflowContext:
    """Context data for workflow execution"""
    pending_orders_count: int = 0
    storage_accessible: bool = False
    timestamp: str = ""
    error_message: Optional[str] = None
    order_id: Optional[str] = None
    user_id: Optional[str] = None
    batch_id: Optional[str] = None
    current_phase: str = "initialization"
    completed_phases: List[str] = None
    
    def __post_init__(self):
        if self.completed_phases is None:
            self.completed_phases = []
        if not self.timestamp:
            self.timestamp = datetime.utcnow().isoformat()


class ORBITPromptBuilder:
    """Dynamic prompt builder for ORBIT workflows"""
    
    # System prompt template
    SYSTEM_PROMPT = """You are an ORBIT image processing specialist with direct access to a comprehensive suite of tools for executing complete image processing workflows.

## Core Capabilities:
- Database operations with transaction support and retry logic
- Storage management with file operations and signed URLs
- AI-powered image analysis with Gemini integration
- Metadata embedding and processing
- Workflow progress tracking and monitoring
- Error handling and recovery

## Operational Principles:
1. **Systematic Execution**: Process workflows step-by-step, verifying each operation
2. **Atomic Operations**: Complete each image fully before starting the next
3. **Error Recovery**: Retry failed operations and handle errors gracefully
4. **Progress Tracking**: Maintain detailed progress logs and todo lists
5. **Data Integrity**: Store complete analysis results, never truncate data
6. **Verification**: Always verify file existence and processing completion

## Available Tools:
- **database_query**: SQL operations with transaction support
- **storage_operations**: File management, uploads, downloads, signed URLs
- **ai_analyze_image**: Gemini-powered image analysis
- **metadata_embed**: Embed analysis metadata into processed images
- **progress_tracker**: Track workflow progress with todo management
- **monitoring**: Logging, metrics, and alerting

## Response Format:
- Be thorough and explain your reasoning
- Use tools systematically and verify results
- Update progress tracking after each major step
- Handle errors gracefully and continue processing
- Provide detailed status updates and next steps"""

    # Workflow phase definitions
    WORKFLOW_PHASES = {
        "initialization": {
            "title": "Phase 0: Pre-flight Validation",
            "description": "Initialize systems and validate connectivity",
            "steps": [
                "Initialize progress tracking with workflow todos",
                "Test database connectivity with simple query",
                "Verify storage bucket access",
                "Validate AI analysis service availability",
                "Set up monitoring and logging"
            ],
            "success_criteria": "All systems accessible and responsive",
            "next_phase": "order_discovery"
        },
        "order_discovery": {
            "title": "Phase 1: Order Discovery & Preparation",
            "description": "Find and prepare pending orders for processing",
            "steps": [
                "Query for pending orders with 'completed' payment status",
                "Select oldest order for processing priority",
                "Mark selected order as 'processing' in database",
                "Update corresponding batch status to 'processing'",
                "Discover all images associated with the order",
                "Verify original images exist in storage"
            ],
            "success_criteria": "Order locked and images discovered",
            "next_phase": "image_processing"
        },
        "image_processing": {
            "title": "Phase 2: Image Processing Pipeline",
            "description": "Process each image with AI analysis and metadata embedding",
            "steps": [
                "FOR EACH IMAGE in the order:",
                "  - Create signed URL for secure image access",
                "  - Analyze image with AI (lifestyle or product)",
                "  - Store complete analysis results in database",
                "  - Embed metadata into processed image copy",
                "  - Update database with processed file paths",
                "  - Verify processed image exists in storage",
                "  - Mark image as 'completed' in database"
            ],
            "success_criteria": "All images processed and verified",
            "next_phase": "finalization"
        },
        "finalization": {
            "title": "Phase 3: Order Finalization & Notification",
            "description": "Complete order processing and send notifications",
            "steps": [
                "Verify all images in order are 'completed'",
                "Update order status to 'completed'",
                "Update batch status to 'completed'",
                "Trigger email notification to customer",
                "Record completion metrics and timing",
                "Perform final consistency check"
            ],
            "success_criteria": "Order completed and customer notified",
            "next_phase": "continuation"
        },
        "continuation": {
            "title": "Phase 4: Workflow Continuation",
            "description": "Continue processing remaining orders",
            "steps": [
                "Check for additional pending orders",
                "If pending orders exist, return to Phase 1",
                "If no pending orders, generate final report",
                "Clean up resources and temporary data",
                "Update workflow statistics"
            ],
            "success_criteria": "All pending orders processed or workflow complete",
            "next_phase": None
        }
    }
    
    # Error recovery prompts
    ERROR_RECOVERY_PROMPTS = {
        "database_error": """
Database operation failed. Recovery steps:
1. Check if error is transient (connection timeout, lock conflict)
2. If transient, retry operation up to 3 times with exponential backoff
3. If persistent, log error and continue with next operation if possible
4. For transaction failures, ensure proper rollback
5. Update progress tracker with error details
""",
        "storage_error": """
Storage operation failed. Recovery steps:
1. Verify storage bucket exists and is accessible
2. Check file paths for correctness
3. For upload failures, verify file size and format
4. For download failures, check file existence first
5. Retry operation once after brief delay
6. If persistent, mark item as failed and continue
""",
        "ai_analysis_error": """
AI analysis failed. Recovery steps:
1. Check if image URL is accessible
2. Verify image format and size are supported
3. Retry analysis once with different parameters if possible
4. If service is down, wait 30 seconds and retry
5. As last resort, use fallback mock analysis
6. Log the failure for manual review
""",
        "metadata_embed_error": """
Metadata embedding failed. Recovery steps:
1. Verify source image exists and is accessible
2. Check output path permissions and space
3. Validate metadata format and size
4. Retry with lower compression quality if needed
5. If persistent failure, store metadata separately
6. Continue processing other images
"""
    }
    
    @classmethod
    def build_workflow_prompt(cls, context: WorkflowContext, 
                             specific_phase: str = None,
                             include_recovery: bool = True) -> str:
        """Build complete workflow prompt with context"""
        
        # Start with system instructions
        prompt_parts = [cls.SYSTEM_PROMPT]
        
        # Add context information
        context_section = cls._build_context_section(context)
        prompt_parts.append(context_section)
        
        # Add workflow phases
        if specific_phase:
            phase_section = cls._build_specific_phase(specific_phase)
        else:
            phase_section = cls._build_all_phases(context.current_phase)
        prompt_parts.append(phase_section)
        
        # Add error recovery if requested
        if include_recovery:
            recovery_section = cls._build_recovery_section()
            prompt_parts.append(recovery_section)
        
        # Add execution instructions
        execution_section = cls._build_execution_section(context)
        prompt_parts.append(execution_section)
        
        return "\n\n".join(prompt_parts)
    
    @classmethod
    def _build_context_section(cls, context: WorkflowContext) -> str:
        """Build context information section"""
        
        status_indicator = "✅ Accessible" if context.storage_accessible else "❌ Error"
        
        context_info = f"""## Current Workflow Context:
- **Timestamp**: {context.timestamp}
- **Pending Orders**: {context.pending_orders_count}
- **Storage Status**: {status_indicator}
- **Current Phase**: {context.current_phase.replace('_', ' ').title()}
- **Completed Phases**: {', '.join(context.completed_phases) if context.completed_phases else 'None'}"""
        
        if context.order_id:
            context_info += f"""
- **Processing Order**: {context.order_id}
- **User ID**: {context.user_id}
- **Batch ID**: {context.batch_id}"""
        
        if context.error_message:
            context_info += f"""
- **Previous Error**: {context.error_message}"""
        
        return context_info
    
    @classmethod
    def _build_specific_phase(cls, phase_name: str) -> str:
        """Build prompt for specific workflow phase"""
        
        if phase_name not in cls.WORKFLOW_PHASES:
            return f"## Error: Unknown phase '{phase_name}'"
        
        phase = cls.WORKFLOW_PHASES[phase_name]
        
        phase_prompt = f"""## {phase['title']}

**Objective**: {phase['description']}

**Required Steps**:"""
        
        for i, step in enumerate(phase['steps'], 1):
            phase_prompt += f"\n{i}. {step}"
        
        phase_prompt += f"""

**Success Criteria**: {phase['success_criteria']}
**Next Phase**: {phase['next_phase'] or 'Workflow Complete'}"""
        
        return phase_prompt
    
    @classmethod
    def _build_all_phases(cls, current_phase: str) -> str:
        """Build overview of all workflow phases"""
        
        phases_prompt = "## Complete ORBIT Workflow Overview:\n"
        
        for phase_name, phase_info in cls.WORKFLOW_PHASES.items():
            status = "🔄 CURRENT" if phase_name == current_phase else "⏳ PENDING"
            phases_prompt += f"\n### {status} {phase_info['title']}\n"
            phases_prompt += f"**Goal**: {phase_info['description']}\n"
            phases_prompt += f"**Steps**: {len(phase_info['steps'])} operations\n"
        
        return phases_prompt
    
    @classmethod
    def _build_recovery_section(cls) -> str:
        """Build error recovery section"""
        
        recovery_prompt = """## Error Recovery Procedures:

When operations fail, follow these recovery procedures based on error type:

"""
        
        for error_type, recovery_steps in cls.ERROR_RECOVERY_PROMPTS.items():
            recovery_prompt += f"### {error_type.replace('_', ' ').title()}\n"
            recovery_prompt += recovery_steps.strip() + "\n\n"
        
        recovery_prompt += """### General Recovery Principles:
1. **Log all errors** with full context for debugging
2. **Update progress tracker** with failure details
3. **Continue processing** other items when possible
4. **Escalate persistent failures** for manual intervention
5. **Maintain data integrity** throughout recovery attempts"""
        
        return recovery_prompt
    
    @classmethod
    def _build_execution_section(cls, context: WorkflowContext) -> str:
        """Build execution instructions section"""
        
        if context.pending_orders_count == 0:
            return """## Execution Instructions:

No pending orders found. Please:
1. Verify database connectivity
2. Check order status criteria (processing_stage = 'pending', payment_status = 'completed')
3. Generate summary report of current system state
4. Update monitoring with 'no work' status"""
        
        return f"""## Execution Instructions:

**Primary Objective**: Process all {context.pending_orders_count} pending orders through the complete ORBIT workflow.

**Execution Mode**: Start with {context.current_phase} and proceed systematically through each phase.

**Critical Requirements**:
- Use progress_tracker to maintain detailed todo list
- Log all operations with monitoring tool
- Verify each step before proceeding to next
- Store COMPLETE analysis data (never truncate JSON)
- Process images atomically (complete one fully before starting next)
- Handle errors gracefully using recovery procedures

**Success Metrics**:
- All orders moved from 'pending' to 'completed' status
- All images successfully analyzed and processed
- Customer notifications sent for completed orders
- Zero data corruption or incomplete operations
- Complete audit trail of all operations

**Begin Execution**: Start immediately with the current phase and work systematically toward completion."""

    @classmethod
    def build_health_check_prompt(cls) -> str:
        """Build health check prompt"""
        return """Perform a comprehensive health check of the ORBIT system:

1. **Database Health**: Test connection and basic query execution
2. **Storage Health**: Verify bucket access and file operations
3. **AI Service Health**: Test image analysis service connectivity
4. **Metadata Service Health**: Verify metadata embedding service
5. **System Resources**: Check memory and processing capacity

Provide detailed status for each component and overall system health assessment."""

    @classmethod
    def build_recovery_prompt(cls, failed_operation: str, error_details: str, 
                            context: WorkflowContext) -> str:
        """Build recovery prompt for specific failure"""
        
        base_recovery = cls.ERROR_RECOVERY_PROMPTS.get(failed_operation, 
                                                     cls.ERROR_RECOVERY_PROMPTS.get("database_error", ""))
        
        return f"""## Recovery Required for Failed Operation

**Failed Operation**: {failed_operation}
**Error Details**: {error_details}
**Current Context**: {context.current_phase} - Order {context.order_id or 'N/A'}

{base_recovery}

**Recovery Actions**:
1. Analyze the specific error and determine root cause
2. Apply appropriate recovery procedure from above
3. Update progress tracker with recovery attempt
4. Log recovery actions for audit trail
5. Continue workflow if recovery successful
6. Escalate if recovery fails after maximum retries

**Critical**: Maintain data integrity throughout recovery process."""

    @classmethod
    def build_completion_prompt(cls, stats: Dict[str, Any]) -> str:
        """Build workflow completion summary prompt"""
        
        return f"""## Workflow Completion Summary

**Execution Statistics**:
- **Orders Processed**: {stats.get('orders_processed', 0)}
- **Images Processed**: {stats.get('images_processed', 0)}
- **Processing Time**: {stats.get('duration_minutes', 0)} minutes
- **Errors Encountered**: {stats.get('errors', 0)}
- **Success Rate**: {stats.get('success_rate', 0)}%

**Final Tasks**:
1. Generate comprehensive execution report
2. Update all monitoring metrics
3. Clean up temporary resources
4. Archive processing logs
5. Verify all data integrity constraints
6. Prepare system for next execution cycle

**Report Requirements**:
- Detailed breakdown of processing statistics
- Error summary and resolution status
- Performance metrics and recommendations
- System health assessment
- Recommendations for optimization"""


# Convenience functions for common prompt scenarios
def get_initialization_prompt(context: WorkflowContext) -> str:
    """Get initialization phase prompt"""
    return ORBITPromptBuilder.build_workflow_prompt(context, "initialization")


def get_processing_prompt(context: WorkflowContext, order_id: str) -> str:
    """Get image processing prompt for specific order"""
    context.order_id = order_id
    context.current_phase = "image_processing"
    return ORBITPromptBuilder.build_workflow_prompt(context, "image_processing")


def get_error_recovery_prompt(operation: str, error: str, context: WorkflowContext) -> str:
    """Get error recovery prompt"""
    return ORBITPromptBuilder.build_recovery_prompt(operation, error, context)


def get_health_check_prompt() -> str:
    """Get system health check prompt"""
    return ORBITPromptBuilder.build_health_check_prompt()


def get_completion_prompt(execution_stats: Dict[str, Any]) -> str:
    """Get workflow completion prompt"""
    return ORBITPromptBuilder.build_completion_prompt(execution_stats)


# Example usage and testing
if __name__ == "__main__":
    # Test prompt generation
    context = WorkflowContext(
        pending_orders_count=5,
        storage_accessible=True,
        current_phase="initialization"
    )
    
    print("=== ORBIT Workflow Prompt Example ===")
    prompt = ORBITPromptBuilder.build_workflow_prompt(context)
    print(prompt[:500] + "..." if len(prompt) > 500 else prompt)
    
    print("\n=== Health Check Prompt Example ===")
    health_prompt = get_health_check_prompt()
    print(health_prompt[:300] + "..." if len(health_prompt) > 300 else health_prompt)