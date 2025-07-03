export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      batches: {
        Row: {
          actual_cost: number | null
          completed_at: string | null
          created_at: string | null
          download_urls: Json | null
          error_count: number | null
          estimated_cost: number | null
          id: string
          image_count: number | null
          max_retries: number | null
          metadata: Json | null
          name: string
          order_id: string | null
          processed_count: number | null
          processing_end_time: string | null
          processing_results: Json | null
          processing_start_time: string | null
          quality_level: string | null
          retry_count: number | null
          status: string | null
          tier_pricing_applied: Json | null
          user_id: string | null
        }
        Insert: {
          actual_cost?: number | null
          completed_at?: string | null
          created_at?: string | null
          download_urls?: Json | null
          error_count?: number | null
          estimated_cost?: number | null
          id?: string
          image_count?: number | null
          max_retries?: number | null
          metadata?: Json | null
          name: string
          order_id?: string | null
          processed_count?: number | null
          processing_end_time?: string | null
          processing_results?: Json | null
          processing_start_time?: string | null
          quality_level?: string | null
          retry_count?: number | null
          status?: string | null
          tier_pricing_applied?: Json | null
          user_id?: string | null
        }
        Update: {
          actual_cost?: number | null
          completed_at?: string | null
          created_at?: string | null
          download_urls?: Json | null
          error_count?: number | null
          estimated_cost?: number | null
          id?: string
          image_count?: number | null
          max_retries?: number | null
          metadata?: Json | null
          name?: string
          order_id?: string | null
          processed_count?: number | null
          processing_end_time?: string | null
          processing_results?: Json | null
          processing_start_time?: string | null
          quality_level?: string | null
          retry_count?: number | null
          status?: string | null
          tier_pricing_applied?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orbit_users"
            referencedColumns: ["id"]
          },
        ]
      }
      file_downloads: {
        Row: {
          access_token: string | null
          batch_id: string | null
          created_at: string
          download_count: number | null
          download_url: string | null
          expires_at: string
          file_paths: string[]
          id: string
          is_active: boolean | null
          last_accessed_at: string | null
          max_downloads: number | null
          metadata: Json | null
          order_id: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          batch_id?: string | null
          created_at?: string
          download_count?: number | null
          download_url?: string | null
          expires_at: string
          file_paths: string[]
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          max_downloads?: number | null
          metadata?: Json | null
          order_id?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          batch_id?: string | null
          created_at?: string
          download_count?: number | null
          download_url?: string | null
          expires_at?: string
          file_paths?: string[]
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          max_downloads?: number | null
          metadata?: Json | null
          order_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_downloads_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_processing_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_downloads_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_downloads_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_downloads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orbit_users"
            referencedColumns: ["id"]
          },
        ]
      }
      images: {
        Row: {
          ai_analysis: Json | null
          analysis_type: string | null
          batch_id: string | null
          created_at: string | null
          error_message: string | null
          extracted_metadata: Json | null
          file_hash: string | null
          file_size: number | null
          gemini_analysis_raw: string | null
          id: string
          mime_type: string | null
          order_id: string | null
          original_filename: string
          processed_at: string | null
          processing_cost: number | null
          processing_duration_ms: number | null
          processing_status: string | null
          quality_settings: Json | null
          retry_count: number | null
          storage_path_original: string | null
          storage_path_processed: string | null
          thumbnail_path: string | null
          tier_price_applied: number | null
          user_id: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          analysis_type?: string | null
          batch_id?: string | null
          created_at?: string | null
          error_message?: string | null
          extracted_metadata?: Json | null
          file_hash?: string | null
          file_size?: number | null
          gemini_analysis_raw?: string | null
          id?: string
          mime_type?: string | null
          order_id?: string | null
          original_filename: string
          processed_at?: string | null
          processing_cost?: number | null
          processing_duration_ms?: number | null
          processing_status?: string | null
          quality_settings?: Json | null
          retry_count?: number | null
          storage_path_original?: string | null
          storage_path_processed?: string | null
          thumbnail_path?: string | null
          tier_price_applied?: number | null
          user_id?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          analysis_type?: string | null
          batch_id?: string | null
          created_at?: string | null
          error_message?: string | null
          extracted_metadata?: Json | null
          file_hash?: string | null
          file_size?: number | null
          gemini_analysis_raw?: string | null
          id?: string
          mime_type?: string | null
          order_id?: string | null
          original_filename?: string
          processed_at?: string | null
          processing_cost?: number | null
          processing_duration_ms?: number | null
          processing_status?: string | null
          quality_settings?: Json | null
          retry_count?: number | null
          storage_path_original?: string | null
          storage_path_processed?: string | null
          thumbnail_path?: string | null
          tier_price_applied?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "images_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_processing_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "images_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "images_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "images_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orbit_users"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_audit_log: {
        Row: {
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          id: string
          ip_address: string | null
          request_data: Json | null
          response_data: Json | null
          risk_score: number | null
          session_id: string
          success: boolean
          tool_name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          ip_address?: string | null
          request_data?: Json | null
          response_data?: Json | null
          risk_score?: number | null
          session_id: string
          success?: boolean
          tool_name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          ip_address?: string | null
          request_data?: Json | null
          response_data?: Json | null
          risk_score?: number | null
          session_id?: string
          success?: boolean
          tool_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orbit_users"
            referencedColumns: ["id"]
          },
        ]
      }
      orbit_users: {
        Row: {
          batch_size_limit: number | null
          billing_period_end: string | null
          billing_period_start: string | null
          created_at: string | null
          email: string
          id: string
          images_processed_this_month: number | null
          monthly_image_limit: number | null
          monthly_spend_current: number | null
          preferred_payment_method_id: string | null
          stripe_customer_id: string | null
          subscription_plan: string | null
          subscription_status: string | null
          tier_discount_eligible: boolean | null
          total_lifetime_spend: number | null
          updated_at: string | null
        }
        Insert: {
          batch_size_limit?: number | null
          billing_period_end?: string | null
          billing_period_start?: string | null
          created_at?: string | null
          email: string
          id: string
          images_processed_this_month?: number | null
          monthly_image_limit?: number | null
          monthly_spend_current?: number | null
          preferred_payment_method_id?: string | null
          stripe_customer_id?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          tier_discount_eligible?: boolean | null
          total_lifetime_spend?: number | null
          updated_at?: string | null
        }
        Update: {
          batch_size_limit?: number | null
          billing_period_end?: string | null
          billing_period_start?: string | null
          created_at?: string | null
          email?: string
          id?: string
          images_processed_this_month?: number | null
          monthly_image_limit?: number | null
          monthly_spend_current?: number | null
          preferred_payment_method_id?: string | null
          stripe_customer_id?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          tier_discount_eligible?: boolean | null
          total_lifetime_spend?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          base_cost: number
          batch_id: string | null
          completed_at: string | null
          cost_breakdown: Json | null
          created_at: string
          estimated_completion_time: string | null
          id: string
          image_count: number
          metadata: Json | null
          order_number: string
          order_status: string | null
          payment_status: string | null
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          tier_discount: number | null
          total_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          base_cost?: number
          batch_id?: string | null
          completed_at?: string | null
          cost_breakdown?: Json | null
          created_at?: string
          estimated_completion_time?: string | null
          id?: string
          image_count?: number
          metadata?: Json | null
          order_number: string
          order_status?: string | null
          payment_status?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          tier_discount?: number | null
          total_cost?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          base_cost?: number
          batch_id?: string | null
          completed_at?: string | null
          cost_breakdown?: Json | null
          created_at?: string
          estimated_completion_time?: string | null
          id?: string
          image_count?: number
          metadata?: Json | null
          order_number?: string
          order_status?: string | null
          payment_status?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          tier_discount?: number | null
          total_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_processing_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orbit_users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string | null
          failure_reason: string | null
          id: string
          metadata: Json | null
          order_id: string
          payment_method: string | null
          payment_status: string | null
          processed_at: string | null
          refund_amount: number | null
          stripe_charge_id: string | null
          stripe_payment_intent_id: string
          stripe_webhook_events: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          order_id: string
          payment_method?: string | null
          payment_status?: string | null
          processed_at?: string | null
          refund_amount?: number | null
          stripe_charge_id?: string | null
          stripe_payment_intent_id: string
          stripe_webhook_events?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string
          payment_method?: string | null
          payment_status?: string | null
          processed_at?: string | null
          refund_amount?: number | null
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string
          stripe_webhook_events?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orbit_users"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_steps: {
        Row: {
          batch_id: string | null
          end_time: string | null
          error_message: string | null
          id: string
          progress: number | null
          start_time: string | null
          status: string | null
          step_data: Json | null
          step_type: string
        }
        Insert: {
          batch_id?: string | null
          end_time?: string | null
          error_message?: string | null
          id?: string
          progress?: number | null
          start_time?: string | null
          status?: string | null
          step_data?: Json | null
          step_type: string
        }
        Update: {
          batch_id?: string | null
          end_time?: string | null
          error_message?: string | null
          id?: string
          progress?: number | null
          start_time?: string | null
          status?: string | null
          step_data?: Json | null
          step_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_steps_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_processing_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_steps_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      service_logs: {
        Row: {
          action: string
          batch_id: string | null
          created_at: string | null
          error_message: string | null
          execution_time_ms: number | null
          id: string
          request_payload: Json | null
          response_payload: Json | null
          service_name: string
          success: boolean
          user_id: string | null
        }
        Insert: {
          action: string
          batch_id?: string | null
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          service_name: string
          success: boolean
          user_id?: string | null
        }
        Update: {
          action?: string
          batch_id?: string | null
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          service_name?: string
          success?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_processing_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orbit_users"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_buckets: {
        Row: {
          bucket_name: string
          bucket_type: string
          cleanup_enabled: boolean | null
          created_at: string
          file_count: number | null
          id: string
          last_cleanup_at: string | null
          metadata: Json | null
          retention_days: number | null
          storage_size_bytes: number | null
          user_id: string
        }
        Insert: {
          bucket_name: string
          bucket_type: string
          cleanup_enabled?: boolean | null
          created_at?: string
          file_count?: number | null
          id?: string
          last_cleanup_at?: string | null
          metadata?: Json | null
          retention_days?: number | null
          storage_size_bytes?: number | null
          user_id: string
        }
        Update: {
          bucket_name?: string
          bucket_type?: string
          cleanup_enabled?: boolean | null
          created_at?: string
          file_count?: number | null
          id?: string
          last_cleanup_at?: string | null
          metadata?: Json | null
          retention_days?: number | null
          storage_size_bytes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storage_buckets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orbit_users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          status: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orbit_users"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_events: {
        Row: {
          batch_id: string | null
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          step_type: string | null
          user_id: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          step_type?: string | null
          user_id?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          step_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_processing_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orbit_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      batch_processing_summary: {
        Row: {
          completed_at: string | null
          completed_steps: number | null
          created_at: string | null
          error_count: number | null
          id: string | null
          image_count: number | null
          name: string | null
          processed_count: number | null
          status: string | null
          success_rate_percent: number | null
          total_steps: number | null
          total_time_ms: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orbit_users"
            referencedColumns: ["id"]
          },
        ]
      }
      service_health_summary: {
        Row: {
          avg_execution_time_ms: number | null
          failed_calls: number | null
          hour: string | null
          max_execution_time_ms: number | null
          service_name: string | null
          successful_calls: number | null
          total_calls: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_tier_pricing: {
        Args: {
          user_id_param: string
          image_count_param: number
          billing_period_start_param?: string
        }
        Returns: Json
      }
      emit_workflow_event: {
        Args: {
          p_event_type: string
          p_batch_id: string
          p_user_id?: string
          p_step_type?: string
          p_event_data?: Json
        }
        Returns: string
      }
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_processing_stats: {
        Args: { p_user_id: string }
        Returns: {
          total_batches: number
          total_images: number
          images_this_month: number
          successful_images: number
          failed_images: number
          avg_processing_time_ms: number
        }[]
      }
      increment_user_stats: {
        Args: { user_id: string; images_count: number; amount: number }
        Returns: undefined
      }
      log_service_call: {
        Args: {
          p_service_name: string
          p_action: string
          p_user_id?: string
          p_batch_id?: string
          p_request_payload?: Json
          p_response_payload?: Json
          p_success?: boolean
          p_error_message?: string
          p_execution_time_ms?: number
        }
        Returns: string
      }
      setup_user_buckets: {
        Args: { user_id: string }
        Returns: undefined
      }
      setup_user_storage_buckets: {
        Args: { user_id_param: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
