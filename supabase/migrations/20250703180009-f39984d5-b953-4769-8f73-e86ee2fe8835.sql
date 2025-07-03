-- Create audit log table for MCP security monitoring
CREATE TABLE public.mcp_audit_log (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.orbit_users(id) ON DELETE CASCADE,
    session_id text NOT NULL,
    tool_name text NOT NULL,
    success boolean NOT NULL DEFAULT true,
    ip_address text,
    risk_score integer DEFAULT 0,
    error_message text,
    request_data jsonb DEFAULT '{}'::jsonb,
    response_data jsonb DEFAULT '{}'::jsonb,
    execution_time_ms integer,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mcp_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own audit logs" ON public.mcp_audit_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create audit logs" ON public.mcp_audit_log
    FOR INSERT WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_mcp_audit_log_user_id ON public.mcp_audit_log(user_id);
CREATE INDEX idx_mcp_audit_log_session_id ON public.mcp_audit_log(session_id);
CREATE INDEX idx_mcp_audit_log_tool_name ON public.mcp_audit_log(tool_name);
CREATE INDEX idx_mcp_audit_log_created_at ON public.mcp_audit_log(created_at);

-- Update existing images table to store analysis type
ALTER TABLE public.images 
ADD COLUMN IF NOT EXISTS analysis_type text DEFAULT 'product',
ADD COLUMN IF NOT EXISTS gemini_analysis_raw text;