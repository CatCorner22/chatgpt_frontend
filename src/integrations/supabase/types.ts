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
      ai_request_guards: {
        Row: {
          lease_id: string | null
          lease_until: string | null
          starts: string[]
          user_id: string
        }
        Insert: {
          lease_id?: string | null
          lease_until?: string | null
          starts?: string[]
          user_id: string
        }
        Update: {
          lease_id?: string | null
          lease_until?: string | null
          starts?: string[]
          user_id?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          checked_at: string | null
          created_at: string
          design_id: string
          error: string | null
          history: Json
          id: string
          issued_at: string
          lease_until: string | null
          next_check: string
          passing: boolean
          reasons: Json
          score: number | null
          showcase: boolean
          title: string
          tokens: Json
          url: string
          user_id: string
        }
        Insert: {
          checked_at?: string | null
          created_at?: string
          design_id: string
          error?: string | null
          history?: Json
          id?: string
          issued_at?: string
          lease_until?: string | null
          next_check?: string
          passing?: boolean
          reasons?: Json
          score?: number | null
          showcase?: boolean
          title?: string
          tokens: Json
          url: string
          user_id: string
        }
        Update: {
          checked_at?: string | null
          created_at?: string
          design_id?: string
          error?: string | null
          history?: Json
          id?: string
          issued_at?: string
          lease_until?: string | null
          next_check?: string
          passing?: boolean
          reasons?: Json
          score?: number | null
          showcase?: boolean
          title?: string
          tokens?: Json
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      brand_builds: {
        Row: {
          build_id: string
          collection: string
          created_at: string
          favorite: boolean
          state: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          build_id: string
          collection?: string
          created_at?: string
          favorite?: boolean
          state: Json
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          build_id?: string
          collection?: string
          created_at?: string
          favorite?: boolean
          state?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      design_progress: {
        Row: {
          completed_at: string
          design_id: string
          details: Json
          fingerprint: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          design_id: string
          details?: Json
          fingerprint: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          completed_at?: string
          design_id?: string
          details?: Json
          fingerprint?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          business_name: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          business_name?: string
          created_at?: string
          id: string
          name?: string
          updated_at?: string
        }
        Update: {
          business_name?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          id: string
          state: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          state: Json
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          state?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shares: {
        Row: {
          created_at: string
          id: string
          snapshot: Json
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          snapshot: Json
          title?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          snapshot?: Json
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vision_events: {
        Row: {
          created_at: string
          design_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          design_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          design_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      vision_links: {
        Row: {
          created_at: string
          design_id: string
          enabled: boolean
          id: string
          title: string
          token: string
          updated_at: string
          user_id: string
          vision: string
        }
        Insert: {
          created_at?: string
          design_id: string
          enabled?: boolean
          id?: string
          title?: string
          token?: string
          updated_at?: string
          user_id: string
          vision: string
        }
        Update: {
          created_at?: string
          design_id?: string
          enabled?: boolean
          id?: string
          title?: string
          token?: string
          updated_at?: string
          user_id?: string
          vision?: string
        }
        Relationships: []
      }
      watched_sites: {
        Row: {
          checked_at: string | null
          created_at: string
          design_id: string | null
          enabled: boolean
          error: string | null
          findings: Json
          history: Json
          id: string
          label: string
          lease_until: string | null
          next_check: string
          score: number | null
          url: string
          user_id: string
        }
        Insert: {
          checked_at?: string | null
          created_at?: string
          design_id?: string | null
          enabled?: boolean
          error?: string | null
          findings?: Json
          history?: Json
          id?: string
          label?: string
          lease_until?: string | null
          next_check?: string
          score?: number | null
          url: string
          user_id: string
        }
        Update: {
          checked_at?: string | null
          created_at?: string
          design_id?: string | null
          enabled?: boolean
          error?: string | null
          findings?: Json
          history?: Json
          id?: string
          label?: string
          lease_until?: string | null
          next_check?: string
          score?: number | null
          url?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_badge: { Args: { _id: string }; Returns: boolean }
      claim_watchtower: { Args: { _id: string }; Returns: boolean }
      get_badge: {
        Args: { _id: string }
        Returns: {
          checked_at: string
          design_id: string
          history: Json
          issued_at: string
          passing: boolean
          reasons: Json
          score: number
          title: string
          url: string
        }[]
      }
      get_share: {
        Args: { _id: string }
        Returns: {
          snapshot: Json
          title: string
        }[]
      }
      get_vision: {
        Args: { _token: string }
        Returns: {
          title: string
          updated_at: string
          vision: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_showcase: {
        Args: never
        Returns: {
          checked_at: string
          id: string
          issued_at: string
          score: number
          title: string
          url: string
        }[]
      }
      owner_counts: { Args: never; Returns: Json }
      release_ai_request: {
        Args: { _ticket: string; _user_id: string }
        Returns: undefined
      }
      reserve_ai_request: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin"
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
    Enums: {
      app_role: ["admin"],
    },
  },
} as const
