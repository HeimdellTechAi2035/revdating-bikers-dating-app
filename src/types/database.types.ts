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
      admin_actions: {
        Row: {
          action: Database["public"]["Enums"]["admin_action_type"]
          admin_id: string
          created_at: string
          id: string
          metadata: Json | null
          reason: string | null
          target_user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["admin_action_type"]
          admin_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["admin_action_type"]
          admin_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["admin_role_type"]
        }
        Insert: {
          created_at?: string
          id: string
          role?: Database["public"]["Enums"]["admin_role_type"]
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["admin_role_type"]
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bikes: {
        Row: {
          bike_brand: string
          bike_model: string
          bike_type: Database["public"]["Enums"]["bike_type_type"]
          bike_year: number | null
          created_at: string
          engine_size_cc: number | null
          id: string
          notes: string | null
          owned_or_dream: Database["public"]["Enums"]["owned_or_dream_type"]
          photo_url: string | null
          primary_bike: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          bike_brand: string
          bike_model: string
          bike_type: Database["public"]["Enums"]["bike_type_type"]
          bike_year?: number | null
          created_at?: string
          engine_size_cc?: number | null
          id?: string
          notes?: string | null
          owned_or_dream?: Database["public"]["Enums"]["owned_or_dream_type"]
          photo_url?: string | null
          primary_bike?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          bike_brand?: string
          bike_model?: string
          bike_type?: Database["public"]["Enums"]["bike_type_type"]
          bike_year?: number | null
          created_at?: string
          engine_size_cc?: number | null
          id?: string
          notes?: string | null
          owned_or_dream?: Database["public"]["Enums"]["owned_or_dream_type"]
          photo_url?: string | null
          primary_bike?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bikes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_logs: {
        Row: {
          consent_type: string
          consented: boolean
          created_at: string
          id: string
          ip_hash: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
          version: string
        }
        Insert: {
          consent_type: string
          consented: boolean
          created_at?: string
          id?: string
          ip_hash?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          version?: string
        }
        Update: {
          consent_type?: string
          consented?: boolean
          created_at?: string
          id?: string
          ip_hash?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_swipe_counts: {
        Row: {
          count: number
          reset_date: string
          user_id: string
        }
        Insert: {
          count?: number
          reset_date?: string
          user_id: string
        }
        Update: {
          count?: number
          reset_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_swipe_counts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_deletion_requests: {
        Row: {
          completed_at: string | null
          email: string
          id: string
          notes: string | null
          reason: string | null
          requested_at: string
          status: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          email: string
          id?: string
          notes?: string | null
          reason?: string | null
          requested_at?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          email?: string
          id?: string
          notes?: string | null
          reason?: string | null
          requested_at?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      data_export_requests: {
        Row: {
          completed_at: string | null
          email: string
          id: string
          ip_hash: string | null
          notes: string | null
          requested_at: string
          status: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          email: string
          id?: string
          ip_hash?: string | null
          notes?: string | null
          requested_at?: string
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          email?: string
          id?: string
          ip_hash?: string | null
          notes?: string | null
          requested_at?: string
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_export_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_filters: {
        Row: {
          bike_types: Database["public"]["Enums"]["bike_type_type"][] | null
          club_types: Database["public"]["Enums"]["club_type_type"][] | null
          dating_intents:
            | Database["public"]["Enums"]["dating_intent_type"][]
            | null
          riding_styles:
            | Database["public"]["Enums"]["riding_style_type"][]
            | null
          updated_at: string
          user_id: string
          verified_only: boolean
        }
        Insert: {
          bike_types?: Database["public"]["Enums"]["bike_type_type"][] | null
          club_types?: Database["public"]["Enums"]["club_type_type"][] | null
          dating_intents?:
            | Database["public"]["Enums"]["dating_intent_type"][]
            | null
          riding_styles?:
            | Database["public"]["Enums"]["riding_style_type"][]
            | null
          updated_at?: string
          user_id: string
          verified_only?: boolean
        }
        Update: {
          bike_types?: Database["public"]["Enums"]["bike_type_type"][] | null
          club_types?: Database["public"]["Enums"]["club_type_type"][] | null
          dating_intents?:
            | Database["public"]["Enums"]["dating_intent_type"][]
            | null
          riding_styles?:
            | Database["public"]["Enums"]["riding_style_type"][]
            | null
          updated_at?: string
          user_id?: string
          verified_only?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "discovery_filters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engine_revs: {
        Row: {
          created_at: string
          giver_id: string
          id: string
          receiver_id: string
        }
        Insert: {
          created_at?: string
          giver_id: string
          id?: string
          receiver_id: string
        }
        Update: {
          created_at?: string
          giver_id?: string
          id?: string
          receiver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engine_revs_giver_id_fkey"
            columns: ["giver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engine_revs_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      illegal_content_reports: {
        Row: {
          category: string
          content_id: string | null
          content_type: string
          description: string
          id: string
          reported_at: string
          reported_user_id: string | null
          reporter_id: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          status: string
        }
        Insert: {
          category: string
          content_id?: string | null
          content_type: string
          description: string
          id?: string
          reported_at?: string
          reported_user_id?: string | null
          reporter_id?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string
        }
        Update: {
          category?: string
          content_id?: string | null
          content_type?: string
          description?: string
          id?: string
          reported_at?: string
          reported_user_id?: string | null
          reporter_id?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "illegal_content_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "illegal_content_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "illegal_content_reports_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_message_at: string | null
          user1_id: string
          user1_superliked: boolean
          user2_id: string
          user2_superliked: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_message_at?: string | null
          user1_id: string
          user1_superliked?: boolean
          user2_id: string
          user2_superliked?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_message_at?: string | null
          user1_id?: string
          user1_superliked?: boolean
          user2_id?: string
          user2_superliked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "matches_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          is_read: boolean
          match_id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_read?: boolean
          match_id: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_read?: boolean
          match_id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_boosts: {
        Row: {
          activated_at: string
          created_at: string
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          activated_at?: string
          created_at?: string
          expires_at: string
          id?: string
          user_id: string
        }
        Update: {
          activated_at?: string
          created_at?: string
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_boosts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_photos: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          moderation_provider: string | null
          moderation_response: Json | null
          moderation_status: Database["public"]["Enums"]["moderation_status_type"]
          public_url: string | null
          rejected_reason: string | null
          sort_order: number
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          moderation_provider?: string | null
          moderation_response?: Json | null
          moderation_status?: Database["public"]["Enums"]["moderation_status_type"]
          public_url?: string | null
          rejected_reason?: string | null
          sort_order?: number
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          moderation_provider?: string | null
          moderation_response?: Json | null
          moderation_status?: Database["public"]["Enums"]["moderation_status_type"]
          public_url?: string | null
          rejected_reason?: string | null
          sort_order?: number
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number | null
          attends_rallies: boolean | null
          ban_reason: string | null
          bio: string | null
          children_status: string | null
          city: string | null
          club_name: string | null
          club_status: string | null
          club_type: Database["public"]["Enums"]["club_type_type"]
          country: string
          created_at: string
          date_of_birth: string
          dating_intent:
            | Database["public"]["Enums"]["dating_intent_type"]
            | null
          display_name: string
          drinker: boolean | null
          email_notifications: boolean
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          gender: Database["public"]["Enums"]["gender_type"]
          has_passenger_helmet: boolean | null
          hide_exact_location: boolean
          id: string
          interested_in: Database["public"]["Enums"]["interested_in_type"]
          is_active: boolean
          is_admin: boolean
          is_banned: boolean
          is_premium: boolean
          is_verified: boolean
          last_active: string
          latitude: number | null
          location: unknown
          longitude: number | null
          max_distance_miles: number
          mood: string | null
          music_taste: string[] | null
          onboarding_complete: boolean
          onboarding_reminder_sent_at: string | null
          riding_style: Database["public"]["Enums"]["riding_style_type"] | null
          show_online_status: boolean
          smoker: boolean | null
          trust_status: Database["public"]["Enums"]["trust_status_type"]
          updated_at: string
          years_riding: number | null
        }
        Insert: {
          age?: number | null
          attends_rallies?: boolean | null
          ban_reason?: string | null
          bio?: string | null
          children_status?: string | null
          city?: string | null
          club_name?: string | null
          club_status?: string | null
          club_type?: Database["public"]["Enums"]["club_type_type"]
          country?: string
          created_at?: string
          date_of_birth: string
          dating_intent?:
            | Database["public"]["Enums"]["dating_intent_type"]
            | null
          display_name: string
          drinker?: boolean | null
          email_notifications?: boolean
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          gender: Database["public"]["Enums"]["gender_type"]
          has_passenger_helmet?: boolean | null
          hide_exact_location?: boolean
          id: string
          interested_in?: Database["public"]["Enums"]["interested_in_type"]
          is_active?: boolean
          is_admin?: boolean
          is_banned?: boolean
          is_premium?: boolean
          is_verified?: boolean
          last_active?: string
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          max_distance_miles?: number
          mood?: string | null
          music_taste?: string[] | null
          onboarding_complete?: boolean
          onboarding_reminder_sent_at?: string | null
          riding_style?: Database["public"]["Enums"]["riding_style_type"] | null
          show_online_status?: boolean
          smoker?: boolean | null
          trust_status?: Database["public"]["Enums"]["trust_status_type"]
          updated_at?: string
          years_riding?: number | null
        }
        Update: {
          age?: number | null
          attends_rallies?: boolean | null
          ban_reason?: string | null
          bio?: string | null
          children_status?: string | null
          city?: string | null
          club_name?: string | null
          club_status?: string | null
          club_type?: Database["public"]["Enums"]["club_type_type"]
          country?: string
          created_at?: string
          date_of_birth?: string
          dating_intent?:
            | Database["public"]["Enums"]["dating_intent_type"]
            | null
          display_name?: string
          drinker?: boolean | null
          email_notifications?: boolean
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          gender?: Database["public"]["Enums"]["gender_type"]
          has_passenger_helmet?: boolean | null
          hide_exact_location?: boolean
          id?: string
          interested_in?: Database["public"]["Enums"]["interested_in_type"]
          is_active?: boolean
          is_admin?: boolean
          is_banned?: boolean
          is_premium?: boolean
          is_verified?: boolean
          last_active?: string
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          max_distance_miles?: number
          mood?: string | null
          music_taste?: string[] | null
          onboarding_complete?: boolean
          onboarding_reminder_sent_at?: string | null
          riding_style?: Database["public"]["Enums"]["riding_style_type"] | null
          show_online_status?: boolean
          smoker?: boolean | null
          trust_status?: Database["public"]["Enums"]["trust_status_type"]
          updated_at?: string
          years_riding?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string | null
          id: string
          photo_id: string | null
          reason: Database["public"]["Enums"]["report_reason_type"]
          reported_id: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["report_status_type"]
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          photo_id?: string | null
          reason: Database["public"]["Enums"]["report_reason_type"]
          reported_id: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status_type"]
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          photo_id?: string | null
          reason?: Database["public"]["Enums"]["report_reason_type"]
          reported_id?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status_type"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "profile_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_id_fkey"
            columns: ["reported_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_dates: {
        Row: {
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          id: string
          location: string
          location_lat: number | null
          location_lng: number | null
          match_id: string
          route_data: Json | null
          route_summary: string | null
          scheduled_time: string
          status: string
          updated_at: string
          user_one: string
          user_two: string
        }
        Insert: {
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          location: string
          location_lat?: number | null
          location_lng?: number | null
          match_id: string
          route_data?: Json | null
          route_summary?: string | null
          scheduled_time: string
          status?: string
          updated_at?: string
          user_one: string
          user_two: string
        }
        Update: {
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          location?: string
          location_lat?: number | null
          location_lng?: number | null
          match_id?: string
          route_data?: Json | null
          route_summary?: string | null
          scheduled_time?: string
          status?: string
          updated_at?: string
          user_one?: string
          user_two?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_dates_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_dates_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_dates_user_one_fkey"
            columns: ["user_one"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_dates_user_two_fkey"
            columns: ["user_two"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_ratings: {
        Row: {
          created_at: string
          id: string
          photo_id: string
          rater_id: string
          stars: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          photo_id: string
          rater_id: string
          stars: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          photo_id?: string
          rater_id?: string
          stars?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_ratings_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "profile_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_checkins: {
        Row: {
          alert_sent_at: string | null
          created_at: string
          destination_lat: number | null
          destination_lng: number | null
          destination_name: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          expected_return_at: string
          id: string
          match_id: string | null
          resolved_at: string | null
          ride_description: string | null
          status: Database["public"]["Enums"]["checkin_status_type"]
          user_id: string
        }
        Insert: {
          alert_sent_at?: string | null
          created_at?: string
          destination_lat?: number | null
          destination_lng?: number | null
          destination_name?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          expected_return_at: string
          id?: string
          match_id?: string | null
          resolved_at?: string | null
          ride_description?: string | null
          status?: Database["public"]["Enums"]["checkin_status_type"]
          user_id: string
        }
        Update: {
          alert_sent_at?: string | null
          created_at?: string
          destination_lat?: number | null
          destination_lng?: number | null
          destination_name?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          expected_return_at?: string
          id?: string
          match_id?: string | null
          resolved_at?: string | null
          ride_description?: string | null
          status?: Database["public"]["Enums"]["checkin_status_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_checkins_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_name: string | null
          status: Database["public"]["Enums"]["subscription_status_type"]
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_name?: string | null
          status: Database["public"]["Enums"]["subscription_status_type"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_name?: string | null
          status?: Database["public"]["Enums"]["subscription_status_type"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      superlike_credits: {
        Row: {
          credits: number
          last_reset_at: string
          user_id: string
        }
        Insert: {
          credits?: number
          last_reset_at?: string
          user_id: string
        }
        Update: {
          credits?: number
          last_reset_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "superlike_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      swipes: {
        Row: {
          created_at: string
          id: string
          swipe_action: Database["public"]["Enums"]["swipe_action_type"]
          swiped_id: string
          swiper_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          swipe_action: Database["public"]["Enums"]["swipe_action_type"]
          swiped_id: string
          swiper_id: string
        }
        Update: {
          created_at?: string
          id?: string
          swipe_action?: Database["public"]["Enums"]["swipe_action_type"]
          swiped_id?: string
          swiper_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "swipes_swiped_id_fkey"
            columns: ["swiped_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swipes_swiper_id_fkey"
            columns: ["swiper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_name: Database["public"]["Enums"]["badge_name_type"]
          badge_type: Database["public"]["Enums"]["badge_type_type"]
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_name: Database["public"]["Enums"]["badge_name_type"]
          badge_type: Database["public"]["Enums"]["badge_type_type"]
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_name?: Database["public"]["Enums"]["badge_name_type"]
          badge_type?: Database["public"]["Enums"]["badge_type_type"]
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verifications: {
        Row: {
          admin_notes: string | null
          created_at: string
          document_path: string | null
          id: string
          provider: string | null
          provider_reference: string | null
          provider_response: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_path: string | null
          status: Database["public"]["Enums"]["verification_status_type"]
          updated_at: string
          user_id: string
          verification_type: Database["public"]["Enums"]["verification_type_type"]
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          document_path?: string | null
          id?: string
          provider?: string | null
          provider_reference?: string | null
          provider_response?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string | null
          status?: Database["public"]["Enums"]["verification_status_type"]
          updated_at?: string
          user_id: string
          verification_type: Database["public"]["Enums"]["verification_type_type"]
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          document_path?: string | null
          id?: string
          provider?: string | null
          provider_reference?: string | null
          provider_response?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string | null
          status?: Database["public"]["Enums"]["verification_status_type"]
          updated_at?: string
          user_id?: string
          verification_type?: Database["public"]["Enums"]["verification_type_type"]
        }
        Relationships: [
          {
            foreignKeyName: "verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      web_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      photo_rating_summaries: {
        Row: {
          avg_stars: number | null
          photo_id: string | null
          rating_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ride_ratings_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "profile_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_rev_counts: {
        Row: {
          rev_count: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engine_revs_receiver_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string | null
          email_confirmed: boolean | null
          id: string | null
          last_sign_in_at: string | null
          phone: string | null
          raw_user_meta_data: Json | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          email_confirmed?: never
          id?: string | null
          last_sign_in_at?: string | null
          phone?: string | null
          raw_user_meta_data?: Json | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          email_confirmed?: never
          id?: string | null
          last_sign_in_at?: string | null
          phone?: string | null
          raw_user_meta_data?: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      are_users_blocked: {
        Args: { p_user_a: string; p_user_b: string }
        Returns: boolean
      }
      award_badge: {
        Args: {
          p_badge: Database["public"]["Enums"]["badge_name_type"]
          p_type: Database["public"]["Enums"]["badge_type_type"]
          p_user_id: string
        }
        Returns: undefined
      }
      compute_trust_status: {
        Args: { p_user_id: string }
        Returns: Database["public"]["Enums"]["trust_status_type"]
      }
      delete_user_data: { Args: never; Returns: undefined }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      export_user_data: { Args: never; Returns: Json }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_discovery_candidates: {
        Args: {
          p_bike_types?: Database["public"]["Enums"]["bike_type_type"][]
          p_club_types?: Database["public"]["Enums"]["club_type_type"][]
          p_dating_intents?: Database["public"]["Enums"]["dating_intent_type"][]
          p_limit?: number
          p_riding_styles?: Database["public"]["Enums"]["riding_style_type"][]
          p_verified_only?: boolean
        }
        Returns: {
          age: number
          attends_rallies: boolean
          bio: string
          city: string
          club_status: string
          club_type: Database["public"]["Enums"]["club_type_type"]
          country: string
          dating_intent: Database["public"]["Enums"]["dating_intent_type"]
          display_name: string
          distance_miles: number
          drinker: boolean
          gender: Database["public"]["Enums"]["gender_type"]
          has_passenger_helmet: boolean
          id: string
          is_premium: boolean
          is_verified: boolean
          music_taste: string[]
          primary_bike_brand: string
          primary_bike_model: string
          primary_bike_type: Database["public"]["Enums"]["bike_type_type"]
          primary_photo_url: string
          riding_style: Database["public"]["Enums"]["riding_style_type"]
          smoker: boolean
          trust_status: Database["public"]["Enums"]["trust_status_type"]
          years_riding: number
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      is_admin: { Args: { p_user_id: string }; Returns: boolean }
      is_super_admin: { Args: { p_user_id: string }; Returns: boolean }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_messages_read: { Args: { p_match_id: string }; Returns: undefined }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      profile_field_unchanged: {
        Args: { p_field: string; p_new_value: boolean; p_user_id: string }
        Returns: boolean
      }
      record_swipe: {
        Args: {
          p_swipe_action: Database["public"]["Enums"]["swipe_action_type"]
          p_swiped_id: string
        }
        Returns: string
      }
      refresh_trust_status: { Args: { p_user_id: string }; Returns: undefined }
      set_premium_superlike_credits: {
        Args: { p_credits: number; p_user_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      update_overdue_safety_checkins: { Args: never; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      admin_action_type:
        | "ban"
        | "unban"
        | "warn"
        | "photo_rejected"
        | "photo_approved"
        | "report_actioned"
        | "report_dismissed"
        | "profile_note"
        | "verification_approved"
        | "verification_rejected"
      admin_role_type: "moderator" | "admin" | "super_admin"
      badge_name_type:
        | "first_match"
        | "five_matches"
        | "first_message"
        | "first_ride_date"
        | "verified_rider"
        | "trusted_rider"
        | "revved_up"
      badge_type_type: "social" | "communication" | "activity" | "trust"
      bike_type_type:
        | "cruiser"
        | "sport"
        | "touring"
        | "adventure"
        | "dirt"
        | "chopper"
        | "cafe_racer"
        | "bobber"
        | "naked"
        | "scooter"
        | "electric"
        | "other"
      checkin_status_type: "active" | "resolved" | "overdue" | "alert_sent"
      club_type_type: "MC" | "RC" | "independent" | "none"
      dating_intent_type:
        | "serious_relationship"
        | "casual_dating"
        | "riding_partner"
        | "friendship"
        | "open_to_anything"
      gender_type:
        | "man"
        | "woman"
        | "non_binary"
        | "other"
        | "prefer_not_to_say"
      interested_in_type: "men" | "women" | "everyone"
      moderation_status_type: "pending" | "approved" | "rejected"
      owned_or_dream_type: "owned" | "dream"
      report_reason_type:
        | "inappropriate_photos"
        | "harassment"
        | "fake_profile"
        | "underage"
        | "spam"
        | "hate_speech"
        | "other"
      report_status_type: "pending" | "reviewed" | "actioned" | "dismissed"
      riding_style_type:
        | "cruiser"
        | "sport"
        | "touring"
        | "adventure"
        | "dirt"
        | "chopper"
        | "cafe_racer"
        | "bobber"
        | "naked"
        | "scooter"
        | "electric"
        | "other"
      subscription_status_type:
        | "active"
        | "canceled"
        | "past_due"
        | "trialing"
        | "incomplete"
      swipe_action_type: "like" | "pass" | "superlike" | "rev"
      trust_status_type: "new_rider" | "active_rider" | "trusted_rider"
      verification_status_type: "pending" | "approved" | "rejected"
      verification_type_type:
        | "id_document"
        | "face_selfie"
        | "phone"
        | "social_link"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
      admin_action_type: [
        "ban",
        "unban",
        "warn",
        "photo_rejected",
        "photo_approved",
        "report_actioned",
        "report_dismissed",
        "profile_note",
        "verification_approved",
        "verification_rejected",
      ],
      admin_role_type: ["moderator", "admin", "super_admin"],
      badge_name_type: [
        "first_match",
        "five_matches",
        "first_message",
        "first_ride_date",
        "verified_rider",
        "trusted_rider",
        "revved_up",
      ],
      badge_type_type: ["social", "communication", "activity", "trust"],
      bike_type_type: [
        "cruiser",
        "sport",
        "touring",
        "adventure",
        "dirt",
        "chopper",
        "cafe_racer",
        "bobber",
        "naked",
        "scooter",
        "electric",
        "other",
      ],
      checkin_status_type: ["active", "resolved", "overdue", "alert_sent"],
      club_type_type: ["MC", "RC", "independent", "none"],
      dating_intent_type: [
        "serious_relationship",
        "casual_dating",
        "riding_partner",
        "friendship",
        "open_to_anything",
      ],
      gender_type: ["man", "woman", "non_binary", "other", "prefer_not_to_say"],
      interested_in_type: ["men", "women", "everyone"],
      moderation_status_type: ["pending", "approved", "rejected"],
      owned_or_dream_type: ["owned", "dream"],
      report_reason_type: [
        "inappropriate_photos",
        "harassment",
        "fake_profile",
        "underage",
        "spam",
        "hate_speech",
        "other",
      ],
      report_status_type: ["pending", "reviewed", "actioned", "dismissed"],
      riding_style_type: [
        "cruiser",
        "sport",
        "touring",
        "adventure",
        "dirt",
        "chopper",
        "cafe_racer",
        "bobber",
        "naked",
        "scooter",
        "electric",
        "other",
      ],
      subscription_status_type: [
        "active",
        "canceled",
        "past_due",
        "trialing",
        "incomplete",
      ],
      swipe_action_type: ["like", "pass", "superlike", "rev"],
      trust_status_type: ["new_rider", "active_rider", "trusted_rider"],
      verification_status_type: ["pending", "approved", "rejected"],
      verification_type_type: [
        "id_document",
        "face_selfie",
        "phone",
        "social_link",
      ],
    },
  },
} as const

// ─── Convenience type aliases ─────────────────────────────────────────────────
// Row types
export type ProfileRow = Database['public']['Tables']['profiles']['Row']
export type BikeRow = Database['public']['Tables']['bikes']['Row']
export type MatchRow = Database['public']['Tables']['matches']['Row']
export type MessageRow = Database['public']['Tables']['messages']['Row']
export type ProfilePhotoRow = Database['public']['Tables']['profile_photos']['Row']
export type RideDateRow = Database['public']['Tables']['ride_dates']['Row']
export type SafetyCheckinRow = Database['public']['Tables']['safety_checkins']['Row']
export type UserBadgeRow = Database['public']['Tables']['user_badges']['Row']

// Enum types
export type AdminActionType = Database['public']['Enums']['admin_action_type']
export type AdminRoleType = Database['public']['Enums']['admin_role_type']
export type BadgeNameType = Database['public']['Enums']['badge_name_type']
export type BadgeTypeCategory = Database['public']['Enums']['badge_type_type']
export type BikeTypeType = Database['public']['Enums']['bike_type_type']
export type ClubTypeType = Database['public']['Enums']['club_type_type']
export type DatingIntentType = Database['public']['Enums']['dating_intent_type']
export type GenderType = Database['public']['Enums']['gender_type']
export type InterestedInType = Database['public']['Enums']['interested_in_type']
export type ModerationStatus = Database['public']['Enums']['moderation_status_type']
export type OwnedOrDreamType = Database['public']['Enums']['owned_or_dream_type']
export type ReportReasonType = Database['public']['Enums']['report_reason_type']
export type ReportStatusType = Database['public']['Enums']['report_status_type']
export type RidingStyleType = Database['public']['Enums']['riding_style_type']
export type SubscriptionStatus = Database['public']['Enums']['subscription_status_type']
export type TrustStatusType = Database['public']['Enums']['trust_status_type']

// String-based types (not DB enums but used as literals)
export type RideDateStatusType = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed'

// DiscoveryCandidate — base shape consumed by swipe components and scoring engine
export interface DiscoveryCandidate {
  id: string
  display_name: string
  age: number | null
  gender: GenderType
  bio: string | null
  city: string | null
  country: string
  riding_style: RidingStyleType | null
  years_riding: number | null
  club_status: string | null
  club_type: ClubTypeType | null
  trust_status: TrustStatusType
  attends_rallies: boolean | null
  music_taste: string[] | null
  smoker: boolean | null
  drinker: boolean | null
  has_passenger_helmet: boolean | null
  is_verified: boolean
  is_premium: boolean
  dating_intent: DatingIntentType | null
  distance_miles: number | null
  primary_photo_url: string
  primary_bike_brand: string | null
  primary_bike_model: string | null
  primary_bike_type: BikeTypeType | null
  last_active?: string | null
  rev_count?: number
  mood?: string | null
  approved_bike_photo_urls?: string[]
  bikes?: unknown[]
  compatibility?: unknown
}
