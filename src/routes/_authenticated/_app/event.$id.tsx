import { Feature } from '@/lib/feature-flags';
import { CommunityRequestsPanel } from '@/components/community-seats';
import { readChatLinks } from '@/lib/chat-links';
import { TextInvitePanel } from '@/components/text-invite';
import { EventBadgePanel } from '@/components/recognition';
import { EarlyAccessPanel } from '@/components/early-access';
import { CopyButton } from '@/components/copy-button';
import { OutboxSummary } from '@/components/notifications';
import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, UserRound, UsersRound, Check, Save, Rocket, Pencil, CopyPlus, Share2, Ban, Trash2, Copy, MessageCircle, MessageSquareText, Repeat, ImageDown, EyeOff, ScanLine, PartyPopper } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { GatheringCover } from '@/components/gathering-cover';
import { useGatherwell } from '@/components/gatherwell-shell';
import { TemplateEditor, type TemplateDraft } from '@/components/templates';
import { supabase } from '@/integrations/supabase/client';
import { initialsOf, mediaUrl, teamsQuery } from '@/lib/account';
import { guestSummaryQuery, placeOf, seriesQuery, shareLink } from '@/lib/gatherings';
import { blueprintFromEvent } from '@/lib/blueprint-defaults';
import { eventDetailQuery, type ChecklistItem } from '@/lib/templates';
import { gatherwellHead } from '@/lib/gatherwell-head';
import { storyImage } from '@/lib/guest';
import { Switch } from '@/components/ui/switch';
import { useServerFn } from '@tanstack/react-start';
import { refundPayments } from '@/lib/billing.functions';
import { usePaymentGate } from '@/components/plan-page';
import { ShareKit } from '@/components/share-kit';
import { NetworkShareToggle } from '@/components/network-share';
import { MembersOnlyPicker } from '@/components/offers';
import { WaiverEventToggle } from '@/components/waiver';
import { RsvpSettingsPanel } from '@/components/rsvp-questions';
import { EventComments, GroupChatLink } from '@/components/conversation';
import { CohostsPanel, cohostsQuery } from '@/components/cohosts';
import { Polls, PhotoRoll, useLiveCounts } from '@/components/event-live';

export const Route = createFileRoute('/_authenticated/_app/event/$id')({ head: () => gatherwellHead('events'), component: EventDetailPage });

function EventDetailPage() {
  const { id } = Route.useParams();
  const { t, i18n } = useTranslation(); const { userId } = useGatherwell(); const queryClient = useQueryClient(); const navigate = useNavigate();
  const lang = i18n.resolvedLanguage ?? 'en';
  const { data, isLoading } = useQuery(eventDetailQuery(id));
  const { data: teams = [] } = useQuery(teamsQuery(userId));
  const event = data?.event;
  const leadsTeam = !!event && teams.some(team => team.teamId === event.team_id && team.role === 'leader');
  const { data: cohostIds = [] } = useQuery({ ...cohostsQuery(id) });
  const isCohost = cohostIds.includes(userId);
  const manages = !!event && (event.host_id === userId || leadsTeam || isCohost);
  const { data: guests } = useQuery({ ...guestSummaryQuery(id), enabled: manages });
  const { data: series = [] } = useQuery({ ...seriesQuery(event?.series_id ?? null), enabled: manages && !!event?.series_id });
  const live = useLiveCounts(id, () => void queryClient.invalidateQueries({ queryKey: ['event', id, 'guests'] }));
  const ended = !!event && new Date(event.ends_at ?? new Date(new Date(event.starts_at).getTime() + 3600000)).getTime() < Date.now();
  const { data: summary } = useQuery({ queryKey: ['event', id, 'summary', live?.checked_in], enabled: manages && ended && event?.status === 'published',
    queryFn: async () => (await supabase.rpc('event_summary', { _event: id })).data as null | Record<'rsvps' | 'checkins' | 'walk_ins' | 'first_timers' | 'photos', number> });
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [saving, setSaving] = useState(false); const [sheet, setSheet] = useState<'share' | 'cancel' | 'delete' | null>(null); const [notify, setNotify] = useState(true);
  const [refund, setRefund] = useState(true); const gate = usePaymentGate(); const refundFn = useServerFn(refundPayments);
  const { data: planWaiting = 0 } = useQuery({ queryKey: ['event', id, 'plan-waitlist'], enabled: manages && event?.status === 'published',
    queryFn: async () => {
      const { data: hit } = await supabase.from('event_plan_waitlist').select('event_id').eq('event_id', id).maybeSingle();
      if (!hit) return 0;
      const { count } = await supabase.from('rsvps').select('id', { count: 'exact', head: true }).eq('event_id', id).eq('status', 'waitlist');
      return count ?? 0;
    } });
  if (isLoading) return <div className="panel"><p className="auth-subtitle">{t('publicEvent.loading')}</p></div>;
  if (!data || !event) return <section className="panel"><h2>{t('eventDetail.notFound')}</h2><Button asChild variant="secondary" className="mt-4"><Link to="/events"><ArrowLeft />{t('gathering.backToGatherings')}</Link></Button></section>;
  const { hostName, going, teamName, checklist } = data;
  const isHost = event.host_id === userId;
  const description = lang === 'es' ? event.description_es || event.description_en : event.description_en || event.description_es;
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['event', id] }); await queryClient.invalidateQueries({ queryKey: ['gatherings'] }); await queryClient.invalidateQueries({ queryKey: ['team', event.team_id] }); };
  const toggle = async (index: number) => {
    if (!checklist) return;
    const items: ChecklistItem[] = checklist.map((item, i) => i === index ? { ...item, done: !item.done } : item);
    queryClient.setQueryData(eventDetailQuery(id).queryKey, old => (old ? { ...old, checklist: items } : old));
    const { error } = await supabase.from('event_checklists').update({ items, updated_at: new Date().toISOString() }).eq('event_id', id);
    if (error) { toast.error(t('profile.saveError')); await refresh(); }
  };
  const setStatus = async (status: 'published' | 'cancelled') => {
    setSaving(true); const { error } = await supabase.from('events').update({ status }).eq('id', id); setSaving(false);
    if (error) { toast.error(t('profile.saveError')); return; }
    if (status === 'cancelled' && refund && event.price_cents) {
      if (!gate.connected) toast.message(t('billing.refundNotConnected'));
      else { try { const r = await refundFn({ data: { eventId: id } }); if (r.ok) toast.success(t('billing.refundedCount', { count: r.refunded })); else toast.message(t('billing.refundNotConnected')); } catch { toast.error(t('billing.error')); } }
    }
    if (status === 'cancelled' && notify) { const { data: n } = await supabase.rpc('notify_gathering_cancelled', { _event: id }); toast.success(t('notify.cancelQueued', { count: n ?? 0 })); }
    void queryClient.invalidateQueries({ queryKey: ['outbox-summary', id] });
    toast.success(t(status === 'published' ? 'templates.launchedToast' : 'gathering.cancelled')); setSheet(null); await refresh();
  };
  const remove = async () => {
    setSaving(true); const { error } = await supabase.from('events').delete().eq('id', id); setSaving(false);
    if (error) { toast.error(t('profile.saveError')); return; }
    toast.success(t('gathering.deleted')); await queryClient.invalidateQueries({ queryKey: ['gatherings'] }); void navigate({ to: '/events', search: { tab: 'hosting' } });
  };
  const start = new Date(event.starts_at);
  const when = start.toLocaleString(lang, { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const link = shareLink(event); const invite = t('gathering.invite', { title: event.title, date: when, link });
  const statusChip = <span className={`chip ${event.status === 'published' ? 'published-chip' : ''}`}>{t(`teamSpace.status.${event.status}`)}</span>;

  return <>
    <Link to="/events" className="auth-link back-link"><ArrowLeft />{t('gathering.backToGatherings')}</Link>
    <section className="panel manage-header">
      <GatheringCover path={event.cover_url} style={event.cover_style} title={event.title} className="manage-cover" />
      <div className="manage-body">
        <div className="profile-chips">{statusChip}<span className="chip">{t(`gathering.vis.${event.visibility === 'public' ? 'public' : event.visibility === 'invite' ? 'invite' : 'team'}`)}</span>{event.series_id && <span className="chip"><Repeat className="inline-icon" />{t('gathering.weekly')}</span>}</div>
        <h1 className="manage-title">{event.title}</h1>
        <ul className="detail-facts">
          <li><CalendarDays />{when}</li>
          <li><MapPin />{placeOf(event) ?? (event.online_url ? t('teamSpace.online') : t('teamSpace.placeTbd'))}{event.address && event.location_name ? ` · ${event.address}` : ''}</li>
          {event.meeting_note && <li><MapPin />{event.meeting_note}</li>}
          <li><UserRound /><span className="initial-avatar small-avatar">{initialsOf(hostName)}</span>{t('eventDetail.hostedBy', { name: hostName ?? t('teamSpace.someone') })}{teamName ? ` · ${teamName}` : ''}</li>
          <li><UsersRound />{event.capacity ? t('gathering.goingOf', { count: going, total: event.capacity }) : t('map.going', { count: going })}</li>
        </ul>
        {description && <p className="detail-description">{description}</p>}
        {manages && planWaiting > 0 && <div className="notice-banner is-inline" role="status"><UsersRound /><div><strong>{t('billing.planWaitTitle', { count: planWaiting })}</strong><p>{t('billing.planWaitBody')}</p></div><Button asChild size="sm"><Link to="/plan">{t('billing.upgrade')}</Link></Button></div>}
        {manages ? <div className="manage-actions">
          {event.status === 'published' && <Button asChild><Link to="/event/$id/checkin" params={{ id }}><ScanLine />{t('live.startCheckin')}</Link></Button>}
          {event.status === 'draft' && <Button disabled={saving} onClick={() => setStatus('published')}><Rocket />{t('gathering.publish')}</Button>}
          {event.status !== 'cancelled' && <Button asChild variant="secondary"><Link to="/gathering/$id/edit" params={{ id }}><Pencil />{t('gathering.edit')}</Link></Button>}
          <Button asChild variant="secondary"><Link to="/gathering/new" search={{ from: id }}><CopyPlus />{t('gathering.duplicate')}</Link></Button>
          {event.status === 'published' && <Button variant="secondary" onClick={() => setSheet('share')}><Share2 />{t('gathering.share')}</Button>}
          {isHost && <Button variant="secondary" onClick={() => setDraft(blueprintFromEvent(event, checklist?.map(item => item.label) ?? []))}><Save />{t('templates.saveAs')}</Button>}
          {event.status === 'published' && <Button variant="ghost" className="danger-text" onClick={() => setSheet('cancel')}><Ban />{t('gathering.cancel')}</Button>}
          {event.status === 'draft' && <Button variant="ghost" className="danger-text" onClick={() => setSheet('delete')}><Trash2 />{t('gathering.deleteDraft')}</Button>}
        </div> : event.status === 'published' && event.visibility === 'public' && <div className="manage-actions"><Button asChild variant="secondary"><Link to="/e/$id" params={{ id: event.id }}>{t('teamSpace.openEvent')}<ArrowRight /></Link></Button></div>}
      </div>
    </section>

    {manages && summary && <section className="panel summary-panel"><div className="section-heading"><h2><PartyPopper className="inline-icon" />{t('live.summaryTitle')}</h2><span className="chip published-chip">{t('live.completed')}</span></div>
      <div className="summary-grid">{(['rsvps', 'checkins', 'walk_ins', 'first_timers', 'photos'] as const).map(k => <div key={k} className="guest-stat"><strong className="tabular">{summary[k] ?? 0}</strong><span>{t(`live.summary.${k}`)}</span></div>)}</div></section>}
    {manages && <section className="panel"><div className="section-heading"><h2>{t('gathering.guests')}</h2></div>
      <div className="guest-stats">{(['going', 'maybe', 'waitlist'] as const).map(k => <div key={k} className="guest-stat"><strong className="tabular">{guests?.[k] ?? 0}</strong><span>{t(`gathering.guestStatus.${k}`)}</span></div>)}</div>
      <label className="switch-row guest-hide-row"><EyeOff className="inline-icon" /><span><strong>{t('guestList.hideList')}</strong><small>{t('guestList.hideListHelp')}</small></span><Switch checked={!!event.hide_guest_list} onCheckedChange={async v => { const { error } = await supabase.from('events').update({ hide_guest_list: v }).eq('id', id); if (error) toast.error(t('profile.saveError')); else await refresh(); }} /></label>
      <Button asChild variant="link" className="detail-link"><Link to="/event/$id/guests" params={{ id }}>{t('gathering.viewGuests')}<ArrowRight /></Link></Button></section>}

    {manages && event.status === 'published' && <section className="panel"><Polls eventId={id} manage /><PhotoRoll eventId={id} canAdd /></section>}

    {manages && checklist && checklist.length > 0 && <section className="panel">
      <div className="section-heading"><h2>{t('eventDetail.checklist')}</h2><span className="chip">{t('eventDetail.onlyYou')}</span></div>
      <ul className="host-checklist">{checklist.map((item, i) => <li key={i}><button type="button" className={`check-item ${item.done ? 'is-done' : ''}`} aria-pressed={item.done} onClick={() => toggle(i)}><span className="check-box">{item.done && <Check />}</span>{item.label}</button></li>)}</ul>
    </section>}

    {manages && series.length > 1 && <section className="panel"><div className="section-heading"><div><h2>{t('gathering.series')}</h2><p>{t('gathering.seriesHelp')}</p></div></div>
      <ul className="series-list">{series.map(s => <li key={s.id}><Link to="/event/$id" params={{ id: s.id }} className={`series-row ${s.id === id ? 'is-current' : ''}`}>
        <span>{new Date(s.starts_at).toLocaleString(lang, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
        <span className="chip">{t(`teamSpace.status.${s.status}`)}</span></Link></li>)}</ul>
      {event.status !== 'cancelled' && <Button asChild variant="secondary"><Link to="/gathering/$id/edit" params={{ id }}><Pencil />{t('gathering.editSeries')}</Link></Button>}
    </section>}

    <GroupChatLink table="events" id={event.id} links={readChatLinks(event as any)} canEdit={manages} />
    {manages && <CommunityRequestsPanel kind="event" target={event.id} seats={(event as { community_seats?: number | null }).community_seats} />}
    {manages && event.status === 'published' && <TextInvitePanel eventId={event.id} title={event.title} startsAt={event.starts_at} timezone={event.timezone} />}
    {manages && event.status === 'published' && <EventBadgePanel eventId={event.id} teamId={event.team_id} />}
    {event.status !== 'draft' && <EventComments eventId={event.id} teamId={event.team_id} me={userId} />}
    {(manages || cohostIds.length > 0) && <CohostsPanel eventId={event.id} teamId={event.team_id} hostId={event.host_id} canEdit={event.host_id === userId || leadsTeam} />}

    <ResponsiveSheet open={sheet === 'share'} onOpenChange={o => !o && setSheet(null)} title={t('gathering.share')} description={event.title}>
      <ShareKit title={event.title} startsAt={event.starts_at} timezone={event.timezone} place={placeOf(event) ?? (event.online_url ? t('teamSpace.online') : '')} link={link} coverPath={event.cover_url} coverStyle={event.cover_style} />
      {isHost && event.visibility === 'public' && event.status === 'published' && <Feature flag="feature_network"><NetworkShareToggle eventId={event.id} /></Feature>}
      {manages && <RsvpSettingsPanel eventId={event.id} initial={{ questions: ((event as any).rsvp_questions ?? []), require_approval: !!(event as any).require_approval, visibility: event.visibility, invite_token: (event as any).invite_token ?? '', price_cents: (event as any).price_cents ?? null }} />}
      {isHost && <WaiverEventToggle eventId={event.id} teamId={event.team_id} value={!!(event as { requires_waiver?: boolean }).requires_waiver} />}
      {isHost && <MembersOnlyPicker table="events" id={event.id} teamId={event.team_id} />}
      {isHost && event.status === 'published' && <EarlyAccessPanel eventId={event.id} hostId={event.host_id} />}
    </ResponsiveSheet>
    {manages && event.status !== 'draft' && <OutboxSummary eventId={id} />}
    <ResponsiveSheet open={sheet === 'cancel'} onOpenChange={o => !o && setSheet(null)} title={t('gathering.cancelTitle')} description={t('gathering.cancelText')}>
      <div className="edit-form"><label className="switch-row"><Checkbox checked={notify} onCheckedChange={v => setNotify(!!v)} /><span><strong>{t('gathering.notifyGuests')}</strong><small>{t('notify.cancelNote')}</small></span></label>
        {!!event.price_cents && <label className="switch-row"><Checkbox checked={refund} onCheckedChange={v => setRefund(!!v)} /><span><strong>{t('billing.refundEveryone')}</strong><small>{gate.connected ? t('billing.refundOnCancel') : t('billing.refundNotConnected')}</small></span></label>}
        <div className="confirm-actions"><Button variant="secondary" onClick={() => setSheet(null)}>{t('gathering.keep')}</Button><Button className="danger-button" disabled={saving} onClick={() => setStatus('cancelled')}>{t('gathering.cancel')}</Button></div></div>
    </ResponsiveSheet>
    <ResponsiveSheet open={sheet === 'delete'} onOpenChange={o => !o && setSheet(null)} title={t('gathering.deleteTitle')} description={t('gathering.deleteText')}>
      <div className="confirm-actions"><Button variant="secondary" onClick={() => setSheet(null)}>{t('gathering.keep')}</Button><Button className="danger-button" disabled={saving} onClick={remove}>{t('gathering.deleteDraft')}</Button></div>
    </ResponsiveSheet>
    {isHost && <TemplateEditor draft={draft} teamId={event.team_id} userId={userId} onClose={() => setDraft(null)} />}
  </>;
}
