import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, Copy, MessageCircle, MessageSquareText, MapPin, Megaphone, Pencil, BookmarkCheck, Bookmark, ExternalLink, CalendarDays, UsersRound, Clock } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GatheringCover } from '@/components/gathering-cover';
import { useGatherwell } from '@/components/gatherwell-shell';
import { supabase } from '@/integrations/supabase/client';
import { workspaceQuery } from '@/lib/account';
import { rpcError, shareLink } from '@/lib/gatherings';
import { setPendingAnnouncement } from '@/lib/assistant-client';
import type { AssistantCard, GatheringDraft, RecipeCard } from '@/lib/assistant/config';

const copy = async (text: string, t: (k: string) => string) => { await navigator.clipboard.writeText(text); toast.success(t('onboarding.copied')); };
const loc = (lang: string) => (lang === 'es' ? 'es-MX' : 'en-US');

function GatheringCardView({ draft: initial, close }: { draft: GatheringDraft; close: () => void }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const { userId } = useGatherwell(); const { data: workspace } = useQuery(workspaceQuery(userId));
  const qc = useQueryClient(); const navigate = useNavigate();
  const [d, setD] = useState(initial); const [editing, setEditing] = useState(false); const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string } | null>(null);
  const start = d.date && d.time ? new Date(`${d.date}T${d.time}`) : null;
  const when = start && !Number.isNaN(start.getTime()) ? start.toLocaleString(loc(lang), { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  const desc = lang === 'es' ? d.description_es || d.description_en : d.description_en || d.description_es;
  const create = async () => {
    if (!workspace || !start) return;
    if (workspace.role === 'member') { toast.error(t('gathering.hostsOnlyText')); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc('create_gathering_at', { _team: workspace.teamId, _publish: true, _weekly: false, _p: {
      title: d.title.trim(), cover_url: '', cover_style: 0, starts_at: start.toISOString(), duration_minutes: 60, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      location_name: d.place, address: '', meeting_note: '', online_url: '', capacity: d.capacity ?? '', visibility: 'public', description_en: d.description_en, description_es: d.description_es, template_id: '', lat: '', lng: '' } });
    setBusy(false);
    if (error || !data) { toast.error(rpcError(t, error)); return; }
    await qc.invalidateQueries(); setDone({ id: data as string });
  };
  if (done) {
    const link = shareLink({ id: done.id, visibility: 'public' });
    const invite = t('gathering.invite', { title: d.title, date: when, link });
    return <div className="as-card"><GatheringCover path={null} style={0} title={d.title} className="as-cover" />
      <div className="as-card-body"><span className="as-live"><Check />{t('gathering.live')}</span><strong className="as-title">{d.title}</strong><p className="as-meta">{when}</p>
        <div className="as-actions wrap">
          <Button variant="secondary" size="sm" onClick={() => copy(link, t)}><Copy />{t('gathering.copyLink')}</Button>
          <Button asChild variant="secondary" size="sm"><a href={`https://wa.me/?text=${encodeURIComponent(invite)}`} target="_blank" rel="noopener noreferrer"><MessageCircle />{t('teamSpace.whatsapp')}</a></Button>
          <Button asChild variant="secondary" size="sm"><a href={`sms:?&body=${encodeURIComponent(invite)}`}><MessageSquareText />{t('gathering.text')}</a></Button>
          <Button size="sm" onClick={() => { close(); void navigate({ to: '/event/$id', params: { id: done.id } }); }}>{t('assistant.openGathering')}</Button>
        </div></div></div>;
  }
  return <div className="as-card"><GatheringCover path={null} style={0} title={d.title || 'G'} className="as-cover" />
    <div className="as-card-body">
      {editing ? <div className="as-edit">
        <Input className="field-input" value={d.title} maxLength={120} onChange={e => setD({ ...d, title: e.target.value })} aria-label={t('gathering.title')} />
        <div className="as-edit-row"><Input type="date" className="field-input" value={d.date} onChange={e => setD({ ...d, date: e.target.value })} aria-label={t('gathering.when')} /><Input type="time" className="field-input" value={d.time} onChange={e => setD({ ...d, time: e.target.value })} aria-label={t('gathering.when')} /></div>
        <Input className="field-input" value={d.place} maxLength={160} onChange={e => setD({ ...d, place: e.target.value })} placeholder={t('gathering.locationName')} aria-label={t('gathering.locationName')} />
        <Input type="number" min={1} className="field-input" value={d.capacity ?? ''} onChange={e => setD({ ...d, capacity: e.target.value ? Math.max(1, Number(e.target.value)) : null })} placeholder={t('gathering.noLimit')} aria-label={t('gathering.capacity')} />
        <Textarea rows={3} className="field-textarea" value={lang === 'es' ? d.description_es : d.description_en} onChange={e => setD(lang === 'es' ? { ...d, description_es: e.target.value } : { ...d, description_en: e.target.value })} aria-label={t('gathering.description')} />
      </div> : <>
        <strong className="as-title">{d.title}</strong>
        <ul className="as-facts"><li><CalendarDays />{when}</li>{d.place && <li><MapPin />{d.place}</li>}<li><UsersRound />{d.capacity ? t('assistant.spots', { count: d.capacity }) : t('gathering.noLimit')}</li></ul>
        {desc && <p className="as-text">{desc}</p>}
      </>}
      <div className="as-actions">
        <Button disabled={busy || !start || !d.title.trim()} onClick={create}>{busy ? t('onboarding.saving') : t('assistant.createIt')}</Button>
        <Button variant="secondary" onClick={() => setEditing(v => !v)}><Pencil />{t(editing ? 'assistant.doneEditing' : 'assistant.edit')}</Button>
      </div>
    </div></div>;
}

function RecipeCardView({ recipe }: { recipe: RecipeCard }) {
  const { t } = useTranslation(); const [saved, setSaved] = useState(false); const [busy, setBusy] = useState(false);
  const title = recipe.lang === 'es' ? recipe.title_es || recipe.title_en : recipe.title_en || recipe.title_es;
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('save_assistant_recipe', { _title_en: recipe.title_en || title, _title_es: recipe.title_es || title, _prep: recipe.minutes ?? 0, _ingredients: { [recipe.lang]: recipe.ingredients }, _steps: { [recipe.lang]: recipe.steps } });
    setBusy(false);
    if (error) { toast.error(t('profile.saveError')); return; }
    setSaved(true); toast.success(t('assistant.recipeSaved'));
  };
  return <div className="as-card"><div className="as-card-body">
    <span className="gw-label">{t('assistant.recipe')}</span><strong className="as-title">{title}</strong>
    {recipe.minutes ? <p className="as-meta"><Clock />{t('learnHub.prep', { count: recipe.minutes })}</p> : null}
    <span className="as-sub">{t('learnHub.ingredients')}</span><ul className="as-list">{recipe.ingredients.map((x, i) => <li key={i}>{x}</li>)}</ul>
    <span className="as-sub">{t('learnHub.steps')}</span><ol className="as-list">{recipe.steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
    <div className="as-actions"><Button variant="secondary" disabled={saved || busy} onClick={save}>{saved ? <BookmarkCheck /> : <Bookmark />}{t(saved ? 'assistant.saved' : 'assistant.saveRecipe')}</Button></div>
  </div></div>;
}

export function AssistantCardView({ card, close }: { card: AssistantCard; close: () => void }) {
  const { t, i18n } = useTranslation(); const navigate = useNavigate(); const lang = i18n.resolvedLanguage ?? 'en';
  switch (card.type) {
    case 'gathering': return <GatheringCardView draft={card.draft} close={close} />;
    case 'recipe': return <RecipeCardView recipe={card.recipe} />;
    case 'translation': return <div className="as-card"><div className="as-card-body"><span className="gw-label">{t(`assistant.lang.${card.target}`)}</span><p className="as-text">{card.text}</p><div className="as-actions"><Button variant="secondary" onClick={() => copy(card.text, t)}><Copy />{t('assistant.copy')}</Button></div></div></div>;
    case 'invite': return <div className="as-card"><div className="as-card-body"><span className="gw-label">{t(`assistant.channel.${card.channel}`)}</span><p className="as-text pre">{card.text}</p><div className="as-actions wrap">
      <Button variant="secondary" onClick={() => copy(card.text, t)}><Copy />{t('assistant.copy')}</Button>
      <Button asChild variant="secondary"><a href={`https://wa.me/?text=${encodeURIComponent(card.text)}`} target="_blank" rel="noopener noreferrer"><MessageCircle />{t('assistant.openWhatsapp')}</a></Button></div></div></div>;
    case 'announcement': return <div className="as-card"><div className="as-card-body"><span className="gw-label">{t('teamSpace.announce')}</span><p className="as-text">{card.text}</p><div className="as-actions wrap">
      <Button onClick={() => { setPendingAnnouncement(card.text); close(); void navigate({ to: '/team' }); }}><Megaphone />{t('assistant.postToTeam')}</Button>
      <Button variant="secondary" onClick={() => copy(card.text, t)}><Copy />{t('assistant.copy')}</Button></div></div></div>;
    case 'upcoming': return <div className="as-card"><div className="as-card-body"><span className="gw-label">{t('assistant.upcoming')}</span>
      {card.items.length ? <ul className="as-upcoming">{card.items.map(g => <li key={g.id}><button type="button" onClick={() => { close(); void navigate({ to: '/event/$id', params: { id: g.id } }); }}>
        <strong>{g.title}</strong><small>{new Date(g.starts_at).toLocaleString(loc(lang), { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{g.place ? ` · ${g.place}` : ''}</small></button></li>)}</ul>
        : <p className="as-text">{t('assistant.noUpcoming')}</p>}</div></div>;
    case 'directions': return <div className="as-card"><div className="as-card-body"><span className="gw-label">{t('assistant.directions')}</span><strong className="as-title">{card.title}</strong><p className="as-text">{card.tip}</p>
      <div className="as-actions"><Button asChild variant="secondary"><a href={card.url} target="_blank" rel="noopener noreferrer"><ExternalLink />{t('assistant.openMaps')}</a></Button></div></div></div>;
  }
}
