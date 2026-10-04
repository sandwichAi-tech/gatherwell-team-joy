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
          lat: number | null
          lng: number | null
          location_name: string | null
          meeting_note: string | null
          online_url: string | null
          recurrence: string
          series_id: string | null
          starts_at: string
          status: string
          team_id: string
          template_id: string | null
          theme: string | null
          timezone: string
          title: string
          visibility: string
        }
        Insert: {
          address?: string | null
          capacity?: number | null
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
          lat?: number | null
          lng?: number | null
          location_name?: string | null
          meeting_note?: string | null
          online_url?: string | null
          recurrence?: string
          series_id?: string | null
          starts_at: string
          status?: string
          team_id: string
          template_id?: string | null
          theme?: string | null
          timezone?: string
          title: string
          visibility?: string
        }
        Update: {
          address?: string | null
          capacity?: number | null
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
          lat?: number | null
          lng?: number | null
          location_name?: string | null
          meeting_note?: string | null
          online_url?: string | null
          recurrence?: string
          series_id?: string | null
          starts_at?: string
          status?: string
          team_id?: string
          template_id?: string | null
          theme?: string | null
          timezone?: string
          title?: string
          visibility?: string
        }
        Relationships: [
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
      notification_outbox: {
        Row: {
          channel: string
          created_at: string
          event_id: string | null
          id: string
          lesson_id: string | null
          payload: Json
          recipient: string
          rsvp_id: string | null
          send_after: string
          status: string
          template: string
        }
        Insert: {
          channel: string
          created_at?: string
          event_id?: string | null
          id?: string
          lesson_id?: string | null
          payload?: Json
          recipient: string
          rsvp_id?: string | null
          send_after?: string
          status?: string
          template: string
        }
        Update: {
          channel?: string
          created_at?: string
          event_id?: string | null
          id?: string
          lesson_id?: string | null
          payload?: Json
          recipient?: string
          rsvp_id?: string | null
          send_after?: string
          status?: string
          template?: string
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
        ]
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
      recipes: {
        Row: {
          cover_style: number
          cover_url: string | null
          created_at: string
          created_by: string | null
          id: string
          ingredients: Json
          prep_minutes: number | null
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
          prep_minutes?: number | null
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
          prep_minutes?: number | null
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
      team_members: {
        Row: {
          custom_badge: string | null
          joined_at: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          custom_badge?: string | null
          joined_at?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          custom_badge?: string | null
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
          sort_order?: number
          team_id?: string
          title_en?: string
          title_es?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracks_team_id_fkey"
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
      can_edit_track: { Args: { _track: string }; Returns: boolean }
      can_manage_event: { Args: { _event_id: string }; Returns: boolean }
      can_read_track: { Args: { _track: string }; Returns: boolean }
      can_rsvp_event: { Args: { _event_id: string }; Returns: boolean }
      can_use_team_templates: { Args: { _team: string }; Returns: boolean }
      can_view_event: { Args: { _event_id: string }; Returns: boolean }
      cancel_rsvp_by_code: { Args: { _code: string }; Returns: boolean }
      check_in_code: { Args: { _code: string; _event: string }; Returns: Json }
      check_in_rsvp: {
        Args: { _rsvp: string; _undo?: boolean }
        Returns: undefined
      }
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
      delete_my_account: { Args: never; Returns: undefined }
      event_going_count: { Args: { _event_id: string }; Returns: number }
      event_seats_used: { Args: { _event: string }; Returns: number }
      event_summary: { Args: { _event: string }; Returns: Json }
      gathering_validate: { Args: { _p: Json }; Returns: undefined }
      get_public_event: { Args: { _id: string }; Returns: Json }
      get_rsvp_by_code: { Args: { _code: string }; Returns: Json }
      get_team_invite: {
        Args: { _code: string }
        Returns: {
          leader_name: string
          team_id: string
          team_name: string
        }[]
      }
      is_team_member: {
        Args: { _roles: string[]; _team_id: string }
        Returns: boolean
      }
      join_team_by_code: {
        Args: { _code: string; _role?: string }
        Returns: string
      }
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
      live_lesson_link: { Args: { _lesson: string }; Returns: string }
      my_poll_votes: {
        Args: { _code: string; _event: string }
        Returns: {
          option_id: string
          poll_id: string
        }[]
      }
      my_sole_leader_teams: {
        Args: never
        Returns: {
          team_id: string
          team_name: string
        }[]
      }
      post_shoutout: {
        Args: { _message: string; _team: string; _to: string }
        Returns: undefined
      }
      promote_waitlist: { Args: { _event: string }; Returns: undefined }
      queue_rsvp_notices: {
        Args: { _rsvp: string; _template: string }
        Returns: undefined
      }
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
      shares_team_with: { Args: { _other: string }; Returns: boolean }
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
      update_gathering: {
        Args: { _event: string; _p: Json; _whole_series: boolean }
        Returns: undefined
      }
      update_rsvp_by_code: {
        Args: { _code: string; _plus_ones: number; _status: string }
        Returns: string
      }
      vote_poll: {
        Args: { _code: string; _option: string }
        Returns: undefined
      }
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
