import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Json } from '@/integrations/supabase/types';
import type { HostAnalytics, TeamAnalytics } from './insights';
import { monthBounds } from './analytics-period';

/** RLS filters attendance to the caller's participant-access scopes; no contacts returned. */
export const getAttendanceHistory = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const bounds = monthBounds(data.month);
    const { data: rows, error } = await context.supabase.from('rsvps').select('event_id, events!inner(id,title,starts_at)')
      .gte('checked_in_at', bounds.start).lt('checked_in_at', bounds.end).limit(5000);
    if (error) throw new Error(error.message);
    const grouped = new Map<string, { id: string; title: string; starts_at: string; count: number }>();
    for (const row of rows ?? []) {
      const event = row.events;
      if (!event) continue;
      const old = grouped.get(event.id);
      grouped.set(event.id, { ...event, count: (old?.count ?? 0) + 1 });
    }
    const permitted = await Promise.all([...grouped.values()].map(async event => {
      const { data: allowed, error } = await context.supabase.rpc('can_access_event_participants', { _event: event.id });
      if (error) throw new Error(error.message);
      return allowed ? event : null;
    }));
    return permitted.filter(event => event !== null);
  });

/** Caller's own host analytics (hosted/co-hosted events, owned offers, real order ledger). */
export const getHostAnalytics = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc('host_analytics');
    if (error) throw new Error(error.message);
    return data as unknown as HostAnalytics;
  });

/** Aggregate-only team analytics; the database enforces owner/admin/analyst via team_capability. */
export const getTeamAnalytics = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc('team_analytics', { _team: data.teamId });
    if (error) throw new Error(error.message);
    return rows as unknown as TeamAnalytics;
  });

/** Server-authorized export of the caller's own data only. */
export const exportMyData = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc('export_my_data');
    if (error) throw new Error(error.message);
    return data as Json;
  });

export type ConsentHistory = {
  adult_confirmed_at: string | null;
  terms: { event: string; accepted_at: string }[];
  waivers: { event: string; version: number | null; source: string; accepted_at: string }[];
  guardian_consents: { event: string; minor_first_name: string | null; minor_age_band: string | null; guardian_relationship: string | null; consented_at: string }[];
  marketing: { all_off: boolean; reminders: boolean; announcements: boolean; badges: boolean; followups: boolean; updated_at: string } | null;
};

export const getConsentHistory = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc('my_consent_history');
    if (error) throw new Error(error.message);
    return data as unknown as ConsentHistory;
  });
