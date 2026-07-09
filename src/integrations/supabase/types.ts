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
      example_flyers: {
        Row: {
          created_at: string
          description: string | null
          id: string
          sort_order: number
          thumbnail_url: string | null
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      flyer_master_auth: {
        Row: {
          created_at: string
          flyer_id: string
          master_pin_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          flyer_id: string
          master_pin_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          flyer_id?: string
          master_pin_hash?: string
          updated_at?: string
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
          address: string | null
          auto_unpublish_at: string | null
          baths: number | null
          beds: number | null
          category: Database["public"]["Enums"]["flyer_category"]
          created_at: string
          event_date: string | null
          id: string
          listing_status: string
          owner_id: string
          price_cents: number | null
          public_slug: string | null
          settings: Json
          sqft: number | null
          status: Database["public"]["Enums"]["flyer_status"]
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          auto_unpublish_at?: string | null
          baths?: number | null
          beds?: number | null
          category?: Database["public"]["Enums"]["flyer_category"]
          created_at?: string
          event_date?: string | null
          id?: string
          listing_status?: string
          owner_id: string
          price_cents?: number | null
          public_slug?: string | null
          settings?: Json
          sqft?: number | null
          status?: Database["public"]["Enums"]["flyer_status"]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          auto_unpublish_at?: string | null
          baths?: number | null
          beds?: number | null
          category?: Database["public"]["Enums"]["flyer_category"]
          created_at?: string
          event_date?: string | null
          id?: string
          listing_status?: string
          owner_id?: string
          price_cents?: number | null
          public_slug?: string | null
          settings?: Json
          sqft?: number | null
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
          assigned_at: string | null
          assigned_editor_id: string | null
          brief: string | null
          created_at: string
          customer_deletion_reason: string | null
          customer_email: string | null
          customer_updated_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          editor_started_at: string | null
          flyer_active: boolean
          flyer_id: string | null
          id: string
          mini_ad_enabled: boolean
          mini_ad_paid: boolean
          payment_link: string | null
          preview_ready: boolean
          price_cents: number | null
          selected_actions: Json
          share_unlocked: boolean
          staff_acknowledged_at: string | null
          staff_acknowledged_by: string | null
          staff_content_seen_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          type: Database["public"]["Enums"]["job_type"]
          updated_at: string
          upload_url: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          assigned_at?: string | null
          assigned_editor_id?: string | null
          brief?: string | null
          created_at?: string
          customer_deletion_reason?: string | null
          customer_email?: string | null
          customer_updated_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          editor_started_at?: string | null
          flyer_active?: boolean
          flyer_id?: string | null
          id?: string
          mini_ad_enabled?: boolean
          mini_ad_paid?: boolean
          payment_link?: string | null
          preview_ready?: boolean
          price_cents?: number | null
          selected_actions?: Json
          share_unlocked?: boolean
          staff_acknowledged_at?: string | null
          staff_acknowledged_by?: string | null
          staff_content_seen_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          type: Database["public"]["Enums"]["job_type"]
          updated_at?: string
          upload_url?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          assigned_at?: string | null
          assigned_editor_id?: string | null
          brief?: string | null
          created_at?: string
          customer_deletion_reason?: string | null
          customer_email?: string | null
          customer_updated_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          editor_started_at?: string | null
          flyer_active?: boolean
          flyer_id?: string | null
          id?: string
          mini_ad_enabled?: boolean
          mini_ad_paid?: boolean
          payment_link?: string | null
          preview_ready?: boolean
          price_cents?: number | null
          selected_actions?: Json
          share_unlocked?: boolean
          staff_acknowledged_at?: string | null
          staff_acknowledged_by?: string | null
          staff_content_seen_at?: string | null
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
      listing_pending_details: {
        Row: {
          agreed_price_cents: number | null
          buyer_agent_brokerage: string | null
          buyer_agent_name: string | null
          buyer_name: string | null
          closing_costs_cents: number | null
          closing_date: string | null
          contingencies: string | null
          contract_date: string | null
          created_at: string
          earnest_money_cents: number | null
          financing_deadline: string | null
          flyer_id: string
          inspection_deadline: string | null
          lender: string | null
          notes: string | null
          seller_name: string | null
          title_company: string | null
          updated_at: string
        }
        Insert: {
          agreed_price_cents?: number | null
          buyer_agent_brokerage?: string | null
          buyer_agent_name?: string | null
          buyer_name?: string | null
          closing_costs_cents?: number | null
          closing_date?: string | null
          contingencies?: string | null
          contract_date?: string | null
          created_at?: string
          earnest_money_cents?: number | null
          financing_deadline?: string | null
          flyer_id: string
          inspection_deadline?: string | null
          lender?: string | null
          notes?: string | null
          seller_name?: string | null
          title_company?: string | null
          updated_at?: string
        }
        Update: {
          agreed_price_cents?: number | null
          buyer_agent_brokerage?: string | null
          buyer_agent_name?: string | null
          buyer_name?: string | null
          closing_costs_cents?: number | null
          closing_date?: string | null
          contingencies?: string | null
          contract_date?: string | null
          created_at?: string
          earnest_money_cents?: number | null
          financing_deadline?: string | null
          flyer_id?: string
          inspection_deadline?: string | null
          lender?: string | null
          notes?: string | null
          seller_name?: string | null
          title_company?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_pending_details_flyer_id_fkey"
            columns: ["flyer_id"]
            isOneToOne: true
            referencedRelation: "flyers"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_photos: {
        Row: {
          caption: string | null
          category: string
          created_at: string
          flyer_id: string
          id: string
          position: number
          staged_url: string | null
          updated_at: string
          url: string
        }
        Insert: {
          caption?: string | null
          category?: string
          created_at?: string
          flyer_id: string
          id?: string
          position?: number
          staged_url?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          caption?: string | null
          category?: string
          created_at?: string
          flyer_id?: string
          id?: string
          position?: number
          staged_url?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_photos_flyer_id_fkey"
            columns: ["flyer_id"]
            isOneToOne: false
            referencedRelation: "flyers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_drafts: {
        Row: {
          created_at: string
          error_message: string | null
          facebook_error_message: string | null
          facebook_last_attempt_at: string | null
          facebook_last_error: string | null
          facebook_post: string | null
          facebook_posted_at: string | null
          facebook_provider_post_id: string | null
          facebook_provider_status: string
          facebook_scheduled_for: string | null
          facebook_status: string
          flyer_id: string
          flyer_title: string | null
          flyer_url: string | null
          id: string
          instagram_caption: string | null
          instagram_error_message: string | null
          instagram_posted_at: string | null
          instagram_scheduled_for: string | null
          instagram_status: string
          owner_id: string
          status: string
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          facebook_error_message?: string | null
          facebook_last_attempt_at?: string | null
          facebook_last_error?: string | null
          facebook_post?: string | null
          facebook_posted_at?: string | null
          facebook_provider_post_id?: string | null
          facebook_provider_status?: string
          facebook_scheduled_for?: string | null
          facebook_status?: string
          flyer_id: string
          flyer_title?: string | null
          flyer_url?: string | null
          id?: string
          instagram_caption?: string | null
          instagram_error_message?: string | null
          instagram_posted_at?: string | null
          instagram_scheduled_for?: string | null
          instagram_status?: string
          owner_id: string
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          facebook_error_message?: string | null
          facebook_last_attempt_at?: string | null
          facebook_last_error?: string | null
          facebook_post?: string | null
          facebook_posted_at?: string | null
          facebook_provider_post_id?: string | null
          facebook_provider_status?: string
          facebook_scheduled_for?: string | null
          facebook_status?: string
          flyer_id?: string
          flyer_title?: string | null
          flyer_url?: string | null
          id?: string
          instagram_caption?: string | null
          instagram_error_message?: string | null
          instagram_posted_at?: string | null
          instagram_scheduled_for?: string | null
          instagram_status?: string
          owner_id?: string
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_drafts_flyer_id_fkey"
            columns: ["flyer_id"]
            isOneToOne: false
            referencedRelation: "flyers"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_daily_summaries: {
        Row: {
          cancelled_orders: number
          completed_orders: number
          created_at: string
          flyer_id: string
          id: string
          paid_orders: number
          pending_orders: number
          summary_date: string
          total_orders: number
          total_sales_cents: number
          unpaid_orders: number
          updated_at: string
        }
        Insert: {
          cancelled_orders?: number
          completed_orders?: number
          created_at?: string
          flyer_id: string
          id?: string
          paid_orders?: number
          pending_orders?: number
          summary_date: string
          total_orders?: number
          total_sales_cents?: number
          unpaid_orders?: number
          updated_at?: string
        }
        Update: {
          cancelled_orders?: number
          completed_orders?: number
          created_at?: string
          flyer_id?: string
          id?: string
          paid_orders?: number
          pending_orders?: number
          summary_date?: string
          total_orders?: number
          total_sales_cents?: number
          unpaid_orders?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_daily_summaries_flyer_id_fkey"
            columns: ["flyer_id"]
            isOneToOne: false
            referencedRelation: "flyers"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_orders: {
        Row: {
          action_id: string | null
          approved_at: string | null
          approved_by: string | null
          archived_at: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          flyer_id: string
          id: string
          items: Json
          notes: string | null
          order_type: string
          paid_at: string | null
          payment_method: string
          payment_status: string
          pickup_at: string | null
          session_id: string | null
          status: string
          subtotal_cents: number
          table_number: string | null
          updated_at: string
          waiter_id: string | null
        }
        Insert: {
          action_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          flyer_id: string
          id?: string
          items?: Json
          notes?: string | null
          order_type?: string
          paid_at?: string | null
          payment_method?: string
          payment_status?: string
          pickup_at?: string | null
          session_id?: string | null
          status?: string
          subtotal_cents?: number
          table_number?: string | null
          updated_at?: string
          waiter_id?: string | null
        }
        Update: {
          action_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          flyer_id?: string
          id?: string
          items?: Json
          notes?: string | null
          order_type?: string
          paid_at?: string | null
          payment_method?: string
          payment_status?: string
          pickup_at?: string | null
          session_id?: string | null
          status?: string
          subtotal_cents?: number
          table_number?: string | null
          updated_at?: string
          waiter_id?: string | null
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
      meta_connections: {
        Row: {
          connection_mode: string
          created_at: string
          facebook_page_id: string | null
          facebook_page_name: string | null
          id: string
          last_error: string | null
          meta_app_id: string | null
          page_access_token_last4: string | null
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_mode?: string
          created_at?: string
          facebook_page_id?: string | null
          facebook_page_name?: string | null
          id?: string
          last_error?: string | null
          meta_app_id?: string | null
          page_access_token_last4?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_mode?: string
          created_at?: string
          facebook_page_id?: string | null
          facebook_page_name?: string | null
          id?: string
          last_error?: string | null
          meta_app_id?: string | null
          page_access_token_last4?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mini_ad_events: {
        Row: {
          created_at: string
          event_type: string
          flyer_id: string | null
          id: string
          mini_ad_id: string
          session_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          flyer_id?: string | null
          id?: string
          mini_ad_id: string
          session_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          flyer_id?: string | null
          id?: string
          mini_ad_id?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mini_ad_events_flyer_id_fkey"
            columns: ["flyer_id"]
            isOneToOne: false
            referencedRelation: "flyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mini_ad_events_mini_ad_id_fkey"
            columns: ["mini_ad_id"]
            isOneToOne: false
            referencedRelation: "mini_ads"
            referencedColumns: ["id"]
          },
        ]
      }
      mini_ads: {
        Row: {
          active: boolean
          alt_text: string | null
          click_url: string
          created_at: string
          ends_at: string | null
          id: string
          image_url: string
          starts_at: string | null
          updated_at: string
          weight: number
        }
        Insert: {
          active?: boolean
          alt_text?: string | null
          click_url: string
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url: string
          starts_at?: string | null
          updated_at?: string
          weight?: number
        }
        Update: {
          active?: boolean
          alt_text?: string | null
          click_url?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string
          starts_at?: string | null
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      novel_purchases: {
        Row: {
          action_id: string
          amount: number | null
          book_title: string | null
          buyer_email: string
          buyer_name: string | null
          chapter_numbers: number[]
          created_at: string
          currency: string | null
          flyer_id: string
          id: string
          payment_ref: string | null
          paypal_txn_id: string | null
          purchase_type: string
          status: string
          updated_at: string
        }
        Insert: {
          action_id: string
          amount?: number | null
          book_title?: string | null
          buyer_email: string
          buyer_name?: string | null
          chapter_numbers?: number[]
          created_at?: string
          currency?: string | null
          flyer_id: string
          id?: string
          payment_ref?: string | null
          paypal_txn_id?: string | null
          purchase_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          action_id?: string
          amount?: number | null
          book_title?: string | null
          buyer_email?: string
          buyer_name?: string | null
          chapter_numbers?: number[]
          created_at?: string
          currency?: string | null
          flyer_id?: string
          id?: string
          payment_ref?: string | null
          paypal_txn_id?: string | null
          purchase_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "novel_purchases_flyer_id_fkey"
            columns: ["flyer_id"]
            isOneToOne: false
            referencedRelation: "flyers"
            referencedColumns: ["id"]
          },
        ]
      }
      novel_subscriptions: {
        Row: {
          action_id: string
          book_title: string | null
          created_at: string
          ended_at: string | null
          flyer_id: string
          id: string
          paypal_subscription_id: string | null
          started_at: string
          status: string
          subscriber_email: string
          subscriber_name: string | null
          tier: string
          updated_at: string
        }
        Insert: {
          action_id: string
          book_title?: string | null
          created_at?: string
          ended_at?: string | null
          flyer_id: string
          id?: string
          paypal_subscription_id?: string | null
          started_at?: string
          status?: string
          subscriber_email: string
          subscriber_name?: string | null
          tier?: string
          updated_at?: string
        }
        Update: {
          action_id?: string
          book_title?: string | null
          created_at?: string
          ended_at?: string | null
          flyer_id?: string
          id?: string
          paypal_subscription_id?: string | null
          started_at?: string
          status?: string
          subscriber_email?: string
          subscriber_name?: string | null
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "novel_subscriptions_flyer_id_fkey"
            columns: ["flyer_id"]
            isOneToOne: false
            referencedRelation: "flyers"
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
      profiles: {
        Row: {
          brokerage: string | null
          created_at: string
          email: string
          full_name: string | null
          headline: string | null
          id: string
          phone: string | null
          photo_url: string | null
          profile_slug: string | null
          updated_at: string
        }
        Insert: {
          brokerage?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          headline?: string | null
          id: string
          phone?: string | null
          photo_url?: string | null
          profile_slug?: string | null
          updated_at?: string
        }
        Update: {
          brokerage?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          headline?: string | null
          id?: string
          phone?: string | null
          photo_url?: string | null
          profile_slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      realtor_applications: {
        Row: {
          applicant_user_id: string | null
          brokerage: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          license_number: string | null
          message: string | null
          phone: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          applicant_user_id?: string | null
          brokerage?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          license_number?: string | null
          message?: string | null
          phone?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          applicant_user_id?: string | null
          brokerage?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          license_number?: string | null
          message?: string | null
          phone?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      realtor_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invited_by: string
          invited_name: string | null
          note: string | null
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by: string
          invited_name?: string | null
          note?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string
          invited_name?: string | null
          note?: string | null
          status?: string
          token?: string
          updated_at?: string
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
      table_assignments: {
        Row: {
          created_at: string
          flyer_id: string
          id: string
          table_number: string
          updated_at: string
          waiter_id: string | null
        }
        Insert: {
          created_at?: string
          flyer_id: string
          id?: string
          table_number: string
          updated_at?: string
          waiter_id?: string | null
        }
        Update: {
          created_at?: string
          flyer_id?: string
          id?: string
          table_number?: string
          updated_at?: string
          waiter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "table_assignments_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_assignments_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters_public"
            referencedColumns: ["id"]
          },
        ]
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
      waiters: {
        Row: {
          active: boolean
          color: string
          created_at: string
          flyer_id: string
          id: string
          name: string
          pin_hash: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          flyer_id: string
          id?: string
          name: string
          pin_hash: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          flyer_id?: string
          id?: string
          name?: string
          pin_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      waiters_public: {
        Row: {
          active: boolean | null
          color: string | null
          flyer_id: string | null
          id: string | null
          name: string | null
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          flyer_id?: string | null
          id?: string | null
          name?: string | null
        }
        Update: {
          active?: boolean | null
          color?: string | null
          flyer_id?: string | null
          id?: string | null
          name?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_realtor_invite: { Args: { _token: string }; Returns: Json }
      admin_assign_job_editor: {
        Args: { _editor_id: string; _job_id: string }
        Returns: Json
      }
      admin_create_realtor_invite: {
        Args: {
          _email?: string
          _expires_days?: number
          _name?: string
          _note?: string
        }
        Returns: Json
      }
      admin_list_realtor_applications: {
        Args: never
        Returns: {
          applicant_user_id: string | null
          brokerage: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          license_number: string | null
          message: string | null
          phone: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          website: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "realtor_applications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_realtor_invites: {
        Args: never
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invited_by: string
          invited_name: string | null
          note: string | null
          status: string
          token: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "realtor_invites"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_review_realtor_application: {
        Args: { _application_id: string; _decision: string; _notes?: string }
        Returns: Json
      }
      admin_revoke_realtor_invite: { Args: { _id: string }; Returns: Json }
      admin_set_job_mini_ad: {
        Args: { _enabled: boolean; _job_id: string }
        Returns: Json
      }
      archive_menu_orders_daily: { Args: never; Returns: number }
      check_novel_payment: { Args: { _payment_ref: string }; Returns: Json }
      current_user_can_edit: { Args: never; Returns: boolean }
      customer_delete_job: {
        Args: { _job_id: string; _reason: string }
        Returns: Json
      }
      customer_set_flyer_active: {
        Args: { _active: boolean; _job_id: string }
        Returns: Json
      }
      customer_set_job_mini_ad: {
        Args: { _enabled: boolean; _job_id: string }
        Returns: Json
      }
      customer_update_job: {
        Args: {
          _brief?: string
          _job_id: string
          _selected_actions?: Json
          _title?: string
          _upload_url?: string
        }
        Returns: Json
      }
      editor_claim_job: { Args: { _job_id: string }; Returns: Json }
      editor_release_job: { Args: { _job_id: string }; Returns: Json }
      editor_update_job: {
        Args: {
          _clear_flyer?: boolean
          _flyer_id?: string
          _job_id: string
          _preview_ready?: boolean
          _status?: Database["public"]["Enums"]["job_status"]
        }
        Returns: Json
      }
      ensure_flyer_portal_credentials: {
        Args: { _flyer_id: string }
        Returns: {
          portal_access_code: string
          portal_token: string
        }[]
      }
      ensure_flyer_public_slug: { Args: { _flyer_id: string }; Returns: string }
      flyer_lead_count: { Args: { _flyer_id: string }; Returns: number }
      flyer_mini_ad_enabled: { Args: { _flyer_id: string }; Returns: boolean }
      flyer_view_count: { Args: { _flyer_id: string }; Returns: number }
      get_listing_pending_details: {
        Args: { _flyer_id: string }
        Returns: Json
      }
      get_realtor_public_profile: { Args: { _slug: string }; Returns: Json }
      grant_editor_by_email: { Args: { _email: string }; Returns: Json }
      grant_realtor_by_email: { Args: { _email: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      job_assigned_editor_display: {
        Args: { _user_id: string }
        Returns: string
      }
      list_editors: {
        Args: never
        Returns: {
          email: string
          granted_at: string
          user_id: string
        }[]
      }
      list_users_with_roles: {
        Args: never
        Returns: {
          email: string
          flyer_count: number
          job_count: number
          roles: string[]
          signed_up_at: string
          user_id: string
        }[]
      }
      pick_mini_ad:
        | {
            Args: never
            Returns: {
              alt_text: string
              click_url: string
              id: string
              image_url: string
            }[]
          }
        | {
            Args: { _exclude_id?: string }
            Returns: {
              alt_text: string
              click_url: string
              id: string
              image_url: string
            }[]
          }
      place_menu_order: {
        Args: {
          _action_id: string
          _customer_name: string
          _customer_phone: string
          _flyer_id: string
          _items: Json
          _notes: string
          _order_type: string
          _paid_at?: string
          _payment_method?: string
          _payment_status?: string
          _pickup_at: string
          _status: string
          _subtotal_cents: number
          _table_number: string
        }
        Returns: string
      }
      realtor_listing_stats: {
        Args: { _flyer_ids: string[] }
        Returns: {
          flyer_id: string
          leads: number
          views: number
        }[]
      }
      regenerate_flyer_portal_credentials: {
        Args: {
          _flyer_id: string
          _reset_code?: boolean
          _reset_token?: boolean
        }
        Returns: {
          portal_access_code: string
          portal_token: string
        }[]
      }
      resolve_realtor_invite: { Args: { _token: string }; Returns: Json }
      revoke_editor_by_email: { Args: { _email: string }; Returns: Json }
      revoke_realtor_by_email: { Args: { _email: string }; Returns: Json }
      staff_acknowledge_job: { Args: { _job_id: string }; Returns: Json }
      staff_mark_job_seen: { Args: { _job_id: string }; Returns: Json }
      unpublish_expired_events: { Args: never; Returns: number }
      update_my_realtor_profile: {
        Args: {
          _brokerage?: string
          _full_name?: string
          _headline?: string
          _phone?: string
          _photo_url?: string
          _profile_slug?: string
        }
        Returns: Json
      }
      upsert_listing_pending_details: {
        Args: { _flyer_id: string; _payload: Json }
        Returns: Json
      }
      upsert_menu_daily_summary: {
        Args: { p_date: string; p_flyer_id: string }
        Returns: undefined
      }
      user_can_manage_flyer: { Args: { _flyer_id: string }; Returns: boolean }
      user_can_manage_flyer_portal: {
        Args: { _flyer_id: string }
        Returns: boolean
      }
      waiter_pin_hash: {
        Args: { p_flyer_id: string; p_pin: string }
        Returns: string
      }
      waiter_portal_resolve_token: { Args: { p_token: string }; Returns: Json }
      waiter_portal_rpc: {
        Args: {
          p_action: string
          p_flyer_id: string
          p_order_id?: string
          p_pin: string
          p_status?: string
        }
        Returns: Json
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
        | "product_grid"
        | "novel"
        | "realtor_gallery"
      app_role: "admin" | "user" | "editor" | "realtor"
      appointment_status: "confirmed" | "cancelled"
      event_type: "view" | "click" | "submit" | "reveal"
      flyer_category: "business" | "event" | "realtor"
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
        "product_grid",
        "novel",
        "realtor_gallery",
      ],
      app_role: ["admin", "user", "editor", "realtor"],
      appointment_status: ["confirmed", "cancelled"],
      event_type: ["view", "click", "submit", "reveal"],
      flyer_category: ["business", "event", "realtor"],
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
