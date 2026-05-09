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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          games_played: number
          id: string
          max_active_games: number
          premove_enabled: boolean
          puzzles_solved: number
          rating: number
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_cancel_at_period_end: boolean
          subscription_canceled_at: string | null
          subscription_current_period_end: string | null
          subscription_plan: string | null
          subscription_status: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          games_played?: number
          id?: string
          max_active_games?: number
          premove_enabled?: boolean
          puzzles_solved?: number
          rating?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_cancel_at_period_end?: boolean
          subscription_canceled_at?: string | null
          subscription_current_period_end?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          games_played?: number
          id?: string
          max_active_games?: number
          premove_enabled?: boolean
          puzzles_solved?: number
          rating?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_cancel_at_period_end?: boolean
          subscription_canceled_at?: string | null
          subscription_current_period_end?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      game_sessions: {
        Row: {
          black_user_id: string | null
          created_at: string
          daily_move_window_seconds: number
          id: string
          mode: Database["public"]["Enums"]["game_mode"]
          move_deadline_at: string | null
          next_turn_notified_at: string | null
          status: Database["public"]["Enums"]["game_status"]
          time_control: string | null
          turn_color: string | null
          updated_at: string
          white_user_id: string | null
        }
        Insert: {
          black_user_id?: string | null
          created_at?: string
          daily_move_window_seconds?: number
          id?: string
          mode?: Database["public"]["Enums"]["game_mode"]
          move_deadline_at?: string | null
          next_turn_notified_at?: string | null
          status?: Database["public"]["Enums"]["game_status"]
          time_control?: string | null
          turn_color?: string | null
          updated_at?: string
          white_user_id?: string | null
        }
        Update: {
          black_user_id?: string | null
          created_at?: string
          daily_move_window_seconds?: number
          id?: string
          mode?: Database["public"]["Enums"]["game_mode"]
          move_deadline_at?: string | null
          next_turn_notified_at?: string | null
          status?: Database["public"]["Enums"]["game_status"]
          time_control?: string | null
          turn_color?: string | null
          updated_at?: string
          white_user_id?: string | null
        }
        Relationships: []
      }
      daily_turn_notifications: {
        Row: {
          channel: Database["public"]["Enums"]["game_notification_channel"]
          created_at: string
          delivered_at: string | null
          game_session_id: string
          id: string
          payload: Json
          recipient_user_id: string
          status: Database["public"]["Enums"]["game_notification_status"]
        }
        Insert: {
          channel?: Database["public"]["Enums"]["game_notification_channel"]
          created_at?: string
          delivered_at?: string | null
          game_session_id: string
          id?: string
          payload?: Json
          recipient_user_id: string
          status?: Database["public"]["Enums"]["game_notification_status"]
        }
        Update: {
          channel?: Database["public"]["Enums"]["game_notification_channel"]
          created_at?: string
          delivered_at?: string | null
          game_session_id?: string
          id?: string
          payload?: Json
          recipient_user_id?: string
          status?: Database["public"]["Enums"]["game_notification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "daily_turn_notifications_game_session_id_fkey"
            columns: ["game_session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_start_new_seek: {
        Args: {
          p_user_id: string
        }
        Returns: boolean
      }
      get_active_game_count: {
        Args: {
          p_user_id: string
        }
        Returns: number
      }
    }
    Enums: {
      game_mode: "standard" | "blitz" | "increment" | "chess960" | "daily"
      game_notification_channel: "email" | "in_app"
      game_notification_status: "pending" | "delivered" | "failed"
      game_status: "pending" | "active" | "completed" | "abandoned"
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
