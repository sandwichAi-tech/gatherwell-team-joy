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
      events: {
        Row: {
          address: string | null
          capacity: number | null
          cover_style: number
          cover_url: string | null
          created_at: string
          description_en: string | null
          description_es: string | null
          ends_at: string | null
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
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          ends_at?: string | null
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
          cover_style?: number
          cover_url?: string | null
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          ends_at?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_event: { Args: { _event_id: string }; Returns: boolean }
      can_rsvp_event: { Args: { _event_id: string }; Returns: boolean }
      can_use_team_templates: { Args: { _team: string }; Returns: boolean }
      cancel_rsvp_by_code: { Args: { _code: string }; Returns: boolean }
      copy_starter_template: {
        Args: { _team: string; _template: string }
        Returns: string
      }
      create_gathering: {
        Args: { _p: Json; _publish: boolean; _team: string; _weekly: boolean }
        Returns: string
      }
      create_guest_rsvp: {
        Args: {
          _email_opt_in?: boolean
          _event_id: string
          _guest_email?: string
          _guest_name: string
          _guest_phone?: string
          _language?: string
          _plus_ones?: number
          _sms_opt_in?: boolean
        }
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
      gathering_validate: { Args: { _p: Json }; Returns: undefined }
      get_rsvp_by_code: {
        Args: { _code: string }
        Returns: {
          checked_in_at: string
          created_at: string
          email_opt_in: boolean
          event_id: string
          guest_email: string
          guest_name: string
          guest_phone: string
          id: string
          language: string
          plus_ones: number
          sms_opt_in: boolean
          status: string
        }[]
      }
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
      reset_join_code: { Args: { _team: string }; Returns: string }
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
      transfer_leadership: {
        Args: { _team: string; _to: string }
        Returns: undefined
      }
      update_gathering: {
        Args: { _event: string; _p: Json; _whole_series: boolean }
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
