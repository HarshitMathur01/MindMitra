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
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          memory_processed_at: string | null
          processed_into_memory: boolean | null
          role: string | null
          sender: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          memory_processed_at?: string | null
          processed_into_memory?: boolean | null
          role?: string | null
          sender: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          memory_processed_at?: string | null
          processed_into_memory?: boolean | null
          role?: string | null
          sender?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      memories: {
        Row: {
          created_at: string | null
          data_type: string
          episodic_memories: Json | null
          id: string
          memory_summary: Json | null
          metadata: Json | null
          procedural_memories: Json | null
          processed_at: string | null
          semantic_memories: Json | null
          session_id: string
          source_message_ids: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data_type: string
          episodic_memories?: Json | null
          id?: string
          memory_summary?: Json | null
          metadata?: Json | null
          procedural_memories?: Json | null
          processed_at?: string | null
          semantic_memories?: Json | null
          session_id: string
          source_message_ids?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data_type?: string
          episodic_memories?: Json | null
          id?: string
          memory_summary?: Json | null
          metadata?: Json | null
          procedural_memories?: Json | null
          processed_at?: string | null
          semantic_memories?: Json | null
          session_id?: string
          source_message_ids?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_activities: {
        Row: {
          accuracy_percentage: number | null
          activity_data: Json | null
          activity_metadata: Json | null
          activity_type: string
          completed_at: string | null
          difficulty_level: string | null
          evaluation_data: Json | null
          game_duration: number | null
          id: string
          insights_generated: Json | null
          score: number | null
          session_id: string | null
          user_id: string
          user_response_data: Json | null
        }
        Insert: {
          accuracy_percentage?: number | null
          activity_data?: Json | null
          activity_metadata?: Json | null
          activity_type: string
          completed_at?: string | null
          difficulty_level?: string | null
          evaluation_data?: Json | null
          game_duration?: number | null
          id?: string
          insights_generated?: Json | null
          score?: number | null
          session_id?: string | null
          user_id: string
          user_response_data?: Json | null
        }
        Update: {
          accuracy_percentage?: number | null
          activity_data?: Json | null
          activity_metadata?: Json | null
          activity_type?: string
          completed_at?: string | null
          difficulty_level?: string | null
          evaluation_data?: Json | null
          game_duration?: number | null
          id?: string
          insights_generated?: Json | null
          score?: number | null
          session_id?: string | null
          user_id?: string
          user_response_data?: Json | null
        }
        Relationships: []
      }
      crisis_events: {
        Row: {
          id: string
          user_id: string
          level: 'critical' | 'high' | 'medium'
          source: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          level: 'critical' | 'high' | 'medium'
          source: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          level?: 'critical' | 'high' | 'medium'
          source?: string
          created_at?: string
        }
        Relationships: []
      }
      onboarding_analytics: {
        Row: {
          id: string
          user_id: string
          step: number
          device_tier: 'full' | 'standard' | 'lite' | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          step: number
          device_tier?: 'full' | 'standard' | 'lite' | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          step?: number
          device_tier?: 'full' | 'standard' | 'lite' | null
          metadata?: Json
          created_at?: string
        }
        Relationships: []
      }
      platform_stats: {
        Row: {
          id: string
          active_users_today: number
          total_sessions_completed: number
          recorded_at: string
        }
        Insert: {
          id?: string
          active_users_today?: number
          total_sessions_completed?: number
          recorded_at?: string
        }
        Update: {
          id?: string
          active_users_today?: number
          total_sessions_completed?: number
          recorded_at?: string
        }
        Relationships: []
      }
      user_onboarding: {
        Row: {
          id: string
          user_id: string
          consent_given: boolean
          onboarding_step: number
          onboarding_completed: boolean
          steps_skipped: Json
          device_tier: 'full' | 'standard' | 'lite' | null
          personalization: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          consent_given?: boolean
          onboarding_step?: number
          onboarding_completed?: boolean
          steps_skipped?: Json
          device_tier?: 'full' | 'standard' | 'lite' | null
          personalization?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          consent_given?: boolean
          onboarding_step?: number
          onboarding_completed?: boolean
          steps_skipped?: Json
          device_tier?: 'full' | 'standard' | 'lite' | null
          personalization?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          companion_name: string | null
          avatar_personality: string | null
          companion_personality: 'mitra' | 'arjun' | 'diya' | 'riya' | 'zen'
          companion_personality_locked: boolean
          reminder_time: string | null
          language: string | null
          theme: string | null
          privacy_mode: boolean
          data_sharing_consent: boolean
          notification_preferences: Json | null
          accessibility_settings: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          companion_name?: string | null
          avatar_personality?: string | null
          companion_personality?: 'mitra' | 'arjun' | 'diya' | 'riya' | 'zen'
          companion_personality_locked?: boolean
          reminder_time?: string | null
          language?: string | null
          theme?: string | null
          privacy_mode?: boolean
          data_sharing_consent?: boolean
          notification_preferences?: Json | null
          accessibility_settings?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          companion_name?: string | null
          avatar_personality?: string | null
          companion_personality?: 'mitra' | 'arjun' | 'diya' | 'riya' | 'zen'
          companion_personality_locked?: boolean
          reminder_time?: string | null
          language?: string | null
          theme?: string | null
          privacy_mode?: boolean
          data_sharing_consent?: boolean
          notification_preferences?: Json | null
          accessibility_settings?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      companion_personalities: {
        Row: {
          id: string
          name: string
          emoji: string
          tagline: string
          best_for: string
          color_accent: string
          system_prompt_addition: string
          voice_rate: number
          avatar_animation_style: string
        }
        Insert: {
          id: string
          name: string
          emoji: string
          tagline: string
          best_for: string
          color_accent: string
          system_prompt_addition: string
          voice_rate: number
          avatar_animation_style: string
        }
        Update: {
          id?: string
          name?: string
          emoji?: string
          tagline?: string
          best_for?: string
          color_accent?: string
          system_prompt_addition?: string
          voice_rate?: number
          avatar_animation_style?: string
        }
        Relationships: []
      }
      voice_analysis_events: {
        Row: {
          avg_confidence: number | null
          avg_pause_duration_ms: number | null
          created_at: string | null
          confidence_variance: number | null
          detected_hindi_words: string[]
          hindi_english_mixing: boolean
          id: string
          language: string
          long_pause_count: number | null
          max_pause_duration_ms: number | null
          message_id: string | null
          min_confidence: number | null
          pause_count: number | null
          pause_pattern: string | null
          processing_duration_ms: number | null
          prosody: Json | null
          session_id: string
          source: string
          speech_clarity: string | null
          speech_rate_category: string | null
          speech_rate_wpm: number | null
          speech_to_silence_ratio: number | null
          total_duration_sec: number | null
          total_speech_duration_sec: number | null
          transcript: string
          user_id: string
          word_count: number
        }
        Insert: {
          avg_confidence?: number | null
          avg_pause_duration_ms?: number | null
          created_at?: string | null
          confidence_variance?: number | null
          detected_hindi_words?: string[]
          hindi_english_mixing?: boolean
          id?: string
          language?: string
          long_pause_count?: number | null
          max_pause_duration_ms?: number | null
          message_id?: string | null
          min_confidence?: number | null
          pause_count?: number | null
          pause_pattern?: string | null
          processing_duration_ms?: number | null
          prosody?: Json | null
          session_id: string
          source: string
          speech_clarity?: string | null
          speech_rate_category?: string | null
          speech_rate_wpm?: number | null
          speech_to_silence_ratio?: number | null
          total_duration_sec?: number | null
          total_speech_duration_sec?: number | null
          transcript: string
          user_id: string
          word_count?: number
        }
        Update: {
          avg_confidence?: number | null
          avg_pause_duration_ms?: number | null
          created_at?: string | null
          confidence_variance?: number | null
          detected_hindi_words?: string[]
          hindi_english_mixing?: boolean
          id?: string
          language?: string
          long_pause_count?: number | null
          max_pause_duration_ms?: number | null
          message_id?: string | null
          min_confidence?: number | null
          pause_count?: number | null
          pause_pattern?: string | null
          processing_duration_ms?: number | null
          prosody?: Json | null
          session_id?: string
          source?: string
          speech_clarity?: string | null
          speech_rate_category?: string | null
          speech_rate_wpm?: number | null
          speech_to_silence_ratio?: number | null
          total_duration_sec?: number | null
          total_speech_duration_sec?: number | null
          transcript?: string
          user_id?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "voice_analysis_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reset_onboarding: {
        Args: { target_user_id: string }
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
