export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
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
          processing_completion_percentage: number | null
          processing_end_time: string | null
          processing_results: Json | null
          processing_stage: string | null
          processing_start_time: string | null
          quality_level: string | null
          retry_count: number | null
          status: string | null
          tier_pricing_applied: Json | null
          user_id: string | null
          webhook_triggered: boolean | null
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
          processing_completion_percentage?: number | null
          processing_end_time?: string | null
          processing_results?: Json | null
          processing_stage?: string | null
          processing_start_time?: string | null
          quality_level?: string | null
          retry_count?: number | null
          status?: string | null
          tier_pricing_applied?: Json | null
          user_id?: string | null
          webhook_triggered?: boolean | null
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
          processing_completion_percentage?: number | null
          processing_end_time?: string | null
          processing_results?: Json | null
          processing_stage?: string | null
          processing_start_time?: string | null
          quality_level?: string | null
          retry_count?: number | null
          status?: string | null
          tier_pricing_applied?: Json | null
          user_id?: string | null
          webhook_triggered?: boolean | null
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
      feedback_submissions: {
        Row: {
          created_at: string
          email: string | null
          feedback: string
          id: string
          metadata: Json
          page_path: string
          page_url: string | null
          resolved: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          feedback: string
          id?: string
          metadata?: Json
          page_path: string
          page_url?: string | null
          resolved?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          feedback?: string
          id?: string
          metadata?: Json
          page_path?: string
          page_url?: string | null
          resolved?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
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
          updated_at: string | null
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
          updated_at?: string | null
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
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
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
      order_access_tokens: {
        Row: {
          created_at: string | null
          current_uses: number | null
          expires_at: string
          id: string
          is_active: boolean | null
          max_uses: number | null
          metadata: Json | null
          order_id: string
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_uses?: number | null
          expires_at: string
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          metadata?: Json | null
          order_id: string
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_uses?: number | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          metadata?: Json | null
          order_id?: string
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_access_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          access_token: string | null
          base_cost: number
          batch_id: string
          completed_at: string | null
          cost_breakdown: Json | null
          created_at: string
          estimated_completion_time: string | null
          id: string
          image_count: number
          last_webhook_at: string | null
          metadata: Json | null
          order_number: string
          order_status: string | null
          payment_status: string | null
          processing_completion_percentage: number | null
          processing_stage: string | null
          processing_started_at: string | null
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          stripe_payment_intent_id_actual: string | null
          tier_discount: number | null
          token_expires_at: string | null
          token_max_uses: number | null
          token_used_count: number | null
          total_cost: number
          updated_at: string
          user_id: string
          webhook_event_ids: Json | null
          webhook_events: Json | null
        }
        Insert: {
          access_token?: string | null
          base_cost?: number
          batch_id: string
          completed_at?: string | null
          cost_breakdown?: Json | null
          created_at?: string
          estimated_completion_time?: string | null
          id?: string
          image_count?: number
          last_webhook_at?: string | null
          metadata?: Json | null
          order_number: string
          order_status?: string | null
          payment_status?: string | null
          processing_completion_percentage?: number | null
          processing_stage?: string | null
          processing_started_at?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_intent_id_actual?: string | null
          tier_discount?: number | null
          token_expires_at?: string | null
          token_max_uses?: number | null
          token_used_count?: number | null
          total_cost?: number
          updated_at?: string
          user_id: string
          webhook_event_ids?: Json | null
          webhook_events?: Json | null
        }
        Update: {
          access_token?: string | null
          base_cost?: number
          batch_id?: string
          completed_at?: string | null
          cost_breakdown?: Json | null
          created_at?: string
          estimated_completion_time?: string | null
          id?: string
          image_count?: number
          last_webhook_at?: string | null
          metadata?: Json | null
          order_number?: string
          order_status?: string | null
          payment_status?: string | null
          processing_completion_percentage?: number | null
          processing_stage?: string | null
          processing_started_at?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_intent_id_actual?: string | null
          tier_discount?: number | null
          token_expires_at?: string | null
          token_max_uses?: number | null
          token_used_count?: number | null
          total_cost?: number
          updated_at?: string
          user_id?: string
          webhook_event_ids?: Json | null
          webhook_events?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_orders_batch_id"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
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
          last_webhook_at: string | null
          metadata: Json | null
          order_id: string
          payment_method: string | null
          payment_status: string | null
          processed_at: string | null
          refund_amount: number | null
          stripe_charge_id: string | null
          stripe_payment_intent_id: string
          stripe_payment_intent_id_actual: string | null
          stripe_webhook_events: Json | null
          updated_at: string
          user_id: string
          webhook_event_ids: Json | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string | null
          failure_reason?: string | null
          id?: string
          last_webhook_at?: string | null
          metadata?: Json | null
          order_id: string
          payment_method?: string | null
          payment_status?: string | null
          processed_at?: string | null
          refund_amount?: number | null
          stripe_charge_id?: string | null
          stripe_payment_intent_id: string
          stripe_payment_intent_id_actual?: string | null
          stripe_webhook_events?: Json | null
          updated_at?: string
          user_id: string
          webhook_event_ids?: Json | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string | null
          failure_reason?: string | null
          id?: string
          last_webhook_at?: string | null
          metadata?: Json | null
          order_id?: string
          payment_method?: string | null
          payment_status?: string | null
          processed_at?: string | null
          refund_amount?: number | null
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string
          stripe_payment_intent_id_actual?: string | null
          stripe_webhook_events?: Json | null
          updated_at?: string
          user_id?: string
          webhook_event_ids?: Json | null
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
      token_usage_audit: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown | null
          metadata: Json | null
          token_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          token_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          token_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "token_usage_audit_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "order_access_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
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
      cleanup_expired_tokens: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      deactivate_token: {
        Args: { token_param: string; reason?: string }
        Returns: boolean
      }
      generate_order_access_token: {
        Args: { order_id_param: string; expires_in_hours?: number }
        Returns: {
          token: string
          expires_at: string
          max_uses: number
        }[]
      }
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      increment_token_usage: {
        Args: { token_param: string }
        Returns: boolean
      }
      increment_user_stats: {
        Args: { user_id: string; images_count: number; amount: number }
        Returns: undefined
      }
      log_token_usage: {
        Args: {
          token_param: string
          action_param: string
          metadata_param?: Json
        }
        Returns: boolean
      }
      set_config: {
        Args: {
          setting_name: string
          setting_value: string
          is_local?: boolean
        }
        Returns: string
      }
      setup_user_buckets: {
        Args: { user_id: string }
        Returns: undefined
      }
      submit_feedback: {
        Args: {
          page_path: string
          feedback_text: string
          email?: string
          page_url?: string
          user_agent?: string
        }
        Returns: string
      }
      validate_order_token: {
        Args: { token_param: string; order_id_param: string }
        Returns: {
          valid: boolean
          order_id: string
          user_id: string
          expires_at: string
          uses_remaining: number
        }[]
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
