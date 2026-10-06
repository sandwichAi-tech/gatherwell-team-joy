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
      badges: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description_en: string | null
          description_es: string | null
          icon: string
          id: string
          is_custom: boolean
          name_en: string
          name_es: string
          sort_order: number
          team_id: string | null
          tier: string
        }
        Insert: {
          code?: string
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_es?: string | null
          icon?: string
          id?: string
          is_custom?: boolean
          name_en: string
          name_es: string
          sort_order?: number
          team_id?: string | null
          tier?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_es?: string | null
          icon?: string
          id?: string
          is_custom?: boolean
          name_en?: string
          name_es?: string
          sort_order?: number
          team_id?: string | null
          tier?: string
        }
        Relationships: [
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
          connect_account_id: string | null
          connect_status: string
          created_at: string
          pass_fee: boolean
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
          connect_account_id?: string | null
          connect_status?: string
          created_at?: string
          pass_fee?: boolean
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
          connect_account_id?: string | null
          connect_status?: string
          created_at?: string
          pass_fee?: boolean
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
          address: string | null
          capacity: number | null
          category: string | null
          completed_at: string | null
          cover_style: number
          cover_url: string | null
          created_at: string
          description_en: string | null
          description_es: string | null
          ends_at: string | null
          hide_guest_list: boolean
          host_id: string
          id: string
          invite_token: string
          lat: number | null
          lng: number | null
          location_name: string | null
          meeting_note: string | null
          offer_id: string | null
          online_url: string | null
          pass_fee: boolean
          price_cents: number | null
          recurrence: string
          require_approval: boolean
          requires_waiver: boolean
          rsvp_questions: Json
          series_id: string | null
          starts_at: string
          status: string
          team_id: string
          template_id: string | null
          theme: string | null
          timezone: string
          title: string
          visibility: string
          whatsapp_url: string | null
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          category?: string | null
          completed_at?: string | null
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          ends_at?: string | null
          hide_guest_list?: boolean
          host_id?: string
          id?: string
          invite_token?: string
          lat?: number | null
          lng?: number | null
          location_name?: string | null
          meeting_note?: string | null
          offer_id?: string | null
          online_url?: string | null
          pass_fee?: boolean
          price_cents?: number | null
          recurrence?: string
          require_approval?: boolean
          requires_waiver?: boolean
          rsvp_questions?: Json
          series_id?: string | null
          starts_at: string
          status?: string
          team_id: string
          template_id?: string | null
          theme?: string | null
          timezone?: string
          title: string
          visibility?: string
          whatsapp_url?: string | null
        }
        Update: {
          address?: string | null
          capacity?: number | null
          category?: string | null
          completed_at?: string | null
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          ends_at?: string | null
          hide_guest_list?: boolean
          host_id?: string
          id?: string
          invite_token?: string
          lat?: number | null
          lng?: number | null
          location_name?: string | null
          meeting_note?: string | null
          offer_id?: string | null
          online_url?: string | null
          pass_fee?: boolean
          price_cents?: number | null
          recurrence?: string
          require_approval?: boolean
          requires_waiver?: boolean
          rsvp_questions?: Json
          series_id?: string | null
          starts_at?: string
          status?: string
          team_id?: string
          template_id?: string | null
          theme?: string | null
          timezone?: string
          title?: string
          visibility?: string
          whatsapp_url?: string | null
        }
        Relationships: [
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
          created_at: string
          duration_minutes: number | null
          id: string
          live_starts_at: string | null
          notes_en: string | null
          notes_es: string | null
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
          created_at?: string
          duration_minutes?: number | null
          id?: string
          live_starts_at?: string | null
          notes_en?: string | null
          notes_es?: string | null
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
          created_at?: string
          duration_minutes?: number | null
          id?: string
          live_starts_at?: string | null
          notes_en?: string | null
          notes_es?: string | null
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
      offer_purchases: {
        Row: {
          amount_cents: number
          cancel_at_period_end: boolean
          created_at: string
          id: string
          offer_id: string
          renews_at: string | null
          status: string
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          cancel_at_period_end?: boolean
          created_at?: string
          id?: string
          offer_id: string
          renews_at?: string | null
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          cancel_at_period_end?: boolean
          created_at?: string
          id?: string
          offer_id?: string
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
          cover_style: number
          created_at: string
          description_en: string | null
          description_es: string | null
          drip_days: number
          file_path: string | null
          host_id: string
          id: string
          includes_en: Json
          includes_es: Json
          kind: string
          price_cents: number
          status: string
          team_id: string
          title_en: string
          title_es: string
          updated_at: string
        }
        Insert: {
          cover_style?: number
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          drip_days?: number
          file_path?: string | null
          host_id?: string
          id?: string
          includes_en?: Json
          includes_es?: Json
          kind: string
          price_cents?: number
          status?: string
          team_id: string
          title_en?: string
          title_es?: string
          updated_at?: string
        }
        Update: {
          cover_style?: number
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          drip_days?: number
          file_path?: string | null
          host_id?: string
          id?: string
          includes_en?: Json
          includes_es?: Json
          kind?: string
          price_cents?: number
          status?: string
          team_id?: string
          title_en?: string
          title_es?: string
          updated_at?: string
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
      payments: {
        Row: {
          amount_cents: number
          booking_fee_cents: number
          buyer_email: string | null
          buyer_name: string | null
          challenge_id: string | null
          created_at: string
          currency: string
          event_id: string | null
          fee_cents: number
          host_id: string
          id: string
          kind: string
          offer_id: string | null
          rsvp_id: string | null
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          booking_fee_cents?: number
          buyer_email?: string | null
          buyer_name?: string | null
          challenge_id?: string | null
          created_at?: string
          currency?: string
          event_id?: string | null
          fee_cents?: number
          host_id: string
          id?: string
          kind: string
          offer_id?: string | null
          rsvp_id?: string | null
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          booking_fee_cents?: number
          buyer_email?: string | null
          buyer_name?: string | null
          challenge_id?: string | null
          created_at?: string
          currency?: string
          event_id?: string | null
          fee_cents?: number
          host_id?: string
          id?: string
          kind?: string
          offer_id?: string | null
          rsvp_id?: string | null
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
            foreignKeyName: "payments_rsvp_id_fkey"
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
      profiles: {
        Row: {
          active_team_id: string | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string
          full_name: string | null
          id: string
          language: string
          notify_prefs: Json
          onboarded: boolean
          phone: string | null
          role_intent: string | null
          shop_url: string | null
        }
        Insert: {
          active_team_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          language?: string
          notify_prefs?: Json
          onboarded?: boolean
          phone?: string | null
          role_intent?: string | null
          shop_url?: string | null
        }
        Update: {
          active_team_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          language?: string
          notify_prefs?: Json
          onboarded?: boolean
          phone?: string | null
          role_intent?: string | null
          shop_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_team_id_fkey"
            columns: ["active_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
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
          checked_in_at: string | null
          checkin_code: string
          created_at: string
          email_opt_in: boolean
          event_id: string
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          is_walk_in: boolean
          language: string
          plus_ones: number
          sms_opt_in: boolean
          status: string
          user_id: string | null
        }
        Insert: {
          checked_in_at?: string | null
          checkin_code?: string
          created_at?: string
          email_opt_in?: boolean
          event_id: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          is_walk_in?: boolean
          language?: string
          plus_ones?: number
          sms_opt_in?: boolean
          status?: string
          user_id?: string | null
        }
        Update: {
          checked_in_at?: string | null
          checkin_code?: string
          created_at?: string
          email_opt_in?: boolean
          event_id?: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          is_walk_in?: boolean
          language?: string
          plus_ones?: number
          sms_opt_in?: boolean
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
          checklist: Json
          cover_url: string | null
          created_at: string
          created_by: string | null
          default_capacity: number | null
          default_duration_minutes: number
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
          checklist?: Json
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          default_capacity?: number | null
          default_duration_minutes?: number
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
          checklist?: Json
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          default_capacity?: number | null
          default_duration_minutes?: number
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
      admin_grant_preview_license: {
        Args: { _team: string; _tier: string }
        Returns: undefined
      }
      admin_overview: { Args: { _since: string }; Returns: Json }
      admin_reports: { Args: { _status: string }; Returns: Json }
      admin_team_detail: { Args: { _id: string }; Returns: Json }
      admin_teams: { Args: { _q: string }; Returns: Json }
      admin_user_detail: { Args: { _id: string }; Returns: Json }
      admin_users: { Args: { _q: string }; Returns: Json }
      ai_usage_status: { Args: never; Returns: Json }
      assign_license_seat: {
        Args: { _on: boolean; _team: string; _user: string }
        Returns: undefined
      }
      award_badge: {
        Args: { _badge: string; _note: string; _team: string; _user: string }
        Returns: undefined
      }
      build_member_plan: {
        Args: { _team: string; _user: string }
        Returns: undefined
      }
      can_edit_track: { Args: { _track: string }; Returns: boolean }
      can_join_conversation: { Args: { _event: string }; Returns: boolean }
      can_manage_event: { Args: { _event_id: string }; Returns: boolean }
      can_moderate_comment: { Args: { _c: string }; Returns: boolean }
      can_read_challenge: { Args: { _c: string }; Returns: boolean }
      can_read_comment: { Args: { _c: string }; Returns: boolean }
      can_read_track: { Args: { _track: string }; Returns: boolean }
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
      check_in_code: { Args: { _code: string; _event: string }; Returns: Json }
      check_in_rsvp: {
        Args: { _rsvp: string; _undo?: boolean }
        Returns: undefined
      }
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
      compute_playbook: { Args: never; Returns: number }
      copy_starter_template: {
        Args: { _team: string; _template: string }
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
      decide_rsvp: {
        Args: { _approve: boolean; _rsvp: string }
        Returns: string
      }
      default_waiver: { Args: { _team: string }; Returns: undefined }
      delete_comment: { Args: { _id: string }; Returns: undefined }
      delete_my_account: { Args: never; Returns: undefined }
      due_followup_events: { Args: never; Returns: string[] }
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
      evaluate_badges: {
        Args: { _team: string; _user: string }
        Returns: undefined
      }
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
      followups_sent: {
        Args: { _from: string; _root: string; _scope: string; _to: string }
        Returns: number
      }
      gathering_validate: { Args: { _p: Json }; Returns: undefined }
      gatherings_this_month: { Args: { _uid: string }; Returns: number }
      get_email_prefs: { Args: { _token: string }; Returns: Json }
      get_member_plan: { Args: { _team: string }; Returns: Json }
      get_public_event: { Args: { _id: string }; Returns: Json }
      get_public_event_k: {
        Args: { _id: string; _token: string }
        Returns: Json
      }
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
      has_blocked_claim: { Args: { _text: string }; Returns: boolean }
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
      infer_gathering_category: {
        Args: { _category: string; _title: string }
        Returns: string
      }
      is_connected: { Args: { _a: string; _b: string }; Returns: boolean }
      is_event_cohost: { Args: { _event: string }; Returns: boolean }
      is_host_anywhere: { Args: { _u: string }; Returns: boolean }
      is_member_of: { Args: { _team: string; _user: string }; Returns: boolean }
      is_team_member: {
        Args: { _roles: string[]; _team_id: string }
        Returns: boolean
      }
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
      live_lesson_link: { Args: { _lesson: string }; Returns: string }
      local_today: { Args: { _tz: string }; Returns: string }
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
      my_invite_code: { Args: never; Returns: string }
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
      my_referrals: { Args: never; Returns: Json }
      my_sole_leader_teams: {
        Args: never
        Returns: {
          team_id: string
          team_name: string
        }[]
      }
      my_welcome: { Args: never; Returns: Json }
      name_host_of_month: {
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
      notify_rsvp_request: { Args: { _rsvp: string }; Returns: undefined }
      plan_limits: { Args: { _plan: string }; Returns: Json }
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
      promote_waitlist: { Args: { _event: string }; Returns: undefined }
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
      report_content: {
        Args: { _id: string; _note: string; _reason: string; _type: string }
        Returns: boolean
      }
      request_ip: { Args: never; Returns: string }
      reset_invite_link: { Args: { _event: string }; Returns: string }
      reset_join_code: { Args: { _team: string }; Returns: string }
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
      set_email_prefs: {
        Args: { _prefs: Json; _token: string }
        Returns: boolean
      }
      set_event_cohosts: {
        Args: { _event: string; _users: string[] }
        Returns: undefined
      }
      set_pass_fee: { Args: { _on: boolean }; Returns: undefined }
      set_referral_thanks: {
        Args: { _amount: number; _kind: string }
        Returns: undefined
      }
      shares_team_with: { Args: { _other: string }; Returns: boolean }
      storage_allows: { Args: { _bytes: number }; Returns: boolean }
      storage_used_bytes: { Args: { _uid: string }; Returns: number }
      team_benchmark: { Args: { _root: string }; Returns: Json }
      team_featured_gatherings: { Args: { _team: string }; Returns: Json }
      team_insights: {
        Args: { _from: string; _root: string; _scope: string; _to: string }
        Returns: Json
      }
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
      toggle_comment_reaction: {
        Args: { _id: string; _kind: string }
        Returns: boolean
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
      update_gathering: {
        Args: { _event: string; _p: Json; _whole_series: boolean }
        Returns: undefined
      }
      update_rsvp_by_code: {
        Args: { _code: string; _plus_ones: number; _status: string }
        Returns: string
      }
      user_email: { Args: { _user: string }; Returns: string }
      vote_poll: {
        Args: { _code: string; _option: string }
        Returns: undefined
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
