import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/**
 * Communications hub server functions. All reads/writes go through the
 * caller's RLS-scoped client and the capability-checked RPCs from migration
 * 0095 — the database is the authorization boundary, not the client.
 */

export const getMessagingSetup = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { channelStatus } = await import('@/lib/notify/channels.server');
    const c = channelStatus();
    return { email: c.email, sms: c.sms, inApp: true };
  });

export const listMessageTemplates = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from('message_templates')
      .select('id, team_id, name, channel, language, subject, body, variables, audience, archived, created_at')
      .or(`team_id.is.null,team_id.eq.${data.teamId}`)
      .order('team_id', { nullsFirst: true })
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveMessageTemplate = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; id?: string | null; name: string; channel: string; language: string; subject?: string; body: string; audience?: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc('save_message_template', {
      _team: data.teamId, _id: data.id ?? null, _name: data.name, _channel: data.channel,
      _language: data.language, _subject: data.subject ?? '', _body: data.body, _audience: data.audience ?? '',
    } as never);
    if (error) throw new Error(error.message);
    return { id };
  });

export const duplicateMessageTemplate = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; teamId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc('duplicate_message_template', { _id: data.id, _team: data.teamId });
    if (error) throw new Error(error.message);
    return { id };
  });

export const archiveMessageTemplate = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; archived: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('archive_message_template', { _id: data.id, _archived: data.archived });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMessageAutomations = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from('message_automations')
      .select('id, name, trigger, timing_hours, audience, channel, template_id, event_id, status, created_at')
      .eq('team_id', data.teamId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveMessageAutomation = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; id?: string | null; name: string; trigger: string; timing_hours: number; audience?: string; channel: string; template_id?: string | null; event_id?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc('save_message_automation', {
      _team: data.teamId, _id: data.id ?? null, _name: data.name, _trigger: data.trigger,
      _timing_hours: data.timing_hours, _audience: data.audience ?? '', _channel: data.channel,
      _template_id: data.template_id ?? null, _event_id: data.event_id ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { id };
  });

export const setAutomationStatus = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string; channel: string }) => input)
  .handler(async ({ data, context }) => {
    // Provider gate: activating an email/SMS automation without the provider
    // secret configured is blocked server-side with a specific reason.
    if (data.status === 'active' && data.channel !== 'in_app') {
      const { channelStatus } = await import('@/lib/notify/channels.server');
      const c = channelStatus();
      if (data.channel === 'email' && !c.email) return { ok: false as const, reason: 'setup_required_email' };
      if (data.channel === 'sms' && !c.sms) return { ok: false as const, reason: 'setup_required_sms' };
    }
    const { error } = await context.supabase.rpc('set_automation_status', { _id: data.id, _status: data.status });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const listMessageJourneys = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: journeys, error } = await context.supabase
      .from('message_journeys')
      .select('id, name, start_trigger, status, created_at')
      .eq('team_id', data.teamId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    const ids = (journeys ?? []).map(j => j.id);
    const { data: steps } = ids.length
      ? await context.supabase.from('message_journey_steps').select('id, journey_id, sort_order, kind, config').in('journey_id', ids).order('sort_order')
      : { data: [] };
    return (journeys ?? []).map(j => ({ ...j, steps: (steps ?? []).filter(s => s.journey_id === j.id) }));
  });

export const saveMessageJourney = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; id?: string | null; name: string; start_trigger: string; steps: unknown[] }) => input)
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc('save_message_journey', {
      _team: data.teamId, _id: data.id ?? null, _name: data.name, _start_trigger: data.start_trigger,
      _steps: data.steps,
    } as never);
    if (error) throw new Error(error.message);
    return { id };
  });

export const setJourneyStatus = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('set_journey_status', { _id: data.id, _status: data.status });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getAutomationActivity = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; limit?: number }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc('automation_activity', { _team: data.teamId, _limit: data.limit ?? 20 });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getJourneyRuns = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; journeyId?: string | null; limit?: number }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc('journey_run_activity', {
      _team: data.teamId, _journey: data.journeyId ?? null, _limit: data.limit ?? 20,
    } as never);
    if (error) throw new Error(error.message);
    return rows;
  });
