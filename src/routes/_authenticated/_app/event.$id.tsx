import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, UserRound, UsersRound, Check, Save, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGatherwell } from '@/components/gatherwell-shell';
import { TemplateEditor, type TemplateDraft } from '@/components/templates';
import { supabase } from '@/integrations/supabase/client';
import { initialsOf, teamsQuery } from '@/lib/account';
import { eventDetailQuery, type ChecklistItem } from '@/lib/templates';
import { gatherwellHead } from '@/lib/gatherwell-head';

export const Route = createFileRoute('/_authenticated/_app/event/$id')({ head: () => gatherwellHead('events'), component: EventDetailPage });

function EventDetailPage() {
  const { id } = Route.useParams();
  const { t, i18n } = useTranslation(); const { userId } = useGatherwell(); const queryClient = useQueryClient();
  const lang = i18n.resolvedLanguage ?? 'en';
  const { data, isLoading } = useQuery(eventDetailQuery(id));
  const { data: teams = [] } = useQuery(teamsQuery(userId));
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [saving, setSaving] = useState(false);
  if (isLoading) return <div className="panel"><p className="auth-subtitle">{t('publicEvent.loading')}</p></div>;
  if (!data) return <section className="panel"><h2>{t('eventDetail.notFound')}</h2><Button asChild variant="secondary" className="mt-4"><Link to="/team"><ArrowLeft />{t('eventDetail.backToTeam')}</Link></Button></section>;
  const { event, hostName, going, teamName, checklist } = data;
  const isHost = event.host_id === userId;
  const leadsTeam = teams.some(team => team.teamId === event.team_id && team.role === 'leader');
  const description = lang === 'es' ? event.description_es || event.description_en : event.description_en || event.description_es;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['event', id] });
  const toggle = async (index: number) => {
    if (!checklist) return;
    const items: ChecklistItem[] = checklist.map((item, i) => i === index ? { ...item, done: !item.done } : item);
    queryClient.setQueryData(eventDetailQuery(id).queryKey, { ...data, checklist: items });
    const { error } = await supabase.from('event_checklists').update({ items, updated_at: new Date().toISOString() }).eq('event_id', id);
    if (error) { toast.error(t('profile.saveError')); await refresh(); }
  };
  const publish = async () => {
    setSaving(true); const { error } = await supabase.from('events').update({ status: 'published' }).eq('id', id); setSaving(false);
    if (error) toast.error(t('profile.saveError')); else { toast.success(t('templates.launchedToast')); await refresh(); await queryClient.invalidateQueries({ queryKey: ['team', event.team_id] }); }
  };
  const start = new Date(event.starts_at);
  return <>
    <Link to="/team" className="auth-link back-link"><ArrowLeft />{teamName ?? t('eventDetail.backToTeam')}</Link>
    <div className="page-heading"><div><span className="eyebrow">{t('eventDetail.eyebrow')}</span><h1>{event.title}</h1></div></div>
    <section className="panel">
      <div className="profile-chips"><span className={`chip ${event.status === 'published' ? 'published-chip' : ''}`}>{t(`teamSpace.status.${event.status}`)}</span><span className="chip">{t(`teamSpace.visibility.${event.visibility}`)}</span></div>
      <ul className="detail-facts">
        <li><CalendarDays />{start.toLocaleString(lang, { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</li>
        <li><MapPin />{event.location_name ?? (event.online_url ? t('teamSpace.online') : t('teamSpace.placeTbd'))}</li>
        <li><UserRound /><span className="initial-avatar small-avatar">{initialsOf(hostName)}</span>{t('eventDetail.hostedBy', { name: hostName ?? t('teamSpace.someone') })}</li>
        <li><UsersRound />{event.capacity ? t('sampleEvents.registered', { count: going, total: event.capacity }) : t('teamSpace.going', { count: going })}</li>
      </ul>
      {description && <p className="detail-description">{description}</p>}
      <div className="confirm-actions detail-actions">
        {isHost && event.status === 'draft' && <Button disabled={saving} onClick={publish}><Rocket />{t('templates.publish')}</Button>}
        {isHost && leadsTeam && <Button variant="secondary" onClick={() => setDraft({ title: event.title, description_en: event.description_en, description_es: event.description_es, cover_url: event.cover_url,
          default_duration_minutes: event.ends_at ? Math.max(5, Math.round((new Date(event.ends_at).getTime() - start.getTime()) / 60000)) : 60, default_capacity: event.capacity,
          visibility_default: event.visibility, checklist: checklist?.map(item => item.label) ?? [], is_published: false })}><Save />{t('templates.saveAs')}</Button>}
        {event.status === 'published' && event.visibility === 'public' && <Button asChild variant="secondary"><Link to="/e/$id" params={{ id: event.id }}>{t('teamSpace.openEvent')}<ArrowRight /></Link></Button>}
      </div>
    </section>
    {isHost && checklist && checklist.length > 0 && <section className="panel">
      <div className="section-heading"><h2>{t('eventDetail.checklist')}</h2><span className="chip">{t('eventDetail.onlyYou')}</span></div>
      <ul className="host-checklist">{checklist.map((item, i) => <li key={i}><button type="button" className={`check-item ${item.done ? 'is-done' : ''}`} aria-pressed={item.done} onClick={() => toggle(i)}><span className="check-box">{item.done && <Check />}</span>{item.label}</button></li>)}</ul>
    </section>}
    {leadsTeam && <TemplateEditor draft={draft} teamId={event.team_id} userId={userId} onClose={() => setDraft(null)} />}
  </>;
}
