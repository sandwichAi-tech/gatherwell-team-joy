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
      activity: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          payload: Json
          team_id: string
          type: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          team_id: string
          type: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          team_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_reactions: {
        Row: {
          activity_id: string
          created_at: string
          kind: string
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          kind: string
          user_id?: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_reactions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          note: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          note?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          note?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          created_at: string
          feature: string
          id: string
          input_tokens: number
          output_tokens: number
          user_id: string
        }
        Insert: {
          created_at?: string
          feature: string
          id?: string
          input_tokens?: number
          output_tokens?: number
          user_id: string
        }
        Update: {
          created_at?: string
          feature?: string
          id?: string
          input_tokens?: number
          output_tokens?: number
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          photo_url: string | null
          pinned: boolean
          team_id: string
        }
        Insert: {
          author_id?: string
          body: string
          created_at?: string
          id?: string
          photo_url?: string | null
          pinned?: boolean
          team_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          photo_url?: string | null
          pinned?: boolean
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      auth_intents: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          path: string
          token_hash: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          path: string
          token_hash: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          path?: string
          token_hash?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          available_from: string | null
          available_until: string | null
          code: string
          created_at: string
          created_by: string | null
          description_en: string | null
          description_es: string | null
          event_id: string | null
          founding_limit: number | null
          icon: string
          id: string
          is_custom: boolean
          kind: string
          name_en: string
          name_es: string
          sort_order: number
          team_id: string | null
          tier: string
        }
        Insert: {
          available_from?: string | null
          available_until?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_es?: string | null
          event_id?: string | null
          founding_limit?: number | null
          icon?: string
          id?: string
          is_custom?: boolean
          kind?: string
          name_en: string
          name_es: string
          sort_order?: number
          team_id?: string | null
          tier?: string
        }
        Update: {
          available_from?: string | null
          available_until?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_es?: string | null
          event_id?: string | null
          founding_limit?: number | null
          icon?: string
          id?: string
          is_custom?: boolean
          kind?: string
          name_en?: string
          name_es?: string
          sort_order?: number
          team_id?: string | null
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "badges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "badges_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_accounts: {
        Row: {
          billing_period: string | null
          cancel_at_period_end: boolean
          connect_account_id: string | null
          connect_status: string
          created_at: string
          legacy_price_cents: number | null
          pass_fee: boolean
          pending_plan: string | null
          pending_plan_at: string | null
          plan: string
          renews_at: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_period?: string | null
          cancel_at_period_end?: boolean
          connect_account_id?: string | null
          connect_status?: string
          created_at?: string
          legacy_price_cents?: number | null
          pass_fee?: boolean
          pending_plan?: string | null
          pending_plan_at?: string | null
          plan?: string
          renews_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_period?: string | null
          cancel_at_period_end?: boolean
          connect_account_id?: string | null
          connect_status?: string
          created_at?: string
          legacy_price_cents?: number | null
          pass_fee?: boolean
          pending_plan?: string | null
          pending_plan_at?: string | null
          plan?: string
          renews_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      broadcast_reads: {
        Row: {
          broadcast_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          broadcast_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          broadcast_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_reads_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          active: boolean
          audience: string
          body_en: string
          body_es: string
          created_at: string
          created_by: string | null
          id: string
          is_test: boolean
          recipients: number
          title_en: string
          title_es: string
        }
        Insert: {
          active?: boolean
          audience: string
          body_en: string
          body_es: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_test?: boolean
          recipients?: number
          title_en: string
          title_es: string
        }
        Update: {
          active?: boolean
          audience?: string
          body_en?: string
          body_es?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_test?: boolean
          recipients?: number
          title_en?: string
          title_es?: string
        }
        Relationships: []
      }
      calendar_feeds: {
        Row: {
          created_at: string
          scope: string
          team_id: string | null
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          scope: string
          team_id?: string | null
          token?: string
          user_id: string
        }
        Update: {
          created_at?: string
          scope?: string
          team_id?: string | null
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_feeds_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_checkins: {
        Row: {
          challenge_id: string
          checkin_date: string
          created_at: string
          id: string
          note: string | null
          photo_path: string | null
          user_id: string
        }
        Insert: {
          challenge_id: string
          checkin_date: string
          created_at?: string
          id?: string
          note?: string | null
          photo_path?: string | null
          user_id: string
        }
        Update: {
          challenge_id?: string
          checkin_date?: string
          created_at?: string
          id?: string
          note?: string | null
          photo_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_checkins_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_members: {
        Row: {
          challenge_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          joined_at?: string
          user_id?: string
        }
        Update: {
          challenge_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_members_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_types: {
        Row: {
          created_at: string
          daily_prompt_en: string | null
          daily_prompt_es: string | null
          description_en: string | null
          description_es: string | null
          duration_days: number
          id: string
          is_published: boolean
          sort_order: number
          title_en: string
          title_es: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_prompt_en?: string | null
          daily_prompt_es?: string | null
          description_en?: string | null
          description_es?: string | null
          duration_days?: number
          id?: string
          is_published?: boolean
          sort_order?: number
          title_en: string
          title_es: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_prompt_en?: string | null
          daily_prompt_es?: string | null
          description_en?: string | null
          description_es?: string | null
          duration_days?: number
          id?: string
          is_published?: boolean
          sort_order?: number
          title_en?: string
          title_es?: string
          updated_at?: string
        }
        Relationships: []
      }
      challenges: {
        Row: {
          cover_style: number
          cover_url: string | null
          created_at: string
          created_by: string
          daily_prompt_en: string | null
          daily_prompt_es: string | null
          description_en: string | null
          description_es: string | null
          ends_on: string
          id: string
          is_paid: boolean
          price_cents: number | null
          starts_on: string
          team_id: string
          title_en: string
          title_es: string
        }
        Insert: {
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          created_by?: string
          daily_prompt_en?: string | null
          daily_prompt_es?: string | null
          description_en?: string | null
          description_es?: string | null
          ends_on: string
          id?: string
          is_paid?: boolean
          price_cents?: number | null
          starts_on: string
          team_id: string
          title_en?: string
          title_es?: string
        }
        Update: {
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          created_by?: string
          daily_prompt_en?: string | null
          daily_prompt_es?: string | null
          description_en?: string | null
          description_es?: string | null
          ends_on?: string
          id?: string
          is_paid?: boolean
          price_cents?: number | null
          starts_on?: string
          team_id?: string
          title_en?: string
          title_es?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_reviews: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          hidden: boolean
          host_id: string
          id: string
          rating: number
        }
        Insert: {
          author_id: string
          body?: string | null
          created_at?: string
          hidden?: boolean
          host_id: string
          id?: string
          rating: number
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          hidden?: boolean
          host_id?: string
          id?: string
          rating?: number
        }
        Relationships: []
      }
      coach_steps: {
        Row: {
          celebrated_at: string
          step: string
          user_id: string
        }
        Insert: {
          celebrated_at?: string
          step: string
          user_id?: string
        }
        Update: {
          celebrated_at?: string
          step?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_verifications: {
        Row: {
          created_at: string
          credentials: Json
          id: string
          identity_path: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          created_at?: string
          credentials?: Json
          id?: string
          identity_path: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          created_at?: string
          credentials?: Json
          id?: string
          identity_path?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          kind: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          kind: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          event_id: string | null
          hidden: boolean
          id: string
          parent_id: string | null
          pinned: boolean
          team_id: string
          topic_id: string | null
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          event_id?: string | null
          hidden?: boolean
          id?: string
          parent_id?: string | null
          pinned?: boolean
          team_id: string
          topic_id?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          event_id?: string | null
          hidden?: boolean
          id?: string
          parent_id?: string | null
          pinned?: boolean
          team_id?: string
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "discussion_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      community_seat_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          host_id: string
          id: string
          kind: string
          note: string | null
          pay_cents: number
          status: string
          target_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          host_id: string
          id?: string
          kind: string
          note?: string | null
          pay_cents?: number
          status?: string
          target_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          host_id?: string
          id?: string
          kind?: string
          note?: string | null
          pay_cents?: number
          status?: string
          target_id?: string
          user_id?: string
        }
        Relationships: []
      }
      config_versions: {
        Row: {
          changed_by: string | null
          config_key: string
          created_at: string
          id: number
          new_value: Json | null
          old_value: Json | null
          reason: string | null
          source: string | null
        }
        Insert: {
          changed_by?: string | null
          config_key: string
          created_at?: string
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          source?: string | null
        }
        Update: {
          changed_by?: string | null
          config_key?: string
          created_at?: string
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          source?: string | null
        }
        Relationships: []
      }
      consent_text_versions: {
        Row: {
          body: string
          body_sha256: string
          created_at: string
          effective_from: string
          id: string
          kind: string
          locale: string
          team_id: string | null
          version: number
        }
        Insert: {
          body: string
          body_sha256: string
          created_at?: string
          effective_from?: string
          id?: string
          kind: string
          locale: string
          team_id?: string | null
          version: number
        }
        Update: {
          body?: string
          body_sha256?: string
          created_at?: string
          effective_from?: string
          id?: string
          kind?: string
          locale?: string
          team_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "consent_text_versions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_briefs: {
        Row: {
          created_at: string
          day: string
          dismissed: boolean
          language: string
          lines: Json
          preview: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          dismissed?: boolean
          language?: string
          lines?: Json
          preview?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          dismissed?: boolean
          language?: string
          lines?: Json
          preview?: boolean
          user_id?: string
        }
        Relationships: []
      }
      delivery_events: {
        Row: {
          created_at: string
          email: string | null
          event: string
          id: string
          payload: Json
          provider: string
          provider_message_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event: string
          id?: string
          payload?: Json
          provider: string
          provider_message_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event?: string
          id?: string
          payload?: Json
          provider?: string
          provider_message_id?: string | null
        }
        Relationships: []
      }
      discussion_topics: {
        Row: {
          created_at: string
          created_by: string
          id: string
          last_post_at: string
          pinned: boolean
          team_id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          last_post_at?: string
          pinned?: boolean
          team_id: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          last_post_at?: string
          pinned?: boolean
          team_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_topics_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      email_prefs: {
        Row: {
          all_off: boolean
          announcements: boolean
          badges: boolean
          email: string
          followups: boolean
          language: string
          reminders: boolean
          token: string
          updated_at: string
        }
        Insert: {
          all_off?: boolean
          announcements?: boolean
          badges?: boolean
          email: string
          followups?: boolean
          language?: string
          reminders?: boolean
          token?: string
          updated_at?: string
        }
        Update: {
          all_off?: boolean
          announcements?: boolean
          badges?: boolean
          email?: string
          followups?: boolean
          language?: string
          reminders?: boolean
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_suppressions: {
        Row: {
          created_at: string
          email: string
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          reason?: string
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          created_at: string
          ends_at: string | null
          event_id: string | null
          id: string
          kind: string
          offer_id: string | null
          order_id: string | null
          revoke_reason: string | null
          revoked_at: string | null
          source: string
          starts_at: string
          track_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          event_id?: string | null
          id?: string
          kind: string
          offer_id?: string | null
          order_id?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          source: string
          starts_at?: string
          track_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          event_id?: string | null
          id?: string
          kind?: string
          offer_id?: string | null
          order_id?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          source?: string
          starts_at?: string
          track_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_checklists: {
        Row: {
          event_id: string
          items: Json
          updated_at: string
        }
        Insert: {
          event_id: string
          items?: Json
          updated_at?: string
        }
        Update: {
          event_id?: string
          items?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_checklists_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_cohosts: {
        Row: {
          added_by: string | null
          created_at: string
          event_id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          event_id: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_cohosts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_live_counts: {
        Row: {
          checked_in: number
          event_id: string
          going: number
          updated_at: string
          waitlist: number
          walk_ins: number
        }
        Insert: {
          checked_in?: number
          event_id: string
          going?: number
          updated_at?: string
          waitlist?: number
          walk_ins?: number
        }
        Update: {
          checked_in?: number
          event_id?: string
          going?: number
          updated_at?: string
          waitlist?: number
          walk_ins?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_live_counts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_photos: {
        Row: {
          created_at: string
          event_id: string
          hidden: boolean
          id: string
          path: string
          rsvp_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          hidden?: boolean
          id?: string
          path: string
          rsvp_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          hidden?: boolean
          id?: string
          path?: string
          rsvp_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_photos_rsvp_id_fkey"
            columns: ["rsvp_id"]
            isOneToOne: false
            referencedRelation: "rsvps"
            referencedColumns: ["id"]
          },
        ]
      }
      event_plan_waitlist: {
        Row: {
          event_id: string
          last_hit_at: string
          notified_at: string | null
        }
        Insert: {
          event_id: string
          last_hit_at?: string
          notified_at?: string | null
        }
        Update: {
          event_id?: string
          last_hit_at?: string
          notified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_plan_waitlist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_poll_options: {
        Row: {
          event_id: string
          id: string
          label: string
          poll_id: string
          position: number
          votes: number
        }
        Insert: {
          event_id: string
          id?: string
          label: string
          poll_id: string
          position?: number
          votes?: number
        }
        Update: {
          event_id?: string
          id?: string
          label?: string
          poll_id?: string
          position?: number
          votes?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_poll_options_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "event_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      event_poll_votes: {
        Row: {
          created_at: string
          option_id: string
          poll_id: string
          rsvp_id: string
        }
        Insert: {
          created_at?: string
          option_id: string
          poll_id: string
          rsvp_id: string
        }
        Update: {
          created_at?: string
          option_id?: string
          poll_id?: string
          rsvp_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "event_poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "event_polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_poll_votes_rsvp_id_fkey"
            columns: ["rsvp_id"]
            isOneToOne: false
            referencedRelation: "rsvps"
            referencedColumns: ["id"]
          },
        ]
      }
      event_polls: {
        Row: {
          closed: boolean
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          question: string
        }
        Insert: {
          closed?: boolean
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          question: string
        }
        Update: {
          closed?: boolean
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_polls_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          accessibility_notes: string | null
          addons: Json
          address: string | null
          allows_minors: boolean
          cancellation_policy: string | null
          capacity: number | null
          category: string | null
          category_label: string | null
          chat_links: Json
          community_seats: number | null
          completed_at: string | null
          contact_email: string | null
          contact_phone: string | null
          cover_service_fee: boolean
          cover_style: number
          cover_url: string | null
          created_at: string
          description_en: string | null
          description_es: string | null
          early_offer_id: string | null
          ends_at: string | null
          format: string
          hide_guest_list: boolean
          host_id: string
          id: string
          invite_token: string
          language: string
          lat: number | null
          lng: number | null
          location_id: string | null
          location_name: string | null
          map_url: string | null
          meeting_note: string | null
          min_age: number | null
          offer_id: string | null
          online_url: string | null
          pass_fee: boolean
          price_cents: number | null
          public_rsvp_at: string | null
          recurrence: string
          refund_policy: string
          reg_closes_at: string | null
          reg_opens_at: string | null
          require_approval: boolean
          requires_waiver: boolean
          retreat: Json | null
          rsvp_questions: Json
          series_id: string | null
          small_groups: string[]
          starts_at: string
          status: string
          summary_en: string | null
          summary_es: string | null
          tags: string[]
          team_id: string
          team_max: number
          team_min: number
          team_price_mode: string
          team_registration: boolean
          template_id: string | null
          theme: string | null
          ticket_tiers: Json
          timezone: string
          title: string
          visibility: string
          waitlist_enabled: boolean
          what_to_bring: string | null
          whatsapp_url: string | null
        }
        Insert: {
          accessibility_notes?: string | null
          addons?: Json
          address?: string | null
          allows_minors?: boolean
          cancellation_policy?: string | null
          capacity?: number | null
          category?: string | null
          category_label?: string | null
          chat_links?: Json
          community_seats?: number | null
          completed_at?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          cover_service_fee?: boolean
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          early_offer_id?: string | null
          ends_at?: string | null
          format?: string
          hide_guest_list?: boolean
          host_id?: string
          id?: string
          invite_token?: string
          language?: string
          lat?: number | null
          lng?: number | null
          location_id?: string | null
          location_name?: string | null
          map_url?: string | null
          meeting_note?: string | null
          min_age?: number | null
          offer_id?: string | null
          online_url?: string | null
          pass_fee?: boolean
          price_cents?: number | null
          public_rsvp_at?: string | null
          recurrence?: string
          refund_policy?: string
          reg_closes_at?: string | null
          reg_opens_at?: string | null
          require_approval?: boolean
          requires_waiver?: boolean
          retreat?: Json | null
          rsvp_questions?: Json
          series_id?: string | null
          small_groups?: string[]
          starts_at: string
          status?: string
          summary_en?: string | null
          summary_es?: string | null
          tags?: string[]
          team_id: string
          team_max?: number
          team_min?: number
          team_price_mode?: string
          team_registration?: boolean
          template_id?: string | null
          theme?: string | null
          ticket_tiers?: Json
          timezone?: string
          title: string
          visibility?: string
          waitlist_enabled?: boolean
          what_to_bring?: string | null
          whatsapp_url?: string | null
        }
        Update: {
          accessibility_notes?: string | null
          addons?: Json
          address?: string | null
          allows_minors?: boolean
          cancellation_policy?: string | null
          capacity?: number | null
          category?: string | null
          category_label?: string | null
          chat_links?: Json
          community_seats?: number | null
          completed_at?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          cover_service_fee?: boolean
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          early_offer_id?: string | null
          ends_at?: string | null
          format?: string
          hide_guest_list?: boolean
          host_id?: string
          id?: string
          invite_token?: string
          language?: string
          lat?: number | null
          lng?: number | null
          location_id?: string | null
          location_name?: string | null
          map_url?: string | null
          meeting_note?: string | null
          min_age?: number | null
          offer_id?: string | null
          online_url?: string | null
          pass_fee?: boolean
          price_cents?: number | null
          public_rsvp_at?: string | null
          recurrence?: string
          refund_policy?: string
          reg_closes_at?: string | null
          reg_opens_at?: string | null
          require_approval?: boolean
          requires_waiver?: boolean
          retreat?: Json | null
          rsvp_questions?: Json
          series_id?: string | null
          small_groups?: string[]
          starts_at?: string
          status?: string
          summary_en?: string | null
          summary_es?: string | null
          tags?: string[]
          team_id?: string
          team_max?: number
          team_min?: number
          team_price_mode?: string
          team_registration?: boolean
          template_id?: string | null
          theme?: string | null
          ticket_tiers?: Json
          timezone?: string
          title?: string
          visibility?: string
          waitlist_enabled?: boolean
          what_to_bring?: string | null
          whatsapp_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_early_offer_id_fkey"
            columns: ["early_offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          description_en: string
          description_es: string
          enabled: boolean
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          description_en?: string
          description_es?: string
          enabled?: boolean
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          description_en?: string
          description_es?: string
          enabled?: boolean
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      fee_rules: {
        Row: {
          applies_to: string[]
          cap_cents: number | null
          created_at: string
          effective_from: string
          effective_to: string | null
          fixed_cents: number
          id: string
          is_legacy: boolean
          note: string | null
          percent: number
        }
        Insert: {
          applies_to: string[]
          cap_cents?: number | null
          created_at?: string
          effective_from: string
          effective_to?: string | null
          fixed_cents?: number
          id: string
          is_legacy?: boolean
          note?: string | null
          percent: number
        }
        Update: {
          applies_to?: string[]
          cap_cents?: number | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          fixed_cents?: number
          id?: string
          is_legacy?: boolean
          note?: string | null
          percent?: number
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          email: string | null
          follower_id: string | null
          id: string
          language: string
          target_id: string
          target_kind: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          follower_id?: string | null
          id?: string
          language?: string
          target_id: string
          target_kind: string
        }
        Update: {
          created_at?: string
          email?: string | null
          follower_id?: string | null
          id?: string
          language?: string
          target_id?: string
          target_kind?: string
        }
        Relationships: []
      }
      followup_drafts: {
        Row: {
          channel: string | null
          created_at: string
          event_id: string
          guest_name: string
          host_id: string
          id: string
          kind: string
          language: string
          message: string
          preview: boolean
          rsvp_id: string
          sent_at: string | null
          status: string
          team_id: string
          updated_at: string
        }
        Insert: {
          channel?: string | null
          created_at?: string
          event_id: string
          guest_name?: string
          host_id: string
          id?: string
          kind: string
          language?: string
          message: string
          preview?: boolean
          rsvp_id: string
          sent_at?: string | null
          status?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          channel?: string | null
          created_at?: string
          event_id?: string
          guest_name?: string
          host_id?: string
          id?: string
          kind?: string
          language?: string
          message?: string
          preview?: boolean
          rsvp_id?: string
          sent_at?: string | null
          status?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_drafts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_drafts_rsvp_id_fkey"
            columns: ["rsvp_id"]
            isOneToOne: true
            referencedRelation: "rsvps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_drafts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      founding_coaches: {
        Row: {
          accepted_at: string | null
          audience: string
          city: string
          coach_type: string
          council_months: string[]
          created_at: string
          email: string
          full_name: string
          has_space: boolean
          id: string
          language: string
          launch_date: string | null
          small_town: boolean
          stay_at_rate: boolean | null
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          audience?: string
          city?: string
          coach_type?: string
          council_months?: string[]
          created_at?: string
          email: string
          full_name?: string
          has_space?: boolean
          id?: string
          language?: string
          launch_date?: string | null
          small_town?: boolean
          stay_at_rate?: boolean | null
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          audience?: string
          city?: string
          coach_type?: string
          council_months?: string[]
          created_at?: string
          email?: string
          full_name?: string
          has_space?: boolean
          id?: string
          language?: string
          launch_date?: string | null
          small_town?: boolean
          stay_at_rate?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      founding_program: {
        Row: {
          free_months: number
          id: boolean
          max_coaches: number
          rate_cents: number
          start_date: string | null
          updated_at: string
        }
        Insert: {
          free_months?: number
          id?: boolean
          max_coaches?: number
          rate_cents?: number
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          free_months?: number
          id?: boolean
          max_coaches?: number
          rate_cents?: number
          start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      guest_claims: {
        Row: {
          action: string
          canonical_rsvp_id: string | null
          created_at: string
          id: string
          orders_linked: number
          rsvp_id: string
          user_id: string
        }
        Insert: {
          action: string
          canonical_rsvp_id?: string | null
          created_at?: string
          id?: string
          orders_linked?: number
          rsvp_id: string
          user_id: string
        }
        Update: {
          action?: string
          canonical_rsvp_id?: string | null
          created_at?: string
          id?: string
          orders_linked?: number
          rsvp_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_claims_canonical_rsvp_id_fkey"
            columns: ["canonical_rsvp_id"]
            isOneToOne: false
            referencedRelation: "rsvps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_claims_rsvp_id_fkey"
            columns: ["rsvp_id"]
            isOneToOne: true
            referencedRelation: "rsvps"
            referencedColumns: ["id"]
          },
        ]
      }
      host_of_month: {
        Row: {
          awarded_by: string | null
          created_at: string
          month: string
          note: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          awarded_by?: string | null
          created_at?: string
          month: string
          note?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          awarded_by?: string | null
          created_at?: string
          month?: string
          note?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "host_of_month_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_instructor_notes: {
        Row: {
          lesson_id: string
          notes_en: string | null
          notes_es: string | null
          updated_at: string
        }
        Insert: {
          lesson_id: string
          notes_en?: string | null
          notes_es?: string | null
          updated_at?: string
        }
        Update: {
          lesson_id?: string
          notes_en?: string | null
          notes_es?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_instructor_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_live_links: {
        Row: {
          lesson_id: string
          url: string
        }
        Insert: {
          lesson_id: string
          url: string
        }
        Update: {
          lesson_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_live_links_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          lesson_id: string
          user_id?: string
        }
        Update: {
          completed_at?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_reminders: {
        Row: {
          created_at: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          lesson_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_reminders_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_summaries: {
        Row: {
          actions_en: Json
          actions_es: Json
          created_at: string
          lesson_id: string
          points_en: Json
          points_es: Json
          published: boolean
          summary_en: string
          summary_es: string
          team_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actions_en?: Json
          actions_es?: Json
          created_at?: string
          lesson_id: string
          points_en?: Json
          points_es?: Json
          published?: boolean
          summary_en?: string
          summary_es?: string
          team_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actions_en?: Json
          actions_es?: Json
          created_at?: string
          lesson_id?: string
          points_en?: Json
          points_es?: Json
          published?: boolean
          summary_en?: string
          summary_es?: string
          team_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_summaries_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_summaries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          attachments: Json
          created_at: string
          description_en: string | null
          description_es: string | null
          duration_minutes: number | null
          event_id: string | null
          id: string
          is_preview: boolean
          is_published: boolean
          live_starts_at: string | null
          notes_en: string | null
          notes_es: string | null
          prerequisite_lesson_id: string | null
          replay_url: string | null
          sort_order: number
          storage_path: string | null
          title_en: string
          title_es: string
          track_id: string
          type: string
          url: string | null
        }
        Insert: {
          attachments?: Json
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          duration_minutes?: number | null
          event_id?: string | null
          id?: string
          is_preview?: boolean
          is_published?: boolean
          live_starts_at?: string | null
          notes_en?: string | null
          notes_es?: string | null
          prerequisite_lesson_id?: string | null
          replay_url?: string | null
          sort_order?: number
          storage_path?: string | null
          title_en?: string
          title_es?: string
          track_id: string
          type?: string
          url?: string | null
        }
        Update: {
          attachments?: Json
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          duration_minutes?: number | null
          event_id?: string | null
          id?: string
          is_preview?: boolean
          is_published?: boolean
          live_starts_at?: string | null
          notes_en?: string | null
          notes_es?: string | null
          prerequisite_lesson_id?: string | null
          replay_url?: string | null
          sort_order?: number
          storage_path?: string | null
          title_en?: string
          title_es?: string
          track_id?: string
          type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_prerequisite_lesson_id_fkey"
            columns: ["prerequisite_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      library_chunks: {
        Row: {
          content: string
          embedding: string | null
          id: string
          source_id: string
          source_type: string
          team_id: string
          title: string
          tsv: unknown
          updated_at: string
        }
        Insert: {
          content?: string
          embedding?: string | null
          id?: string
          source_id: string
          source_type: string
          team_id: string
          title?: string
          tsv?: unknown
          updated_at?: string
        }
        Update: {
          content?: string
          embedding?: string | null
          id?: string
          source_id?: string
          source_type?: string
          team_id?: string
          title?: string
          tsv?: unknown
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_chunks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      license_seats: {
        Row: {
          assigned_by: string | null
          created_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_seats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_licenses"
            referencedColumns: ["team_id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string
          booking_url: string | null
          capacity: number | null
          created_at: string
          dropin_cents: number | null
          host_id: string
          id: string
          lat: number | null
          lng: number | null
          mode: string
          name: string
          opening_notes: string
          photos: string[]
          schedule: Json
          slug: string
          store_url: string | null
          updated_at: string
        }
        Insert: {
          address?: string
          booking_url?: string | null
          capacity?: number | null
          created_at?: string
          dropin_cents?: number | null
          host_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          mode: string
          name: string
          opening_notes?: string
          photos?: string[]
          schedule?: Json
          slug: string
          store_url?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          booking_url?: string | null
          capacity?: number | null
          created_at?: string
          dropin_cents?: number | null
          host_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          mode?: string
          name?: string
          opening_notes?: string
          photos?: string[]
          schedule?: Json
          slug?: string
          store_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      member_of_month: {
        Row: {
          awarded_by: string | null
          created_at: string
          month: string
          note: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          awarded_by?: string | null
          created_at?: string
          month: string
          note?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          awarded_by?: string | null
          created_at?: string
          month?: string
          note?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_of_month_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      member_plans: {
        Row: {
          created_at: string
          items: Json
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          items?: Json
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          items?: Json
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_plans_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      network_features: {
        Row: {
          created_at: string
          event_id: string
          featured_by: string
          team_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          featured_by: string
          team_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          featured_by?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "network_features_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_features_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      network_links: {
        Row: {
          created_at: string
          id: string
          recipient: string
          requester: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipient: string
          requester: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          recipient?: string
          requester?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      network_shares: {
        Row: {
          created_at: string
          event_id: string
          host_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          host_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          host_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "network_shares_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          error: string | null
          event_id: string | null
          id: string
          kind: string
          language: string
          lesson_id: string | null
          locked_at: string | null
          payload: Json
          provider_message_id: string | null
          recipient: string
          rsvp_id: string | null
          send_after: string
          sent_at: string | null
          status: string
          team_id: string | null
          template: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          error?: string | null
          event_id?: string | null
          id?: string
          kind?: string
          language?: string
          lesson_id?: string | null
          locked_at?: string | null
          payload?: Json
          provider_message_id?: string | null
          recipient: string
          rsvp_id?: string | null
          send_after?: string
          sent_at?: string | null
          status?: string
          team_id?: string | null
          template: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          error?: string | null
          event_id?: string | null
          id?: string
          kind?: string
          language?: string
          lesson_id?: string | null
          locked_at?: string | null
          payload?: Json
          provider_message_id?: string | null
          recipient?: string
          rsvp_id?: string | null
          send_after?: string
          sent_at?: string | null
          status?: string
          team_id?: string | null
          template?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_rsvp_id_fkey"
            columns: ["rsvp_id"]
            isOneToOne: false
            referencedRelation: "rsvps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_grants: {
        Row: {
          created_at: string
          granted_by: string
          granted_to: string
          id: string
          note: string | null
          offer_id: string
        }
        Insert: {
          created_at?: string
          granted_by: string
          granted_to: string
          id?: string
          note?: string | null
          offer_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string
          granted_to?: string
          id?: string
          note?: string | null
          offer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_grants_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_managers: {
        Row: {
          assigned_by: string | null
          created_at: string
          offer_id: string
          role: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          offer_id: string
          role?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          offer_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_managers_assigner_profile_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_managers_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_managers_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_purchases: {
        Row: {
          amount_cents: number
          cancel_at_period_end: boolean
          community: boolean
          created_at: string
          founding: boolean
          id: string
          offer_id: string
          paused_until: string | null
          renews_at: string | null
          status: string
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          cancel_at_period_end?: boolean
          community?: boolean
          created_at?: string
          founding?: boolean
          id?: string
          offer_id: string
          paused_until?: string | null
          renews_at?: string | null
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          cancel_at_period_end?: boolean
          community?: boolean
          created_at?: string
          founding?: boolean
          id?: string
          offer_id?: string
          paused_until?: string | null
          renews_at?: string | null
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_purchases_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          accessibility_notes: string | null
          billing_interval: string | null
          category: string | null
          coauthor_name: string | null
          community_seats: number | null
          cover_style: number
          cover_url: string | null
          created_at: string
          currency: string
          description_en: string | null
          description_es: string | null
          drip_days: number
          enroll_closes_at: string | null
          enroll_opens_at: string | null
          file_path: string | null
          founding_price_cents: number | null
          founding_seats: number | null
          host_id: string
          id: string
          includes_en: Json
          includes_es: Json
          kind: string
          license_en: string | null
          license_es: string | null
          price_cents: number
          refund_policy: string
          status: string
          summary_en: string | null
          summary_es: string | null
          support_email: string | null
          tags: string[]
          team_id: string
          title_en: string
          title_es: string
          updated_at: string
          version_label: string | null
          visibility: string
        }
        Insert: {
          accessibility_notes?: string | null
          billing_interval?: string | null
          category?: string | null
          coauthor_name?: string | null
          community_seats?: number | null
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          currency?: string
          description_en?: string | null
          description_es?: string | null
          drip_days?: number
          enroll_closes_at?: string | null
          enroll_opens_at?: string | null
          file_path?: string | null
          founding_price_cents?: number | null
          founding_seats?: number | null
          host_id?: string
          id?: string
          includes_en?: Json
          includes_es?: Json
          kind: string
          license_en?: string | null
          license_es?: string | null
          price_cents?: number
          refund_policy?: string
          status?: string
          summary_en?: string | null
          summary_es?: string | null
          support_email?: string | null
          tags?: string[]
          team_id: string
          title_en?: string
          title_es?: string
          updated_at?: string
          version_label?: string | null
          visibility?: string
        }
        Update: {
          accessibility_notes?: string | null
          billing_interval?: string | null
          category?: string | null
          coauthor_name?: string | null
          community_seats?: number | null
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          currency?: string
          description_en?: string | null
          description_es?: string | null
          drip_days?: number
          enroll_closes_at?: string | null
          enroll_opens_at?: string | null
          file_path?: string | null
          founding_price_cents?: number | null
          founding_seats?: number | null
          host_id?: string
          id?: string
          includes_en?: Json
          includes_es?: Json
          kind?: string
          license_en?: string | null
          license_es?: string | null
          price_cents?: number
          refund_policy?: string
          status?: string
          summary_en?: string | null
          summary_es?: string | null
          support_email?: string | null
          tags?: string[]
          team_id?: string
          title_en?: string
          title_es?: string
          updated_at?: string
          version_label?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          item_type: string
          order_id: string
          quantity: number
          unit_cents: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          item_type: string
          order_id: string
          quantity?: number
          unit_cents: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          item_type?: string
          order_id?: string
          quantity?: number
          unit_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_user_id: string | null
          connected_account_id: string | null
          created_at: string
          currency: string
          discount_cents: number
          environment: string | null
          event_id: string | null
          fee_rule_id: string
          gross_cents: number
          host_id: string | null
          id: string
          idempotency_key: string
          legacy_payment_id: string | null
          offer_id: string | null
          offering_type: string
          platform_fee_cents: number
          price_version_id: string | null
          processor_fee_cents: number | null
          promo_id: string | null
          refund_policy_text: string | null
          refund_policy_version_id: string | null
          rsvp_id: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          tax_cents: number
          track_id: string | null
          updated_at: string
        }
        Insert: {
          buyer_user_id?: string | null
          connected_account_id?: string | null
          created_at?: string
          currency?: string
          discount_cents?: number
          environment?: string | null
          event_id?: string | null
          fee_rule_id: string
          gross_cents: number
          host_id?: string | null
          id?: string
          idempotency_key: string
          legacy_payment_id?: string | null
          offer_id?: string | null
          offering_type: string
          platform_fee_cents: number
          price_version_id?: string | null
          processor_fee_cents?: number | null
          promo_id?: string | null
          refund_policy_text?: string | null
          refund_policy_version_id?: string | null
          rsvp_id?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          tax_cents?: number
          track_id?: string | null
          updated_at?: string
        }
        Update: {
          buyer_user_id?: string | null
          connected_account_id?: string | null
          created_at?: string
          currency?: string
          discount_cents?: number
          environment?: string | null
          event_id?: string | null
          fee_rule_id?: string
          gross_cents?: number
          host_id?: string | null
          id?: string
          idempotency_key?: string
          legacy_payment_id?: string | null
          offer_id?: string | null
          offering_type?: string
          platform_fee_cents?: number
          price_version_id?: string | null
          processor_fee_cents?: number | null
          promo_id?: string | null
          refund_policy_text?: string | null
          refund_policy_version_id?: string | null
          rsvp_id?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          tax_cents?: number
          track_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_profile_fkey"
            columns: ["buyer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_fee_rule_id_fkey"
            columns: ["fee_rule_id"]
            isOneToOne: false
            referencedRelation: "fee_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_host_profile_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_legacy_payment_id_fkey"
            columns: ["legacy_payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_price_version_id_fkey"
            columns: ["price_version_id"]
            isOneToOne: false
            referencedRelation: "price_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_refund_policy_version_id_fkey"
            columns: ["refund_policy_version_id"]
            isOneToOne: false
            referencedRelation: "refund_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_rsvp_id_fkey"
            columns: ["rsvp_id"]
            isOneToOne: false
            referencedRelation: "rsvps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          booking_fee_cents: number
          buyer_email: string | null
          buyer_key: string | null
          buyer_name: string | null
          challenge_id: string | null
          created_at: string
          currency: string
          discount_cents: number
          event_id: string | null
          fee_cents: number
          host_id: string
          id: string
          kind: string
          offer_id: string | null
          promo_id: string | null
          rsvp_id: string | null
          service_fee_cents: number
          service_fee_covered: boolean
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          booking_fee_cents?: number
          buyer_email?: string | null
          buyer_key?: string | null
          buyer_name?: string | null
          challenge_id?: string | null
          created_at?: string
          currency?: string
          discount_cents?: number
          event_id?: string | null
          fee_cents?: number
          host_id: string
          id?: string
          kind: string
          offer_id?: string | null
          promo_id?: string | null
          rsvp_id?: string | null
          service_fee_cents?: number
          service_fee_covered?: boolean
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          booking_fee_cents?: number
          buyer_email?: string | null
          buyer_key?: string | null
          buyer_name?: string | null
          challenge_id?: string | null
          created_at?: string
          currency?: string
          discount_cents?: number
          event_id?: string | null
          fee_cents?: number
          host_id?: string
          id?: string
          kind?: string
          offer_id?: string | null
          promo_id?: string | null
          rsvp_id?: string | null
          service_fee_cents?: number
          service_fee_covered?: boolean
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_promo_id_fkey"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_rsvp_id_fkey"
            columns: ["rsvp_id"]
            isOneToOne: false
            referencedRelation: "rsvps"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_holds: {
        Row: {
          amount_cents: number | null
          created_at: string
          id: string
          order_id: string
          payout_policy_version_id: string
          reason: string
          release_after: string | null
          released_at: string | null
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          id?: string
          order_id: string
          payout_policy_version_id: string
          reason: string
          release_after?: string | null
          released_at?: string | null
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          id?: string
          order_id?: string
          payout_policy_version_id?: string
          reason?: string
          release_after?: string | null
          released_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_holds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_holds_payout_policy_version_id_fkey"
            columns: ["payout_policy_version_id"]
            isOneToOne: false
            referencedRelation: "payout_policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_policy_versions: {
        Row: {
          applies_to: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          is_configured: boolean
          note: string | null
          release_offset_hours: number | null
          release_trigger: string
        }
        Insert: {
          applies_to: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id: string
          is_configured?: boolean
          note?: string | null
          release_offset_hours?: number | null
          release_trigger: string
        }
        Update: {
          applies_to?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_configured?: boolean
          note?: string | null
          release_offset_hours?: number | null
          release_trigger?: string
        }
        Relationships: []
      }
      personal_bests: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string
          recorded_on: string
          unit: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label: string
          recorded_on?: string
          unit: string
          user_id?: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string
          recorded_on?: string
          unit?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      plan_limit_versions: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          limits: Json
          plan: string
        }
        Insert: {
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id: string
          limits?: Json
          plan: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          limits?: Json
          plan?: string
        }
        Relationships: []
      }
      plan_settings: {
        Row: {
          fee_percent: number
          legacy: boolean
          monthly_cap: number | null
          monthly_price: number
          plan: string
          service_fee_fixed: number
          service_fee_percent: number
          updated_at: string
        }
        Insert: {
          fee_percent: number
          legacy?: boolean
          monthly_cap?: number | null
          monthly_price?: number
          plan: string
          service_fee_fixed?: number
          service_fee_percent?: number
          updated_at?: string
        }
        Update: {
          fee_percent?: number
          legacy?: boolean
          monthly_cap?: number | null
          monthly_price?: number
          plan?: string
          service_fee_fixed?: number
          service_fee_percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      playbook_patterns: {
        Row: {
          category: string | null
          computed_at: string
          context: string
          gatherings: number
          key: string
          params: Json
          teams: number
        }
        Insert: {
          category?: string | null
          computed_at?: string
          context: string
          gatherings: number
          key: string
          params?: Json
          teams: number
        }
        Update: {
          category?: string | null
          computed_at?: string
          context?: string
          gatherings?: number
          key?: string
          params?: Json
          teams?: number
        }
        Relationships: []
      }
      price_versions: {
        Row: {
          amount_cents: number
          billing_interval: string
          created_at: string
          currency: string
          effective_from: string
          effective_to: string | null
          id: string
          plan: string
          stripe_lookup_key: string | null
        }
        Insert: {
          amount_cents: number
          billing_interval: string
          created_at?: string
          currency?: string
          effective_from: string
          effective_to?: string | null
          id: string
          plan: string
          stripe_lookup_key?: string | null
        }
        Update: {
          amount_cents?: number
          billing_interval?: string
          created_at?: string
          currency?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          plan?: string
          stripe_lookup_key?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_team_id: string | null
          adult_confirmed_at: string | null
          adult_consent_version_id: string | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          cover_url: string | null
          created_at: string
          full_name: string | null
          host_languages: string[]
          id: string
          language: string
          live_at: string | null
          no_limits_until: string | null
          notify_prefs: Json
          onboarded: boolean
          phone: string | null
          role_intent: string | null
          shop_url: string | null
          slug: string | null
          view_mode: string
        }
        Insert: {
          active_team_id?: string | null
          adult_confirmed_at?: string | null
          adult_consent_version_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          full_name?: string | null
          host_languages?: string[]
          id: string
          language?: string
          live_at?: string | null
          no_limits_until?: string | null
          notify_prefs?: Json
          onboarded?: boolean
          phone?: string | null
          role_intent?: string | null
          shop_url?: string | null
          slug?: string | null
          view_mode?: string
        }
        Update: {
          active_team_id?: string | null
          adult_confirmed_at?: string | null
          adult_consent_version_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          full_name?: string | null
          host_languages?: string[]
          id?: string
          language?: string
          live_at?: string | null
          no_limits_until?: string | null
          notify_prefs?: Json
          onboarded?: boolean
          phone?: string | null
          role_intent?: string | null
          shop_url?: string | null
          slug?: string | null
          view_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_team_id_fkey"
            columns: ["active_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_adult_consent_version_id_fkey"
            columns: ["adult_consent_version_id"]
            isOneToOne: false
            referencedRelation: "consent_text_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_goal_checks: {
        Row: {
          checked_on: string
          goal_id: string
          user_id: string
        }
        Insert: {
          checked_on: string
          goal_id: string
          user_id?: string
        }
        Update: {
          checked_on?: string
          goal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_goal_checks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "progress_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_goals: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          title: string
          user_id?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      progress_shares: {
        Row: {
          created_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          team_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_shares_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          active: boolean
          amount: number
          applies_all: boolean
          challenge_ids: string[]
          code: string
          created_at: string
          ends_at: string | null
          event_ids: string[]
          host_id: string
          id: string
          kind: string
          max_uses: number | null
          offer_ids: string[]
          per_person: number | null
          starts_at: string | null
        }
        Insert: {
          active?: boolean
          amount: number
          applies_all?: boolean
          challenge_ids?: string[]
          code: string
          created_at?: string
          ends_at?: string | null
          event_ids?: string[]
          host_id: string
          id?: string
          kind?: string
          max_uses?: number | null
          offer_ids?: string[]
          per_person?: number | null
          starts_at?: string | null
        }
        Update: {
          active?: boolean
          amount?: number
          applies_all?: boolean
          challenge_ids?: string[]
          code?: string
          created_at?: string
          ends_at?: string | null
          event_ids?: string[]
          host_id?: string
          id?: string
          kind?: string
          max_uses?: number | null
          offer_ids?: string[]
          per_person?: number | null
          starts_at?: string | null
        }
        Relationships: []
      }
      provider_events: {
        Row: {
          attempts: number
          environment: string
          error: string | null
          event_type: string
          id: string
          payload_sha256: string | null
          processed_at: string | null
          provider: string
          provider_event_id: string
          received_at: string
          status: string
        }
        Insert: {
          attempts?: number
          environment: string
          error?: string | null
          event_type: string
          id?: string
          payload_sha256?: string | null
          processed_at?: string | null
          provider: string
          provider_event_id: string
          received_at?: string
          status?: string
        }
        Update: {
          attempts?: number
          environment?: string
          error?: string | null
          event_type?: string
          id?: string
          payload_sha256?: string | null
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          received_at?: string
          status?: string
        }
        Relationships: []
      }
      push_subscriptions: {
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
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      recipes: {
        Row: {
          cover_style: number
          cover_url: string | null
          created_at: string
          created_by: string | null
          id: string
          ingredients: Json
          is_published: boolean
          prep_minutes: number | null
          private_owner: string | null
          sort_order: number
          steps: Json
          tags: string[]
          team_id: string | null
          title_en: string
          title_es: string
        }
        Insert: {
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          ingredients?: Json
          is_published?: boolean
          prep_minutes?: number | null
          private_owner?: string | null
          sort_order?: number
          steps?: Json
          tags?: string[]
          team_id?: string | null
          title_en?: string
          title_es?: string
        }
        Update: {
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          ingredients?: Json
          is_published?: boolean
          prep_minutes?: number | null
          private_owner?: string | null
          sort_order?: number
          steps?: Json
          tags?: string[]
          team_id?: string | null
          title_en?: string
          title_es?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_thanks: {
        Row: {
          amount: number
          host_id: string
          kind: string
          updated_at: string
        }
        Insert: {
          amount?: number
          host_id: string
          kind?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          host_id?: string
          kind?: string
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          gathering_id: string
          id: string
          partner_host: string
          referring_host: string
          rsvp_id: string
          thanks_cents: number
        }
        Insert: {
          created_at?: string
          gathering_id: string
          id?: string
          partner_host: string
          referring_host: string
          rsvp_id: string
          thanks_cents?: number
        }
        Update: {
          created_at?: string
          gathering_id?: string
          id?: string
          partner_host?: string
          referring_host?: string
          rsvp_id?: string
          thanks_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "referrals_gathering_id_fkey"
            columns: ["gathering_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_rsvp_id_fkey"
            columns: ["rsvp_id"]
            isOneToOne: true
            referencedRelation: "rsvps"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_policy_versions: {
        Row: {
          applies_to: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          rules: Json
          summary_en: string
          summary_es: string
        }
        Insert: {
          applies_to: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id: string
          rules: Json
          summary_en: string
          summary_es: string
        }
        Update: {
          applies_to?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          rules?: Json
          summary_en?: string
          summary_es?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          idempotency_key: string
          order_id: string
          platform_fee_refunded_cents: number
          reason: string
          refund_policy_version_id: string | null
          requested_by: string | null
          status: string
          stripe_refund_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          idempotency_key: string
          order_id: string
          platform_fee_refunded_cents?: number
          reason: string
          refund_policy_version_id?: string | null
          requested_by?: string | null
          status?: string
          stripe_refund_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          order_id?: string
          platform_fee_refunded_cents?: number
          reason?: string
          refund_policy_version_id?: string | null
          requested_by?: string | null
          status?: string
          stripe_refund_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_refund_policy_version_id_fkey"
            columns: ["refund_policy_version_id"]
            isOneToOne: false
            referencedRelation: "refund_policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          note: string | null
          reason: string
          reporter_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          source: string
          status: string
          target_id: string
          target_type: string
          team_id: string | null
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          reason: string
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string
          target_id: string
          target_type: string
          team_id?: string | null
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          reason?: string
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string
          target_id?: string
          target_type?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      retreat_checks: {
        Row: {
          checked_at: string
          item: number
          rsvp_id: string
        }
        Insert: {
          checked_at?: string
          item: number
          rsvp_id: string
        }
        Update: {
          checked_at?: string
          item?: number
          rsvp_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retreat_checks_rsvp_id_fkey"
            columns: ["rsvp_id"]
            isOneToOne: false
            referencedRelation: "rsvps"
            referencedColumns: ["id"]
          },
        ]
      }
      rsvp_answers: {
        Row: {
          answers: Json
          created_at: string
          event_id: string
          rsvp_id: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          event_id: string
          rsvp_id: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          created_at?: string
          event_id?: string
          rsvp_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rsvp_answers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvp_answers_rsvp_id_fkey"
            columns: ["rsvp_id"]
            isOneToOne: true
            referencedRelation: "rsvps"
            referencedColumns: ["id"]
          },
        ]
      }
      rsvp_attempts: {
        Row: {
          created_at: string
          key: string
        }
        Insert: {
          created_at?: string
          key: string
        }
        Update: {
          created_at?: string
          key?: string
        }
        Relationships: []
      }
      rsvps: {
        Row: {
          buddy_rsvp_id: string | null
          cancel_reason: string | null
          cancelled_by: string | null
          checked_in_at: string | null
          checkin_code: string
          created_at: string
          email_opt_in: boolean
          event_id: string
          group_id: string | null
          group_name: string | null
          guardian_consent_at: string | null
          guardian_consent_version_id: string | null
          guardian_email: string | null
          guardian_name: string | null
          guardian_phone: string | null
          guardian_relationship: string | null
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          is_walk_in: boolean
          language: string
          merged_at: string | null
          merged_into_rsvp_id: string | null
          minor_age_band: string | null
          minor_first_name: string | null
          plus_ones: number
          small_group: string | null
          sms_opt_in: boolean
          status: string
          terms_accepted_at: string | null
          terms_version_id: string | null
          tier_id: string | null
          updates_opt_in: boolean
          user_id: string | null
          wants_buddy: boolean
        }
        Insert: {
          buddy_rsvp_id?: string | null
          cancel_reason?: string | null
          cancelled_by?: string | null
          checked_in_at?: string | null
          checkin_code?: string
          created_at?: string
          email_opt_in?: boolean
          event_id: string
          group_id?: string | null
          group_name?: string | null
          guardian_consent_at?: string | null
          guardian_consent_version_id?: string | null
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relationship?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          is_walk_in?: boolean
          language?: string
          merged_at?: string | null
          merged_into_rsvp_id?: string | null
          minor_age_band?: string | null
          minor_first_name?: string | null
          plus_ones?: number
          small_group?: string | null
          sms_opt_in?: boolean
          status?: string
          terms_accepted_at?: string | null
          terms_version_id?: string | null
          tier_id?: string | null
          updates_opt_in?: boolean
          user_id?: string | null
          wants_buddy?: boolean
        }
        Update: {
          buddy_rsvp_id?: string | null
          cancel_reason?: string | null
          cancelled_by?: string | null
          checked_in_at?: string | null
          checkin_code?: string
          created_at?: string
          email_opt_in?: boolean
          event_id?: string
          group_id?: string | null
          group_name?: string | null
          guardian_consent_at?: string | null
          guardian_consent_version_id?: string | null
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relationship?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          is_walk_in?: boolean
          language?: string
          merged_at?: string | null
          merged_into_rsvp_id?: string | null
          minor_age_band?: string | null
          minor_first_name?: string | null
          plus_ones?: number
          small_group?: string | null
          sms_opt_in?: boolean
          status?: string
          terms_accepted_at?: string | null
          terms_version_id?: string | null
          tier_id?: string | null
          updates_opt_in?: boolean
          user_id?: string | null
          wants_buddy?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "rsvps_buddy_rsvp_id_fkey"
            columns: ["buddy_rsvp_id"]
            isOneToOne: false
            referencedRelation: "rsvps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_guardian_consent_version_id_fkey"
            columns: ["guardian_consent_version_id"]
            isOneToOne: false
            referencedRelation: "consent_text_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_merged_into_rsvp_id_fkey"
            columns: ["merged_into_rsvp_id"]
            isOneToOne: false
            referencedRelation: "rsvps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_terms_version_id_fkey"
            columns: ["terms_version_id"]
            isOneToOne: false
            referencedRelation: "consent_text_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      sample_gatherings: {
        Row: {
          capacity: number | null
          category: string
          dow: number
          going: number
          going_names: string[]
          hero: boolean
          host_name: string
          id: string
          is_sample: boolean
          lat: number | null
          lng: number | null
          local_time: string
          location_name: string
          slot_order: number
          title_en: string
          title_es: string
        }
        Insert: {
          capacity?: number | null
          category: string
          dow: number
          going: number
          going_names?: string[]
          hero?: boolean
          host_name: string
          id?: string
          is_sample?: boolean
          lat?: number | null
          lng?: number | null
          local_time: string
          location_name: string
          slot_order: number
          title_en: string
          title_es: string
        }
        Update: {
          capacity?: number | null
          category?: string
          dow?: number
          going?: number
          going_names?: string[]
          hero?: boolean
          host_name?: string
          id?: string
          is_sample?: boolean
          lat?: number | null
          lng?: number | null
          local_time?: string
          location_name?: string
          slot_order?: number
          title_en?: string
          title_es?: string
        }
        Relationships: []
      }
      saved_recipes: {
        Row: {
          created_at: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          recipe_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_recipes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      shoutouts: {
        Row: {
          activity_id: string | null
          created_at: string
          from_user: string
          hidden: boolean
          id: string
          message: string
          photo_path: string | null
          pinned: boolean
          team_id: string
          to_user: string
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          from_user: string
          hidden?: boolean
          id?: string
          message: string
          photo_path?: string | null
          pinned?: boolean
          team_id: string
          to_user: string
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          from_user?: string
          hidden?: boolean
          id?: string
          message?: string
          photo_path?: string | null
          pinned?: boolean
          team_id?: string
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "shoutouts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      site_media: {
        Row: {
          alt_en: string
          alt_es: string
          aspect: number
          credit: string | null
          default_alt_en: string
          default_alt_es: string
          default_credit: string | null
          default_url: string | null
          focal_x: number
          focal_y: number
          id: string
          image_path: string | null
          slot: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          alt_en?: string
          alt_es?: string
          aspect?: number
          credit?: string | null
          default_alt_en?: string
          default_alt_es?: string
          default_credit?: string | null
          default_url?: string | null
          focal_x?: number
          focal_y?: number
          id?: string
          image_path?: string | null
          slot: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          alt_en?: string
          alt_es?: string
          aspect?: number
          credit?: string | null
          default_alt_en?: string
          default_alt_es?: string
          default_credit?: string | null
          default_url?: string | null
          focal_x?: number
          focal_y?: number
          id?: string
          image_path?: string | null
          slot?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      sms_invites: {
        Row: {
          created_at: string
          event_id: string
          id: string
          language: string
          name: string | null
          phone: string
          replied_at: string | null
          reply: string | null
          sent_by: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          language?: string
          name?: string | null
          phone: string
          replied_at?: string | null
          reply?: string | null
          sent_by?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          language?: string
          name?: string | null
          phone?: string
          replied_at?: string | null
          reply?: string | null
          sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_optouts: {
        Row: {
          created_at: string
          phone: string
          source: string
        }
        Insert: {
          created_at?: string
          phone: string
          source?: string
        }
        Update: {
          created_at?: string
          phone?: string
          source?: string
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          created_at: string
          id: string
          type: string
        }
        Insert: {
          created_at?: string
          id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: string
        }
        Relationships: []
      }
      team_licenses: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          is_preview: boolean
          leader_id: string
          renews_at: string | null
          seats: number
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          team_id: string
          tier: string
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          is_preview?: boolean
          leader_id: string
          renews_at?: string | null
          seats: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          team_id: string
          tier: string
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          is_preview?: boolean
          leader_id?: string
          renews_at?: string | null
          seats?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          team_id?: string
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_licenses_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          custom_badge: string | null
          invited_by: string | null
          joined_at: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          custom_badge?: string | null
          invited_by?: string | null
          joined_at?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          custom_badge?: string | null
          invited_by?: string | null
          joined_at?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_suspensions: {
        Row: {
          created_at: string
          reason: string
          suspended_by: string | null
          team_id: string
        }
        Insert: {
          created_at?: string
          reason: string
          suspended_by?: string | null
          team_id: string
        }
        Update: {
          created_at?: string
          reason?: string
          suspended_by?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_suspensions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          allow_host_subteams: boolean
          brand_color: string | null
          chat_links: Json
          cover_url: string | null
          created_at: string
          id: string
          join_code: string
          name: string
          owner_id: string
          parent_team_id: string | null
          plan: string
          slug: string
          whatsapp_url: string | null
        }
        Insert: {
          allow_host_subteams?: boolean
          brand_color?: string | null
          chat_links?: Json
          cover_url?: string | null
          created_at?: string
          id?: string
          join_code?: string
          name: string
          owner_id?: string
          parent_team_id?: string | null
          plan?: string
          slug: string
          whatsapp_url?: string | null
        }
        Update: {
          allow_host_subteams?: boolean
          brand_color?: string | null
          chat_links?: Json
          cover_url?: string | null
          created_at?: string
          id?: string
          join_code?: string
          name?: string
          owner_id?: string
          parent_team_id?: string | null
          plan?: string
          slug?: string
          whatsapp_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_parent_team_id_fkey"
            columns: ["parent_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          category: string
          category_label: string | null
          checklist: Json
          cover_style: number
          cover_url: string | null
          created_at: string
          created_by: string | null
          default_capacity: number | null
          default_duration_minutes: number
          default_mode: string
          default_price_cents: number
          description_en: string | null
          description_es: string | null
          followup_script_en: string | null
          followup_script_es: string | null
          id: string
          invite_script_en: string | null
          invite_script_es: string | null
          is_published: boolean
          launches_count: number
          sort_order: number
          team_id: string | null
          theme: string | null
          title: string
          visibility_default: string
        }
        Insert: {
          category?: string
          category_label?: string | null
          checklist?: Json
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          default_capacity?: number | null
          default_duration_minutes?: number
          default_mode?: string
          default_price_cents?: number
          description_en?: string | null
          description_es?: string | null
          followup_script_en?: string | null
          followup_script_es?: string | null
          id?: string
          invite_script_en?: string | null
          invite_script_es?: string | null
          is_published?: boolean
          launches_count?: number
          sort_order?: number
          team_id?: string | null
          theme?: string | null
          title: string
          visibility_default?: string
        }
        Update: {
          category?: string
          category_label?: string | null
          checklist?: Json
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          default_capacity?: number | null
          default_duration_minutes?: number
          default_mode?: string
          default_price_cents?: number
          description_en?: string | null
          description_es?: string | null
          followup_script_en?: string | null
          followup_script_es?: string | null
          id?: string
          invite_script_en?: string | null
          invite_script_es?: string | null
          is_published?: boolean
          launches_count?: number
          sort_order?: number
          team_id?: string | null
          theme?: string | null
          title?: string
          visibility_default?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          approved: boolean
          avatar_url: string | null
          city: string | null
          created_at: string
          id: string
          name: string
          photo_url: string | null
          quote_en: string
          quote_es: string | null
          sort_order: number
        }
        Insert: {
          approved?: boolean
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name: string
          photo_url?: string | null
          quote_en: string
          quote_es?: string | null
          sort_order?: number
        }
        Update: {
          approved?: boolean
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          photo_url?: string | null
          quote_en?: string
          quote_es?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      topic_reads: {
        Row: {
          last_read_at: string
          topic_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          topic_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_reads_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "discussion_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      track_managers: {
        Row: {
          assigned_by: string | null
          created_at: string
          role: string
          track_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          role?: string
          track_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          role?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_managers_assigner_profile_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_managers_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_managers_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          cover_style: number
          cover_url: string | null
          created_at: string
          description_en: string | null
          description_es: string | null
          id: string
          is_published: boolean
          is_start_here: boolean
          offer_id: string | null
          sort_order: number
          team_id: string
          title_en: string
          title_es: string
        }
        Insert: {
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          id?: string
          is_published?: boolean
          is_start_here?: boolean
          offer_id?: string | null
          sort_order?: number
          team_id: string
          title_en?: string
          title_es?: string
        }
        Update: {
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          id?: string
          is_published?: boolean
          is_start_here?: boolean
          offer_id?: string | null
          sort_order?: number
          team_id?: string
          title_en?: string
          title_es?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracks_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          awarded_at: string
          awarded_by: string | null
          badge_id: string
          featured: number | null
          id: string
          note: string | null
          seen_at: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string | null
          badge_id: string
          featured?: number | null
          id?: string
          note?: string | null
          seen_at?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          awarded_by?: string | null
          badge_id?: string
          featured?: number | null
          id?: string
          note?: string | null
          seen_at?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
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
      user_suspensions: {
        Row: {
          created_at: string
          reason: string
          suspended_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          reason: string
          suspended_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          reason?: string
          suspended_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      waiver_acceptances: {
        Row: {
          accepted_at: string
          accepted_body_sha256: string
          consent_text_version_id: string
          event_id: string
          full_name: string
          ip: string | null
          rsvp_id: string
          source: string
          team_id: string
          version: number
        }
        Insert: {
          accepted_at?: string
          accepted_body_sha256: string
          consent_text_version_id: string
          event_id: string
          full_name: string
          ip?: string | null
          rsvp_id: string
          source?: string
          team_id: string
          version: number
        }
        Update: {
          accepted_at?: string
          accepted_body_sha256?: string
          consent_text_version_id?: string
          event_id?: string
          full_name?: string
          ip?: string | null
          rsvp_id?: string
          source?: string
          team_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "waiver_acceptances_consent_text_version_id_fkey"
            columns: ["consent_text_version_id"]
            isOneToOne: false
            referencedRelation: "consent_text_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiver_acceptances_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiver_acceptances_rsvp_id_fkey"
            columns: ["rsvp_id"]
            isOneToOne: true
            referencedRelation: "rsvps"
            referencedColumns: ["id"]
          },
        ]
      }
      waivers: {
        Row: {
          body_en: string
          body_es: string
          is_draft: boolean
          team_id: string
          title_en: string
          title_es: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          body_en: string
          body_es: string
          is_draft?: boolean
          team_id: string
          title_en: string
          title_es: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          body_en?: string
          body_es?: string
          is_draft?: boolean
          team_id?: string
          title_en?: string
          title_es?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "waivers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      welcome_invites: {
        Row: {
          code: string
          created_at: string
          guest_key: string | null
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          guest_key?: string | null
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          guest_key?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      welcome_redemptions: {
        Row: {
          code: string
          created_at: string
          honored_at: string | null
          host_id: string
          id: string
          invite_code: string
          points: number
          reward_id: string | null
          status: string
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          honored_at?: string | null
          host_id: string
          id?: string
          invite_code: string
          points: number
          reward_id?: string | null
          status?: string
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          honored_at?: string | null
          host_id?: string
          id?: string
          invite_code?: string
          points?: number
          reward_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "welcome_redemptions_invite_code_fkey"
            columns: ["invite_code"]
            isOneToOne: false
            referencedRelation: "welcome_invites"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "welcome_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "welcome_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      welcome_referrals: {
        Row: {
          code: string
          created_at: string
          earned_at: string | null
          event_id: string
          friend_name: string
          host_id: string
          id: string
          points: number
          rsvp_id: string
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          earned_at?: string | null
          event_id: string
          friend_name?: string
          host_id: string
          id?: string
          points?: number
          rsvp_id: string
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          earned_at?: string | null
          event_id?: string
          friend_name?: string
          host_id?: string
          id?: string
          points?: number
          rsvp_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "welcome_referrals_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "welcome_invites"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "welcome_referrals_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "welcome_referrals_rsvp_id_fkey"
            columns: ["rsvp_id"]
            isOneToOne: true
            referencedRelation: "rsvps"
            referencedColumns: ["id"]
          },
        ]
      }
      welcome_rewards: {
        Row: {
          active: boolean
          created_at: string
          host_id: string
          id: string
          points_cost: number
          title_en: string
          title_es: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          host_id?: string
          id?: string
          points_cost: number
          title_en?: string
          title_es?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          host_id?: string
          id?: string
          points_cost?: number
          title_en?: string
          title_es?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_founding: { Args: never; Returns: undefined }
      active_fee_rule: {
        Args: { _at?: string; _offering_type: string }
        Returns: string
      }
      add_walk_in: {
        Args: {
          _email: string
          _event: string
          _first: string
          _language: string
          _last: string
          _mail: boolean
          _phone: string
          _sms: boolean
        }
        Returns: string
      }
      admin_broadcasts: { Args: never; Returns: Json }
      admin_day60: { Args: never; Returns: Json }
      admin_founding: { Args: never; Returns: Json }
      admin_grant_preview_license: {
        Args: { _team: string; _tier: string }
        Returns: undefined
      }
      admin_overview: { Args: { _since: string }; Returns: Json }
      admin_reports: { Args: { _status: string }; Returns: Json }
      admin_retry_message: { Args: { _id: string }; Returns: Json }
      admin_team_detail: { Args: { _id: string }; Returns: Json }
      admin_teams: { Args: { _q: string }; Returns: Json }
      admin_time_to_live: { Args: { _since: string }; Returns: Json }
      admin_user_detail: { Args: { _id: string }; Returns: Json }
      admin_users: { Args: { _q: string }; Returns: Json }
      ai_usage_status: { Args: never; Returns: Json }
      assign_license_seat: {
        Args: { _on: boolean; _team: string; _user: string }
        Returns: undefined
      }
      assign_small_group: {
        Args: { _group: string; _rsvp: string }
        Returns: undefined
      }
      award_badge: {
        Args: { _badge: string; _note: string; _team: string; _user: string }
        Returns: undefined
      }
      badge_holder_counts: {
        Args: { _ids: string[] }
        Returns: {
          badge_id: string
          holders: number
        }[]
      }
      build_member_plan: {
        Args: { _team: string; _user: string }
        Returns: undefined
      }
      calc_platform_fee_cents: {
        Args: { _net_cents: number; _rule: string }
        Returns: number
      }
      calendar_feed: {
        Args: { _token: string }
        Returns: {
          ends_at: string
          id: string
          location: string
          online: boolean
          role: string
          starts_at: string
          status: string
          title: string
          updated: string
        }[]
      }
      can_access_event_participants: {
        Args: { _event: string }
        Returns: boolean
      }
      can_access_offer: { Args: { _offer: string }; Returns: boolean }
      can_access_offer_participants: {
        Args: { _offer: string }
        Returns: boolean
      }
      can_access_track_participants: {
        Args: { _track: string }
        Returns: boolean
      }
      can_edit_track: { Args: { _track: string }; Returns: boolean }
      can_join_conversation: { Args: { _event: string }; Returns: boolean }
      can_manage_event: { Args: { _event_id: string }; Returns: boolean }
      can_moderate_comment: { Args: { _c: string }; Returns: boolean }
      can_read_challenge: { Args: { _c: string }; Returns: boolean }
      can_read_comment: { Args: { _c: string }; Returns: boolean }
      can_read_track: { Args: { _track: string }; Returns: boolean }
      can_review_coach: { Args: { _host: string }; Returns: boolean }
      can_rsvp_event: { Args: { _event_id: string }; Returns: boolean }
      can_use_team_templates: { Args: { _team: string }; Returns: boolean }
      can_view_event: { Args: { _event_id: string }; Returns: boolean }
      cancel_rsvp_by_code: { Args: { _code: string }; Returns: boolean }
      challenge_check_in: {
        Args: {
          _c: string
          _date: string
          _note?: string
          _photo?: string
          _tz: string
        }
        Returns: Json
      }
      challenge_counts: {
        Args: { _ids: string[] }
        Returns: {
          challenge_id: string
          members: number
        }[]
      }
      challenge_leaderboard: {
        Args: { _c: string; _tz?: string }
        Returns: {
          best_streak: number
          checkins: number
          current_streak: number
          full_name: string
          rank: number
          user_id: string
        }[]
      }
      challenge_stats: { Args: { _c: string; _tz?: string }; Returns: Json }
      challenge_streaks: {
        Args: { _c: string; _today?: string; _u: string }
        Returns: {
          best_streak: number
          checkins: number
          current_streak: number
          last_date: string
        }[]
      }
      chat_platform: { Args: { _url: string }; Returns: string }
      check_in_code: { Args: { _code: string; _event: string }; Returns: Json }
      check_in_rsvp: {
        Args: { _rsvp: string; _undo?: boolean }
        Returns: undefined
      }
      check_promo: {
        Args: { _buyer?: string; _code: string; _kind: string; _target: string }
        Returns: Json
      }
      claim_guest_records: { Args: never; Returns: Json }
      claim_outbox: {
        Args: { _limit?: number }
        Returns: {
          attempts: number
          channel: string
          id: string
          kind: string
          language: string
          payload: Json
          recipient: string
          skip_reason: string
          template: string
          unsub_token: string
          user_id: string
        }[]
      }
      cleanup_auth_intents: { Args: never; Returns: number }
      coach_checklist: { Args: never; Returns: Json }
      coach_trust: { Args: { _host: string }; Returns: Json }
      comment_feed: { Args: { _event: string; _topic: string }; Returns: Json }
      community_requests: {
        Args: { _kind: string; _target: string }
        Returns: Json
      }
      community_seat_info: {
        Args: { _kind: string; _target: string }
        Returns: Json
      }
      compute_playbook: { Args: never; Returns: number }
      confirm_adult: { Args: { _attest: boolean }; Returns: undefined }
      consume_auth_intent: { Args: { _token: string }; Returns: string }
      copy_starter_template: {
        Args: { _team: string; _template: string }
        Returns: string
      }
      create_auth_intent: { Args: { _path: string }; Returns: string }
      create_event_badge: {
        Args: {
          _event: string
          _icon: string
          _name_en: string
          _name_es: string
          _tier: string
        }
        Returns: string
      }
      create_gathering: {
        Args: { _p: Json; _publish: boolean; _team: string; _weekly: boolean }
        Returns: string
      }
      create_gathering_at: {
        Args: { _p: Json; _publish: boolean; _team: string; _weekly: boolean }
        Returns: string
      }
      create_poll: {
        Args: { _event: string; _options: string[]; _question: string }
        Returns: string
      }
      create_subteam: {
        Args: { _name: string; _parent: string }
        Returns: string
      }
      create_team: {
        Args: { _name: string }
        Returns: {
          id: string
          join_code: string
          slug: string
        }[]
      }
      create_topic: {
        Args: { _body: string; _team: string; _title: string }
        Returns: string
      }
      current_fee_pct: { Args: { _host: string }; Returns: number }
      decide_community_seat: {
        Args: { _approve: boolean; _id: string }
        Returns: string
      }
      decide_rsvp: {
        Args: { _approve: boolean; _rsvp: string }
        Returns: string
      }
      default_waiver: { Args: { _team: string }; Returns: undefined }
      delete_comment: { Args: { _id: string }; Returns: undefined }
      delete_my_account: { Args: never; Returns: undefined }
      delete_my_coach_review: { Args: { _host: string }; Returns: undefined }
      due_followup_events: { Args: never; Returns: string[] }
      duplicate_offer: { Args: { _offer: string }; Returns: string }
      effective_plan: { Args: { _uid: string }; Returns: Json }
      email_token: { Args: { _email: string; _lang: string }; Returns: string }
      enqueue_message: {
        Args: {
          _channel: string
          _event?: string
          _kind: string
          _language: string
          _lesson?: string
          _payload: Json
          _recipient: string
          _rsvp?: string
          _send_after?: string
          _team?: string
          _template: string
          _user?: string
        }
        Returns: undefined
      }
      enroll_free: { Args: { _offer: string }; Returns: undefined }
      evaluate_badges: {
        Args: { _team: string; _user: string }
        Returns: undefined
      }
      evaluate_milestones: {
        Args: { _team: string; _user: string }
        Returns: undefined
      }
      event_early_access: { Args: { _event: string }; Returns: Json }
      event_going_count: { Args: { _event_id: string }; Returns: number }
      event_payload: { Args: { _event: string; _rsvp: string }; Returns: Json }
      event_price: { Args: { _id: string }; Returns: Json }
      event_seats_used: { Args: { _event: string }; Returns: number }
      event_summary: { Args: { _event: string }; Returns: Json }
      event_waiver: { Args: { _event: string }; Returns: Json }
      event_waiver_k: {
        Args: { _event: string; _token: string }
        Returns: Json
      }
      feature_badge: {
        Args: { _id: string; _slot: number }
        Returns: undefined
      }
      featured_badges: {
        Args: { _user: string }
        Returns: {
          code: string
          featured: number
          icon: string
          id: string
          name_en: string
          name_es: string
          tier: string
        }[]
      }
      follow_target: {
        Args: {
          _email?: string
          _kind: string
          _lang?: string
          _target: string
        }
        Returns: undefined
      }
      followups_sent: {
        Args: { _from: string; _root: string; _scope: string; _to: string }
        Returns: number
      }
      founding_status: { Args: { _uid: string }; Returns: Json }
      gathering_validate: { Args: { _p: Json }; Returns: undefined }
      gatherings_in_month: {
        Args: { _at: string; _uid: string }
        Returns: number
      }
      gatherings_this_month: { Args: { _uid: string }; Returns: number }
      get_email_prefs: { Args: { _token: string }; Returns: Json }
      get_member_plan: { Args: { _team: string }; Returns: Json }
      get_public_event: { Args: { _id: string }; Returns: Json }
      get_public_event_k: {
        Args: { _id: string; _token: string }
        Returns: Json
      }
      get_public_host: { Args: { _slug: string }; Returns: Json }
      get_public_location: { Args: { _slug: string }; Returns: Json }
      get_public_offer: { Args: { _id: string }; Returns: Json }
      get_public_team: { Args: { _slug: string }; Returns: Json }
      get_rsvp_by_code: { Args: { _code: string }; Returns: Json }
      get_team_invite: {
        Args: { _code: string }
        Returns: {
          leader_name: string
          team_id: string
          team_name: string
        }[]
      }
      give_shoutout: {
        Args: { _message: string; _photo: string; _team: string; _to: string }
        Returns: string
      }
      grant_auto_badge: {
        Args: { _code: string; _team: string; _user: string }
        Returns: undefined
      }
      grant_badge: {
        Args: {
          _badge: string
          _by: string
          _note: string
          _team: string
          _user: string
        }
        Returns: boolean
      }
      grant_offer_access: {
        Args: { _email: string; _offer: string }
        Returns: string
      }
      guest_cap: { Args: { _event: string }; Returns: number }
      guest_invite_code_for: { Args: { _checkin: string }; Returns: string }
      guest_key_of: {
        Args: { _email: string; _phone: string }
        Returns: string
      }
      guest_redeem_welcome: {
        Args: { _checkin: string; _reward: string }
        Returns: string
      }
      guest_welcome: { Args: { _checkin: string }; Returns: Json }
      handle_sms_inbound: {
        Args: { _body: string; _from: string }
        Returns: string
      }
      handle_sms_reply: {
        Args: { _body: string; _from: string }
        Returns: Json
      }
      has_blocked_claim: { Args: { _text: string }; Returns: boolean }
      has_entitlement: {
        Args: { _kind: string; _target: string }
        Returns: boolean
      }
      has_offer_access: {
        Args: { _offer: string; _uid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      honor_welcome_code: { Args: { _code: string }; Returns: Json }
      host_cancel_rsvp: {
        Args: { _reason: string; _rsvp: string }
        Returns: undefined
      }
      host_fees_this_month: { Args: { _host: string }; Returns: number }
      host_month_recap: {
        Args: { _host: string; _start: string }
        Returns: Json
      }
      host_no_limits_until: { Args: { _uid: string }; Returns: string }
      host_sales_this_month: { Args: { _host: string }; Returns: number }
      host_value_month: {
        Args: { _host: string; _start: string }
        Returns: Json
      }
      infer_gathering_category: {
        Args: { _category: string; _title: string }
        Returns: string
      }
      is_adult: { Args: { _uid?: string }; Returns: boolean }
      is_connected: { Args: { _a: string; _b: string }; Returns: boolean }
      is_event_cohost: { Args: { _event: string }; Returns: boolean }
      is_founding_coach: { Args: { _uid: string }; Returns: boolean }
      is_host_anywhere: { Args: { _u: string }; Returns: boolean }
      is_member_of: { Args: { _team: string; _user: string }; Returns: boolean }
      is_safe_return_path: { Args: { _p: string }; Returns: boolean }
      is_team_member: {
        Args: { _roles: string[]; _team_id: string }
        Returns: boolean
      }
      is_verified_coach: { Args: { _user: string }; Returns: boolean }
      join_free_offer: { Args: { _offer: string }; Returns: undefined }
      join_team_by_code: {
        Args: { _by?: string; _code: string; _role?: string }
        Returns: string
      }
      landing_social_proof: { Args: never; Returns: Json }
      launch_template: {
        Args: {
          _location_name: string
          _online_url: string
          _publish: boolean
          _starts_at: string
          _team: string
          _template: string
          _timezone: string
        }
        Returns: string
      }
      leave_free_offer: { Args: { _offer: string }; Returns: undefined }
      list_public_gatherings: {
        Args: { _days?: number; _include_samples?: boolean; _limit?: number }
        Returns: Json
      }
      list_public_locations: { Args: never; Returns: Json }
      live_lesson_link: { Args: { _lesson: string }; Returns: string }
      local_today: { Args: { _tz: string }; Returns: string }
      make_profile_slug: { Args: { _name: string }; Returns: string }
      manage_topic: {
        Args: { _delete: boolean; _id: string; _pinned: boolean }
        Returns: undefined
      }
      mark_badges_seen: { Args: { _ids: string[] }; Returns: undefined }
      mark_topic_read: { Args: { _id: string }; Returns: undefined }
      moderate_comment: {
        Args: { _hidden: boolean; _id: string; _pinned: boolean }
        Returns: undefined
      }
      moderate_shoutout: {
        Args: { _action: string; _id: string }
        Returns: undefined
      }
      my_broadcasts: {
        Args: never
        Returns: {
          body_en: string
          body_es: string
          created_at: string
          id: string
          title_en: string
          title_es: string
        }[]
      }
      my_calendar_feeds: { Args: never; Returns: Json }
      my_invite_code: { Args: never; Returns: string }
      my_learning: { Args: never; Returns: Json }
      my_offer_stats: {
        Args: never
        Returns: {
          active: number
          offer_id: string
          total: number
        }[]
      }
      my_plan_status: { Args: never; Returns: Json }
      my_poll_votes: {
        Args: { _code: string; _event: string }
        Returns: {
          option_id: string
          poll_id: string
        }[]
      }
      my_progress: { Args: { _tz: string }; Returns: Json }
      my_referrals: { Args: never; Returns: Json }
      my_regular_hosts: {
        Args: never
        Returns: {
          checkins: number
          host_id: string
          host_name: string
        }[]
      }
      my_sole_leader_teams: {
        Args: never
        Returns: {
          team_id: string
          team_name: string
        }[]
      }
      my_tickets: { Args: never; Returns: Json }
      my_value_meter: { Args: never; Returns: Json }
      my_welcome: { Args: never; Returns: Json }
      name_host_of_month: {
        Args: { _note: string; _team: string; _user: string }
        Returns: undefined
      }
      name_member_of_month: {
        Args: { _note: string; _team: string; _user: string }
        Returns: undefined
      }
      network_feature: {
        Args: { _event: string; _on: boolean; _team: string }
        Returns: undefined
      }
      network_overview: { Args: never; Returns: Json }
      network_remove: { Args: { _link: string }; Returns: undefined }
      network_request: { Args: { _to: string }; Returns: undefined }
      network_respond: {
        Args: { _accept: boolean; _link: string }
        Returns: undefined
      }
      network_share: {
        Args: { _event: string; _on: boolean }
        Returns: undefined
      }
      normalize_phone: { Args: { _p: string }; Returns: string }
      note_plan_waitlist: { Args: { _event: string }; Returns: undefined }
      notify_announcement: {
        Args: { _announcement: string; _email: boolean; _subteams: boolean }
        Returns: number
      }
      notify_gathering_cancelled: { Args: { _event: string }; Returns: number }
      notify_rsvp_person: {
        Args: {
          _payload: Json
          _r: Database["public"]["Tables"]["rsvps"]["Row"]
          _template: string
        }
        Returns: undefined
      }
      notify_rsvp_request: { Args: { _rsvp: string }; Returns: undefined }
      offer_founding_status: { Args: { _offer: string }; Returns: Json }
      offer_readiness: { Args: { _offer: string }; Returns: Json }
      pair_buddy: {
        Args: { _buddy: string; _rsvp: string }
        Returns: undefined
      }
      payouts_live: { Args: { _uid: string }; Returns: boolean }
      plan_limits: { Args: { _plan: string }; Returns: Json }
      platform_fee_cents: {
        Args: { _amount: number; _host: string }
        Returns: number
      }
      playbook_cards: {
        Args: { _category?: string; _context: string }
        Returns: Json
      }
      playbook_event_metrics: {
        Args: { _since: string }
        Returns: {
          category: string
          checkins: number
          dow: number
          event_id: string
          going: number
          hr: number
          minutes: number
          team_id: string
        }[]
      }
      post_challenge_encouragement: {
        Args: { _c: string; _message: string }
        Returns: undefined
      }
      post_comment: {
        Args: {
          _body: string
          _event: string
          _mentions: string[]
          _parent: string
          _topic: string
        }
        Returns: string
      }
      post_shoutout: {
        Args: { _message: string; _team: string; _to: string }
        Returns: undefined
      }
      price_guidance: { Args: { _category: string }; Returns: Json }
      progress_core: { Args: { _tz: string; _user: string }; Returns: Json }
      promo_usage: {
        Args: never
        Returns: {
          discount_cents: number
          promo_id: string
          uses: number
        }[]
      }
      promote_waitlist: { Args: { _event: string }; Returns: undefined }
      public_upcoming: { Args: { _host: string; _team: string }; Returns: Json }
      queue_broadcast: { Args: { _id: string }; Returns: number }
      queue_rsvp_notices: {
        Args: { _rsvp: string; _template: string }
        Returns: undefined
      }
      queue_rsvp_reminders: { Args: { _rsvp: string }; Returns: undefined }
      record_ai_usage: {
        Args: { _feature: string; _input: number; _output: number }
        Returns: undefined
      }
      record_delivery_event: {
        Args: {
          _email: string
          _event: string
          _message_id: string
          _payload: Json
          _provider: string
        }
        Returns: undefined
      }
      record_referral: {
        Args: { _code: string; _ref: string }
        Returns: undefined
      }
      record_waiver: {
        Args: { _ip: string; _name: string; _rsvp: string; _source: string }
        Returns: undefined
      }
      record_welcome_invite: {
        Args: { _invite: string; _rsvp_code: string }
        Returns: undefined
      }
      redeem_welcome_reward: { Args: { _reward: string }; Returns: string }
      register_attendance: {
        Args: {
          _answers: Json
          _email: string
          _event_id: string
          _first: string
          _language: string
          _last: string
          _mail: boolean
          _phone: string
          _plus_ones: number
          _sms: boolean
          _status: string
          _terms_ok: boolean
          _tier_id: string
          _token: string
          _updates_opt_in: boolean
          _waiver_name: string
        }
        Returns: {
          code: string
          status: string
        }[]
      }
      report_content: {
        Args: { _id: string; _note: string; _reason: string; _type: string }
        Returns: boolean
      }
      request_community_seat: {
        Args: {
          _kind: string
          _note: string
          _pay_cents: number
          _target: string
        }
        Returns: undefined
      }
      request_ip: { Args: never; Returns: string }
      reset_calendar_feeds: { Args: never; Returns: Json }
      reset_invite_link: { Args: { _event: string }; Returns: string }
      reset_join_code: { Args: { _team: string }; Returns: string }
      resume_my_membership: { Args: { _offer: string }; Returns: undefined }
      retreat_checklist: { Args: { _code: string }; Returns: Json }
      rsvp_belonging: {
        Args: { _event: string }
        Returns: {
          checkins: number
          first_time: boolean
          regular: boolean
          rsvp_id: string
        }[]
      }
      rsvp_event: {
        Args: {
          _email: string
          _event_id: string
          _first: string
          _language: string
          _last: string
          _mail: boolean
          _phone: string
          _plus_ones: number
          _sms: boolean
          _status: string
        }
        Returns: {
          code: string
          status: string
        }[]
      }
      rsvp_event_full: {
        Args: {
          _answers: Json
          _email: string
          _event_id: string
          _first: string
          _language: string
          _last: string
          _mail: boolean
          _phone: string
          _plus_ones: number
          _sms: boolean
          _status: string
          _token: string
          _waiver_name: string
        }
        Returns: {
          code: string
          status: string
        }[]
      }
      rsvp_event_minor: {
        Args: {
          _event_id: string
          _guardian_email: string
          _guardian_name: string
          _guardian_phone: string
          _guardian_relationship: string
          _language: string
          _mail: boolean
          _minor_age_band: string
          _minor_first: string
          _sms: boolean
          _token: string
        }
        Returns: {
          code: string
          status: string
        }[]
      }
      rsvp_event_waiver: {
        Args: {
          _email: string
          _event_id: string
          _first: string
          _language: string
          _last: string
          _mail: boolean
          _phone: string
          _plus_ones: number
          _sms: boolean
          _status: string
          _waiver_name: string
        }
        Returns: {
          code: string
          status: string
        }[]
      }
      rsvp_first_time: { Args: { _code: string }; Returns: Json }
      rsvp_person_key: {
        Args: { _r: Database["public"]["Tables"]["rsvps"]["Row"] }
        Returns: string
      }
      rsvp_team: {
        Args: {
          _event_id: string
          _language: string
          _participants: Json
          _team_name: string
          _token: string
        }
        Returns: Json
      }
      save_assistant_recipe: {
        Args: {
          _ingredients: Json
          _prep: number
          _steps: Json
          _title_en: string
          _title_es: string
        }
        Returns: string
      }
      save_coach_review: {
        Args: { _body: string; _host: string; _rating: number }
        Returns: undefined
      }
      search_team_library: {
        Args: { _q: string; _team: string }
        Returns: {
          excerpt: string
          rank: number
          source_id: string
          source_type: string
          title: string
        }[]
      }
      send_text_invites: {
        Args: { _event: string; _phones: string[] }
        Returns: number
      }
      send_value_receipts: { Args: never; Returns: number }
      service_fee_cents: {
        Args: { _amount: number; _host: string }
        Returns: number
      }
      set_buddy_wish: {
        Args: { _code: string; _on: boolean }
        Returns: undefined
      }
      set_early_access: {
        Args: { _event: string; _hours: number; _offer: string }
        Returns: undefined
      }
      set_email_prefs: {
        Args: { _prefs: Json; _token: string }
        Returns: boolean
      }
      set_event_cohosts: {
        Args: { _event: string; _users: string[] }
        Returns: undefined
      }
      set_event_location: {
        Args: { _event: string; _location: string }
        Returns: undefined
      }
      set_event_retreat: {
        Args: { _ends_at: string; _event: string; _retreat: Json }
        Returns: undefined
      }
      set_pass_fee: { Args: { _on: boolean }; Returns: undefined }
      set_referral_thanks: {
        Args: { _amount: number; _kind: string }
        Returns: undefined
      }
      set_small_groups: {
        Args: { _event: string; _groups: string[] }
        Returns: undefined
      }
      shared_progress: {
        Args: { _team: string; _tz: string; _user: string }
        Returns: Json
      }
      shares_team_with: { Args: { _other: string }; Returns: boolean }
      sign_waiver_at_door: {
        Args: { _name: string; _rsvp: string }
        Returns: undefined
      }
      sign_waiver_by_code: {
        Args: { _code: string; _name: string }
        Returns: undefined
      }
      start_hosting_window: { Args: never; Returns: string }
      storage_allows: { Args: { _bytes: number }; Returns: boolean }
      storage_used_bytes: { Args: { _uid: string }; Returns: number }
      submit_verification: {
        Args: { _credentials: Json; _identity: string; _years: number }
        Returns: string
      }
      team_benchmark: { Args: { _root: string }; Returns: Json }
      team_featured_gatherings: { Args: { _team: string }; Returns: Json }
      team_insights: {
        Args: { _from: string; _root: string; _scope: string; _to: string }
        Returns: Json
      }
      team_topics: { Args: { _team: string }; Returns: Json }
      team_tree: {
        Args: { _root: string }
        Returns: {
          depth: number
          events_this_month: number
          id: string
          leader_name: string
          member_count: number
          name: string
          parent_team_id: string
        }[]
      }
      text_invite_candidates: {
        Args: { _event: string }
        Returns: {
          invited: boolean
          language: string
          last_seen: string
          name: string
          phone: string
        }[]
      }
      toggle_comment_reaction: {
        Args: { _id: string; _kind: string }
        Returns: boolean
      }
      toggle_retreat_item: {
        Args: { _code: string; _item: number; _on: boolean }
        Returns: undefined
      }
      track_progress: {
        Args: { _team: string }
        Returns: {
          completed: number
          lessons: number
          started: number
          track_id: string
        }[]
      }
      transfer_leadership: {
        Args: { _team: string; _to: string }
        Returns: undefined
      }
      unlock_invite: {
        Args: { _event: string; _token: string }
        Returns: undefined
      }
      update_event_details: {
        Args: { _event: string; _p: Json }
        Returns: undefined
      }
      update_gathering: {
        Args: { _event: string; _p: Json; _whole_series: boolean }
        Returns: undefined
      }
      update_rsvp_by_code: {
        Args: { _code: string; _plus_ones: number; _status: string }
        Returns: string
      }
      user_email: { Args: { _user: string }; Returns: string }
      verified_hosts: { Args: { _ids: string[] }; Returns: string[] }
      vote_poll: {
        Args: { _code: string; _option: string }
        Returns: undefined
      }
      waitlist_position: { Args: { _code: string }; Returns: number }
      walk_in_waiver: {
        Args: { _name: string; _rsvp: string }
        Returns: undefined
      }
      welcome_new_code: { Args: never; Returns: string }
      welcome_redeem_for: {
        Args: { _code: string; _reward: string }
        Returns: string
      }
      welcome_summary: { Args: { _code: string }; Returns: Json }
      withdraw_community_request: {
        Args: { _kind: string; _target: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
