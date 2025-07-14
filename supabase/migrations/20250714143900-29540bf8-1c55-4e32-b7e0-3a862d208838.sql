-- Remove unused tables from Orbit v2 database
-- These tables are not used by the current orbit-image-forge application

-- Drop unused tables in order (views/summaries first, then main tables)
DROP TABLE IF EXISTS public.batch_processing_summary CASCADE;
DROP TABLE IF EXISTS public.service_health_summary CASCADE;

-- Drop MCP-related tables (not implemented in current app)
DROP TABLE IF EXISTS public.mcp_rate_limits CASCADE;
DROP TABLE IF EXISTS public.mcp_requests CASCADE;

-- Drop unused workflow and processing tables
DROP TABLE IF EXISTS public.workflow_events CASCADE;
DROP TABLE IF EXISTS public.processing_steps CASCADE;
DROP TABLE IF EXISTS public.service_logs CASCADE;

-- Drop unused feature tables
DROP TABLE IF EXISTS public.image_analysis_results CASCADE;
DROP TABLE IF EXISTS public.storage_buckets CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;

-- Clean up any remaining functions related to removed tables
DROP FUNCTION IF EXISTS public.cleanup_old_rate_limits() CASCADE;
DROP FUNCTION IF EXISTS public.get_mcp_statistics(interval) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_processing_stats(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.log_service_call(text, text, uuid, uuid, jsonb, jsonb, boolean, text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.emit_workflow_event(text, uuid, uuid, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.update_batch_statistics() CASCADE;
DROP FUNCTION IF EXISTS public.update_batch_status() CASCADE;