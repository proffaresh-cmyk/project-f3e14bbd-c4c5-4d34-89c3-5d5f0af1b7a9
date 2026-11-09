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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          emoji: string
          name: string
          sort: number
        }
        Insert: {
          emoji?: string
          name: string
          sort?: number
        }
        Update: {
          emoji?: string
          name?: string
          sort?: number
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          created_at: string
          habit_id: string
          id: string
          log_date: string
        }
        Insert: {
          created_at?: string
          habit_id: string
          id?: string
          log_date: string
        }
        Update: {
          created_at?: string
          habit_id?: string
          id?: string
          log_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          active: boolean
          created_at: string
          emoji: string
          frequency: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          emoji?: string
          frequency?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          emoji?: string
          frequency?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      project_steps: {
        Row: {
          done: boolean
          done_at: string | null
          id: string
          project_id: string
          sort: number
          title: string
        }
        Insert: {
          done?: boolean
          done_at?: string | null
          id?: string
          project_id: string
          sort?: number
          title: string
        }
        Update: {
          done?: boolean
          done_at?: string | null
          id?: string
          project_id?: string
          sort?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_steps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          id: string
          name: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          status?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          ack_date: string | null
          active: boolean
          created_at: string
          days: number[]
          habit_id: string | null
          id: string
          kind: string
          last_sent_at: string | null
          last_sent_date: string | null
          message: string
          nag: boolean
          project_id: string | null
          remind_time: string
          snoozed_until: string | null
          title: string
        }
        Insert: {
          ack_date?: string | null
          active?: boolean
          created_at?: string
          days?: number[]
          habit_id?: string | null
          id?: string
          kind?: string
          last_sent_at?: string | null
          last_sent_date?: string | null
          message?: string
          nag?: boolean
          project_id?: string | null
          remind_time: string
          snoozed_until?: string | null
          title: string
        }
        Update: {
          ack_date?: string | null
          active?: boolean
          created_at?: string
          days?: number[]
          habit_id?: string | null
          id?: string
          kind?: string
          last_sent_at?: string | null
          last_sent_date?: string | null
          message?: string
          nag?: boolean
          project_id?: string | null
          remind_time?: string
          snoozed_until?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          bot_state: Json
          id: number
          nag_interval_min: number
          owner_chat_id: number | null
          sleep_time: string
          study_goal_hours: number
          timezone: string
          updated_at: string
          wake_time: string
        }
        Insert: {
          bot_state?: Json
          id?: number
          nag_interval_min?: number
          owner_chat_id?: number | null
          sleep_time?: string
          study_goal_hours?: number
          timezone?: string
          updated_at?: string
          wake_time?: string
        }
        Update: {
          bot_state?: Json
          id?: number
          nag_interval_min?: number
          owner_chat_id?: number | null
          sleep_time?: string
          study_goal_hours?: number
          timezone?: string
          updated_at?: string
          wake_time?: string
        }
        Relationships: []
      }
      study_logs: {
        Row: {
          created_at: string
          hours: number
          id: string
          log_date: string
          note: string | null
        }
        Insert: {
          created_at?: string
          hours: number
          id?: string
          log_date: string
          note?: string | null
        }
        Update: {
          created_at?: string
          hours?: number
          id?: string
          log_date?: string
          note?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          category: string
          completed_at: string | null
          created_at: string
          due_date: string | null
          due_time: string | null
          id: string
          last_sent_at: string | null
          nag: boolean
          priority: string
          snoozed_until: string | null
          status: string
          title: string
        }
        Insert: {
          category?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          due_time?: string | null
          id?: string
          last_sent_at?: string | null
          nag?: boolean
          priority?: string
          snoozed_until?: string | null
          status?: string
          title: string
        }
        Update: {
          category?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          due_time?: string | null
          id?: string
          last_sent_at?: string | null
          nag?: boolean
          priority?: string
          snoozed_until?: string | null
          status?: string
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
