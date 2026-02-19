export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          email: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          created_at: string
          description: string | null
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          brand_logo_url: string | null
          brand_name: string | null
          code_format: string | null
          code_length: number | null
          code_pattern: string | null
          default_language: string | null
          enable_code_search: boolean
          enable_multi_exam: boolean | null
          enable_name_search: boolean
          id: string
          result_exam_score_source: string | null
          result_exam_weight: number | null
          result_fail_on_any_exam: boolean | null
          result_message_fail: string | null
          result_message_hidden: boolean | null
          result_message_pass: string | null
          result_message_text: string | null
          result_overall_pass_threshold: number | null
          result_pass_calc_mode: string | null
          results_show_view_attempt: boolean | null
          thank_you_message: string | null
          thank_you_message_ar: string | null
          thank_you_title: string | null
          thank_you_title_ar: string | null
          updated_at: string | null
          welcome_instructions: string | null
          welcome_instructions_ar: string | null
          whatsapp_default_template: string | null
        }
        Insert: {
          brand_logo_url?: string | null
          brand_name?: string | null
          code_format?: string | null
          code_length?: number | null
          code_pattern?: string | null
          default_language?: string | null
          enable_code_search?: boolean
          enable_multi_exam?: boolean | null
          enable_name_search?: boolean
          id?: string
          result_exam_score_source?: string | null
          result_exam_weight?: number | null
          result_fail_on_any_exam?: boolean | null
          result_message_fail?: string | null
          result_message_hidden?: boolean | null
          result_message_pass?: string | null
          result_message_text?: string | null
          result_overall_pass_threshold?: number | null
          result_pass_calc_mode?: string | null
          results_show_view_attempt?: boolean | null
          thank_you_message?: string | null
          thank_you_message_ar?: string | null
          thank_you_title?: string | null
          thank_you_title_ar?: string | null
          updated_at?: string | null
          welcome_instructions?: string | null
          welcome_instructions_ar?: string | null
          whatsapp_default_template?: string | null
        }
        Update: {
          brand_logo_url?: string | null
          brand_name?: string | null
          code_format?: string | null
          code_length?: number | null
          code_pattern?: string | null
          default_language?: string | null
          enable_code_search?: boolean
          enable_multi_exam?: boolean | null
          enable_name_search?: boolean
          id?: string
          result_exam_score_source?: string | null
          result_exam_weight?: number | null
          result_fail_on_any_exam?: boolean | null
          result_message_fail?: string | null
          result_message_hidden?: boolean | null
          result_message_pass?: string | null
          result_message_text?: string | null
          result_overall_pass_threshold?: number | null
          result_pass_calc_mode?: string | null
          results_show_view_attempt?: boolean | null
          thank_you_message?: string | null
          thank_you_message_ar?: string | null
          thank_you_title?: string | null
          thank_you_title_ar?: string | null
          updated_at?: string | null
          welcome_instructions?: string | null
          welcome_instructions_ar?: string | null
          whatsapp_default_template?: string | null
        }
        Relationships: []
      }
      // Additional tables truncated for brevity - full types generated
    }
    Views: {
      student_exam_summary: {
        Row: {
          address: string | null
          code: string | null
          completed_exams: number | null
          in_progress_exams: number | null
          mobile_number: string | null
          mobile_number2: string | null
          national_id: string | null
          national_id_photo_url: string | null
          photo_url: string | null
          student_created_at: string | null
          student_id: string | null
          student_name: string | null
          student_updated_at: string | null
          total_exams_attempted: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      // Functions truncated for brevity
      [_ in never]: never
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
