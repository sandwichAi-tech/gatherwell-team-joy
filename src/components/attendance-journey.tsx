import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { nextDaySchedule, eventLocalInput } from '@/lib/attendance-schedule';
import { saveAttendanceJourney } from '@/lib/messaging.functions';

type Journey = { id: string; name: string; event_id?: string | null; attendance_audience?: string | null; attendance_send_at?: string | null; steps: { kind: string; config: Record<string, unknown> }[] };
type Template = { id: string; name: string; channel: string; archived: boolean; body: string; subject: string | null };
export function AttendanceJourneyEditor({ teamId, journey, templates, onClose, onSaved }: { teamId: string; journey?: Journey | undefined; templates: Template[]; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const save = useServerFn(saveAttendanceJourney);
  const [eventId, setEventId] = useState(journey?.event_id ?? '');
  const [name, setName] = useState(journey?.name ?? t('attendancePilot.followup'));
  const [audience, setAudience] = useState(journey?.attendance_audience ?? 'attended');
  const [templateId, setTemplateId] = useState(String(journey?.steps.find(s => s.kind === 'send')?.config['template_id'] ?? ''));
  const [local, setLocal] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<{body: string; subject: string; channel: 'email' | 'sms' | 'in_app'} | null>(null);
  const { data: events = [] } = useQuery({ queryKey: ['attendance-journey-events', teamId], queryFn: async () => {
    const { data, error } = await supabase.from('events').select('id,title,timezone,starts_at,ends_at').eq('team_id', teamId).eq('status', 'published').order('starts_at');
    if (error) throw error;
    const allowed = await Promise.all((data ?? []).map(async event => ({ event, allowed: (await supabase.rpc('can_manage_event', { _event_id: event.id })).data })));
    return allowed.filter(row => row.allowed).map(row => row.event);
  } });
  const event = events.find(e => e.id === eventId);
  const schedule = local || (event ? journey?.attendance_send_at ? eventLocalInput(journey.attendance_send_at, event.timezone) : nextDaySchedule(event.ends_at ?? new Date(new Date(event.starts_at).getTime() + 3600000).toISOString(), event.timezone) : '');
  const template = templates.find(tpl => tpl.id === templateId);
  const submit = async () => {
    setError(null);
    if (!event || !template || !name.trim() || !schedule) { setError(t('comms.err.invalid_steps')); return; }
    setBusy(true);
    try { await save({ data: { eventId, id: journey?.id ?? null, name, templateId, audience: audience === 'absent' ? 'absent' : 'attended', local: schedule, ...(content ? { content: { ...content, language: i18n.resolvedLanguage === 'es' ? 'es' as const : 'en' as const } } : {}) } }); onSaved(); }
    catch (e) { setError(t(e instanceof Error && e.message.includes('invalid_schedule') ? 'attendancePilot.invalidSchedule' : 'profile.saveError')); }
    finally { setBusy(false); }
  };
  return <ResponsiveSheet open onOpenChange={onClose} title={t('attendancePilot.followup')} footer={<Button className="guest-primary" disabled={busy} onClick={() => void submit()}>{t('comms.saveDraft')}</Button>}>
    <div className="guest-form min-w-0">
      <label htmlFor="aj-name" className="field-label">{t('comms.name')}</label><Input id="aj-name" maxLength={120} value={name} onChange={e => setName(e.target.value)} />
      <label htmlFor="aj-event" className="field-label">{t('comms.relatedEvent')}</label><select id="aj-event" className="field-input w-full" value={eventId} onChange={e => { setEventId(e.target.value); setLocal(''); }}><option value="">{t('attendancePilot.chooseEvent')}</option>{events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select>
      <label htmlFor="aj-audience" className="field-label">{t('attendancePilot.audience')}</label><select id="aj-audience" className="field-input w-full" value={audience} onChange={e => setAudience(e.target.value)}><option value="attended">{t('attendancePilot.attended')}</option><option value="absent">{t('attendancePilot.absent')}</option></select>
      <p className="field-hint">{t('attendancePilot.eligibility')}</p>
      <label htmlFor="aj-template" className="field-label">{t('comms.templateLabel')}</label><select id="aj-template" className="field-input w-full" value={templateId} onChange={e => { setTemplateId(e.target.value); setContent(null); }}><option value="">{t('comms.chooseTemplate')}</option>{templates.filter(tpl => !tpl.archived).map(tpl => <option key={tpl.id} value={tpl.id}>{tpl.name} · {t(`comms.channel.${tpl.channel}`)}</option>)}</select>
      {template && <>
        <label htmlFor="aj-channel" className="field-label">{t('attendancePilot.channel')}</label><select id="aj-channel" className="field-input w-full" value={content?.channel ?? template.channel} onChange={e => setContent({ body: content?.body ?? template.body, subject: content?.subject ?? template.subject ?? '', channel: e.target.value === 'sms' ? 'sms' : e.target.value === 'email' ? 'email' : 'in_app' })}>{['in_app','email','sms'].map(channel => <option key={channel} value={channel}>{t(`comms.channel.${channel}`)}</option>)}</select>
        <label htmlFor="aj-subject" className="field-label">{t('comms.subject')}</label><Input id="aj-subject" maxLength={200} value={content?.subject ?? template.subject ?? ''} onChange={e => setContent({ body: content?.body ?? template.body, channel: content?.channel ?? (template.channel === 'sms' ? 'sms' : template.channel === 'email' ? 'email' : 'in_app'), subject: e.target.value })} />
        <label htmlFor="aj-body" className="field-label">{t('comms.body')}</label><textarea id="aj-body" className="field-input w-full" rows={6} maxLength={10000} value={content?.body ?? template.body} onChange={e => setContent({ subject: content?.subject ?? template.subject ?? '', channel: content?.channel ?? (template.channel === 'sms' ? 'sms' : template.channel === 'email' ? 'email' : 'in_app'), body: e.target.value })} />
      </>}
      <label htmlFor="aj-time" className="field-label">{t('attendancePilot.schedule')}</label><Input id="aj-time" type="datetime-local" value={schedule} onChange={e => setLocal(e.target.value)} aria-describedby="aj-hint" aria-invalid={!!error} />
      <p id="aj-hint" className="field-hint">{t('attendancePilot.scheduleHint', { timezone: event?.timezone ?? '—' })}</p>
      {error && <p role="alert" className="field-error">{error}</p>}
      <p className="field-hint">{t('attendancePilot.paused')}</p>
    </div>
  </ResponsiveSheet>;
}