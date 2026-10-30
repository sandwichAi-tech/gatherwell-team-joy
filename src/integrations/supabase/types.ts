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
          archived_at: string | null
          author_id: string
          body: string
          created_at: string
          id: string
          link_url: string | null
          photo_url: string | null
          pinned: boolean
          team_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          author_id?: string
          body: string
          created_at?: string
          id?: string
          link_url?: string | null
          photo_url?: string | null
          pinned?: boolean
          team_id: string
          title?: string
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          link_url?: string | null
          photo_url?: string | null
          pinned?: boolean
          team_id?: string
          title?: string
          updated_at?: string | null
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
      assessment_receipts: {
        Row: {
          answers: Json
          completed_at: string
          config_snapshot: Json
          id: string
          quiz_id: string
          request_id: string
          result_snapshot: Json | null
          revision: number
          scope_id: string
          score: number | null
          user_id: string
        }
        Insert: {
          answers: Json
          completed_at?: string
          config_snapshot: Json
          id?: string
          quiz_id: string
          request_id: string
          result_snapshot?: Json | null
          revision: number
          scope_id: string
          score?: number | null
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string
          config_snapshot?: Json
          id?: string
          quiz_id?: string
          request_id?: string
          result_snapshot?: Json | null
          revision?: number
          scope_id?: string
          score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_receipts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_receipts_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "assessment_scope_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_scope_versions: {
        Row: {
          approval_reference: string
          approved_at: string
          approved_by: string
          document_hash: string
          document_text: string
          id: string
          locale: string
          retired_at: string | null
          version: number
        }
        Insert: {
          approval_reference: string
          approved_at: string
          approved_by: string
          document_hash: string
          document_text: string
          id?: string
          locale: string
          retired_at?: string | null
          version: number
        }
        Update: {
          approval_reference?: string
          approved_at?: string
          approved_by?: string
          document_hash?: string
          document_text?: string
          id?: string
          locale?: string
          retired_at?: string | null
          version?: number
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
      certificates: {
        Row: {
          cert_number: string
          course_title: string
          expires_at: string | null
          id: string
          issued_at: string
          issuer_name: string
          learner_name: string
          offer_id: string
          revoke_reason: string | null
          revoked_at: string | null
          signer_name: string | null
          signer_title: string | null
          statement: string | null
          user_id: string
        }
        Insert: {
          cert_number: string
          course_title: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          issuer_name: string
          learner_name: string
          offer_id: string
          revoke_reason?: string | null
          revoked_at?: string | null
          signer_name?: string | null
          signer_title?: string | null
          statement?: string | null
          user_id: string
        }
        Update: {
          cert_number?: string
          course_title?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          issuer_name?: string
          learner_name?: string
          offer_id?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          signer_name?: string | null
          signer_title?: string | null
          statement?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_activities: {
        Row: {
          challenge_id: string
          created_at: string
          day_offset: number | null
          due_hour: number | null
          file_path: string | null
          id: string
          instructions_en: string | null
          instructions_es: string | null
          link_url: string | null
          requires_checkin: boolean
          requires_note: boolean
          resource_id: string | null
          resource_kind: string | null
          sort_order: number
          title_en: string
          title_es: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          day_offset?: number | null
          due_hour?: number | null
          file_path?: string | null
          id?: string
          instructions_en?: string | null
          instructions_es?: string | null
          link_url?: string | null
          requires_checkin?: boolean
          requires_note?: boolean
          resource_id?: string | null
          resource_kind?: string | null
          sort_order?: number
          title_en?: string
          title_es?: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          day_offset?: number | null
          due_hour?: number | null
          file_path?: string | null
          id?: string
          instructions_en?: string | null
          instructions_es?: string | null
          link_url?: string | null
          requires_checkin?: boolean
          requires_note?: boolean
          resource_id?: string | null
          resource_kind?: string | null
          sort_order?: number
          title_en?: string
          title_es?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_activities_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
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
      challenge_invites: {
        Row: {
          challenge_id: string
          created_at: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_invites_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_invites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_members: {
        Row: {
          access_status: string
          challenge_id: string
          extras: Json
          joined_at: string
          order_id: string | null
          payment_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          access_status?: string
          challenge_id: string
          extras?: Json
          joined_at?: string
          order_id?: string | null
          payment_id?: string | null
          source?: string
          user_id?: string
        }
        Update: {
          access_status?: string
          challenge_id?: string
          extras?: Json
          joined_at?: string
          order_id?: string | null
          payment_id?: string | null
          source?: string
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
          {
            foreignKeyName: "challenge_members_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_members_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_messages: {
        Row: {
          body_en: string
          body_es: string
          challenge_id: string
          channel: string
          created_at: string
          enabled: boolean
          id: string
          kind: string
          paused: boolean
          send_hour: number
          send_offset_days: number
          sort_order: number
          title_en: string
          title_es: string
        }
        Insert: {
          body_en?: string
          body_es?: string
          challenge_id: string
          channel?: string
          created_at?: string
          enabled?: boolean
          id?: string
          kind: string
          paused?: boolean
          send_hour?: number
          send_offset_days?: number
          sort_order?: number
          title_en?: string
          title_es?: string
        }
        Update: {
          body_en?: string
          body_es?: string
          challenge_id?: string
          channel?: string
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          paused?: boolean
          send_hour?: number
          send_offset_days?: number
          sort_order?: number
          title_en?: string
          title_es?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_messages_challenge_id_fkey"
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
          addons: Json
          capacity: number | null
          cover_style: number
          cover_url: string | null
          created_at: string
          created_by: string
          currency: string
          daily_prompt_en: string | null
          daily_prompt_es: string | null
          description_en: string | null
          description_es: string | null
          draft_request_id: string | null
          ends_on: string
          enrollment: string
          frequency: string
          goal_target: number | null
          goal_unit: string | null
          id: string
          is_paid: boolean
          leaderboard_on: boolean
          model: string
          price_cents: number | null
          starts_on: string
          status: string
          team_id: string
          timezone: string | null
          title_en: string
          title_es: string
        }
        Insert: {
          addons?: Json
          capacity?: number | null
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          daily_prompt_en?: string | null
          daily_prompt_es?: string | null
          description_en?: string | null
          description_es?: string | null
          draft_request_id?: string | null
          ends_on: string
          enrollment?: string
          frequency?: string
          goal_target?: number | null
          goal_unit?: string | null
          id?: string
          is_paid?: boolean
          leaderboard_on?: boolean
          model?: string
          price_cents?: number | null
          starts_on: string
          status?: string
          team_id: string
          timezone?: string | null
          title_en?: string
          title_es?: string
        }
        Update: {
          addons?: Json
          capacity?: number | null
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          daily_prompt_en?: string | null
          daily_prompt_es?: string | null
          description_en?: string | null
          description_es?: string | null
          draft_request_id?: string | null
          ends_on?: string
          enrollment?: string
          frequency?: string
          goal_target?: number | null
          goal_unit?: string | null
          id?: string
          is_paid?: boolean
          leaderboard_on?: boolean
          model?: string
          price_cents?: number | null
          starts_on?: string
          status?: string
          team_id?: string
          timezone?: string | null
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
      coach_subscriptions: {
        Row: {
          announcements: boolean
          coach_id: string
          confirmation_expires_at: string | null
          confirmation_hash: string | null
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          language: string
          new_events: boolean
          new_resources: boolean
          pending_preferences: Json | null
          token_expires_at: string
          token_hash: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          announcements?: boolean
          coach_id: string
          confirmation_expires_at?: string | null
          confirmation_hash?: string | null
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          language?: string
          new_events?: boolean
          new_resources?: boolean
          pending_preferences?: Json | null
          token_expires_at?: string
          token_hash: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          announcements?: boolean
          coach_id?: string
          confirmation_expires_at?: string | null
          confirmation_hash?: string | null
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          language?: string
          new_events?: boolean
          new_resources?: boolean
          pending_preferences?: Json | null
          token_expires_at?: string
          token_hash?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_subscriptions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          client_request_id: string | null
          created_at: string
          event_id: string | null
          hidden: boolean
          id: string
          parent_id: string | null
          pinned: boolean
          removed_at: string | null
          removed_by: string | null
          removed_reason: string | null
          team_id: string
          topic_id: string | null
        }
        Insert: {
          author_id: string
          body: string
          client_request_id?: string | null
          created_at?: string
          event_id?: string | null
          hidden?: boolean
          id?: string
          parent_id?: string | null
          pinned?: boolean
          removed_at?: string | null
          removed_by?: string | null
          removed_reason?: string | null
          team_id: string
          topic_id?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          client_request_id?: string | null
          created_at?: string
          event_id?: string | null
          hidden?: boolean
          id?: string
          parent_id?: string | null
          pinned?: boolean
          removed_at?: string | null
          removed_by?: string | null
          removed_reason?: string | null
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
      community_suspensions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          reason: string
          revoked_at: string | null
          revoked_by: string | null
          scope_id: string | null
          scope_type: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          reason: string
          revoked_at?: string | null
          revoked_by?: string | null
          scope_id?: string | null
          scope_type: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          reason?: string
          revoked_at?: string | null
          revoked_by?: string | null
          scope_id?: string | null
          scope_type?: string
          team_id?: string
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
          approval_reference: string | null
          approved_at: string | null
          body: string
          body_sha256: string
          created_at: string
          document_url: string | null
          effective_from: string
          id: string
          kind: string
          locale: string
          team_id: string | null
          version: number
        }
        Insert: {
          approval_reference?: string | null
          approved_at?: string | null
          body: string
          body_sha256: string
          created_at?: string
          document_url?: string | null
          effective_from?: string
          id?: string
          kind: string
          locale: string
          team_id?: string | null
          version: number
        }
        Update: {
          approval_reference?: string | null
          approved_at?: string | null
          body?: string
          body_sha256?: string
          created_at?: string
          document_url?: string | null
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
      contact_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "contact_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_threads: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          last_message_at: string
          offer_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          last_message_at?: string
          offer_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          last_message_at?: string
          offer_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
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
          locked: boolean
          pinned: boolean
          team_id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          last_post_at?: string
          locked?: boolean
          pinned?: boolean
          team_id: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          last_post_at?: string
          locked?: boolean
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
      event_builder_drafts: {
        Row: {
          event_id: string
          snapshot: Json
          updated_at: string
        }
        Insert: {
          event_id: string
          snapshot: Json
          updated_at?: string
        }
        Update: {
          event_id?: string
          snapshot?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_builder_drafts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
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
      event_waiver_acceptances: {
        Row: {
          accepted_at: string
          content_sha256: string
          event_id: string
          id: string
          order_ref: string | null
          rsvp_id: string
          source: string
          user_id: string | null
          version: number
          waiver_id: string
        }
        Insert: {
          accepted_at?: string
          content_sha256: string
          event_id: string
          id?: string
          order_ref?: string | null
          rsvp_id: string
          source?: string
          user_id?: string | null
          version: number
          waiver_id: string
        }
        Update: {
          accepted_at?: string
          content_sha256?: string
          event_id?: string
          id?: string
          order_ref?: string | null
          rsvp_id?: string
          source?: string
          user_id?: string | null
          version?: number
          waiver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_waiver_acceptances_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_waiver_acceptances_rsvp_id_fkey"
            columns: ["rsvp_id"]
            isOneToOne: false
            referencedRelation: "rsvps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_waiver_acceptances_waiver_id_fkey"
            columns: ["waiver_id"]
            isOneToOne: false
            referencedRelation: "event_waivers"
            referencedColumns: ["id"]
          },
        ]
      }
      event_waiver_versions: {
        Row: {
          body_en: string
          body_es: string
          content_sha256: string
          created_at: string
          file_name: string | null
          file_path: string | null
          kind: string
          required: boolean
          title_en: string
          title_es: string
          version: number
          waiver_id: string
        }
        Insert: {
          body_en: string
          body_es: string
          content_sha256: string
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          kind: string
          required: boolean
          title_en: string
          title_es: string
          version: number
          waiver_id: string
        }
        Update: {
          body_en?: string
          body_es?: string
          content_sha256?: string
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          kind?: string
          required?: boolean
          title_en?: string
          title_es?: string
          version?: number
          waiver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_waiver_versions_waiver_id_fkey"
            columns: ["waiver_id"]
            isOneToOne: false
            referencedRelation: "event_waivers"
            referencedColumns: ["id"]
          },
        ]
      }
      event_waivers: {
        Row: {
          archived_at: string | null
          body_en: string
          body_es: string
          content_sha256: string
          created_at: string
          created_by: string | null
          event_id: string
          file_name: string | null
          file_path: string | null
          id: string
          kind: string
          library_id: string | null
          library_version: number | null
          position: number
          required: boolean
          team_id: string | null
          title_en: string
          title_es: string
          updated_at: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          body_en?: string
          body_es?: string
          content_sha256?: string
          created_at?: string
          created_by?: string | null
          event_id: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          kind?: string
          library_id?: string | null
          library_version?: number | null
          position?: number
          required?: boolean
          team_id?: string | null
          title_en?: string
          title_es?: string
          updated_at?: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          body_en?: string
          body_es?: string
          content_sha256?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          kind?: string
          library_id?: string | null
          library_version?: number | null
          position?: number
          required?: boolean
          team_id?: string | null
          title_en?: string
          title_es?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_waivers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_waivers_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "waiver_library"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          accessibility_notes: string | null
          addons: Json
          address: string | null
          agreements_locked: boolean
          allows_minors: boolean
          builder_draft: Json | null
          cancellation_policy: string | null
          capacity: number | null
          category: string | null
          category_label: string | null
          chat_links: Json
          community_seats: number | null
          completed_at: string | null
          contact_email: string | null
          contact_phone: string | null
          cover_alt: string | null
          cover_focal: string
          cover_overlay: number
          cover_service_fee: boolean
          cover_style: number
          cover_url: string | null
          created_at: string
          description_en: string | null
          description_es: string | null
          discussion_enabled: boolean
          early_offer_id: string | null
          ends_at: string | null
          experience_sessions: Json
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
          platform_agreement_en: string | null
          platform_agreement_es: string | null
          policy_config: Json | null
          price_cents: number | null
          public_counts: string
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
          team_waiver_version: number | null
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
          agreements_locked?: boolean
          allows_minors?: boolean
          builder_draft?: Json | null
          cancellation_policy?: string | null
          capacity?: number | null
          category?: string | null
          category_label?: string | null
          chat_links?: Json
          community_seats?: number | null
          completed_at?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          cover_alt?: string | null
          cover_focal?: string
          cover_overlay?: number
          cover_service_fee?: boolean
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          discussion_enabled?: boolean
          early_offer_id?: string | null
          ends_at?: string | null
          experience_sessions?: Json
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
          platform_agreement_en?: string | null
          platform_agreement_es?: string | null
          policy_config?: Json | null
          price_cents?: number | null
          public_counts?: string
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
          team_waiver_version?: number | null
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
          agreements_locked?: boolean
          allows_minors?: boolean
          builder_draft?: Json | null
          cancellation_policy?: string | null
          capacity?: number | null
          category?: string | null
          category_label?: string | null
          chat_links?: Json
          community_seats?: number | null
          completed_at?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          cover_alt?: string | null
          cover_focal?: string
          cover_overlay?: number
          cover_service_fee?: boolean
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          discussion_enabled?: boolean
          early_offer_id?: string | null
          ends_at?: string | null
          experience_sessions?: Json
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
          platform_agreement_en?: string | null
          platform_agreement_es?: string | null
          policy_config?: Json | null
          price_cents?: number | null
          public_counts?: string
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
          team_waiver_version?: number | null
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
            foreignKeyName: "events_platform_agreement_en_fkey"
            columns: ["platform_agreement_en"]
            isOneToOne: false
            referencedRelation: "consent_text_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_platform_agreement_es_fkey"
            columns: ["platform_agreement_es"]
            isOneToOne: false
            referencedRelation: "consent_text_versions"
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
      host_feature_interest: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      host_invites: {
        Row: {
          created_at: string
          id: string
          inviter_id: string | null
          recorded_at: string | null
          signed_up_user_id: string | null
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          inviter_id?: string | null
          recorded_at?: string | null
          signed_up_user_id?: string | null
          token: string
        }
        Update: {
          created_at?: string
          id?: string
          inviter_id?: string | null
          recorded_at?: string | null
          signed_up_user_id?: string | null
          token?: string
        }
        Relationships: []
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
      host_updates: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          offering_id: string
          offering_kind: string
          published_at: string | null
          scheduled_at: string | null
          status: string
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          offering_id: string
          offering_kind: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          offering_id?: string
          offering_kind?: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          team_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
          started_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          lesson_id: string
          started_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string
          lesson_id?: string
          started_at?: string
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
          detached_at: string | null
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
          resource_offer_id: string | null
          resource_quiz_id: string | null
          resource_recipe_id: string | null
          resource_track_id: string | null
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
          detached_at?: string | null
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
          resource_offer_id?: string | null
          resource_quiz_id?: string | null
          resource_recipe_id?: string | null
          resource_track_id?: string | null
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
          detached_at?: string | null
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
          resource_offer_id?: string | null
          resource_quiz_id?: string | null
          resource_recipe_id?: string | null
          resource_track_id?: string | null
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
            foreignKeyName: "lessons_resource_offer_id_fkey"
            columns: ["resource_offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_resource_quiz_id_fkey"
            columns: ["resource_quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_resource_recipe_id_fkey"
            columns: ["resource_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_resource_track_id_fkey"
            columns: ["resource_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
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
      location_alerts: {
        Row: {
          categories: string[]
          city: string | null
          country: string | null
          created_at: string
          frequency: string
          id: string
          kinds: string[]
          label: string | null
          language: string | null
          lat: number | null
          lng: number | null
          paused: boolean
          radius_km: number
          region: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          categories?: string[]
          city?: string | null
          country?: string | null
          created_at?: string
          frequency?: string
          id?: string
          kinds?: string[]
          label?: string | null
          language?: string | null
          lat?: number | null
          lng?: number | null
          paused?: boolean
          radius_km?: number
          region?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          categories?: string[]
          city?: string | null
          country?: string | null
          created_at?: string
          frequency?: string
          id?: string
          kinds?: string[]
          label?: string | null
          language?: string | null
          lat?: number | null
          lng?: number | null
          paused?: boolean
          radius_km?: number
          region?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      message_automations: {
        Row: {
          audience: string
          channel: string
          created_at: string
          created_by: string | null
          event_id: string | null
          id: string
          name: string
          status: string
          team_id: string
          template_id: string | null
          timing_hours: number
          trigger: string
          updated_at: string
        }
        Insert: {
          audience?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          name: string
          status?: string
          team_id: string
          template_id?: string | null
          timing_hours?: number
          trigger: string
          updated_at?: string
        }
        Update: {
          audience?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          name?: string
          status?: string
          team_id?: string
          template_id?: string | null
          timing_hours?: number
          trigger?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_automations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_automations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_automations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      message_journey_runs: {
        Row: {
          attendance_delivery: boolean
          created_at: string
          current_step: number
          entitlement_id: string | null
          event_id: string
          id: string
          journey_id: string
          next_run_at: string
          note: string | null
          rsvp_id: string
          status: string
          steps_snapshot: Json
          team_id: string
          updated_at: string
        }
        Insert: {
          attendance_delivery?: boolean
          created_at?: string
          current_step?: number
          entitlement_id?: string | null
          event_id: string
          id?: string
          journey_id: string
          next_run_at?: string
          note?: string | null
          rsvp_id: string
          status?: string
          steps_snapshot: Json
          team_id: string
          updated_at?: string
        }
        Update: {
          attendance_delivery?: boolean
          created_at?: string
          current_step?: number
          entitlement_id?: string | null
          event_id?: string
          id?: string
          journey_id?: string
          next_run_at?: string
          note?: string | null
          rsvp_id?: string
          status?: string
          steps_snapshot?: Json
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_journey_runs_entitlement_id_fkey"
            columns: ["entitlement_id"]
            isOneToOne: false
            referencedRelation: "entitlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_journey_runs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_journey_runs_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "message_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_journey_runs_rsvp_id_fkey"
            columns: ["rsvp_id"]
            isOneToOne: false
            referencedRelation: "rsvps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_journey_runs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      message_journey_steps: {
        Row: {
          config: Json
          id: string
          journey_id: string
          kind: string
          sort_order: number
        }
        Insert: {
          config?: Json
          id?: string
          journey_id: string
          kind: string
          sort_order: number
        }
        Update: {
          config?: Json
          id?: string
          journey_id?: string
          kind?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "message_journey_steps_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "message_journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      message_journeys: {
        Row: {
          attendance_audience: string | null
          attendance_send_at: string | null
          created_at: string
          created_by: string | null
          event_id: string | null
          id: string
          name: string
          offer_id: string | null
          start_trigger: string
          status: string
          team_id: string
          updated_at: string
        }
        Insert: {
          attendance_audience?: string | null
          attendance_send_at?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          name: string
          offer_id?: string | null
          start_trigger?: string
          status?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          attendance_audience?: string | null
          attendance_send_at?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          name?: string
          offer_id?: string | null
          start_trigger?: string
          status?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_journeys_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_journeys_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_journeys_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          archived: boolean
          audience: string
          body: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          language: string
          name: string
          subject: string | null
          team_id: string | null
          updated_at: string
          variables: string[]
        }
        Insert: {
          archived?: boolean
          audience?: string
          body: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          name: string
          subject?: string | null
          team_id?: string | null
          updated_at?: string
          variables?: string[]
        }
        Update: {
          archived?: boolean
          audience?: string
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          name?: string
          subject?: string | null
          team_id?: string | null
          updated_at?: string
          variables?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_team_id_fkey"
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
          automation_id: string | null
          channel: string
          created_at: string
          error: string | null
          event_id: string | null
          id: string
          journey_step_id: string | null
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
          automation_id?: string | null
          channel: string
          created_at?: string
          error?: string | null
          event_id?: string | null
          id?: string
          journey_step_id?: string | null
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
          automation_id?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          event_id?: string | null
          id?: string
          journey_step_id?: string | null
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
      notifications: {
        Row: {
          body: string | null
          communication_team_id: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          kind: string
          link: string | null
          read_at: string | null
          resource_journey_run_id: string | null
          resource_journey_step: number | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          communication_team_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          resource_journey_run_id?: string | null
          resource_journey_step?: number | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          communication_team_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          resource_journey_run_id?: string | null
          resource_journey_step?: number | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_resource_journey_run_id_fkey"
            columns: ["resource_journey_run_id"]
            isOneToOne: false
            referencedRelation: "resource_journey_runs"
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
      offer_items: {
        Row: {
          allow_download: boolean
          body_en: string | null
          body_es: string | null
          created_at: string
          id: string
          is_preview: boolean
          is_published: boolean
          offer_id: string
          replaced_by: string | null
          sort_order: number
          storage_path: string | null
          title_en: string
          title_es: string
          type: string
          url: string | null
        }
        Insert: {
          allow_download?: boolean
          body_en?: string | null
          body_es?: string | null
          created_at?: string
          id?: string
          is_preview?: boolean
          is_published?: boolean
          offer_id: string
          replaced_by?: string | null
          sort_order?: number
          storage_path?: string | null
          title_en?: string
          title_es?: string
          type?: string
          url?: string | null
        }
        Update: {
          allow_download?: boolean
          body_en?: string | null
          body_es?: string | null
          created_at?: string
          id?: string
          is_preview?: boolean
          is_published?: boolean
          offer_id?: string
          replaced_by?: string | null
          sort_order?: number
          storage_path?: string | null
          title_en?: string
          title_es?: string
          type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_items_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "offer_items"
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
          accent: string
          accessibility_notes: string | null
          available_from: string | null
          available_tz: string | null
          billing_interval: string | null
          card_layout: string
          category: string | null
          cert_expiry_months: number | null
          cert_issuer: string | null
          cert_signer_name: string | null
          cert_signer_title: string | null
          cert_statement: string | null
          cert_title: string | null
          certificate_enabled: boolean
          coauthor_name: string | null
          community_seats: number | null
          completion_require_lessons: boolean
          completion_require_quizzes: boolean
          cover_style: number
          cover_url: string | null
          created_at: string
          cta_en: string | null
          cta_es: string | null
          currency: string
          curriculum_revision: number
          description_en: string | null
          description_es: string | null
          discussion_enabled: boolean
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
          on_coach: boolean | null
          on_team: boolean | null
          parent_course_id: string | null
          placement: string | null
          price_cents: number
          promo_en: string | null
          promo_es: string | null
          refund_policy: string
          resource_type: string | null
          status: string
          subtitle_en: string | null
          subtitle_es: string | null
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
          accent?: string
          accessibility_notes?: string | null
          available_from?: string | null
          available_tz?: string | null
          billing_interval?: string | null
          card_layout?: string
          category?: string | null
          cert_expiry_months?: number | null
          cert_issuer?: string | null
          cert_signer_name?: string | null
          cert_signer_title?: string | null
          cert_statement?: string | null
          cert_title?: string | null
          certificate_enabled?: boolean
          coauthor_name?: string | null
          community_seats?: number | null
          completion_require_lessons?: boolean
          completion_require_quizzes?: boolean
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          cta_en?: string | null
          cta_es?: string | null
          currency?: string
          curriculum_revision?: number
          description_en?: string | null
          description_es?: string | null
          discussion_enabled?: boolean
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
          on_coach?: boolean | null
          on_team?: boolean | null
          parent_course_id?: string | null
          placement?: string | null
          price_cents?: number
          promo_en?: string | null
          promo_es?: string | null
          refund_policy?: string
          resource_type?: string | null
          status?: string
          subtitle_en?: string | null
          subtitle_es?: string | null
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
          accent?: string
          accessibility_notes?: string | null
          available_from?: string | null
          available_tz?: string | null
          billing_interval?: string | null
          card_layout?: string
          category?: string | null
          cert_expiry_months?: number | null
          cert_issuer?: string | null
          cert_signer_name?: string | null
          cert_signer_title?: string | null
          cert_statement?: string | null
          cert_title?: string | null
          certificate_enabled?: boolean
          coauthor_name?: string | null
          community_seats?: number | null
          completion_require_lessons?: boolean
          completion_require_quizzes?: boolean
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          cta_en?: string | null
          cta_es?: string | null
          currency?: string
          curriculum_revision?: number
          description_en?: string | null
          description_es?: string | null
          discussion_enabled?: boolean
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
          on_coach?: boolean | null
          on_team?: boolean | null
          parent_course_id?: string | null
          placement?: string | null
          price_cents?: number
          promo_en?: string | null
          promo_es?: string | null
          refund_policy?: string
          resource_type?: string | null
          status?: string
          subtitle_en?: string | null
          subtitle_es?: string | null
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
            foreignKeyName: "offers_parent_course_id_fkey"
            columns: ["parent_course_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
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
          addon_key: string | null
          created_at: string
          description: string | null
          description_en: string | null
          description_es: string | null
          id: string
          item_type: string
          order_id: string
          quantity: number
          refunded_cents: number
          unit_cents: number
        }
        Insert: {
          addon_key?: string | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          description_es?: string | null
          id?: string
          item_type: string
          order_id: string
          quantity?: number
          refunded_cents?: number
          unit_cents: number
        }
        Update: {
          addon_key?: string | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          description_es?: string | null
          id?: string
          item_type?: string
          order_id?: string
          quantity?: number
          refunded_cents?: number
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
          challenge_cart: Json | null
          challenge_id: string | null
          checkout_create_started_at: string | null
          checkout_request: Json | null
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
          reservation_expires_at: string | null
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
          challenge_cart?: Json | null
          challenge_id?: string | null
          checkout_create_started_at?: string | null
          checkout_request?: Json | null
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
          reservation_expires_at?: string | null
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
          challenge_cart?: Json | null
          challenge_id?: string | null
          checkout_create_started_at?: string | null
          checkout_request?: Json | null
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
          reservation_expires_at?: string | null
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
            foreignKeyName: "orders_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
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
      platform_event_acceptances: {
        Row: {
          accepted_at: string
          content_sha256: string
          document_id: string
          event_id: string
          id: string
          rsvp_id: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string
          content_sha256: string
          document_id: string
          event_id: string
          id?: string
          rsvp_id: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string
          content_sha256?: string
          document_id?: string
          event_id?: string
          id?: string
          rsvp_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_event_acceptances_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "consent_text_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_event_acceptances_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_event_acceptances_rsvp_id_fkey"
            columns: ["rsvp_id"]
            isOneToOne: false
            referencedRelation: "rsvps"
            referencedColumns: ["id"]
          },
        ]
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
      profile_slug_history: {
        Row: {
          created_at: string
          profile_id: string
          slug: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          slug: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_slug_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_team_id: string | null
          adult_confirmed_at: string | null
          adult_consent_version_id: string | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          city_public: boolean
          cover_url: string | null
          created_at: string
          full_name: string | null
          host_accessibility: string | null
          host_categories: string[] | null
          host_languages: string[]
          host_links: Json | null
          host_org: string | null
          host_public: boolean
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
          city_public?: boolean
          cover_url?: string | null
          created_at?: string
          full_name?: string | null
          host_accessibility?: string | null
          host_categories?: string[] | null
          host_languages?: string[]
          host_links?: Json | null
          host_org?: string | null
          host_public?: boolean
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
          city_public?: boolean
          cover_url?: string | null
          created_at?: string
          full_name?: string | null
          host_accessibility?: string | null
          host_categories?: string[] | null
          host_languages?: string[]
          host_links?: Json | null
          host_org?: string | null
          host_public?: boolean
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
          lease_until: string | null
          payload_sha256: string | null
          processed_at: string | null
          processing_token: string | null
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
          lease_until?: string | null
          payload_sha256?: string | null
          processed_at?: string | null
          processing_token?: string | null
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
          lease_until?: string | null
          payload_sha256?: string | null
          processed_at?: string | null
          processing_token?: string | null
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
      quiz_attempts: {
        Row: {
          attempt_no: number
          deadline: string | null
          id: string
          outcome_id: string | null
          passed: boolean | null
          quiz_id: string
          score_pct: number | null
          started_at: string
          status: string
          submitted_at: string | null
          submitted_late: boolean
          user_id: string
        }
        Insert: {
          attempt_no: number
          deadline?: string | null
          id?: string
          outcome_id?: string | null
          passed?: boolean | null
          quiz_id: string
          score_pct?: number | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          submitted_late?: boolean
          user_id: string
        }
        Update: {
          attempt_no?: number
          deadline?: string | null
          id?: string
          outcome_id?: string | null
          passed?: boolean | null
          quiz_id?: string
          score_pct?: number | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          submitted_late?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "quiz_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_bands: {
        Row: {
          body_en: string | null
          body_es: string | null
          created_at: string
          id: string
          min_pct: number
          quiz_id: string
          title_en: string
          title_es: string
        }
        Insert: {
          body_en?: string | null
          body_es?: string | null
          created_at?: string
          id?: string
          min_pct?: number
          quiz_id: string
          title_en?: string
          title_es?: string
        }
        Update: {
          body_en?: string | null
          body_es?: string | null
          created_at?: string
          id?: string
          min_pct?: number
          quiz_id?: string
          title_en?: string
          title_es?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_bands_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_options: {
        Row: {
          id: string
          image_alt: string | null
          image_path: string | null
          is_correct: boolean
          label_en: string
          label_es: string
          outcome_id: string | null
          question_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          image_alt?: string | null
          image_path?: string | null
          is_correct?: boolean
          label_en?: string
          label_es?: string
          outcome_id?: string | null
          question_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          image_alt?: string | null
          image_path?: string | null
          is_correct?: boolean
          label_en?: string
          label_es?: string
          outcome_id?: string | null
          question_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_options_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "quiz_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_outcomes: {
        Row: {
          body_en: string | null
          body_es: string | null
          created_at: string
          id: string
          image_alt: string | null
          image_path: string | null
          quiz_id: string
          sort_order: number
          title_en: string
          title_es: string
        }
        Insert: {
          body_en?: string | null
          body_es?: string | null
          created_at?: string
          id?: string
          image_alt?: string | null
          image_path?: string | null
          quiz_id: string
          sort_order?: number
          title_en?: string
          title_es?: string
        }
        Update: {
          body_en?: string | null
          body_es?: string | null
          created_at?: string
          id?: string
          image_alt?: string | null
          image_path?: string | null
          quiz_id?: string
          sort_order?: number
          title_en?: string
          title_es?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_outcomes_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          accepted_answers: string[] | null
          allow_manual: boolean
          created_at: string
          explanation_en: string | null
          explanation_es: string | null
          id: string
          image_alt: string | null
          image_path: string | null
          points: number
          prompt_en: string
          prompt_es: string
          quiz_id: string
          sort_order: number
          type: string
        }
        Insert: {
          accepted_answers?: string[] | null
          allow_manual?: boolean
          created_at?: string
          explanation_en?: string | null
          explanation_es?: string | null
          id?: string
          image_alt?: string | null
          image_path?: string | null
          points?: number
          prompt_en?: string
          prompt_es?: string
          quiz_id: string
          sort_order?: number
          type: string
        }
        Update: {
          accepted_answers?: string[] | null
          allow_manual?: boolean
          created_at?: string
          explanation_en?: string | null
          explanation_es?: string | null
          id?: string
          image_alt?: string | null
          image_path?: string | null
          points?: number
          prompt_en?: string
          prompt_es?: string
          quiz_id?: string
          sort_order?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_responses: {
        Row: {
          attempt_id: string
          id: string
          needs_manual: boolean
          points_awarded: number | null
          question_id: string
          selected: string[] | null
          text_answer: string | null
        }
        Insert: {
          attempt_id: string
          id?: string
          needs_manual?: boolean
          points_awarded?: number | null
          question_id: string
          selected?: string[] | null
          text_answer?: string | null
        }
        Update: {
          attempt_id?: string
          id?: string
          needs_manual?: boolean
          points_awarded?: number | null
          question_id?: string
          selected?: string[] | null
          text_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_responses_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          archived_at: string | null
          assessment_config: Json | null
          assessment_revision: number
          assessment_scope_id: string | null
          attempts_allowed: number | null
          commerce_offer_id: string | null
          cooldown_minutes: number
          cover_alt: string | null
          cover_path: string | null
          created_at: string
          created_by: string | null
          host_id: string | null
          id: string
          instructions_en: string | null
          instructions_es: string | null
          is_published: boolean
          is_required: boolean
          lesson_id: string | null
          mode: string
          offer_id: string | null
          on_coach: boolean | null
          on_team: boolean | null
          pass_pct: number
          placement: string | null
          randomize_answers: boolean
          randomize_questions: boolean
          reveal_answers: string
          show_score: boolean
          sort_order: number
          team_id: string | null
          time_limit_minutes: number | null
          title_en: string
          title_es: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          assessment_config?: Json | null
          assessment_revision?: number
          assessment_scope_id?: string | null
          attempts_allowed?: number | null
          commerce_offer_id?: string | null
          cooldown_minutes?: number
          cover_alt?: string | null
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          host_id?: string | null
          id?: string
          instructions_en?: string | null
          instructions_es?: string | null
          is_published?: boolean
          is_required?: boolean
          lesson_id?: string | null
          mode?: string
          offer_id?: string | null
          on_coach?: boolean | null
          on_team?: boolean | null
          pass_pct?: number
          placement?: string | null
          randomize_answers?: boolean
          randomize_questions?: boolean
          reveal_answers?: string
          show_score?: boolean
          sort_order?: number
          team_id?: string | null
          time_limit_minutes?: number | null
          title_en?: string
          title_es?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          assessment_config?: Json | null
          assessment_revision?: number
          assessment_scope_id?: string | null
          attempts_allowed?: number | null
          commerce_offer_id?: string | null
          cooldown_minutes?: number
          cover_alt?: string | null
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          host_id?: string | null
          id?: string
          instructions_en?: string | null
          instructions_es?: string | null
          is_published?: boolean
          is_required?: boolean
          lesson_id?: string | null
          mode?: string
          offer_id?: string | null
          on_coach?: boolean | null
          on_team?: boolean | null
          pass_pct?: number
          placement?: string | null
          randomize_answers?: boolean
          randomize_questions?: boolean
          reveal_answers?: string
          show_score?: boolean
          sort_order?: number
          team_id?: string | null
          time_limit_minutes?: number | null
          title_en?: string
          title_es?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_assessment_scope_id_fkey"
            columns: ["assessment_scope_id"]
            isOneToOne: false
            referencedRelation: "assessment_scope_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_commerce_offer_id_fkey"
            columns: ["commerce_offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          accent: string
          archived_at: string | null
          available_from: string | null
          available_tz: string | null
          card_layout: string
          commerce_offer_id: string | null
          cover_style: number
          cover_url: string | null
          created_at: string
          created_by: string | null
          cta_en: string | null
          cta_es: string | null
          id: string
          ingredients: Json
          is_published: boolean
          on_coach: boolean | null
          on_team: boolean | null
          parent_course_id: string | null
          placement: string | null
          prep_minutes: number | null
          private_owner: string | null
          promo_en: string | null
          promo_es: string | null
          sort_order: number
          steps: Json
          subtitle_en: string | null
          subtitle_es: string | null
          tags: string[]
          team_id: string | null
          title_en: string
          title_es: string
        }
        Insert: {
          accent?: string
          archived_at?: string | null
          available_from?: string | null
          available_tz?: string | null
          card_layout?: string
          commerce_offer_id?: string | null
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          cta_en?: string | null
          cta_es?: string | null
          id?: string
          ingredients?: Json
          is_published?: boolean
          on_coach?: boolean | null
          on_team?: boolean | null
          parent_course_id?: string | null
          placement?: string | null
          prep_minutes?: number | null
          private_owner?: string | null
          promo_en?: string | null
          promo_es?: string | null
          sort_order?: number
          steps?: Json
          subtitle_en?: string | null
          subtitle_es?: string | null
          tags?: string[]
          team_id?: string | null
          title_en?: string
          title_es?: string
        }
        Update: {
          accent?: string
          archived_at?: string | null
          available_from?: string | null
          available_tz?: string | null
          card_layout?: string
          commerce_offer_id?: string | null
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          cta_en?: string | null
          cta_es?: string | null
          id?: string
          ingredients?: Json
          is_published?: boolean
          on_coach?: boolean | null
          on_team?: boolean | null
          parent_course_id?: string | null
          placement?: string | null
          prep_minutes?: number | null
          private_owner?: string | null
          promo_en?: string | null
          promo_es?: string | null
          sort_order?: number
          steps?: Json
          subtitle_en?: string | null
          subtitle_es?: string | null
          tags?: string[]
          team_id?: string | null
          title_en?: string
          title_es?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_commerce_offer_id_fkey"
            columns: ["commerce_offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_parent_course_id_fkey"
            columns: ["parent_course_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_clicks: {
        Row: {
          clicked_at: string
          id: number
          link_id: string
          user_id: string | null
          visitor_key: string
        }
        Insert: {
          clicked_at?: string
          id?: never
          link_id: string
          user_id?: string | null
          visitor_key: string
        }
        Update: {
          clicked_at?: string
          id?: never
          link_id?: string
          user_id?: string | null
          visitor_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_links: {
        Row: {
          code: string
          created_at: string
          id: string
          program_id: string
          referrer_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          program_id: string
          referrer_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          program_id?: string
          referrer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_links_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "referral_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_payouts: {
        Row: {
          amount_cents: number
          created_at: string
          host_id: string
          id: string
          method: string
          note: string | null
          paid_on: string
          recorded_by: string
          reference: string | null
          referrer_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          host_id: string
          id?: string
          method?: string
          note?: string | null
          paid_on: string
          recorded_by: string
          reference?: string | null
          referrer_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          host_id?: string
          id?: string
          method?: string
          note?: string | null
          paid_on?: string
          recorded_by?: string
          reference?: string | null
          referrer_id?: string
        }
        Relationships: []
      }
      referral_programs: {
        Row: {
          created_at: string
          enabled: boolean
          event_id: string | null
          host_id: string
          id: string
          item_kind: string
          offer_id: string | null
          reward_kind: string
          reward_value: number
          terms_version: string
          updated_at: string
          window_days: number
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          event_id?: string | null
          host_id: string
          id?: string
          item_kind: string
          offer_id?: string | null
          reward_kind: string
          reward_value: number
          terms_version?: string
          updated_at?: string
          window_days?: number
        }
        Update: {
          created_at?: string
          enabled?: boolean
          event_id?: string | null
          host_id?: string
          id?: string
          item_kind?: string
          offer_id?: string | null
          reward_kind?: string
          reward_value?: number
          terms_version?: string
          updated_at?: string
          window_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "referral_programs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_programs_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_rewards: {
        Row: {
          available_at: string
          created_at: string
          host_id: string
          id: string
          link_id: string
          order_id: string
          payout_id: string | null
          program_id: string
          referrer_id: string
          reversed_reason: string | null
          reward_cents: number
          sale_cents: number
          status: string
          updated_at: string
        }
        Insert: {
          available_at: string
          created_at?: string
          host_id: string
          id?: string
          link_id: string
          order_id: string
          payout_id?: string | null
          program_id: string
          referrer_id: string
          reversed_reason?: string | null
          reward_cents: number
          sale_cents: number
          status?: string
          updated_at?: string
        }
        Update: {
          available_at?: string
          created_at?: string
          host_id?: string
          id?: string
          link_id?: string
          order_id?: string
          payout_id?: string | null
          program_id?: string
          referrer_id?: string
          reversed_reason?: string | null
          reward_cents?: number
          sale_cents?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "referral_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "referral_programs"
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
          allocation_required: boolean
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
          allocation_required?: boolean
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
          allocation_required?: boolean
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
          assigned_to: string | null
          author_id: string | null
          created_at: string
          escalated_at: string | null
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
          assigned_to?: string | null
          author_id?: string | null
          created_at?: string
          escalated_at?: string | null
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
          assigned_to?: string | null
          author_id?: string | null
          created_at?: string
          escalated_at?: string | null
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
      resource_journey_runs: {
        Row: {
          created_at: string
          current_step: number
          entitlement_id: string
          id: string
          journey_id: string
          next_run_at: string
          note: string | null
          offer_id: string
          status: string
          steps_snapshot: Json
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_step?: number
          entitlement_id: string
          id?: string
          journey_id: string
          next_run_at?: string
          note?: string | null
          offer_id: string
          status?: string
          steps_snapshot: Json
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_step?: number
          entitlement_id?: string
          id?: string
          journey_id?: string
          next_run_at?: string
          note?: string | null
          offer_id?: string
          status?: string
          steps_snapshot?: Json
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_journey_runs_entitlement_id_fkey"
            columns: ["entitlement_id"]
            isOneToOne: false
            referencedRelation: "entitlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_journey_runs_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "message_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_journey_runs_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_templates: {
        Row: {
          copied_from_author: string | null
          copied_from_id: string | null
          created_at: string
          created_by: string | null
          description_en: string | null
          description_es: string | null
          id: string
          kind: string
          shared_team_ids: string[]
          sort_order: number
          source_id: string | null
          source_kind: string | null
          structure: Json
          target: string
          team_id: string | null
          title_en: string
          title_es: string
        }
        Insert: {
          copied_from_author?: string | null
          copied_from_id?: string | null
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_es?: string | null
          id?: string
          kind: string
          shared_team_ids?: string[]
          sort_order?: number
          source_id?: string | null
          source_kind?: string | null
          structure?: Json
          target: string
          team_id?: string | null
          title_en?: string
          title_es?: string
        }
        Update: {
          copied_from_author?: string | null
          copied_from_id?: string | null
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_es?: string | null
          id?: string
          kind?: string
          shared_team_ids?: string[]
          sort_order?: number
          source_id?: string | null
          source_kind?: string | null
          structure?: Json
          target?: string
          team_id?: string | null
          title_en?: string
          title_es?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_templates_team_id_fkey"
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
          walkin_request_id: string | null
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
          walkin_request_id?: string | null
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
          walkin_request_id?: string | null
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
      saved_offerings: {
        Row: {
          created_at: string
          id: string
          kind: string
          target_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          target_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          target_id?: string
          user_id?: string
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
      support_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_staff: boolean
          sender_id: string
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_staff?: boolean
          sender_id: string
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_staff?: boolean
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          id: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_audit: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          id: number
          meta: Json
          target: string | null
          team_id: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          id?: never
          meta?: Json
          target?: string | null
          team_id: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          id?: never
          meta?: Json
          target?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_audit_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_channel_preferences: {
        Row: {
          announcements_read_at: string | null
          muted: boolean
          team_id: string
          user_id: string
        }
        Insert: {
          announcements_read_at?: string | null
          muted?: boolean
          team_id: string
          user_id: string
        }
        Update: {
          announcements_read_at?: string | null
          muted?: boolean
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_channel_preferences_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          revoked_at: string | null
          team_id: string
          token: string
          workspace_role: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by: string
          email: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          team_id: string
          token?: string
          workspace_role?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          team_id?: string
          token?: string
          workspace_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_join_requests: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          invite_id: string | null
          requested_at: string
          status: string
          team_id: string
          user_id: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          invite_id?: string | null
          requested_at?: string
          status?: string
          team_id: string
          user_id: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          invite_id?: string | null
          requested_at?: string
          status?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_join_requests_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "team_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_join_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_library_copies: {
        Row: {
          created_at: string
          request_key: string
          source_id: string
          source_kind: string
          target_id: string
          target_kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          request_key: string
          source_id: string
          source_kind: string
          target_id: string
          target_kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          request_key?: string
          source_id?: string
          source_kind?: string
          target_id?: string
          target_kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_library_copies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          suspended_at: string | null
          team_id: string
          user_id: string
          workspace_role: string
        }
        Insert: {
          custom_badge?: string | null
          invited_by?: string | null
          joined_at?: string
          role?: string
          suspended_at?: string | null
          team_id: string
          user_id: string
          workspace_role?: string
        }
        Update: {
          custom_badge?: string | null
          invited_by?: string | null
          joined_at?: string
          role?: string
          suspended_at?: string | null
          team_id?: string
          user_id?: string
          workspace_role?: string
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
          description: string | null
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
          description?: string | null
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
          description?: string | null
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
          copied_from_author: string | null
          copied_from_id: string | null
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
          event_setup: Json | null
          followup_script_en: string | null
          followup_script_es: string | null
          id: string
          invite_script_en: string | null
          invite_script_es: string | null
          is_published: boolean
          launches_count: number
          shared_team_ids: string[]
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
          copied_from_author?: string | null
          copied_from_id?: string | null
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
          event_setup?: Json | null
          followup_script_en?: string | null
          followup_script_es?: string | null
          id?: string
          invite_script_en?: string | null
          invite_script_es?: string | null
          is_published?: boolean
          launches_count?: number
          shared_team_ids?: string[]
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
          copied_from_author?: string | null
          copied_from_id?: string | null
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
          event_setup?: Json | null
          followup_script_en?: string | null
          followup_script_es?: string | null
          id?: string
          invite_script_en?: string | null
          invite_script_es?: string | null
          is_published?: boolean
          launches_count?: number
          shared_team_ids?: string[]
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
          accent: string
          archived_at: string | null
          available_from: string | null
          available_tz: string | null
          card_layout: string
          commerce_offer_id: string | null
          cover_style: number
          cover_url: string | null
          created_at: string
          cta_en: string | null
          cta_es: string | null
          description_en: string | null
          description_es: string | null
          host_id: string | null
          id: string
          is_published: boolean
          is_start_here: boolean
          offer_id: string | null
          on_coach: boolean | null
          on_team: boolean | null
          placement: string | null
          promo_en: string | null
          promo_es: string | null
          resource_kind: string | null
          sort_order: number
          subtitle_en: string | null
          subtitle_es: string | null
          team_id: string
          title_en: string
          title_es: string
          visibility: string
        }
        Insert: {
          accent?: string
          archived_at?: string | null
          available_from?: string | null
          available_tz?: string | null
          card_layout?: string
          commerce_offer_id?: string | null
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          cta_en?: string | null
          cta_es?: string | null
          description_en?: string | null
          description_es?: string | null
          host_id?: string | null
          id?: string
          is_published?: boolean
          is_start_here?: boolean
          offer_id?: string | null
          on_coach?: boolean | null
          on_team?: boolean | null
          placement?: string | null
          promo_en?: string | null
          promo_es?: string | null
          resource_kind?: string | null
          sort_order?: number
          subtitle_en?: string | null
          subtitle_es?: string | null
          team_id: string
          title_en?: string
          title_es?: string
          visibility?: string
        }
        Update: {
          accent?: string
          archived_at?: string | null
          available_from?: string | null
          available_tz?: string | null
          card_layout?: string
          commerce_offer_id?: string | null
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          cta_en?: string | null
          cta_es?: string | null
          description_en?: string | null
          description_es?: string | null
          host_id?: string | null
          id?: string
          is_published?: boolean
          is_start_here?: boolean
          offer_id?: string | null
          on_coach?: boolean | null
          on_team?: boolean | null
          placement?: string | null
          promo_en?: string | null
          promo_es?: string | null
          resource_kind?: string | null
          sort_order?: number
          subtitle_en?: string | null
          subtitle_es?: string | null
          team_id?: string
          title_en?: string
          title_es?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracks_commerce_offer_id_fkey"
            columns: ["commerce_offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
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
      update_reads: {
        Row: {
          read_at: string
          update_id: string
          user_id: string
        }
        Insert: {
          read_at?: string
          update_id: string
          user_id: string
        }
        Update: {
          read_at?: string
          update_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "update_reads_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "host_updates"
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
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
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
      waiver_library: {
        Row: {
          archived: boolean
          body_en: string
          body_es: string
          description: string
          file_name: string | null
          file_path: string | null
          form_kind: string
          id: string
          is_default: boolean
          name: string
          owner_id: string
          team_id: string
          updated_at: string
          version: number
        }
        Insert: {
          archived?: boolean
          body_en: string
          body_es?: string
          description?: string
          file_name?: string | null
          file_path?: string | null
          form_kind?: string
          id?: string
          is_default?: boolean
          name: string
          owner_id: string
          team_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          archived?: boolean
          body_en?: string
          body_es?: string
          description?: string
          file_name?: string | null
          file_path?: string | null
          form_kind?: string
          id?: string
          is_default?: boolean
          name?: string
          owner_id?: string
          team_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "waiver_library_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      waiver_library_versions: {
        Row: {
          body_en: string
          body_es: string
          content_sha256: string
          created_at: string
          description: string
          file_name: string | null
          file_path: string | null
          form_kind: string
          name: string
          version: number
          waiver_id: string
        }
        Insert: {
          body_en: string
          body_es: string
          content_sha256: string
          created_at?: string
          description?: string
          file_name?: string | null
          file_path?: string | null
          form_kind?: string
          name: string
          version: number
          waiver_id: string
        }
        Update: {
          body_en?: string
          body_es?: string
          content_sha256?: string
          created_at?: string
          description?: string
          file_name?: string | null
          file_path?: string | null
          form_kind?: string
          name?: string
          version?: number
          waiver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiver_library_versions_waiver_id_fkey"
            columns: ["waiver_id"]
            isOneToOne: false
            referencedRelation: "waiver_library"
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
      workspace_assignments: {
        Row: {
          created_at: string
          created_by: string
          id: string
          revoked_at: string | null
          revoked_by: string | null
          scope_id: string
          scope_type: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          scope_id: string
          scope_type: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          scope_id?: string
          scope_type?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_founding: { Args: never; Returns: undefined }
      accept_team_invite: { Args: { _token: string }; Returns: Json }
      active_fee_rule: {
        Args: { _at?: string; _offering_type: string }
        Returns: string
      }
      active_fee_rule_for_plan: {
        Args: { _at?: string; _offering_type: string; _plan: string }
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
      admin_account_record: {
        Args: {
          _action: string
          _actor: string
          _reason: string
          _target: string
        }
        Returns: undefined
      }
      admin_broadcasts: { Args: never; Returns: Json }
      admin_day60: { Args: never; Returns: Json }
      admin_founding: { Args: never; Returns: Json }
      admin_grant_preview_license: {
        Args: { _team: string; _tier: string }
        Returns: undefined
      }
      admin_overview: { Args: { _since: string }; Returns: Json }
      admin_platform_agreement_status: { Args: never; Returns: Json }
      admin_reports: { Args: { _status: string }; Returns: Json }
      admin_retry_message: { Args: { _id: string }; Returns: Json }
      admin_safety_action: {
        Args: {
          _action: string
          _id: string
          _kind: string
          _reason: string
          _user?: string
        }
        Returns: undefined
      }
      admin_safety_guard: { Args: never; Returns: undefined }
      admin_safety_list: {
        Args: { _kind: string; _page?: number; _q?: string; _state?: string }
        Returns: Json
      }
      admin_support_tickets: { Args: { _status: string }; Returns: Json }
      admin_team_detail: { Args: { _id: string }; Returns: Json }
      admin_teams: { Args: { _q: string }; Returns: Json }
      admin_time_to_live: { Args: { _since: string }; Returns: Json }
      admin_user_detail: { Args: { _id: string }; Returns: Json }
      admin_users: { Args: { _q: string }; Returns: Json }
      advance_journey_runs: { Args: { _limit?: number }; Returns: number }
      advance_resource_journeys: { Args: { _limit?: number }; Returns: number }
      ai_usage_status: { Args: never; Returns: Json }
      approved_event_agreement: { Args: { _locale: string }; Returns: string }
      archive_host_update: { Args: { _id: string }; Returns: undefined }
      archive_message_template: {
        Args: { _archived: boolean; _id: string }
        Returns: undefined
      }
      assessment_for_learner: { Args: { _quiz: string }; Returns: Json }
      assign_license_seat: {
        Args: { _on: boolean; _team: string; _user: string }
        Returns: undefined
      }
      assign_small_group: {
        Args: { _group: string; _rsvp: string }
        Returns: undefined
      }
      assign_workspace_scope: {
        Args: {
          _scope_id: string
          _scope_type: string
          _team: string
          _user: string
        }
        Returns: string
      }
      attach_course_resource: {
        Args: { _kind: string; _resource: string; _track: string }
        Returns: string
      }
      attach_library_waiver: {
        Args: { _event: string; _version: number; _waiver: string }
        Returns: string
      }
      attendance_export: { Args: { _event: string }; Returns: Json }
      attendance_message_eligible: {
        Args: { _audience: string; _channel: string; _rsvp: string }
        Returns: boolean
      }
      attendance_totals: { Args: { _event: string }; Returns: Json }
      automation_activity: {
        Args: { _limit: number; _team: string }
        Returns: Json
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
      bind_challenge_checkout: {
        Args: { _buyer: string; _order: string; _session: string }
        Returns: boolean
      }
      bind_course_assessment: {
        Args: { _quiz: string; _track: string }
        Returns: string
      }
      block_user: { Args: { _user: string }; Returns: undefined }
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
      can_build_resources: { Args: { _team: string }; Returns: boolean }
      can_checkin_event: { Args: { _event: string }; Returns: boolean }
      can_edit_quiz: { Args: { _quiz: string }; Returns: boolean }
      can_edit_track: { Args: { _track: string }; Returns: boolean }
      can_join_conversation: { Args: { _event: string }; Returns: boolean }
      can_manage_challenge: { Args: { _c: string }; Returns: boolean }
      can_manage_event: { Args: { _event_id: string }; Returns: boolean }
      can_manage_offering: {
        Args: { _id: string; _kind: string }
        Returns: boolean
      }
      can_moderate_comment: { Args: { _c: string }; Returns: boolean }
      can_read_challenge: { Args: { _c: string }; Returns: boolean }
      can_read_comment: { Args: { _c: string }; Returns: boolean }
      can_read_track: { Args: { _track: string }; Returns: boolean }
      can_review_coach: { Args: { _host: string }; Returns: boolean }
      can_rsvp_event: { Args: { _event_id: string }; Returns: boolean }
      can_use_team_templates: { Args: { _team: string }; Returns: boolean }
      can_view_contact_thread: { Args: { _thread: string }; Returns: boolean }
      can_view_event: { Args: { _event_id: string }; Returns: boolean }
      cancel_challenge_checkout_verified: {
        Args: { _buyer: string; _order: string; _session: string }
        Returns: undefined
      }
      cancel_rsvp_by_code: { Args: { _code: string }; Returns: boolean }
      challenge_can_enroll: { Args: { _c: string }; Returns: boolean }
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
      challenge_host_enrollments: { Args: { _c: string }; Returns: Json }
      challenge_invite_candidates: { Args: { _c: string }; Returns: Json }
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
      challenge_member_active: {
        Args: { _c: string; _user: string }
        Returns: boolean
      }
      challenge_order_receipts: { Args: { _c: string }; Returns: Json }
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
      change_member_role: {
        Args: { _role: string; _team: string; _user: string }
        Returns: undefined
      }
      channel_in_app: {
        Args: {
          _body: string
          _id: string
          _kind: string
          _link: string
          _team: string
          _title: string
        }
        Returns: undefined
      }
      chat_platform: { Args: { _url: string }; Returns: string }
      check_event_waivers: {
        Args: { _accepted: Json; _event: string }
        Returns: undefined
      }
      check_in_code: { Args: { _code: string; _event: string }; Returns: Json }
      check_in_rsvp: {
        Args: { _rsvp: string; _undo?: boolean }
        Returns: undefined
      }
      check_promo: {
        Args: { _buyer?: string; _code: string; _kind: string; _target: string }
        Returns: Json
      }
      checkin_blocker: { Args: { _rsvp: string }; Returns: string }
      checkin_guest_list: { Args: { _event: string }; Returns: Json }
      claim_challenge_checkout: {
        Args: { _buyer: string; _lang: string; _order: string; _origin: string }
        Returns: Json
      }
      claim_challenge_provider_event: {
        Args: {
          _environment: string
          _event: string
          _hash: string
          _token: string
          _type: string
        }
        Returns: string
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
      claim_referral_visitor: { Args: { _visitor: string }; Returns: number }
      cleanup_auth_intents: { Args: never; Returns: number }
      close_contact_thread: { Args: { _thread: string }; Returns: undefined }
      close_support_ticket: { Args: { _ticket: string }; Returns: undefined }
      coach_checklist: { Args: never; Returns: Json }
      coach_referral_dashboard: {
        Args: {
          _from?: string
          _program?: string
          _referrer?: string
          _status?: string
          _to?: string
        }
        Returns: Json
      }
      coach_resource_cards: { Args: { _host: string }; Returns: Json }
      coach_subscriber_segments: { Args: never; Returns: Json }
      coach_trust: { Args: { _host: string }; Returns: Json }
      coach_update_preferences: { Args: { _token: string }; Returns: Json }
      comment_feed: { Args: { _event: string; _topic: string }; Returns: Json }
      communication_offerings: { Args: { _team: string }; Returns: Json }
      community_requests: {
        Args: { _kind: string; _target: string }
        Returns: Json
      }
      community_seat_info: {
        Args: { _kind: string; _target: string }
        Returns: Json
      }
      complete_wellness_assessment: {
        Args: {
          _accepted: boolean
          _answers: Json
          _quiz: string
          _request: string
          _revision: number
          _scope: string
        }
        Returns: Json
      }
      compute_playbook: { Args: never; Returns: number }
      configure_resource_access: {
        Args: {
          _course: string
          _id: string
          _kind: string
          _placement: string
          _price: number
        }
        Returns: string
      }
      confirm_adult: { Args: { _attest: boolean }; Returns: undefined }
      consume_auth_intent: { Args: { _token: string }; Returns: string }
      contact_thread_messages: { Args: { _thread: string }; Returns: Json }
      copy_starter_template: {
        Args: { _team: string; _template: string }
        Returns: string
      }
      copy_team_library_item: {
        Args: {
          _destination: string
          _id: string
          _kind: string
          _request: string
          _team: string
        }
        Returns: Json
      }
      course_access_start: {
        Args: { _offer: string; _user: string }
        Returns: string
      }
      course_lesson_quiz: { Args: { _lesson: string }; Returns: Json }
      course_progress: { Args: { _offer: string }; Returns: Json }
      course_resource_destination: { Args: { _lesson: string }; Returns: Json }
      course_reusable_resources: { Args: { _course: string }; Returns: Json }
      create_auth_intent: { Args: { _path: string }; Returns: string }
      create_challenge_order: {
        Args: {
          _c: string
          _environment: string
          _extras: Json
          _request: string
        }
        Returns: Json
      }
      create_course_quiz_item: {
        Args: { _language: string; _title: string; _track: string }
        Returns: Json
      }
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
      create_host_invite: { Args: never; Returns: string }
      create_poll: {
        Args: { _event: string; _options: string[]; _question: string }
        Returns: string
      }
      create_subteam: {
        Args: { _name: string; _parent: string }
        Returns: string
      }
      create_support_ticket: {
        Args: { _body: string; _category: string; _subject: string }
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
      create_team_announcement: {
        Args: {
          _body: string
          _link: string
          _pinned: boolean
          _team: string
          _title: string
        }
        Returns: string
      }
      create_topic: {
        Args: { _body: string; _team: string; _title: string }
        Returns: string
      }
      credit_course_assessment_receipt: {
        Args: { _lesson: string }
        Returns: undefined
      }
      current_fee_pct: { Args: { _host: string }; Returns: number }
      current_platform_agreement: { Args: never; Returns: Json }
      decide_community_seat: {
        Args: { _approve: boolean; _id: string }
        Returns: string
      }
      decide_rsvp: {
        Args: { _approve: boolean; _rsvp: string }
        Returns: string
      }
      decide_team_request: {
        Args: { _decision: string; _team: string; _user: string }
        Returns: string
      }
      default_waiver: { Args: { _team: string }; Returns: undefined }
      delete_comment: { Args: { _id: string }; Returns: undefined }
      delete_my_account: { Args: never; Returns: undefined }
      delete_my_coach_review: { Args: { _host: string }; Returns: undefined }
      detach_course_curriculum: {
        Args: { _course: string; _lesson?: string; _track: string }
        Returns: undefined
      }
      discover_catalog: {
        Args: {
          _accessible?: boolean
          _cat?: string
          _format?: string
          _free?: boolean
          _from?: string
          _kinds?: string[]
          _lang?: string
          _lat?: number
          _limit?: number
          _lng?: number
          _minors?: boolean
          _offset?: number
          _q?: string
          _radius_km?: number
          _sort?: string
          _to?: string
        }
        Returns: Json
      }
      discover_coaches: {
        Args: { _cat?: string; _limit?: number; _offset?: number; _q?: string }
        Returns: Json
      }
      due_followup_events: { Args: never; Returns: string[] }
      duplicate_message_template: {
        Args: { _id: string; _team: string }
        Returns: string
      }
      duplicate_offer: { Args: { _offer: string }; Returns: string }
      duplicate_quiz: { Args: { _quiz: string }; Returns: string }
      duplicate_quiz_base: { Args: { _quiz: string }; Returns: string }
      effective_plan: { Args: { _uid: string }; Returns: Json }
      email_token: { Args: { _email: string; _lang: string }; Returns: string }
      enqueue_automation_message: {
        Args: {
          _auto: Database["public"]["Tables"]["message_automations"]["Row"]
          _rsvp: Database["public"]["Tables"]["rsvps"]["Row"]
          _send_after: string
        }
        Returns: undefined
      }
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
      enroll_challenge: { Args: { _c: string; _extras?: Json }; Returns: Json }
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
      event_platform_agreement: {
        Args: { _event: string; _token?: string }
        Returns: Json
      }
      event_price: { Args: { _id: string }; Returns: Json }
      event_seats_used: { Args: { _event: string }; Returns: number }
      event_summary: { Args: { _event: string }; Returns: Json }
      event_waiver: { Args: { _event: string }; Returns: Json }
      event_waiver_file_path: {
        Args: {
          _code: string
          _token: string
          _version: number
          _waiver: string
        }
        Returns: string
      }
      event_waiver_k: {
        Args: { _event: string; _token: string }
        Returns: Json
      }
      event_waiver_list: {
        Args: { _event: string; _token?: string }
        Returns: Json
      }
      event_waiver_sha: {
        Args: { w: Database["public"]["Tables"]["event_waivers"]["Row"] }
        Returns: string
      }
      event_waiver_status: { Args: { _event: string }; Returns: Json }
      export_library_source: {
        Args: { _id: string; _kind: string }
        Returns: string
      }
      export_my_data: { Args: never; Returns: Json }
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
      finish_challenge_provider_event: {
        Args: {
          _environment: string
          _event: string
          _succeeded: boolean
          _token: string
        }
        Returns: boolean
      }
      flag_on: { Args: { _key: string }; Returns: boolean }
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
      get_public_challenge: { Args: { _id: string }; Returns: Json }
      get_public_event: { Args: { _id: string }; Returns: Json }
      get_public_event_k: {
        Args: { _id: string; _token: string }
        Returns: Json
      }
      get_public_event_unmasked: { Args: { _id: string }; Returns: Json }
      get_public_host: { Args: { _slug: string }; Returns: Json }
      get_public_location: { Args: { _slug: string }; Returns: Json }
      get_public_offer: { Args: { _id: string }; Returns: Json }
      get_public_team: { Args: { _slug: string }; Returns: Json }
      get_quiz_for_taker: { Args: { _quiz: string }; Returns: Json }
      get_referral_link: { Args: { _program: string }; Returns: string }
      get_resource_page: { Args: { _id: string; _kind: string }; Returns: Json }
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
      grade_quiz_response: {
        Args: { _points: number; _response: string }
        Returns: Json
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
      has_blueprint_placeholder: { Args: { _t: string[] }; Returns: boolean }
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
      has_workspace_assignment: {
        Args: {
          _scope_id: string
          _scope_type: string
          _team: string
          _user: string
        }
        Returns: boolean
      }
      home_checkin_start: {
        Args: { _at: string; _event: string }
        Returns: string
      }
      home_offer_relationship: { Args: { _offer: string }; Returns: boolean }
      honor_welcome_code: { Args: { _code: string }; Returns: Json }
      host_analytics: { Args: never; Returns: Json }
      host_cancel_rsvp: {
        Args: { _reason: string; _rsvp: string }
        Returns: undefined
      }
      host_fees_this_month: { Args: { _host: string }; Returns: number }
      host_form_usage: {
        Args: never
        Returns: {
          drafts: number
          library_id: string
          published: number
        }[]
      }
      host_month_recap: {
        Args: { _host: string; _start: string }
        Returns: Json
      }
      host_no_limits_until: { Args: { _uid: string }; Returns: string }
      host_publicly_listed: { Args: { _host: string }; Returns: boolean }
      host_sales_this_month: { Args: { _host: string }; Returns: number }
      host_value_month: {
        Args: { _host: string; _start: string }
        Returns: Json
      }
      host_waiver_cleanup_path: { Args: { _path: string }; Returns: string }
      in_offering_audience: {
        Args: { _id: string; _kind: string }
        Returns: boolean
      }
      infer_gathering_category: {
        Args: { _category: string; _title: string }
        Returns: string
      }
      invite_team_member: {
        Args: { _email: string; _role?: string; _team: string }
        Returns: Json
      }
      is_adult: { Args: { _uid?: string }; Returns: boolean }
      is_builder_workspace_role: { Args: { _role: string }; Returns: boolean }
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
      issue_certificate: { Args: { _offer: string }; Returns: Json }
      join_free_offer: { Args: { _offer: string }; Returns: undefined }
      join_team_by_code: {
        Args: { _by?: string; _code: string; _role?: string }
        Returns: string
      }
      journey_run_activity: {
        Args: { _journey?: string; _limit?: number; _team: string }
        Returns: {
          created_at: string
          current_step: number
          current_step_kind: string
          event_title: string
          id: string
          journey_id: string
          journey_name: string
          next_run_at: string
          note: string
          status: string
          step_count: number
          updated_at: string
        }[]
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
      learn_object_unlocked: { Args: { _name: string }; Returns: boolean }
      leave_free_offer: { Args: { _offer: string }; Returns: undefined }
      leave_team: { Args: { _team: string }; Returns: undefined }
      lesson_is_unlocked: { Args: { _lesson: string }; Returns: boolean }
      lesson_unlock_at: { Args: { _lesson: string }; Returns: string }
      list_public_gatherings: {
        Args: { _days?: number; _include_samples?: boolean; _limit?: number }
        Returns: Json
      }
      list_public_gatherings_unmasked: {
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
      mark_notifications_read: { Args: { _id?: string }; Returns: undefined }
      mark_topic_read: { Args: { _id: string }; Returns: undefined }
      mark_update_read: { Args: { _id: string }; Returns: undefined }
      mask_public_counts: {
        Args: { _cap: number; _j: Json; _manager: boolean; _mode: string }
        Returns: Json
      }
      moderate_comment:
        | {
            Args: {
              _hidden?: boolean
              _id: string
              _locked?: boolean
              _pinned?: boolean
              _remove_reason?: string
            }
            Returns: undefined
          }
        | {
            Args: { _hidden: boolean; _id: string; _pinned: boolean }
            Returns: undefined
          }
      moderate_shoutout: {
        Args: { _action: string; _id: string }
        Returns: undefined
      }
      moderation_queue: { Args: { _team: string }; Returns: Json }
      moderation_reports: { Args: { _team: string }; Returns: Json }
      my_alert_matches: { Args: never; Returns: Json }
      my_authored_library_items: { Args: never; Returns: Json }
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
      my_challenge_list: { Args: never; Returns: Json }
      my_challenge_progress: { Args: { _c: string }; Returns: Json }
      my_challenges: {
        Args: never
        Returns: {
          addons: Json
          capacity: number | null
          cover_style: number
          cover_url: string | null
          created_at: string
          created_by: string
          currency: string
          daily_prompt_en: string | null
          daily_prompt_es: string | null
          description_en: string | null
          description_es: string | null
          draft_request_id: string | null
          ends_on: string
          enrollment: string
          frequency: string
          goal_target: number | null
          goal_unit: string | null
          id: string
          is_paid: boolean
          leaderboard_on: boolean
          model: string
          price_cents: number | null
          starts_on: string
          status: string
          team_id: string
          timezone: string | null
          title_en: string
          title_es: string
        }[]
        SetofOptions: {
          from: "*"
          to: "challenges"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      my_checkin_events: { Args: never; Returns: Json }
      my_coach_updates: { Args: { _slug: string }; Returns: Json }
      my_consent_history: { Args: never; Returns: Json }
      my_contact_threads: { Args: never; Returns: Json }
      my_event_waiver_acceptances: { Args: { _code: string }; Returns: Json }
      my_following: { Args: never; Returns: Json }
      my_invite_code: { Args: never; Returns: string }
      my_learning: { Args: never; Returns: Json }
      my_library_sources: { Args: never; Returns: Json }
      my_locked_lessons: {
        Args: never
        Returns: {
          duration_minutes: number
          id: string
          sort_order: number
          title_en: string
          title_es: string
          track_id: string
          type: string
          unlock_at: string
        }[]
      }
      my_offer_stats: {
        Args: never
        Returns: {
          active: number
          offer_id: string
          total: number
        }[]
      }
      my_plan_status: { Args: never; Returns: Json }
      my_platform_event_acceptance: { Args: { _code: string }; Returns: Json }
      my_poll_votes: {
        Args: { _code: string; _event: string }
        Returns: {
          option_id: string
          poll_id: string
        }[]
      }
      my_progress: { Args: { _tz: string }; Returns: Json }
      my_quiz_attempts: { Args: { _quiz: string }; Returns: Json }
      my_referral_dashboard: { Args: never; Returns: Json }
      my_referrals: { Args: never; Returns: Json }
      my_regular_hosts: {
        Args: never
        Returns: {
          checkins: number
          host_id: string
          host_name: string
        }[]
      }
      my_resource_coaches: { Args: never; Returns: Json }
      my_sole_leader_teams: {
        Args: never
        Returns: {
          team_id: string
          team_name: string
        }[]
      }
      my_team_states: { Args: never; Returns: Json }
      my_tickets: { Args: never; Returns: Json }
      my_updates: { Args: { _limit?: number; _offset?: number }; Returns: Json }
      my_value_meter: { Args: never; Returns: Json }
      my_welcome: { Args: never; Returns: Json }
      my_workspace_assignments: { Args: { _team: string }; Returns: Json }
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
      normalize_host_categories: { Args: { _in: string[] }; Returns: string[] }
      normalize_phone: { Args: { _p: string }; Returns: string }
      normalize_profile_slug: { Args: { _raw: string }; Returns: string }
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
      notify_users: {
        Args: {
          _body: string
          _dedupe: string
          _kind: string
          _link: string
          _title: string
          _user_ids: string[]
        }
        Returns: number
      }
      offer_founding_status: { Args: { _offer: string }; Returns: Json }
      offer_learner_progress: { Args: { _offer: string }; Returns: Json }
      offer_readiness: { Args: { _offer: string }; Returns: Json }
      offering_audience: {
        Args: { _id: string; _kind: string }
        Returns: string[]
      }
      offering_updates: { Args: { _id: string; _kind: string }; Returns: Json }
      pair_buddy: {
        Args: { _buddy: string; _rsvp: string }
        Returns: undefined
      }
      payouts_live: { Args: { _uid: string }; Returns: boolean }
      personal_home: { Args: never; Returns: Json }
      pin_unpinned_published_events: { Args: never; Returns: number }
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
      policy_text_sha: { Args: { _t: string }; Returns: string }
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
      post_team_comment: {
        Args: {
          _body: string
          _parent: string
          _request: string
          _topic: string
        }
        Returns: string
      }
      price_guidance: { Args: { _category: string }; Returns: Json }
      process_attendance_journey: {
        Args: { _journey: string }
        Returns: number
      }
      process_attendance_journeys: {
        Args: { _limit?: number }
        Returns: number
      }
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
      public_cover_paths: { Args: { _refs: Json }; Returns: Json }
      public_event_sessions: {
        Args: { _event: string; _token?: string }
        Returns: Json
      }
      public_host_challenges: { Args: { _host: string }; Returns: Json }
      public_resource_metadata: {
        Args: { _id: string; _kind: string }
        Returns: Json
      }
      public_upcoming: { Args: { _host: string; _team: string }; Returns: Json }
      publish_host_update: { Args: { _id: string }; Returns: number }
      publish_wellness_assessment: {
        Args: { _quiz: string; _revision: number; _scope: string }
        Returns: undefined
      }
      publish_wellness_assessment_checked: {
        Args: { _quiz: string; _revision: number; _scope: string }
        Returns: undefined
      }
      queue_broadcast: { Args: { _id: string }; Returns: number }
      queue_rsvp_notices: {
        Args: { _rsvp: string; _template: string }
        Returns: undefined
      }
      queue_rsvp_reminders: { Args: { _rsvp: string }; Returns: undefined }
      quiz_access_error: { Args: { _quiz: string }; Returns: string }
      quiz_blockers: { Args: { _quiz: string }; Returns: string[] }
      quiz_host_summary: { Args: { _quiz: string }; Returns: Json }
      quiz_is_assessment: { Args: { _quiz: string }; Returns: boolean }
      quiz_option_counts: { Args: { _quiz: string }; Returns: Json }
      quiz_result: { Args: { _attempt: string }; Returns: Json }
      reconcile_challenge_order: {
        Args: {
          _amount: number
          _currency: string
          _environment: string
          _intent: string
          _order: string
          _session: string
          _state: string
        }
        Returns: undefined
      }
      reconcile_challenge_refund: {
        Args: {
          _amount: number
          _lines: Json
          _order: string
          _provider_refund: string
          _status: string
        }
        Returns: undefined
      }
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
      record_host_invite: { Args: { _token: string }; Returns: boolean }
      record_referral: {
        Args: { _code: string; _ref: string }
        Returns: undefined
      }
      record_referral_click: {
        Args: { _code: string; _visitor: string }
        Returns: boolean
      }
      record_referral_payout: {
        Args: {
          _note: string
          _paid_on: string
          _reference: string
          _referrer: string
          _rewards: string[]
        }
        Returns: string
      }
      record_unallocated_challenge_refund: {
        Args: {
          _amount: number
          _order: string
          _refund: string
          _status: string
        }
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
      referral_attribute_order: { Args: { _order: string }; Returns: string }
      referral_item: {
        Args: { _id: string; _kind: string }
        Returns: {
          eligible: boolean
          host_id: string
          price_cents: number
          title: string
        }[]
      }
      referral_program_for: {
        Args: { _item: string; _kind: string }
        Returns: Json
      }
      referral_release_due: { Args: never; Returns: undefined }
      referral_reverse_order: {
        Args: { _order: string; _reason: string }
        Returns: number
      }
      referral_reward_cents: {
        Args: { _kind: string; _sale: number; _value: number }
        Returns: number
      }
      referral_shares_team: {
        Args: { _a: string; _b: string }
        Returns: boolean
      }
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
      register_attendance_waivers: {
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
          _waivers: Json
        }
        Returns: {
          code: string
          status: string
        }[]
      }
      register_event_agreements: {
        Args: {
          _answers: Json
          _email: string
          _event_id: string
          _first: string
          _language: string
          _last: string
          _mail: boolean
          _phone: string
          _platform_version: string
          _plus_ones: number
          _sms: boolean
          _status: string
          _terms_ok: boolean
          _tier_id: string
          _token: string
          _updates_opt_in: boolean
          _waiver_name: string
          _waivers: Json
        }
        Returns: {
          code: string
          status: string
        }[]
      }
      release_challenge_checkout: {
        Args: { _order: string; _state: string }
        Returns: undefined
      }
      remove_library_attachment: {
        Args: { _event: string; _library: string }
        Returns: undefined
      }
      remove_member: {
        Args: { _team: string; _user: string }
        Returns: undefined
      }
      remove_resource: { Args: { _id: string; _kind: string }; Returns: string }
      render_message_vars: {
        Args: {
          _date: string
          _event: string
          _host: string
          _name: string
          _text: string
        }
        Returns: string
      }
      reorder_course_curriculum: {
        Args: { _course: string; _ids: string[]; _track: string }
        Returns: undefined
      }
      reorder_course_curriculum_checked: {
        Args: {
          _course: string
          _expected: string[]
          _ids: string[]
          _track: string
        }
        Returns: undefined
      }
      reorder_event_host_forms: {
        Args: { _event: string; _library: string[] }
        Returns: undefined
      }
      replace_offer_item: { Args: { _item: string; _p: Json }; Returns: string }
      reply_contact_thread: {
        Args: { _body: string; _thread: string }
        Returns: undefined
      }
      reply_support_ticket: {
        Args: { _body: string; _ticket: string }
        Returns: undefined
      }
      report_content: {
        Args: { _id: string; _note: string; _reason: string; _type: string }
        Returns: boolean
      }
      request_coach_updates:
        | {
            Args: {
              _adult: boolean
              _announcements: boolean
              _base: string
              _email: string
              _events: boolean
              _language: string
              _resources: boolean
              _slug: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _adult: boolean
              _announcements: boolean
              _base: string
              _email: string
              _events: boolean
              _language: string
              _resources: boolean
              _send_confirmation: boolean
              _slug: string
            }
            Returns: undefined
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
      request_team_membership: {
        Args: { _invite?: string; _team: string }
        Returns: string
      }
      reserved_profile_slugs: { Args: never; Returns: string[] }
      reset_calendar_feeds: { Args: never; Returns: Json }
      reset_invite_link: { Args: { _event: string }; Returns: string }
      reset_join_code: { Args: { _team: string }; Returns: string }
      resolve_host_slug: { Args: { _slug: string }; Returns: string }
      resolve_report: {
        Args: { _action: string; _id: string; _note?: string }
        Returns: undefined
      }
      resource_availability: { Args: { _id: string }; Returns: string }
      resource_commerce_access: { Args: { _offer: string }; Returns: boolean }
      resource_course_attachments: { Args: { _course: string }; Returns: Json }
      resource_course_included: {
        Args: { _id: string; _kind: string }
        Returns: boolean
      }
      resource_destinations: {
        Args: { _id: string; _kind: string }
        Returns: Json
      }
      resource_is_live: { Args: { _from: string }; Returns: boolean }
      resource_journey_activity: {
        Args: { _journey?: string; _limit?: number; _team: string }
        Returns: Json
      }
      resource_owner_ok: {
        Args: { _id: string; _kind: string }
        Returns: boolean
      }
      resource_protected: {
        Args: { _id: string; _kind: string }
        Returns: boolean
      }
      resource_removal_plan: {
        Args: { _id: string; _kind: string }
        Returns: Json
      }
      restore_resource: {
        Args: { _id: string; _kind: string }
        Returns: undefined
      }
      resume_my_membership: { Args: { _offer: string }; Returns: undefined }
      retreat_checklist: { Args: { _code: string }; Returns: Json }
      revoke_certificate: {
        Args: { _cert: string; _reason: string }
        Returns: undefined
      }
      revoke_challenge_order: {
        Args: { _environment: string; _intent: string }
        Returns: undefined
      }
      revoke_community_suspension: { Args: { _id: string }; Returns: undefined }
      revoke_team_invite: { Args: { _id: string }; Returns: undefined }
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
      safe_form_file_name: { Args: { _n: string }; Returns: string }
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
      save_attendance_journey: {
        Args: {
          _audience: string
          _event: string
          _id: string
          _local: string
          _name: string
          _template: string
        }
        Returns: string
      }
      save_challenge: {
        Args: {
          _activities: Json
          _id: string
          _messages: Json
          _p: Json
          _team: string
        }
        Returns: string
      }
      save_challenge_request: {
        Args: {
          _activities: Json
          _id: string
          _messages: Json
          _p: Json
          _request: string
          _team: string
        }
        Returns: string
      }
      save_coach_review: {
        Args: { _body: string; _host: string; _rating: number }
        Returns: undefined
      }
      save_coach_update_preferences: {
        Args: {
          _announcements: boolean
          _events: boolean
          _resources: boolean
          _token: string
        }
        Returns: undefined
      }
      save_event_builder_draft: {
        Args: { _event: string; _snapshot: Json; _team: string }
        Returns: string
      }
      save_event_communication_journey: {
        Args: {
          _event: string
          _id: string
          _name: string
          _steps: Json
          _team: string
          _trigger: string
        }
        Returns: string
      }
      save_event_cover: {
        Args: {
          _alt: string
          _event: string
          _focal: string
          _overlay: number
          _style: number
        }
        Returns: undefined
      }
      save_host_form: {
        Args: {
          _archive?: boolean
          _description: string
          _en: string
          _es: string
          _file?: string
          _filename?: string
          _id: string
          _kind: string
          _name: string
          _team: string
        }
        Returns: string
      }
      save_host_profile: {
        Args: {
          _accessibility: string
          _categories: string[]
          _city_public: boolean
          _host_public: boolean
          _languages: string[]
          _links: Json
          _org: string
        }
        Returns: undefined
      }
      save_host_update: {
        Args: {
          _body: string
          _id: string
          _kind: string
          _offering: string
          _scheduled_at?: string
          _title: string
        }
        Returns: string
      }
      save_host_waiver: {
        Args: {
          _archive?: boolean
          _en: string
          _es: string
          _file?: string
          _filename?: string
          _id: string
          _name: string
          _team: string
        }
        Returns: string
      }
      save_library_waiver: {
        Args: {
          _archive?: boolean
          _en: string
          _es: string
          _id: string
          _name: string
          _team: string
        }
        Returns: string
      }
      save_message_automation: {
        Args: {
          _audience: string
          _channel: string
          _event_id: string
          _id: string
          _name: string
          _team: string
          _template_id: string
          _timing_hours: number
          _trigger: string
        }
        Returns: string
      }
      save_message_journey: {
        Args: {
          _id: string
          _name: string
          _start_trigger: string
          _steps: Json
          _team: string
        }
        Returns: string
      }
      save_message_template: {
        Args: {
          _audience: string
          _body: string
          _channel: string
          _id: string
          _language: string
          _name: string
          _subject: string
          _team: string
        }
        Returns: string
      }
      save_my_coach_updates: {
        Args: {
          _adult: boolean
          _announcements: boolean
          _events: boolean
          _resources: boolean
          _slug: string
        }
        Returns: undefined
      }
      save_quiz_response: {
        Args: {
          _attempt: string
          _question: string
          _selected: string[]
          _text: string
        }
        Returns: undefined
      }
      save_referral_program: {
        Args: {
          _enabled: boolean
          _item: string
          _kind: string
          _reward_kind: string
          _value: number
        }
        Returns: string
      }
      save_resource_journey: {
        Args: {
          _id: string
          _name: string
          _offer: string
          _steps: Json
          _team: string
        }
        Returns: string
      }
      save_resource_template: {
        Args: {
          _source: string
          _source_kind: string
          _title_en: string
          _title_es: string
        }
        Returns: string
      }
      save_team_announcement: {
        Args: {
          _archived?: boolean
          _body: string
          _id: string
          _link: string
          _pinned: boolean
          _team: string
          _title: string
        }
        Returns: string
      }
      save_wellness_assessment: {
        Args: {
          _config: Json
          _course: string
          _id: string
          _placement: string
          _price: number
          _revision: number
          _team: string
        }
        Returns: Json
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
      set_automation_status: {
        Args: { _id: string; _status: string }
        Returns: undefined
      }
      set_buddy_wish: {
        Args: { _code: string; _on: boolean }
        Returns: undefined
      }
      set_challenge_invite: {
        Args: { _c: string; _on: boolean; _user: string }
        Returns: undefined
      }
      set_communication_event: {
        Args: { _event: string; _journey: string }
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
      set_event_policy: {
        Args: { _config: Json; _event: string; _text: string }
        Returns: undefined
      }
      set_event_public_counts: {
        Args: { _event: string; _mode: string }
        Returns: undefined
      }
      set_event_retreat: {
        Args: { _ends_at: string; _event: string; _retreat: Json }
        Returns: undefined
      }
      set_event_sessions: {
        Args: { _event: string; _sessions: Json }
        Returns: undefined
      }
      set_host_waiver_default: {
        Args: { _id: string; _on: boolean }
        Returns: undefined
      }
      set_journey_status: {
        Args: { _id: string; _status: string }
        Returns: undefined
      }
      set_lesson_progress: {
        Args: { _completed: boolean; _lesson: string }
        Returns: undefined
      }
      set_member_suspension: {
        Args: { _suspend: boolean; _team: string; _user: string }
        Returns: undefined
      }
      set_pass_fee: { Args: { _on: boolean }; Returns: undefined }
      set_profile_slug: { Args: { _slug: string }; Returns: string }
      set_referral_thanks: {
        Args: { _amount: number; _kind: string }
        Returns: undefined
      }
      set_resource_destinations: {
        Args: {
          _coach: boolean
          _courses: Json
          _id: string
          _kind: string
          _price: number
          _team: boolean
        }
        Returns: string
      }
      set_small_groups: {
        Args: { _event: string; _groups: string[] }
        Returns: undefined
      }
      set_team_channel_preference: {
        Args: { _muted?: boolean; _read_announcements?: boolean; _team: string }
        Returns: undefined
      }
      set_workspace_assignment_active: {
        Args: { _active: boolean; _id: string }
        Returns: undefined
      }
      share_team_library_item: {
        Args: { _id: string; _kind: string; _teams: string[] }
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
      start_contact_thread: {
        Args: { _body: string; _event: string; _offer: string }
        Returns: string
      }
      start_hosting_window: { Args: never; Returns: string }
      start_journey_run: {
        Args: {
          _event: string
          _journey: string
          _next: string
          _rsvp: string
          _team: string
        }
        Returns: undefined
      }
      start_quiz_attempt: { Args: { _quiz: string }; Returns: Json }
      storage_allows: { Args: { _bytes: number }; Returns: boolean }
      storage_used_bytes: { Args: { _uid: string }; Returns: number }
      store_event_waivers: {
        Args: { _accepted: Json; _ref: string; _rsvp: string; _source: string }
        Returns: undefined
      }
      submit_quiz: { Args: { _attempt: string }; Returns: Json }
      submit_verification: {
        Args: { _credentials: Json; _identity: string; _years: number }
        Returns: string
      }
      suspend_community: {
        Args: {
          _reason: string
          _scope_id: string
          _scope_type: string
          _team: string
          _user: string
        }
        Returns: string
      }
      team_activity: { Args: { _limit?: number; _team: string }; Returns: Json }
      team_analytics: { Args: { _team: string }; Returns: Json }
      team_analytics_summary: { Args: { _team: string }; Returns: Json }
      team_benchmark: { Args: { _root: string }; Returns: Json }
      team_builder_seat_count: { Args: { _team: string }; Returns: number }
      team_builder_seat_limit: { Args: { _team: string }; Returns: number }
      team_capability: {
        Args: { _cap: string; _team: string }
        Returns: boolean
      }
      team_channel_access: {
        Args: { _team: string; _user?: string }
        Returns: boolean
      }
      team_channel_delivery_eligible: {
        Args: { _kind: string; _team: string; _user: string }
        Returns: boolean
      }
      team_channel_owner: { Args: { _team: string }; Returns: boolean }
      team_channel_state: { Args: { _team: string }; Returns: Json }
      team_featured_gatherings: { Args: { _team: string }; Returns: Json }
      team_insights: {
        Args: { _from: string; _root: string; _scope: string; _to: string }
        Returns: Json
      }
      team_invites_list: { Args: { _team: string }; Returns: Json }
      team_library_items: { Args: { _team: string }; Returns: Json }
      team_log: {
        Args: { _action: string; _meta?: Json; _target?: string; _team: string }
        Returns: undefined
      }
      team_member_management: { Args: { _team: string }; Returns: Json }
      team_notification_access: {
        Args: { _kind: string; _link: string; _team: string }
        Returns: boolean
      }
      team_quizzes: { Args: { _team: string }; Returns: Json }
      team_seat_usage: { Args: { _team: string }; Returns: Json }
      team_seat_usage_limit: { Args: { _team: string }; Returns: number }
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
      ticket_payload: { Args: { _code: string }; Returns: Json }
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
      transfer_ownership: {
        Args: { _confirm: string; _new_owner: string; _team: string }
        Returns: undefined
      }
      unblock_user: { Args: { _user: string }; Returns: undefined }
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
      use_resource_template: {
        Args: { _team: string; _template: string }
        Returns: Json
      }
      user_email: { Args: { _user: string }; Returns: string }
      validate_assessment_config: { Args: { _c: Json }; Returns: undefined }
      verified_hosts: { Args: { _ids: string[] }; Returns: string[] }
      verify_certificate: { Args: { _number: string }; Returns: Json }
      vote_poll: {
        Args: { _code: string; _option: string }
        Returns: undefined
      }
      waitlist_position: { Args: { _code: string }; Returns: number }
      walk_in_admit: {
        Args: {
          _email: string
          _event: string
          _first: string
          _language: string
          _last: string
          _phone: string
          _request: string
        }
        Returns: Json
      }
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
      workspace_assignments_list: { Args: { _team: string }; Returns: Json }
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
