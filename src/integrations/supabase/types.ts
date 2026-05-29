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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      appointments: {
        Row: {
          action_id: string | null
          created_at: string
          email: string
          end_at: string
          flyer_id: string
          id: string
          layer_id: string | null
          metadata: Json
          name: string | null
          note: string | null
          phone: string | null
          start_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          timezone: string | null
          updated_at: string
        }
        Insert: {
          action_id?: string | null
          created_at?: string
          email: string
          end_at: string
          flyer_id: string
          id?: string
          layer_id?: string | null
          metadata?: Json
          name?: string | null
          note?: string | null
          phone?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          action_id?: string | null
          created_at?: string
          email?: string
          end_at?: string
          flyer_id?: string
          id?: string
          layer_id?: string | null
          metadata?: Json
          name?: string | null
          note?: string | null
          phone?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      business_ratings: {
        Row: {
          action_id: string | null
          comment: string | null
          created_at: string
          flyer_id: string
          id: string
          session_id: string
          stars: number
          updated_at: string
        }
        Insert: {
          action_id?: string | null
          comment?: string | null
          created_at?: string
          flyer_id: string
          id?: string
          session_id: string
          stars: number
          updated_at?: string
        }
        Update: {
          action_id?: string | null
          comment?: string | null
          created_at?: string
          flyer_id?: string
          id?: string
          session_id?: string
          stars?: number
          updated_at?: string
        }
        Relationships: []
      }
      challenge_participants: {
        Row: {
          action_id: string | null
          created_at: string
          email: string
          flyer_id: string
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          action_id?: string | null
          created_at?: string
          email: string
          flyer_id: string
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          action_id?: string | null
          created_at?: string
          email?: string
          flyer_id?: string
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      flyer_portal_credentials: {
        Row: {
          created_at: string
          flyer_id: string
          portal_access_code: string
          portal_token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          flyer_id: string
          portal_access_code?: string
          portal_token?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          flyer_id?: string
          portal_access_code?: string
          portal_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      flyers: {
        Row: {
          auto_unpublish_at: string | null
          category: Database["public"]["Enums"]["flyer_category"]
          created_at: string
          event_date: string | null
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
          auto_unpublish_at?: string | null
          category?: Database["public"]["Enums"]["flyer_category"]
          created_at?: string
          event_date?: string | null
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
          auto_unpublish_at?: string | null
          category?: Database["public"]["Enums"]["flyer_category"]
          created_at?: string
          event_date?: string | null
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
          status: string
        }
        Insert: {
          created_at?: string
          data?: Json
          flyer_id: string
          id?: string
          layer_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          data?: Json
          flyer_id?: string
          id?: string
          layer_id?: string | null
          status?: string
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
      jobs: {
        Row: {
          admin_notes: string | null
          brief: string | null
          created_at: string
          customer_email: string | null
          flyer_id: string | null
          id: string
          payment_link: string | null
          preview_ready: boolean
          price_cents: number | null
          selected_actions: Json
          status: Database["public"]["Enums"]["job_status"]
          title: string
          type: Database["public"]["Enums"]["job_type"]
          updated_at: string
          upload_url: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          brief?: string | null
          created_at?: string
          customer_email?: string | null
          flyer_id?: string | null
          id?: string
          payment_link?: string | null
          preview_ready?: boolean
          price_cents?: number | null
          selected_actions?: Json
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          type: Database["public"]["Enums"]["job_type"]
          updated_at?: string
          upload_url?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          brief?: string | null
          created_at?: string
          customer_email?: string | null
          flyer_id?: string | null
          id?: string
          payment_link?: string | null
          preview_ready?: boolean
          price_cents?: number | null
          selected_actions?: Json
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          type?: Database["public"]["Enums"]["job_type"]
          updated_at?: string
          upload_url?: string | null
          user_id?: string
        }
        Relationships: []
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
      menu_orders: {
        Row: {
          action_id: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          flyer_id: string
          id: string
          items: Json
          notes: string | null
          payment_status: string
          session_id: string | null
          status: string
          subtotal_cents: number
          updated_at: string
        }
        Insert: {
          action_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          flyer_id: string
          id?: string
          items?: Json
          notes?: string | null
          payment_status?: string
          session_id?: string | null
          status?: string
          subtotal_cents?: number
          updated_at?: string
        }
        Update: {
          action_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          flyer_id?: string
          id?: string
          items?: Json
          notes?: string | null
          payment_status?: string
          session_id?: string | null
          status?: string
          subtotal_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      menus: {
        Row: {
          action_id: string
          created_at: string
          flyer_id: string
          id: string
          sections: Json
          updated_at: string
        }
        Insert: {
          action_id: string
          created_at?: string
          flyer_id: string
          id?: string
          sections?: Json
          updated_at?: string
        }
        Update: {
          action_id?: string
          created_at?: string
          flyer_id?: string
          id?: string
          sections?: Json
          updated_at?: string
        }
        Relationships: []
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
      poll_votes: {
        Row: {
          action_id: string
          created_at: string
          flyer_id: string
          id: string
          option_id: string
          session_id: string
        }
        Insert: {
          action_id: string
          created_at?: string
          flyer_id: string
          id?: string
          option_id: string
          session_id: string
        }
        Update: {
          action_id?: string
          created_at?: string
          flyer_id?: string
          id?: string
          option_id?: string
          session_id?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          flyer_id: string
          id: string
          layer_id: string | null
          list_name: string | null
          name: string | null
          phone: string | null
          source: string
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          flyer_id: string
          id?: string
          layer_id?: string | null
          list_name?: string | null
          name?: string | null
          phone?: string | null
          source?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          flyer_id?: string
          id?: string
          layer_id?: string | null
          list_name?: string | null
          name?: string | null
          phone?: string | null
          source?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      survey_responses: {
        Row: {
          action_id: string | null
          answers: Json
          created_at: string
          flyer_id: string
          id: string
          session_id: string | null
        }
        Insert: {
          action_id?: string | null
          answers?: Json
          created_at?: string
          flyer_id: string
          id?: string
          session_id?: string | null
        }
        Update: {
          action_id?: string | null
          answers?: Json
          created_at?: string
          flyer_id?: string
          id?: string
          session_id?: string | null
        }
        Relationships: []
      }
      table_reservations: {
        Row: {
          action_id: string | null
          created_at: string
          email: string | null
          flyer_id: string
          id: string
          name: string
          notes: string | null
          party_size: number
          phone: string | null
          reserve_at: string
          status: string
          updated_at: string
        }
        Insert: {
          action_id?: string | null
          created_at?: string
          email?: string | null
          flyer_id: string
          id?: string
          name: string
          notes?: string | null
          party_size?: number
          phone?: string | null
          reserve_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          action_id?: string | null
          created_at?: string
          email?: string | null
          flyer_id?: string
          id?: string
          name?: string
          notes?: string | null
          party_size?: number
          phone?: string | null
          reserve_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          action_id: string | null
          body: string | null
          created_at: string
          flyer_id: string
          id: string
          name: string | null
          photo_url: string | null
          rating: number | null
          status: string
          updated_at: string
        }
        Insert: {
          action_id?: string | null
          body?: string | null
          created_at?: string
          flyer_id: string
          id?: string
          name?: string | null
          photo_url?: string | null
          rating?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          action_id?: string | null
          body?: string | null
          created_at?: string
          flyer_id?: string
          id?: string
          name?: string | null
          photo_url?: string | null
          rating?: number | null
          status?: string
          updated_at?: string
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
      unpublish_expired_events: { Args: never; Returns: number }
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
        | "buy_product"
        | "air_messages"
        | "poll"
        | "subscribe"
        | "book_appointment"
        | "gallery"
        | "survey"
        | "testimonial"
        | "reserve_table"
        | "schedule_consultation"
        | "show_menu"
        | "join_challenge"
        | "business_rating"
        | "menu_add_item"
      app_role: "admin" | "user"
      appointment_status: "confirmed" | "cancelled"
      event_type: "view" | "click" | "submit" | "reveal"
      flyer_category: "business" | "event"
      flyer_status: "draft" | "published"
      job_status:
        | "new"
        | "reviewing"
        | "quoted"
        | "paid"
        | "in_progress"
        | "preview_ready"
        | "delivered"
        | "cancelled"
      job_type: "upload" | "design"
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
        "buy_product",
        "air_messages",
        "poll",
        "subscribe",
        "book_appointment",
        "gallery",
        "survey",
        "testimonial",
        "reserve_table",
        "schedule_consultation",
        "show_menu",
        "join_challenge",
        "business_rating",
        "menu_add_item",
      ],
      app_role: ["admin", "user"],
      appointment_status: ["confirmed", "cancelled"],
      event_type: ["view", "click", "submit", "reveal"],
      flyer_category: ["business", "event"],
      flyer_status: ["draft", "published"],
      job_status: [
        "new",
        "reviewing",
        "quoted",
        "paid",
        "in_progress",
        "preview_ready",
        "delivered",
        "cancelled",
      ],
      job_type: ["upload", "design"],
      layer_type: ["text", "image", "icon", "shape", "button", "hotspot"],
    },
  },
} as const
