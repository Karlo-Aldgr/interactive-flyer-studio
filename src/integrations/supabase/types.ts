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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      actions: {
        Row: {
          created_at: string
          highlight: Json | null
          id: string
          layer_id: string
          payload: Json
          type: Database["public"]["Enums"]["action_type"]
        }
        Insert: {
          created_at?: string
          highlight?: Json | null
          id?: string
          layer_id: string
          payload?: Json
          type: Database["public"]["Enums"]["action_type"]
        }
        Update: {
          created_at?: string
          highlight?: Json | null
          id?: string
          layer_id?: string
          payload?: Json
          type?: Database["public"]["Enums"]["action_type"]
        }
        Relationships: [
          {
            foreignKeyName: "actions_layer_id_fkey"
            columns: ["layer_id"]
            isOneToOne: false
            referencedRelation: "layers"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          flyer_id: string
          id: string
          layer_id: string | null
          metadata: Json
          page_id: string | null
          session_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["event_type"]
          flyer_id: string
          id?: string
          layer_id?: string | null
          metadata?: Json
          page_id?: string | null
          session_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          flyer_id?: string
          id?: string
          layer_id?: string | null
          metadata?: Json
          page_id?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_flyer_id_fkey"
            columns: ["flyer_id"]
            isOneToOne: false
            referencedRelation: "flyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_layer_id_fkey"
            columns: ["layer_id"]
            isOneToOne: false
            referencedRelation: "layers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      flyers: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          public_slug: string | null
          settings: Json
          status: Database["public"]["Enums"]["flyer_status"]
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          public_slug?: string | null
          settings?: Json
          status?: Database["public"]["Enums"]["flyer_status"]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          public_slug?: string | null
          settings?: Json
          status?: Database["public"]["Enums"]["flyer_status"]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      form_submissions: {
        Row: {
          created_at: string
          data: Json
          flyer_id: string
          id: string
          layer_id: string | null
        }
        Insert: {
          created_at?: string
          data?: Json
          flyer_id: string
          id?: string
          layer_id?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          flyer_id?: string
          id?: string
          layer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_flyer_id_fkey"
            columns: ["flyer_id"]
            isOneToOne: false
            referencedRelation: "flyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_layer_id_fkey"
            columns: ["layer_id"]
            isOneToOne: false
            referencedRelation: "layers"
            referencedColumns: ["id"]
          },
        ]
      }
      layers: {
        Row: {
          content: Json
          created_at: string
          id: string
          intro: Json | null
          page_id: string
          position: Json
          rotation: number
          size: Json
          style: Json
          type: Database["public"]["Enums"]["layer_type"]
          z_index: number
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          intro?: Json | null
          page_id: string
          position?: Json
          rotation?: number
          size?: Json
          style?: Json
          type: Database["public"]["Enums"]["layer_type"]
          z_index?: number
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          intro?: Json | null
          page_id?: string
          position?: Json
          rotation?: number
          size?: Json
          style?: Json
          type?: Database["public"]["Enums"]["layer_type"]
          z_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "layers_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          background: Json
          created_at: string
          flyer_id: string
          id: string
          index: number
          intro: Json | null
          name: string
        }
        Insert: {
          background?: Json
          created_at?: string
          flyer_id: string
          id?: string
          index?: number
          intro?: Json | null
          name?: string
        }
        Update: {
          background?: Json
          created_at?: string
          flyer_id?: string
          id?: string
          index?: number
          intro?: Json | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_flyer_id_fkey"
            columns: ["flyer_id"]
            isOneToOne: false
            referencedRelation: "flyers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      action_type:
        | "open_url"
        | "popup"
        | "video"
        | "call"
        | "sms"
        | "form"
        | "navigate"
        | "reveal"
        | "add_to_calendar"
        | "buy_ticket"
        | "rsvp"
        | "checkout"
        | "coupon"
        | "map"
        | "audio"
      app_role: "admin" | "user"
      event_type: "view" | "click" | "submit" | "reveal"
      flyer_status: "draft" | "published"
      layer_type: "text" | "image" | "icon" | "shape" | "button" | "hotspot"
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
    Enums: {
      action_type: [
        "open_url",
        "popup",
        "video",
        "call",
        "sms",
        "form",
        "navigate",
        "reveal",
        "add_to_calendar",
        "buy_ticket",
        "rsvp",
        "checkout",
        "coupon",
        "map",
        "audio",
      ],
      app_role: ["admin", "user"],
      event_type: ["view", "click", "submit", "reveal"],
      flyer_status: ["draft", "published"],
      layer_type: ["text", "image", "icon", "shape", "button", "hotspot"],
    },
  },
} as const
