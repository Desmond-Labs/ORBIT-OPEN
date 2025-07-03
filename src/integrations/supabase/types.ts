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
          completed_at: string | null
          created_at: string | null
          download_urls: Json | null
          error_count: number | null
          id: string
          image_count: number | null
          metadata: Json | null
          name: string
          processed_count: number | null
          processing_end_time: string | null
          processing_results: Json | null
          processing_start_time: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          download_urls?: Json | null
          error_count?: number | null
          id?: string
          image_count?: number | null
          metadata?: Json | null
          name: string
          processed_count?: number | null
          processing_end_time?: string | null
          processing_results?: Json | null
          processing_start_time?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          download_urls?: Json | null
          error_count?: number | null
          id?: string
          image_count?: number | null
          metadata?: Json | null
          name?: string
          processed_count?: number | null
          processing_end_time?: string | null
          processing_results?: Json | null
          processing_start_time?: string | null
          status?: string | null
          user_id?: string | null
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
      images: {
        Row: {
          ai_analysis: Json | null
          batch_id: string | null
          created_at: string | null
          error_message: string | null
          extracted_metadata: Json | null
          file_size: number | null
          id: string
          mime_type: string | null
          original_filename: string
          processed_at: string | null
          processing_status: string | null
          storage_path_original: string | null
          storage_path_processed: string | null
          user_id: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          batch_id?: string | null
          created_at?: string | null
          error_message?: string | null
          extracted_metadata?: Json | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          original_filename: string
          processed_at?: string | null
          processing_status?: string | null
          storage_path_original?: string | null
          storage_path_processed?: string | null
          user_id?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          batch_id?: string | null
          created_at?: string | null
          error_message?: string | null
          extracted_metadata?: Json | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string
          processed_at?: string | null
          processing_status?: string | null
          storage_path_original?: string | null
          storage_path_processed?: string | null
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
            foreignKeyName: "images_user_id_fkey"
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
          created_at: string | null
          email: string
          id: string
          images_processed_this_month: number | null
          monthly_image_limit: number | null
          stripe_customer_id: string | null
          subscription_plan: string | null
          subscription_status: string | null
          updated_at: string | null
        }
        Insert: {
          batch_size_limit?: number | null
          created_at?: string | null
          email: string
          id: string
          images_processed_this_month?: number | null
          monthly_image_limit?: number | null
          stripe_customer_id?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Update: {
          batch_size_limit?: number | null
          created_at?: string | null
          email?: string
          id?: string
          images_processed_this_month?: number | null
          monthly_image_limit?: number | null
          stripe_customer_id?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
