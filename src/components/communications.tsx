import { useMemo, useState } from 'react';
import { CoachSubscriberSegments } from './coach-updates';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { useGatherwell } from '@/components/gatherwell-shell';
import { workspaceQuery } from '@/lib/account';
import { supabase } from '@/integrations/supabase/client';
import { Link } from '@tanstack/react-router';
import { rpcError } from '@/lib/gatherings';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GwIcon } from '@/components/gw-icon';
import {
  MESSAGE_CHANNELS, MESSAGE_TRIGGERS, JOURNEY_TRIGGERS, JOURNEY_CONDITIONS, TEMPLATE_VARIABLES,
  validateTemplateDraft, validateAutomationDraft, validateJourneySteps, journeyCanActivate, moveStep,
  type JourneyStep, type MessageChannel, type MessageTrigger,
} from '@/lib/messaging';
import {
  getMessagingSetup, listMessageTemplates, saveMessageTemplate, duplicateMessageTemplate, archiveMessageTemplate,
  listMessageAutomations, saveMessageAutomation, setAutomationStatus,
  listMessageJourneys, saveMessageJourney, setJourneyStatus, getAutomationActivity, getJourneyRuns, listCommunicationOfferings,
} from '@/lib/messaging.functions';

type Template = { id: string; team_id: string | null; name: string; channel: string; language: string; subject: string | null; body: string; variables: string[]; audience: string; archived: boolean };
type Automation = { id: string; name: string; trigger: string; timing_hours: number; audience: string; channel: string; template_id: string | null; event_id: string | null; status: string };
type Journey = { id: string; name: string; start_trigger: string; status: string; offer_id?: string | null; event_id?: string | null; steps: { id: string; sort_order: number; kind: string; config: Record<string, unknown> }[] };
type Setup = { email: boolean; sms: boolean; inApp: boolean };

const MANAGER_ROLES = ['owner', 'admin', 'host'];

function samplePreview(body: string, t: (k: string) => string) {
  return body
    .replaceAll('{{name}}', t('comms.sampleName'))
    .replaceAll('{{event}}', t('comms.sampleEvent'))
    .replaceAll('{{resource}}', t('comms.sampleResource'))
    .replaceAll('{{date}}', t('comms.sampleDate'))
    .replaceAll('{{host}}', t('comms.sampleHost'));
}

export function CommunicationsPage() {
  const { t } = useTranslation();
  const { userId } = useGatherwell();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'templates' | 'automations' | 'journeys'>('templates');
  const { data: ws } = useQuery({ ...workspaceQuery(userId), enabled: !!userId });
  const teamId = ws?.teamId ?? null;
  const canManage = !!ws && MANAGER_ROLES.includes(ws.workspaceRole);

  const setupFn = useServerFn(getMessagingSetup);
  const { data: setup } = useQuery({ queryKey: ['messaging-setup'], queryFn: () => setupFn(), enabled: !!userId });

  const templatesFn = useServerFn(listMessageTemplates);
  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ['message-templates', teamId], enabled: !!teamId,
    queryFn: () => templatesFn({ data: { teamId: teamId ?? '' } }) as Promise<Template[]>,
  });

  const automationsFn = useServerFn(listMessageAutomations);
  const { data: automations, isLoading: loadingAutomations } = useQuery({
    queryKey: ['message-automations', teamId], enabled: !!teamId,
    queryFn: () => automationsFn({ data: { teamId: teamId ?? '' } }) as Promise<Automation[]>,
  });

  const journeysFn = useServerFn(listMessageJourneys);
  const { data: journeys, isLoading: loadingJourneys } = useQuery({
    queryKey: ['message-journeys', teamId], enabled: !!teamId,
    queryFn: () => journeysFn({ data: { teamId: teamId ?? '' } }) as Promise<Journey[]>,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['message-templates', teamId] });
    void qc.invalidateQueries({ queryKey: ['message-automations', teamId] });
    void qc.invalidateQueries({ queryKey: ['message-journeys', teamId] });
    void qc.invalidateQueries({ queryKey: ['automation-activity', teamId] });
    void qc.invalidateQueries({ queryKey: ['journey-runs', teamId] });
  };

  if (!ws || !teamId) return <div className="page"><p className="empty-state">{t('comms.noTeam')}</p></div>;

  return <div className="page comms-page">
    <header className="page-header">
      <h1>{t('comms.title')}</h1>
      <p className="page-sub">{t('comms.subtitle')}</p>
    </header>

    {setup && <SetupBanner setup={setup} />}
    {canManage && <CoachSubscriberSegments />}
    <section className="comms-section"><h2>{t('comms.offeringScopeTitle')}</h2><p className="field-hint">{t('comms.offeringScopeHint')}</p><Button asChild variant="secondary"><Link to="/learn" search={{ tab: 'mine' }}>{t('comms.resourcesLink')}</Link></Button></section>

    {!canManage && <p className="empty-state" role="note">{t('comms.membersReadOnly')}</p>}

    <div className="segmented full comms-tabs" role="tablist" aria-label={t('comms.title')}>
      {(['templates', 'automations', 'journeys'] as const).map(k =>
        <Button key={k} variant="ghost" role="tab" aria-selected={tab === k} className={tab === k ? 'selected' : ''} onClick={() => setTab(k)}>{t(`comms.tab.${k}`)}</Button>)}
    </div>
    <p className="field-hint comms-tab-hint">{t(`comms.tabHint.${tab}`)}</p>

    {tab === 'templates' && <TemplatesTab teamId={teamId ?? ''} templates={templates ?? []} loading={loadingTemplates} canManage={canManage} onChanged={refresh} />}
    {tab === 'automations' && <AutomationsTab teamId={teamId ?? ''} automations={automations ?? []} templates={templates ?? []} loading={loadingAutomations} canManage={canManage} setup={setup ?? null} onChanged={refresh} />}
    {tab === 'journeys' && <JourneysTab teamId={teamId ?? ''} journeys={journeys ?? []} templates={templates ?? []} loading={loadingJourneys} canManage={canManage} setup={setup ?? null} onChanged={refresh} />}
  </div>;
}

function SetupBanner({ setup }: { setup: Setup }) {
  const { t } = useTranslation();
  return <section className="guest-card comms-setup" aria-label={t('comms.setupTitle')}>
    <strong>{t('comms.setupTitle')}</strong>
    <ul className="comms-setup-list">
      <li><GwIcon name="Mail" /> {t('comms.channel.email')} — {setup.email ? t('comms.setupReady') : t('comms.setupRequired')}</li>
      <li><GwIcon name="MessageSquare" /> {t('comms.channel.sms')} — {setup.sms ? t('comms.setupReady') : t('comms.setupRequired')}</li>
      <li><GwIcon name="Bell" /> {t('comms.channel.in_app')} — {t('comms.setupReady')}</li>
    </ul>
    {(!setup.email || !setup.sms) && <small className="field-hint">{t('comms.setupHint')}</small>}
  </section>;
}

// ============================= Templates =============================

function TemplatesTab({ teamId, templates, loading, canManage, onChanged }: { teamId: string; templates: Template[]; loading: boolean; canManage: boolean; onChanged: () => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<Template | 'new' | null>(null);
  const [preview, setPreview] = useState<Template | null>(null);
  const dupFn = useServerFn(duplicateMessageTemplate);
  const archFn = useServerFn(archiveMessageTemplate);

  const starters = templates.filter(x => x.team_id === null && !x.archived);
  const mine = templates.filter(x => x.team_id === teamId && !x.archived);
  const archived = templates.filter(x => x.team_id === teamId && x.archived);

  const duplicate = async (id: string) => {
    try { await dupFn({ data: { id, teamId } }); toast.success(t('comms.duplicated')); onChanged(); }
    catch (e) { toast.error(rpcError(t, e)); }
  };
  const archive = async (id: string, archived: boolean) => {
    try { await archFn({ data: { id, archived } }); toast.success(t(archived ? 'comms.archived' : 'comms.restored')); onChanged(); }
    catch (e) { toast.error(rpcError(t, e)); }
  };

  if (loading) return <p className="empty-state">{t('comms.loading')}</p>;

  const card = (tpl: Template, starter: boolean) => <article key={tpl.id} className="guest-card comms-card">
    <div className="comms-card-head">
      <strong>{tpl.name}</strong>
      <span className="chip">{t(`comms.channel.${tpl.channel}`)}</span>
      <span className="chip">{tpl.language.toUpperCase()}</span>
    </div>
    <p className="comms-card-body">{tpl.body.slice(0, 140)}{tpl.body.length > 140 ? '…' : ''}</p>
    {tpl.variables.length > 0 && <p className="field-hint">{t('comms.variables')}: {tpl.variables.map(v => `{{${v}}}`).join(' ')}</p>}
    <div className="chip-row">
      <Button variant="ghost" onClick={() => setPreview(tpl)}>{t('comms.preview')}</Button>
      {canManage && <Button variant="ghost" onClick={() => void duplicate(tpl.id)}>{t('comms.duplicate')}</Button>}
      {canManage && !starter && <Button variant="ghost" onClick={() => setEditing(tpl)}>{t('comms.edit')}</Button>}
      {canManage && !starter && <Button variant="ghost" onClick={() => void archive(tpl.id, true)}>{t('comms.archive')}</Button>}
    </div>
  </article>;

  return <div className="comms-section">
    {canManage && <Button className="guest-primary" onClick={() => setEditing('new')}>{t('comms.createTemplate')}</Button>}

    <h2 className="section-title">{t('comms.starters')}</h2>
    {starters.map(x => card(x, true))}

    <h2 className="section-title">{t('comms.yours')}</h2>
    {mine.length === 0 && <p className="empty-state">{t('comms.noTemplates')}</p>}
    {mine.map(x => card(x, false))}

    {archived.length > 0 && <>
      <h2 className="section-title">{t('comms.archivedTitle')}</h2>
      {archived.map(x => <article key={x.id} className="guest-card comms-card is-archived">
        <div className="comms-card-head"><strong>{x.name}</strong><span className="chip">{t(`comms.channel.${x.channel}`)}</span></div>
        {canManage && <div className="chip-row"><Button variant="ghost" onClick={() => void archive(x.id, false)}>{t('comms.restore')}</Button></div>}
      </article>)}
    </>}

    {editing && <TemplateEditor teamId={teamId} template={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />}
    {preview && <ResponsiveSheet open onOpenChange={() => setPreview(null)} title={preview.name}>
      <div className="comms-preview">
        {preview.subject && <p><strong>{t('comms.subject')}:</strong> {samplePreview(preview.subject, t)}</p>}
        <p style={{ whiteSpace: 'pre-line' }}>{samplePreview(preview.body, t)}</p>
        <small className="field-hint">{t('comms.previewHint')}</small>
      </div>
    </ResponsiveSheet>}
  </div>;
}

function TemplateEditor({ teamId, template, onClose, onSaved }: { teamId: string; template: Template | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const saveFn = useServerFn(saveMessageTemplate);
  const [name, setName] = useState(template?.name ?? '');
  const [channel, setChannel] = useState<MessageChannel>((template?.channel as MessageChannel) ?? 'email');
  const [language, setLanguage] = useState(template?.language ?? 'en');
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [body, setBody] = useState(template?.body ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const err = validateTemplateDraft({ name, channel, body });
    if (err) { toast.error(t(`comms.err.${err}`)); return; }
    setBusy(true);
    try {
      await saveFn({ data: { teamId, id: template?.id ?? null, name, channel, language, subject, body } });
      toast.success(t('comms.saved')); onSaved();
    } catch (e) { toast.error(rpcError(t, e)); }
    setBusy(false);
  };

  return <ResponsiveSheet open onOpenChange={onClose} title={template ? t('comms.editTemplate') : t('comms.createTemplate')}
    footer={<Button className="guest-primary" disabled={busy} onClick={() => void save()}>{busy ? t('onboarding.saving') : t('comms.save')}</Button>}>
    <div className="form-section">
      <label className="field-label" htmlFor="mt-name">{t('comms.name')}</label>
      <Input id="mt-name" className="field-input" maxLength={120} value={name} onChange={e => setName(e.target.value)} />
    </div>
    <div className="form-section">
      <span className="field-label">{t('comms.channelLabel')}</span>
      <div className="segmented full" role="group" aria-label={t('comms.channelLabel')}>
        {MESSAGE_CHANNELS.map(c => <Button key={c} variant="ghost" className={channel === c ? 'selected' : ''} aria-pressed={channel === c} onClick={() => setChannel(c)}>{t(`comms.channel.${c}`)}</Button>)}
      </div>
    </div>
    <div className="form-section">
      <span className="field-label">{t('comms.language')}</span>
      <div className="segmented full" role="group" aria-label={t('comms.language')}>
        {['en', 'es'].map(l => <Button key={l} variant="ghost" className={language === l ? 'selected' : ''} aria-pressed={language === l} onClick={() => setLanguage(l)}>{l === 'en' ? 'English' : 'Español'}</Button>)}
      </div>
    </div>
    {channel === 'email' && <div className="form-section">
      <label className="field-label" htmlFor="mt-subject">{t('comms.subject')}</label>
      <Input id="mt-subject" className="field-input" maxLength={200} value={subject} onChange={e => setSubject(e.target.value)} />
    </div>}
    <div className="form-section">
      <label className="field-label" htmlFor="mt-body">{t('comms.body')}</label>
      <textarea id="mt-body" className="field-input" rows={6} maxLength={channel === 'sms' ? 480 : 4000} value={body} onChange={e => setBody(e.target.value)} />
      <div className="chip-row" aria-label={t('comms.variables')}>
        {TEMPLATE_VARIABLES.map(v => <Button key={v} type="button" variant="ghost" className="preset-chip" onClick={() => setBody(b => `${b}{{${v}}}`)}>{`{{${v}}}`}</Button>)}
      </div>
      <small className="field-hint">{t('comms.variablesHint')}</small>
    </div>
    {body.trim() && <div className="form-section">
      <span className="field-label">{t('comms.preview')}</span>
      <div className="guest-card comms-preview"><p style={{ whiteSpace: 'pre-line' }}>{samplePreview(body, t)}</p></div>
    </div>}
  </ResponsiveSheet>;
}

// ============================= Automations =============================

function AutomationsTab({ teamId, automations, templates, loading, canManage, setup, onChanged }: {
  teamId: string; automations: Automation[]; templates: Template[]; loading: boolean; canManage: boolean; setup: Setup | null; onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<Automation | 'new' | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const statusFn = useServerFn(setAutomationStatus);
  const activityFn = useServerFn(getAutomationActivity);
  const { data: activity } = useQuery({
    queryKey: ['automation-activity', teamId], enabled: showActivity,
    queryFn: () => activityFn({ data: { teamId, limit: 20 } }) as Promise<{ id: string; channel: string; template: string; status: string; send_after: string; sent_at: string | null; error: string | null; automation_name: string | null; event_title: string | null }[]>,
  });

  const setStatus = async (a: Automation, status: string) => {
    try {
      const r = await statusFn({ data: { id: a.id, status, channel: a.channel } });
      if (!r.ok) { toast.error(t(`comms.err.${r.reason}`)); return; }
      toast.success(t(`comms.status.${status}`)); onChanged();
    } catch (e) { toast.error(rpcError(t, e)); }
  };

  if (loading) return <p className="empty-state">{t('comms.loading')}</p>;

  return <div className="comms-section">
    {canManage && <Button className="guest-primary" onClick={() => setEditing('new')}>{t('comms.createAutomation')}</Button>}
    {automations.length === 0 && <p className="empty-state">{t('comms.noAutomations')}</p>}
    {automations.map(a => {
      const tpl = templates.find(x => x.id === a.template_id);
      const blocked = a.channel === 'email' && setup && !setup.email || a.channel === 'sms' && setup && !setup.sms;
      return <article key={a.id} className="guest-card comms-card">
        <div className="comms-card-head">
          <strong>{a.name}</strong>
          <span className={`chip comms-status-${a.status}`}>{t(`comms.status.${a.status}`)}</span>
        </div>
        <p className="comms-card-body">
          {t(`comms.trigger.${a.trigger}`)}{a.trigger === 'event_reminder' ? ` · ${t('comms.timingHours', { hours: a.timing_hours })}` : ''} · {t(`comms.channel.${a.channel}`)} · {tpl ? tpl.name : t('comms.noTemplate')}
        </p>
        {blocked && <p className="field-hint comms-warning" role="note">{t(`comms.err.setup_required_${a.channel}`)}</p>}
        {canManage && <div className="chip-row">
          <Button variant="ghost" onClick={() => setEditing(a)}>{t('comms.edit')}</Button>
          {a.status !== 'active' && <Button variant="ghost" onClick={() => void setStatus(a, 'active')}>{t('comms.activate')}</Button>}
          {a.status === 'active' && <Button variant="ghost" onClick={() => void setStatus(a, 'paused')}>{t('comms.pause')}</Button>}
          {a.status === 'paused' && <Button variant="ghost" onClick={() => void setStatus(a, 'draft')}>{t('comms.toDraft')}</Button>}
        </div>}
      </article>;
    })}

    <Button variant="ghost" aria-expanded={showActivity} onClick={() => setShowActivity(v => !v)}>{t('comms.activity')}</Button>
    {showActivity && <section className="guest-card" aria-label={t('comms.activity')}>
      {!activity?.length && <p className="empty-state">{t('comms.noActivity')}</p>}
      {activity?.map(row => <p key={row.id} className="comms-activity-row">
        <strong>{row.automation_name ?? row.template}</strong> · {row.event_title ?? ''} · {t(`comms.channel.${row.channel}`)} · {t(`comms.delivery.${row.status}`)} · {new Date(row.sent_at ?? row.send_after).toLocaleString()}
        {row.error ? ` · ${row.error}` : ''}
      </p>)}
    </section>}

    {editing && <AutomationEditor teamId={teamId} automation={editing === 'new' ? null : editing} templates={templates} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />}
  </div>;
}

function AutomationEditor({ teamId, automation, templates, onClose, onSaved }: { teamId: string; automation: Automation | null; templates: Template[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const saveFn = useServerFn(saveMessageAutomation);
  const [name, setName] = useState(automation?.name ?? '');
  const [trigger, setTrigger] = useState<MessageTrigger>((automation?.trigger as MessageTrigger) ?? 'registration_confirmation');
  const [timing, setTiming] = useState(automation?.timing_hours ?? 24);
  const [channel, setChannel] = useState<MessageChannel>((automation?.channel as MessageChannel) ?? 'email');
  const [templateId, setTemplateId] = useState(automation?.template_id ?? '');
  const [eventId, setEventId] = useState(automation?.event_id ?? '');
  const offeringFn = useServerFn(listCommunicationOfferings);
  const { data: choices } = useQuery({ queryKey: ['communication-offerings', teamId], queryFn: () => offeringFn({ data: { teamId } }) });
  const events = choices?.events ?? [];
  const [busy, setBusy] = useState(false);

  const eligible = templates.filter(x => !x.archived && x.channel === channel);

  const save = async () => {
    const err = validateAutomationDraft({ name, trigger, channel, timing_hours: timing });
    if (err) { toast.error(t(`comms.err.${err}`)); return; }
    setBusy(true);
    try {
      await saveFn({ data: { teamId, id: automation?.id ?? null, name, trigger, timing_hours: timing, channel, template_id: templateId || null, event_id: eventId || null, audience: 'attendees' } });
      toast.success(t('comms.savedDraft')); onSaved();
    } catch (e) { toast.error(rpcError(t, e)); }
    setBusy(false);
  };

  return <ResponsiveSheet open onOpenChange={onClose} title={automation ? t('comms.editAutomation') : t('comms.createAutomation')}
    footer={<Button className="guest-primary" disabled={busy || (trigger === 'resource_enrollment' && !offerId)} onClick={() => void save()}>{busy ? t('onboarding.saving') : t('comms.saveDraft')}</Button>}>
    <div className="form-section">
      <label className="field-label" htmlFor="ma-name">{t('comms.name')}</label>
      <Input id="ma-name" className="field-input" maxLength={120} value={name} onChange={e => setName(e.target.value)} />
    </div>
    <div className="form-section"><label className="field-label" htmlFor="ma-event">{t('comms.relatedEvent')}</label><select id="ma-event" className="field-input" value={eventId} onChange={e => setEventId(e.target.value)}><option value="">{t('comms.allEvents')}</option>{events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select><p className="field-hint">{t('comms.attendeeAudience')}</p></div>
    <div className="form-section">
      <span className="field-label">{t('comms.triggerLabel')}</span>
      <div className="stack" role="radiogroup" aria-label={t('comms.triggerLabel')}>
        {MESSAGE_TRIGGERS.map(tr => <label key={tr} className="radio-row">
          <input type="radio" name="ma-trigger" checked={trigger === tr} onChange={() => setTrigger(tr)} />
          <span><strong>{t(`comms.trigger.${tr}`)}</strong><small className="field-hint">{t(`comms.triggerHint.${tr}`)}</small></span>
        </label>)}
      </div>
    </div>
    {trigger === 'event_reminder' && <div className="form-section">
      <label className="field-label" htmlFor="ma-timing">{t('comms.timingLabel')}</label>
      <Input id="ma-timing" className="field-input" type="number" min={1} max={720} value={timing} onChange={e => setTiming(Number(e.target.value))} />
      <small className="field-hint">{t('comms.timingHint')}</small>
    </div>}
    <div className="form-section">
      <span className="field-label">{t('comms.channelLabel')}</span>
      <div className="segmented full" role="group" aria-label={t('comms.channelLabel')}>
        {MESSAGE_CHANNELS.map(c => <Button key={c} variant="ghost" className={channel === c ? 'selected' : ''} aria-pressed={channel === c} onClick={() => { setChannel(c); setTemplateId(''); }}>{t(`comms.channel.${c}`)}</Button>)}
      </div>
      {channel === 'sms' && <small className="field-hint">{t('comms.smsCostHint')}</small>}
    </div>
    <div className="form-section">
      <label className="field-label" htmlFor="ma-template">{t('comms.templateLabel')}</label>
      <select id="ma-template" className="field-input" value={templateId} onChange={e => setTemplateId(e.target.value)}>
        <option value="">{t('comms.chooseTemplate')}</option>
        {eligible.map(x => <option key={x.id} value={x.id}>{x.name} ({x.language.toUpperCase()})</option>)}
      </select>
      {eligible.length === 0 && <small className="field-hint">{t('comms.noEligibleTemplates')}</small>}
    </div>
    <p className="field-hint">{t('comms.automationNote')}</p>
  </ResponsiveSheet>;
}

// ============================= Journeys =============================

function JourneysTab({ teamId, journeys, templates, loading, canManage, setup, onChanged }: {
  teamId: string; journeys: Journey[]; templates: Template[]; loading: boolean; canManage: boolean; setup: Setup | null; onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<Journey | 'new' | null>(null);
  const [showRuns, setShowRuns] = useState(false);
  const statusFn = useServerFn(setJourneyStatus);
  const runsFn = useServerFn(getJourneyRuns);
  const { data: runs } = useQuery({
    queryKey: ['journey-runs', teamId], enabled: showRuns,
    queryFn: () => runsFn({ data: { teamId, limit: 20 } }) as Promise<{ id: string; journey_id: string; journey_name: string; event_title: string; context: string; status: string; current_step: number; step_count: number; current_step_kind: string | null; next_run_at: string; note: string | null; created_at: string }[]>,
  });

  const setStatus = async (j: Journey, status: string) => {
    if (status === 'active' && setup) {
      const channels = new Set(j.steps.filter(s => s.kind === 'send').map(s => templates.find(x => x.id === s.config['template_id'])?.channel));
      if (channels.has('email') && !setup.email) { toast.error(t('comms.err.setup_required_email')); return; }
      if (channels.has('sms') && !setup.sms) { toast.error(t('comms.err.setup_required_sms')); return; }
    }
    try {
      await statusFn({ data: { id: j.id, status } });
      toast.success(t(`comms.status.${status}`)); onChanged();
    } catch (e) { toast.error(rpcError(t, e)); }
  };

  if (loading) return <p className="empty-state">{t('comms.loading')}</p>;

  return <div className="comms-section">
    {canManage && <Button className="guest-primary" onClick={() => setEditing('new')}>{t('comms.createJourney')}</Button>}
    {journeys.length === 0 && <p className="empty-state">{t('comms.noJourneys')}</p>}
    {journeys.map(j => <article key={j.id} className="guest-card comms-card">
      <div className="comms-card-head">
        <strong>{j.name}</strong>
        <span className={`chip comms-status-${j.status}`}>{t(`comms.status.${j.status}`)}</span>
      </div>
      <p className="comms-card-body">{t('comms.journeySummary', { trigger: t(`comms.trigger.${j.start_trigger}`), count: j.steps.length })}</p>
      <ol className="comms-steps">
        {j.steps.map(s => <li key={s.id}>{stepLabel(s.kind, s.config, templates, t)}</li>)}
      </ol>
      {canManage && <div className="chip-row">
        <Button variant="ghost" onClick={() => setEditing(j)}>{t('comms.edit')}</Button>
        {j.status !== 'active' && <Button variant="ghost" onClick={() => void setStatus(j, 'active')}>{t('comms.activate')}</Button>}
        {j.status === 'active' && <Button variant="ghost" onClick={() => void setStatus(j, 'paused')}>{t('comms.pause')}</Button>}
        {j.status === 'paused' && <Button variant="ghost" onClick={() => void setStatus(j, 'draft')}>{t('comms.toDraft')}</Button>}
      </div>}
    </article>)}

    <Button variant="ghost" aria-expanded={showRuns} onClick={() => setShowRuns(v => !v)}>{t('comms.runs')}</Button>
    {showRuns && <section className="guest-card" aria-label={t('comms.runs')}>
      {!runs?.length && <p className="empty-state">{t('comms.noRuns')}</p>}
      {runs?.map(r => <p key={r.id} className="comms-activity-row">
        <strong>{r.journey_name}</strong> · {t(r.context === 'resource' ? 'comms.resourceContext' : 'comms.eventContext')}: {r.event_title} — {t(`comms.runStatus.${r.status}`)}
        {r.status === 'running' || r.status === 'paused' ? ` · ${t('comms.runStep', { n: r.current_step, total: r.step_count })}` : ''}
        {r.note ? ` · ${t(`comms.runNote.${r.note}`, { defaultValue: r.note })}` : ''}
      </p>)}
    </section>}

    {editing && <JourneyEditor teamId={teamId} journey={editing === 'new' ? null : editing} templates={templates} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />}
  </div>;
}

function stepLabel(kind: string, config: Record<string, unknown>, templates: Template[], t: TFunction): string {
  if (kind === 'wait') return t('comms.step.wait', { hours: Number(config['hours'] ?? 0) });
  if (kind === 'send') return t('comms.step.send', { name: templates.find(x => x.id === config['template_id'])?.name ?? '—' });
  return t(`comms.condition.${String(config['condition'] ?? '')}`);
}

function JourneyEditor({ teamId, journey, templates, onClose, onSaved }: { teamId: string; journey: Journey | null; templates: Template[]; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const saveFn = useServerFn(saveMessageJourney);
  const [name, setName] = useState(journey?.name ?? '');
  const [trigger, setTrigger] = useState<string>(journey?.start_trigger ?? 'registration_confirmation');
  const [offerId,setOfferId]=useState(journey?.offer_id??'');
  const [eventId, setEventId] = useState(journey?.event_id ?? '');
  const offeringFn = useServerFn(listCommunicationOfferings);
  const { data: choices } = useQuery({ queryKey: ['communication-offerings', teamId], queryFn: () => offeringFn({ data: { teamId } }) });
  const offers = choices?.resources ?? [];
  const events = choices?.events ?? [];
  const [steps, setSteps] = useState<JourneyStep[]>(() => (journey?.steps ?? []).map(s => {
    if (s.kind === 'wait') return { kind: 'wait', hours: Number(s.config['hours'] ?? 24) };
    if (s.kind === 'send') return { kind: 'send', template_id: String(s.config['template_id'] ?? '') };
    return { kind: 'condition', condition: (s.config['condition'] as JourneyStep extends never ? never : 'rsvp_status_going') as 'rsvp_status_going' };
  }));
  const [busy, setBusy] = useState(false);

  const eligible = useMemo(() => templates.filter(x => !x.archived && (trigger !== 'resource_enrollment' || x.channel === 'in_app')), [templates, trigger]);
  const conditions = JOURNEY_CONDITIONS.filter(c => trigger === 'resource_enrollment' ? c === 'enrollment_active' : c !== 'enrollment_active');
  const templateOk = (id: string) => eligible.some(x => x.id === id);
  const validation = validateJourneySteps(steps, templateOk);

  const updateStep = (i: number, next: JourneyStep) => setSteps(ss => ss.map((s, j) => (j === i ? next : s)));

  const save = async () => {
    if (!name.trim()) { toast.error(t('comms.err.invalid_name')); return; }
    if (trigger === 'resource_enrollment' && !offerId) { toast.error(t('comms.chooseResource')); return; }
    if (validation) { toast.error(t(`comms.err.${validation}`)); return; }
    setBusy(true);
    try {
      await saveFn({ data: { teamId, id: journey?.id ?? null, name, start_trigger: trigger, steps, ...(trigger==='resource_enrollment'?{offerId}: {eventId}) } });
      toast.success(t('comms.savedDraft')); onSaved();
    } catch (e) { toast.error(rpcError(t, e)); }
    setBusy(false);
  };

  return <ResponsiveSheet open onOpenChange={onClose} title={journey ? t('comms.editJourney') : t('comms.createJourney')}
    footer={<Button className="guest-primary" disabled={busy || (trigger === 'resource_enrollment' && !offerId)} onClick={() => void save()}>{busy ? t('onboarding.saving') : t('comms.saveDraft')}</Button>}>
    <div className="form-section">
      <label className="field-label" htmlFor="mj-name">{t('comms.name')}</label>
      <Input id="mj-name" className="field-input" maxLength={120} value={name} onChange={e => setName(e.target.value)} />
    </div>
    <div className="form-section">
      <label className="field-label" htmlFor="mj-trigger">{t('comms.startTrigger')}</label>
      <select id="mj-trigger" className="field-input" value={trigger} onChange={e => { setTrigger(e.target.value); setSteps([]); }}>
        {JOURNEY_TRIGGERS.map(tr => <option key={tr} value={tr}>{t(`comms.trigger.${tr}`)}</option>)}
      </select>
    </div>
    {trigger==='resource_enrollment'&&<label className="field-label">{t('comms.relatedResource')}<select className="field-input" value={offerId} onChange={e=>setOfferId(e.target.value)}><option value="">{t('comms.chooseResource')}</option>{offers.map(o=><option key={o.id} value={o.id}>{i18n.resolvedLanguage === 'es' ? o.title_es || o.title_en : o.title_en}</option>)}</select><small>{t('comms.resourceScope')}</small></label>}

    {trigger !== 'resource_enrollment' && <label className="field-label">{t('comms.relatedEvent')}<select className="field-input" value={eventId} onChange={e => setEventId(e.target.value)}><option value="">{t('comms.allEvents')}</option>{events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label>}
    <label className="field-label">{t('comms.audienceLabel')}<select className="field-input" value={trigger === 'resource_enrollment' ? 'enrolled' : 'attendees'} onChange={() => {}}><option value={trigger === 'resource_enrollment' ? 'enrolled' : 'attendees'}>{t(trigger === 'resource_enrollment' ? 'comms.enrolledAudience' : 'comms.attendeeAudience')}</option></select></label>
    {trigger === 'resource_enrollment' && <p className="field-hint">{t('comms.resourceActivation')}</p>}
    <div className="form-section">
      <span className="field-label">{t('comms.steps')}</span>
      <ol className="comms-step-editor">
        {steps.map((s, i) => <li key={i} className="comms-step-row">
          <span className="comms-step-num" aria-hidden="true">{i + 1}</span>
          <div className="comms-step-body">
            {s.kind === 'wait' && <label>{t('comms.step.waitHours')}
              <Input type="number" min={1} max={720} value={s.hours} onChange={e => updateStep(i, { kind: 'wait', hours: Number(e.target.value) })} aria-label={t('comms.step.waitHours')} />
            </label>}
            {s.kind === 'send' && <select className="field-input" value={s.template_id} onChange={e => updateStep(i, { kind: 'send', template_id: e.target.value })} aria-label={t('comms.step.sendLabel')}>
              <option value="">{t('comms.chooseTemplate')}</option>
              {eligible.map(x => <option key={x.id} value={x.id}>{x.name} · {t(`comms.channel.${x.channel}`)}</option>)}
            </select>}
            {s.kind === 'condition' && <select className="field-input" value={s.condition} onChange={e => updateStep(i, { kind: 'condition', condition: e.target.value as typeof s.condition })} aria-label={t('comms.step.conditionLabel')}>
              {conditions.map(c => <option key={c} value={c}>{t(`comms.condition.${c}`)}</option>)}
            </select>}
          </div>
          <div className="comms-step-actions" role="group" aria-label={t('comms.stepActions', { n: i + 1 })}>
            <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={t('comms.moveUp', { n: i + 1 })} disabled={i === 0} onClick={() => setSteps(ss => moveStep(ss, i, -1))}><GwIcon name="ArrowUp" /></Button>
            <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={t('comms.moveDown', { n: i + 1 })} disabled={i === steps.length - 1} onClick={() => setSteps(ss => moveStep(ss, i, 1))}><GwIcon name="ArrowDown" /></Button>
            <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={t('comms.removeStep', { n: i + 1 })} onClick={() => setSteps(ss => ss.filter((_, j) => j !== i))}><GwIcon name="Trash2" /></Button>
          </div>
        </li>)}
      </ol>
      <div className="chip-row">
        <Button variant="ghost" onClick={() => setSteps(ss => [...ss, { kind: 'wait', hours: 24 }])}>{t('comms.addWait')}</Button>
        <Button variant="ghost" onClick={() => setSteps(ss => [...ss, { kind: 'send', template_id: '' }])}>{t('comms.addSend')}</Button>
        <Button variant="ghost" onClick={() => setSteps(ss => [...ss, { kind: 'condition', condition: trigger === 'resource_enrollment' ? 'enrollment_active' : 'rsvp_status_going' }])}>{t('comms.addCondition')}</Button>
      </div>
      {validation && <p className="field-hint comms-warning" role="alert">{t(`comms.err.${validation}`)}</p>}
      {!journeyCanActivate(steps) && !validation && <p className="field-hint">{t('comms.needSendStep')}</p>}
    </div>
    <p className="field-hint">{t('comms.journeyNote')}</p>
  </ResponsiveSheet>;
}
