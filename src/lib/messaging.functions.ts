import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

export const listCommunicationOfferings = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ teamId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc('communication_offerings', { _team: data.teamId });
    if (error) throw new Error(error.message);
    return result as { events: { id: string; title: string }[]; resources: { id: string; title_en: string; title_es: string | null }[] };
  });

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

export const saveAttendanceJourney = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ eventId: z.string().uuid(), id: z.string().uuid().nullable(), name: z.string().trim().min(1).max(120), templateId: z.string().uuid(), audience: z.enum(['attended', 'absent']), local: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), content: z.object({ body: z.string().trim().min(1).max(10000), subject: z.string().max(200), channel: z.enum(['email','sms','in_app']), language: z.enum(['en','es']) }).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    let templateId = data.templateId;
    if (data.content) {
      const { data: allowed } = await context.supabase.rpc('can_manage_event', { _event_id: data.eventId });
      if (!allowed) throw new Error('forbidden');
      const { data: event } = await context.supabase.from('events').select('team_id').eq('id',data.eventId).single();
      if (!event?.team_id) throw new Error('forbidden');
      const { data: copy, error } = await context.supabase.rpc('save_message_template', { _team: event.team_id, _id: null, _name: data.name, _channel: data.content.channel, _language: data.content.language, _subject: data.content.subject, _body: data.content.body, _audience: data.audience } as never);
      if (error || !copy) throw new Error(error?.message ?? 'save_failed');
      templateId = copy;
    }
    const { data: id, error } = await context.supabase.rpc('save_attendance_journey', { _event: data.eventId, _id: data.id, _name: data.name, _template: templateId, _audience: data.audience, _local: data.local } as never);
    if (error) throw new Error(error.message);
    return { id };
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
      .select('id, name, start_trigger, status, created_at, offer_id, event_id, attendance_audience, attendance_send_at')
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
  .inputValidator((input: { teamId: string; id?: string | null; name: string; start_trigger: string; steps: unknown[]; offerId?: string; eventId?: string }) => input)
  .handler(async ({ data, context }) => {
    if (data.start_trigger === 'resource_enrollment') {
      if (!data.offerId) throw new Error('resource_required');
      const { data:id,error }=await context.supabase.rpc('save_resource_journey',{_team:data.teamId,_id:data.id??null,_offer:data.offerId,_name:data.name,_steps:data.steps as never} as never);
      if(error)throw new Error(error.message);return {id};
    }
    const { data: id, error } = await context.supabase.rpc('save_event_communication_journey', {
      _team: data.teamId, _id: data.id ?? null, _name: data.name, _trigger: data.start_trigger,
      _event: data.eventId || null, _steps: data.steps,
    } as never);
    if (error) throw new Error(error.message);
    return { id };
  });

export const setJourneyStatus = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string }) => input)
  .handler(async ({ data, context }) => {
    if (data.status === 'active') {
      const { data: steps, error } = await context.supabase.from('message_journey_steps').select('config').eq('journey_id', data.id).eq('kind', 'send');
      if (error) throw new Error(error.message);
      const ids = (steps ?? []).map(step => String((step.config as Record<string, unknown>)['template_id'] ?? ''));
      const { data: templates } = await context.supabase.from('message_templates').select('channel').in('id', ids);
      const { channelStatus } = await import('@/lib/notify/channels.server');
      const setup = channelStatus();
      if (templates?.some(template => template.channel === 'email') && !setup.email) throw new Error('setup_required_email');
      if (templates?.some(template => template.channel === 'sms') && !setup.sms) throw new Error('setup_required_sms');
    }
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
  .inputValidator((input: unknown) => z.object({ teamId: z.string().uuid(), journeyId: z.string().uuid().nullable().optional(), limit: z.number().int().min(1).max(100).default(20) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc('journey_run_activity', {
      _team: data.teamId, _journey: data.journeyId ?? null, _limit: data.limit ?? 20,
    } as never);
    if (error) throw new Error(error.message);
    const {data:resource,error:resourceError}=await context.supabase.rpc('resource_journey_activity', { _team: data.teamId, _journey: data.journeyId ?? null, _limit: data.limit } as never);
    if(resourceError)throw new Error(resourceError.message);
    const resourceRows = Array.isArray(resource) ? resource : [];
    return [...(rows??[]).map(row => ({ ...row, context: 'event' })), ...resourceRows];
  });
