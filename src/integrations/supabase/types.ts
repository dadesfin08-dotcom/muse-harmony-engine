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
      announcements: {
        Row: {
          bg_color: string | null
          content: string
          content_ar: string | null
          content_fr: string | null
          created_at: string
          end_date: string | null
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          message_ar: string | null
          message_en: string | null
          message_fr: string | null
          messages_ar: string[]
          messages_en: string[]
          messages_fr: string[]
          sort_order: number
          start_date: string | null
          text_color: string | null
          title: string
          updated_at: string
        }
        Insert: {
          bg_color?: string | null
          content: string
          content_ar?: string | null
          content_fr?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          message_ar?: string | null
          message_en?: string | null
          message_fr?: string | null
          messages_ar?: string[]
          messages_en?: string[]
          messages_fr?: string[]
          sort_order?: number
          start_date?: string | null
          text_color?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          bg_color?: string | null
          content?: string
          content_ar?: string | null
          content_fr?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          message_ar?: string | null
          message_en?: string | null
          message_fr?: string | null
          messages_ar?: string[]
          messages_en?: string[]
          messages_fr?: string[]
          sort_order?: number
          start_date?: string | null
          text_color?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      brand_analytics_events: {
        Row: {
          brand_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_analytics_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_scores: {
        Row: {
          active_until: string
          base_score: number
          brand_id: string
          is_blacklisted: boolean
          is_trending: boolean
          last_auto_renewed_at: string | null
          last_updated: string
          manual_boost_until: string | null
          trending_velocity: number
        }
        Insert: {
          active_until?: string
          base_score?: number
          brand_id: string
          is_blacklisted?: boolean
          is_trending?: boolean
          last_auto_renewed_at?: string | null
          last_updated?: string
          manual_boost_until?: string | null
          trending_velocity?: number
        }
        Update: {
          active_until?: string
          base_score?: number
          brand_id?: string
          is_blacklisted?: boolean
          is_trending?: boolean
          last_auto_renewed_at?: string | null
          last_updated?: string
          manual_boost_until?: string | null
          trending_velocity?: number
        }
        Relationships: [
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name_ar: string | null
          name_en: string
          name_fr: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name_ar?: string | null
          name_en: string
          name_fr?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name_ar?: string | null
          name_en?: string
          name_fr?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      carnet_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          vendor_carnet_id: string
          vendor_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          vendor_carnet_id: string
          vendor_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          vendor_carnet_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carnet_payments_vendor_carnet_id_fkey"
            columns: ["vendor_carnet_id"]
            isOneToOne: false
            referencedRelation: "vendor_carnet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carnet_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      carnet_transactions: {
        Row: {
          amount: number
          created_at: string
          customer_phone: string
          id: string
          metadata: Json
          order_id: string | null
          payment_id: string | null
          transaction_type: Database["public"]["Enums"]["carnet_transaction_type"]
          vendor_carnet_id: string | null
          vendor_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_phone: string
          id?: string
          metadata?: Json
          order_id?: string | null
          payment_id?: string | null
          transaction_type: Database["public"]["Enums"]["carnet_transaction_type"]
          vendor_carnet_id?: string | null
          vendor_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_phone?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          payment_id?: string | null
          transaction_type?: Database["public"]["Enums"]["carnet_transaction_type"]
          vendor_carnet_id?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carnet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carnet_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "carnet_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carnet_transactions_vendor_carnet_id_fkey"
            columns: ["vendor_carnet_id"]
            isOneToOne: false
            referencedRelation: "vendor_carnet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carnet_transactions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          accent_color: string | null
          apply_platform_markup: boolean
          created_at: string
          icon_name: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name_ar: string | null
          name_en: string
          name_fr: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          apply_platform_markup?: boolean
          created_at?: string
          icon_name?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_ar?: string | null
          name_en: string
          name_fr?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          apply_platform_markup?: boolean
          created_at?: string
          icon_name?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_ar?: string | null
          name_en?: string
          name_fr?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      communes: {
        Row: {
          created_at: string
          id: string
          name_ar: string | null
          name_en: string
          name_fr: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_ar?: string | null
          name_en: string
          name_fr?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name_ar?: string | null
          name_en?: string
          name_fr?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          neighborhood_id: string | null
          phone_number: string | null
          saved_instructions: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          neighborhood_id?: string | null
          phone_number?: string | null
          saved_instructions?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          neighborhood_id?: string | null
          phone_number?: string | null
          saved_instructions?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cyclist_coverage: {
        Row: {
          created_at: string
          cyclist_id: string
          id: string
          neighborhood_id: string
        }
        Insert: {
          created_at?: string
          cyclist_id: string
          id?: string
          neighborhood_id: string
        }
        Update: {
          created_at?: string
          cyclist_id?: string
          id?: string
          neighborhood_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cyclist_coverage_cyclist_id_fkey"
            columns: ["cyclist_id"]
            isOneToOne: false
            referencedRelation: "cyclists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cyclist_coverage_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
        ]
      }
      cyclists: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          phone_number: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          phone_number: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone_number?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cyclists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      global_settings: {
        Row: {
          created_at: string
          free_delivery_threshold: number
          global_delivery_fee: number
          id: string
          marketplace_active: boolean
          minimum_order_amount: number
          site_logo_url: string | null
          site_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          free_delivery_threshold?: number
          global_delivery_fee?: number
          id?: string
          marketplace_active?: boolean
          minimum_order_amount?: number
          site_logo_url?: string | null
          site_name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          free_delivery_threshold?: number
          global_delivery_fee?: number
          id?: string
          marketplace_active?: boolean
          minimum_order_amount?: number
          site_logo_url?: string | null
          site_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_settings: {
        Row: {
          address: string | null
          created_at: string
          footer_message: string | null
          id: string
          phone: string | null
          receipt_address: string | null
          receipt_footer_message: string | null
          receipt_logo_url: string | null
          receipt_phone: string | null
          receipt_slogan: string | null
          receipt_social_support: string | null
          receipt_store_name: string | null
          receipt_website: string | null
          store_name: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          footer_message?: string | null
          id?: string
          phone?: string | null
          receipt_address?: string | null
          receipt_footer_message?: string | null
          receipt_logo_url?: string | null
          receipt_phone?: string | null
          receipt_slogan?: string | null
          receipt_social_support?: string | null
          receipt_store_name?: string | null
          receipt_website?: string | null
          store_name?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          footer_message?: string | null
          id?: string
          phone?: string | null
          receipt_address?: string | null
          receipt_footer_message?: string | null
          receipt_logo_url?: string | null
          receipt_phone?: string | null
          receipt_slogan?: string | null
          receipt_social_support?: string | null
          receipt_store_name?: string | null
          receipt_website?: string | null
          store_name?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      markup_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          markup_type: Database["public"]["Enums"]["markup_type"]
          markup_value: number
          max_price: number
          min_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          markup_type: Database["public"]["Enums"]["markup_type"]
          markup_value: number
          max_price: number
          min_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          markup_type?: Database["public"]["Enums"]["markup_type"]
          markup_value?: number
          max_price?: number
          min_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      master_products: {
        Row: {
          apply_platform_markup: boolean
          barcode: string | null
          brand_id: string | null
          category: Database["public"]["Enums"]["product_category"]
          category_id: string | null
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          measurement_unit: Database["public"]["Enums"]["measurement_unit"]
          measurement_value: number | null
          name_ar: string | null
          name_fr: string | null
          popularity_score: number
          product_name: string
          product_variants: string[]
          updated_at: string
        }
        Insert: {
          apply_platform_markup?: boolean
          barcode?: string | null
          brand_id?: string | null
          category: Database["public"]["Enums"]["product_category"]
          category_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          measurement_unit: Database["public"]["Enums"]["measurement_unit"]
          measurement_value?: number | null
          name_ar?: string | null
          name_fr?: string | null
          popularity_score?: number
          product_name: string
          product_variants?: string[]
          updated_at?: string
        }
        Update: {
          apply_platform_markup?: boolean
          barcode?: string | null
          brand_id?: string | null
          category?: Database["public"]["Enums"]["product_category"]
          category_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          measurement_unit?: Database["public"]["Enums"]["measurement_unit"]
          measurement_value?: number | null
          name_ar?: string | null
          name_fr?: string | null
          popularity_score?: number
          product_name?: string
          product_variants?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhoods: {
        Row: {
          commune_id: string
          created_at: string
          delivery_fee: number
          id: string
          name_ar: string | null
          name_en: string
          name_fr: string | null
          updated_at: string
          vendor_id: string | null
          zone_code: string
        }
        Insert: {
          commune_id: string
          created_at?: string
          delivery_fee?: number
          id?: string
          name_ar?: string | null
          name_en: string
          name_fr?: string | null
          updated_at?: string
          vendor_id?: string | null
          zone_code: string
        }
        Update: {
          commune_id?: string
          created_at?: string
          delivery_fee?: number
          id?: string
          name_ar?: string | null
          name_en?: string
          name_fr?: string | null
          updated_at?: string
          vendor_id?: string | null
          zone_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "neighborhoods_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neighborhoods_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      order_audit_logs: {
        Row: {
          actor_role: string | null
          actor_user_id: string | null
          created_at: string
          cyclist_id: string | null
          event_type: string
          id: string
          new_status: Database["public"]["Enums"]["order_status"] | null
          order_id: string | null
          previous_status: Database["public"]["Enums"]["order_status"] | null
          settlement_context: Json
          source: string
          vendor_id: string | null
        }
        Insert: {
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          cyclist_id?: string | null
          event_type: string
          id?: string
          new_status?: Database["public"]["Enums"]["order_status"] | null
          order_id?: string | null
          previous_status?: Database["public"]["Enums"]["order_status"] | null
          settlement_context?: Json
          source?: string
          vendor_id?: string | null
        }
        Update: {
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          cyclist_id?: string | null
          event_type?: string
          id?: string
          new_status?: Database["public"]["Enums"]["order_status"] | null
          order_id?: string | null
          previous_status?: Database["public"]["Enums"]["order_status"] | null
          settlement_context?: Json
          source?: string
          vendor_id?: string | null
        }
        Relationships: []
      }
      order_push_events: {
        Row: {
          attempts: number
          created_at: string
          customer_user_id: string | null
          event_type: string
          failed_at: string | null
          id: string
          last_error: string | null
          neighborhood_id: string | null
          order_id: string
          payload: Json
          processed_at: string | null
          processing_started_at: string | null
          status_after: string | null
          status_before: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          customer_user_id?: string | null
          event_type: string
          failed_at?: string | null
          id?: string
          last_error?: string | null
          neighborhood_id?: string | null
          order_id: string
          payload?: Json
          processed_at?: string | null
          processing_started_at?: string | null
          status_after?: string | null
          status_before?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          customer_user_id?: string | null
          event_type?: string
          failed_at?: string | null
          id?: string
          last_error?: string | null
          neighborhood_id?: string | null
          order_id?: string
          payload?: Json
          processed_at?: string | null
          processing_started_at?: string | null
          status_after?: string | null
          status_before?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          admin_settled: boolean
          cash_to_collect_from_customer: number
          created_at: string
          customer_name: string
          customer_phone: string | null
          customer_user_id: string
          cyclist_id: string | null
          delivered_at: string | null
          delivery_auth_code: string
          delivery_fee: number
          delivery_notes: string
          id: string
          item_count: number
          neighborhood_id: string | null
          order_category: Database["public"]["Enums"]["order_category"]
          order_items: Json
          payment_method: Database["public"]["Enums"]["payment_method"]
          platform_markup: number
          platform_profit: number
          status: Database["public"]["Enums"]["order_status"]
          subscription_id: string | null
          subtotal_base_price: number
          total_price: number
          updated_at: string
          vendor_id: string | null
          vendor_revenue: number
          vendor_settlement_status: Database["public"]["Enums"]["vendor_settlement_status"]
        }
        Insert: {
          admin_settled?: boolean
          cash_to_collect_from_customer?: number
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          customer_user_id: string
          cyclist_id?: string | null
          delivered_at?: string | null
          delivery_auth_code?: string
          delivery_fee?: number
          delivery_notes?: string
          id?: string
          item_count?: number
          neighborhood_id?: string | null
          order_category?: Database["public"]["Enums"]["order_category"]
          order_items?: Json
          payment_method?: Database["public"]["Enums"]["payment_method"]
          platform_markup?: number
          platform_profit?: number
          status?: Database["public"]["Enums"]["order_status"]
          subscription_id?: string | null
          subtotal_base_price?: number
          total_price?: number
          updated_at?: string
          vendor_id?: string | null
          vendor_revenue?: number
          vendor_settlement_status?: Database["public"]["Enums"]["vendor_settlement_status"]
        }
        Update: {
          admin_settled?: boolean
          cash_to_collect_from_customer?: number
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          customer_user_id?: string
          cyclist_id?: string | null
          delivered_at?: string | null
          delivery_auth_code?: string
          delivery_fee?: number
          delivery_notes?: string
          id?: string
          item_count?: number
          neighborhood_id?: string | null
          order_category?: Database["public"]["Enums"]["order_category"]
          order_items?: Json
          payment_method?: Database["public"]["Enums"]["payment_method"]
          platform_markup?: number
          platform_profit?: number
          status?: Database["public"]["Enums"]["order_status"]
          subscription_id?: string | null
          subtotal_base_price?: number
          total_price?: number
          updated_at?: string
          vendor_id?: string | null
          vendor_revenue?: number
          vendor_settlement_status?: Database["public"]["Enums"]["vendor_settlement_status"]
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_user_id_fkey"
            columns: ["customer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_cyclist_id_fkey"
            columns: ["cyclist_id"]
            isOneToOne: false
            referencedRelation: "cyclists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "platform_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_requests: {
        Row: {
          created_at: string
          id: string
          otp_code: string
          phone_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          otp_code: string
          phone_number: string
        }
        Update: {
          created_at?: string
          id?: string
          otp_code?: string
          phone_number?: string
        }
        Relationships: []
      }
      pack_features: {
        Row: {
          created_at: string
          feature_data: Json | null
          feature_label: string
          id: string
          pack_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          feature_data?: Json | null
          feature_label: string
          id?: string
          pack_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          feature_data?: Json | null
          feature_label?: string
          id?: string
          pack_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_features_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "platform_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_items: {
        Row: {
          created_at: string
          id: string
          item_data: Json | null
          item_label: string
          pack_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_data?: Json | null
          item_label: string
          pack_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_data?: Json | null
          item_label?: string
          pack_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_items_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "platform_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_collections: {
        Row: {
          amount: number
          collected_by_user_id: string | null
          created_at: string
          id: string
          qr_payload: Json | null
          vendor_id: string
        }
        Insert: {
          amount: number
          collected_by_user_id?: string | null
          created_at?: string
          id?: string
          qr_payload?: Json | null
          vendor_id: string
        }
        Update: {
          amount?: number
          collected_by_user_id?: string | null
          created_at?: string
          id?: string
          qr_payload?: Json | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_collections_collected_by_user_id_fkey"
            columns: ["collected_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_collections_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_commission_ledger: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          order_id: string | null
          transaction_type: Database["public"]["Enums"]["platform_commission_transaction_type"]
          vendor_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string | null
          transaction_type: Database["public"]["Enums"]["platform_commission_transaction_type"]
          vendor_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string | null
          transaction_type?: Database["public"]["Enums"]["platform_commission_transaction_type"]
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_commission_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_commission_ledger_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_packs: {
        Row: {
          base_price_mad: number
          billing_cycle: Database["public"]["Enums"]["pack_billing_cycle"]
          created_at: string
          delivery_window: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name_ar: string | null
          name_en: string
          name_fr: string | null
          price_per_unit: number
          unit_type: string
          updated_at: string
        }
        Insert: {
          base_price_mad?: number
          billing_cycle?: Database["public"]["Enums"]["pack_billing_cycle"]
          created_at?: string
          delivery_window?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_ar?: string | null
          name_en: string
          name_fr?: string | null
          price_per_unit?: number
          unit_type: string
          updated_at?: string
        }
        Update: {
          base_price_mad?: number
          billing_cycle?: Database["public"]["Enums"]["pack_billing_cycle"]
          created_at?: string
          delivery_window?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_ar?: string | null
          name_en?: string
          name_fr?: string | null
          price_per_unit?: number
          unit_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_subscriptions: {
        Row: {
          agreed_price: number | null
          completed_deliveries: number
          contact_phone: string | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          customer_user_id: string
          deliveries_completed: number
          deliveries_expected: number
          delivery_address: string | null
          expiration_date: string | null
          id: string
          lifetime_revenue_mad: number
          next_scheduled_delivery_date: string | null
          notes: string | null
          pack_id: string
          pack_quantity: number
          start_date: string
          status: Database["public"]["Enums"]["platform_subscription_status"]
          total_deliveries: number | null
          updated_at: string
        }
        Insert: {
          agreed_price?: number | null
          completed_deliveries?: number
          contact_phone?: string | null
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          customer_user_id: string
          deliveries_completed?: number
          deliveries_expected?: number
          delivery_address?: string | null
          expiration_date?: string | null
          id?: string
          lifetime_revenue_mad?: number
          next_scheduled_delivery_date?: string | null
          notes?: string | null
          pack_id: string
          pack_quantity?: number
          start_date?: string
          status?: Database["public"]["Enums"]["platform_subscription_status"]
          total_deliveries?: number | null
          updated_at?: string
        }
        Update: {
          agreed_price?: number | null
          completed_deliveries?: number
          contact_phone?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          customer_user_id?: string
          deliveries_completed?: number
          deliveries_expected?: number
          delivery_address?: string | null
          expiration_date?: string | null
          id?: string
          lifetime_revenue_mad?: number
          next_scheduled_delivery_date?: string | null
          notes?: string | null
          pack_id?: string
          pack_quantity?: number
          start_date?: string
          status?: Database["public"]["Enums"]["platform_subscription_status"]
          total_deliveries?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_subscriptions_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "platform_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          full_name: string | null
          id: string
          neighborhood_id: string | null
          phone: string | null
          preferred_language: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id: string
          neighborhood_id?: string | null
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id?: string
          neighborhood_id?: string | null
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_location: string | null
          p256dh: string
          user_id: string
          user_role: string | null
          user_type: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_location?: string | null
          p256dh: string
          user_id: string
          user_role?: string | null
          user_type: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_location?: string | null
          p256dh?: string
          user_id?: string
          user_role?: string | null
          user_type?: string
        }
        Relationships: []
      }
      site_ads: {
        Row: {
          bg_color: string | null
          campaign_name: string
          campaign_type: Database["public"]["Enums"]["campaign_type"]
          content: string
          content_ar: string | null
          content_fr: string | null
          created_at: string
          end_date: string | null
          id: string
          image_ar: string | null
          image_en: string | null
          image_fr: string | null
          image_url: string | null
          is_active: boolean
          link_url: string | null
          sort_order: number
          start_date: string | null
          target_url: string | null
          target_zone_ids: string[] | null
          text_color: string | null
          updated_at: string
          views_count: number
        }
        Insert: {
          bg_color?: string | null
          campaign_name?: string
          campaign_type?: Database["public"]["Enums"]["campaign_type"]
          content: string
          content_ar?: string | null
          content_fr?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          image_ar?: string | null
          image_en?: string | null
          image_fr?: string | null
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          start_date?: string | null
          target_url?: string | null
          target_zone_ids?: string[] | null
          text_color?: string | null
          updated_at?: string
          views_count?: number
        }
        Update: {
          bg_color?: string | null
          campaign_name?: string
          campaign_type?: Database["public"]["Enums"]["campaign_type"]
          content?: string
          content_ar?: string | null
          content_fr?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          image_ar?: string | null
          image_en?: string | null
          image_fr?: string | null
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          start_date?: string | null
          target_url?: string | null
          target_zone_ids?: string[] | null
          text_color?: string | null
          updated_at?: string
          views_count?: number
        }
        Relationships: []
      }
      trending_history: {
        Row: {
          brand_id: string | null
          id: number
          recorded_at: string
          score: number
        }
        Insert: {
          brand_id?: string | null
          id?: number
          recorded_at?: string
          score?: number
        }
        Update: {
          brand_id?: string | null
          id?: number
          recorded_at?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "trending_history_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_carnet: {
        Row: {
          created_at: string
          current_debt: number
          customer_cin: string | null
          customer_name: string | null
          customer_phone: string
          id: string
          max_limit: number
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          current_debt?: number
          customer_cin?: string | null
          customer_name?: string | null
          customer_phone: string
          id?: string
          max_limit?: number
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          current_debt?: number
          customer_cin?: string | null
          customer_name?: string | null
          customer_phone?: string
          id?: string
          max_limit?: number
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_carnet_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_products: {
        Row: {
          category_id: string | null
          created_at: string
          flash_sale_end_time: string | null
          flash_sale_price: number | null
          id: string
          image_url: string | null
          is_active: boolean
          is_available: boolean
          is_flash_sale: boolean
          master_product_id: string
          measurement_unit:
            | Database["public"]["Enums"]["measurement_unit"]
            | null
          name_ar: string | null
          name_fr: string | null
          popularity_score: number
          updated_at: string
          vendor_id: string
          vendor_price: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          flash_sale_end_time?: string | null
          flash_sale_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_available?: boolean
          is_flash_sale?: boolean
          master_product_id: string
          measurement_unit?:
            | Database["public"]["Enums"]["measurement_unit"]
            | null
          name_ar?: string | null
          name_fr?: string | null
          popularity_score?: number
          updated_at?: string
          vendor_id: string
          vendor_price?: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          flash_sale_end_time?: string | null
          flash_sale_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_available?: boolean
          is_flash_sale?: boolean
          master_product_id?: string
          measurement_unit?:
            | Database["public"]["Enums"]["measurement_unit"]
            | null
          name_ar?: string | null
          name_fr?: string | null
          popularity_score?: number
          updated_at?: string
          vendor_id?: string
          vendor_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendor_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_products_master_product_id_fkey"
            columns: ["master_product_id"]
            isOneToOne: false
            referencedRelation: "master_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_service_zones: {
        Row: {
          created_at: string
          id: string
          neighborhood_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          neighborhood_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          neighborhood_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_service_zones_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_service_zones_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          assigned_categories: string[]
          created_at: string
          id: string
          is_active: boolean
          neighborhood_id: string | null
          owner_name: string | null
          phone_number: string
          platform_dues: number
          store_name: string
          total_cash_received: number
          updated_at: string
          user_id: string | null
          vendor_earnings: number
          vendor_type: string
        }
        Insert: {
          assigned_categories?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          neighborhood_id?: string | null
          owner_name?: string | null
          phone_number: string
          platform_dues?: number
          store_name: string
          total_cash_received?: number
          updated_at?: string
          user_id?: string | null
          vendor_earnings?: number
          vendor_type?: string
        }
        Update: {
          assigned_categories?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          neighborhood_id?: string | null
          owner_name?: string | null
          phone_number?: string
          platform_dues?: number
          store_name?: string
          total_cash_received?: number
          updated_at?: string
          user_id?: string | null
          vendor_earnings?: number
          vendor_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_order_push_events: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          created_at: string
          customer_user_id: string | null
          event_type: string
          failed_at: string | null
          id: string
          last_error: string | null
          neighborhood_id: string | null
          order_id: string
          payload: Json
          processed_at: string | null
          processing_started_at: string | null
          status_after: string | null
          status_before: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "order_push_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      collect_platform_dues: {
        Args: {
          p_amount: number
          p_collected_by_user_id?: string
          p_qr_payload?: Json
          p_vendor_id: string
        }
        Returns: {
          collected_amount: number
          remaining_dues: number
          transaction_id: string
        }[]
      }
      complete_delivery_and_apply_payment: {
        Args: { p_cyclist_id: string; p_order_id: string }
        Returns: {
          new_status: string
          order_id: string
        }[]
      }
      compute_brand_score: {
        Args: {
          p_cart: number
          p_orders: number
          p_search: number
          p_views: number
        }
        Returns: number
      }
      confirm_cash_transferred_to_vendor: {
        Args: { p_cyclist_id: string; p_vendor_id: string }
        Returns: {
          platform_dues_added: number
          settled_orders_count: number
          total_cash_received_added: number
          vendor_earnings_added: number
        }[]
      }
      increment_campaign_view: {
        Args: { campaign_id_input: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      map_order_status_to_push_event: {
        Args: { _status: string }
        Returns: string
      }
      recompute_vendor_carnet_customer_debt: {
        Args: { p_customer_phone: string; p_vendor_id: string }
        Returns: number
      }
      record_brand_event: {
        Args: {
          p_brand_id: string
          p_event_type: string
          p_metadata?: Json
          p_user_id: string
        }
        Returns: string
      }
      record_vendor_carnet_payment: {
        Args: {
          p_amount: number
          p_customer_phone: string
          p_vendor_id: string
        }
        Returns: {
          payment_id: string
          remaining_debt: number
        }[]
      }
      refresh_brand_scores: {
        Args: never
        Returns: {
          active_until: string
          base_score: number
          brand_id: string
          is_trending: boolean
          trending_velocity: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      campaign_type: "AD" | "PROMO" | "NEWS"
      carnet_transaction_type:
        | "CREDIT_ISSUED"
        | "CREDIT_REPAID"
        | "CREDIT_CANCELLED"
      markup_type: "fixed" | "percentage"
      measurement_unit:
        | "Kg"
        | "Liter"
        | "Piece"
        | "Pack"
        | "Gram"
        | "Bunch"
        | "Tray"
        | "Box"
      order_category: "MARKETPLACE" | "PLATFORM_SUBSCRIPTION"
      order_status:
        | "new"
        | "preparing"
        | "ready"
        | "delivering"
        | "delivered"
        | "cancelled"
        | "delivered_cash_with_cyclist"
        | "cash_transferred_to_vendor"
      pack_billing_cycle: "DAILY" | "WEEKLY" | "MONTHLY"
      payment_method: "COD" | "Carnet"
      platform_commission_transaction_type: "ACCRUAL" | "WITHDRAWAL"
      platform_subscription_status:
        | "active"
        | "paused"
        | "expired"
        | "cancelled"
        | "pending"
        | "completed"
      product_category:
        | "Vegetables"
        | "Fruits"
        | "Dairy"
        | "Bakery"
        | "Pantry"
        | "Groceries"
        | "Vegetables & Fruits"
        | "Meat & Poultry"
        | "Bakery & Pastry"
        | "Dairy & Eggs"
        | "Drinks & Water"
        | "Cleaning Supplies"
      vendor_settlement_status: "pending" | "settled"
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
      app_role: ["admin", "moderator", "user"],
      campaign_type: ["AD", "PROMO", "NEWS"],
      carnet_transaction_type: [
        "CREDIT_ISSUED",
        "CREDIT_REPAID",
        "CREDIT_CANCELLED",
      ],
      markup_type: ["fixed", "percentage"],
      measurement_unit: [
        "Kg",
        "Liter",
        "Piece",
        "Pack",
        "Gram",
        "Bunch",
        "Tray",
        "Box",
      ],
      order_category: ["MARKETPLACE", "PLATFORM_SUBSCRIPTION"],
      order_status: [
        "new",
        "preparing",
        "ready",
        "delivering",
        "delivered",
        "cancelled",
        "delivered_cash_with_cyclist",
        "cash_transferred_to_vendor",
      ],
      pack_billing_cycle: ["DAILY", "WEEKLY", "MONTHLY"],
      payment_method: ["COD", "Carnet"],
      platform_commission_transaction_type: ["ACCRUAL", "WITHDRAWAL"],
      platform_subscription_status: [
        "active",
        "paused",
        "expired",
        "cancelled",
        "pending",
        "completed",
      ],
      product_category: [
        "Vegetables",
        "Fruits",
        "Dairy",
        "Bakery",
        "Pantry",
        "Groceries",
        "Vegetables & Fruits",
        "Meat & Poultry",
        "Bakery & Pastry",
        "Dairy & Eggs",
        "Drinks & Water",
        "Cleaning Supplies",
      ],
      vendor_settlement_status: ["pending", "settled"],
    },
  },
} as const
