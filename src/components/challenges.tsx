import { challengeAddonImages } from '@/lib/challenge-media.functions';
import { BrandImage } from '@/components/brand-image';
import { challengeScore, challengePeriods, checkedInPeriod, challengeExtrasTotal, type ChallengeAddon } from '@/lib/challenge-templates';
import { PromoField } from '@/components/promo-field';
import { promoDiscount, type Promo } from '@/lib/promo';
import { EmptyState } from '@/components/launch-states';
import { trackEvent } from '@/lib/analytics';
import { confirmAction } from '@/components/confirm-dialog';
import { ListSkeleton, RetryState } from '@/components/launch-states';
import { useServerFn } from '@tanstack/react-start';
import { usePaymentGate } from '@/components/plan-page';
import { startChallengeCheckout } from '@/lib/billing.functions';
import { formatMoney } from '@/lib/billing';
import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Camera, Check, Download, Flame, Lock, Megaphone, Pencil, Plus, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { GatheringCover } from '@/components/gathering-cover';
import { useGatherwell } from '@/components/gatherwell-shell';
import { supabase } from '@/integrations/supabase/client';
import { firstName, initialsOf, profileQuery, workspaceQuery } from '@/lib/account';
import { ancestorsQuery, compressImage } from '@/lib/learn';
import { ChallengeBuilder } from '@/components/challenge-builder';
import { ChallengeHostPanel } from '@/components/challenge-host-panel';
import { learnFileUrl } from '@/lib/learn';
import {
  activitiesForDay, addDays, challengePhotoUrls, challengesQuery, dayNumber, goalProgress, leaderboardQuery, lengthOf, lifecycleOf, localDate, localHour, modelOf, myCheckinsQuery, phaseOf, pick, rpcErrorKey,
  streaksOf, titleOf, userTz, type Challenge, type ChallengeActivity, type ChallengeItem, type ChallengeMessage, type Phase,
} from '@/lib/challenges';

function useChallenges() {
  const { userId } = useGatherwell();
  const { data: workspace } = useQuery(workspaceQuery(userId));
  const teamId = workspace?.teamId ?? '';
  const { data: ancestors = [] } = useQuery({ ...ancestorsQuery(teamId), enabled: !!teamId });
  const { data = [], isLoading } = useQuery(challengesQuery(userId, ancestors));
  return { userId, workspace, teamId, leader: workspace?.role === 'leader', list: data, isLoading: isLoading || !ancestors.length };
}

const fmtDate = (iso: string, lang: string) => new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));

/** Home/Team card for the running challenge (joined first). */
export function ActiveChallengeCard() {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const { list, userId } = useChallenges();
  const active = list.filter(c => phaseOf(c) === 'active').sort((a, b) => Number(b.joined) - Number(a.joined))[0];
  const { data: mine = [] } = useQuery({ ...myCheckinsQuery(userId, active?.id ?? ''), enabled: !!active?.joined });
  if (!active) return null;
  const s = streaksOf(mine.map(m => m.checkin_date)); const doneToday = mine.some(m => m.checkin_date === localDate());
  return <section className="panel challenge-active">
    <GatheringCover path={active.cover_url} style={active.cover_style} title={titleOf(active, lang)} className="challenge-thumb" />
    <div className="challenge-active-body"><span className="eyebrow">{t('challenges.activeNow')}</span><h2>{titleOf(active, lang)}</h2>
      <p className="track-facts">{t('challenges.dayOf', { day: dayNumber(active), total: lengthOf(active) })} · {t('challenges.joinedCount', { count: active.members })}{active.joined ? ` · ${t('challenges.streakShort', { count: s.current })}` : ''}</p></div>
    <Button asChild variant={doneToday ? 'secondary' : 'default'}><Link to="/challenge/$id" params={{ id: active.id }}>{!active.joined ? t('challenges.join') : doneToday ? t('challenges.doneToday') : t('challenges.checkIn')}<ArrowRight /></Link></Button>
  </section>;
}

function ChallengeRow({ c }: { c: ChallengeItem }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en'; const phase = phaseOf(c);
  return <Link to="/challenge/$id" params={{ id: c.id }} className="challenge-row">
    <GatheringCover path={c.cover_url} style={c.cover_style} title={titleOf(c, lang)} className="challenge-thumb" />
    <span className="lesson-info"><strong>{titleOf(c, lang)}</strong><small>{fmtDate(c.starts_on, lang)} – {fmtDate(c.ends_on, lang)} · {phase === 'active' ? t('challenges.dayOf', { day: dayNumber(c), total: lengthOf(c) }) : t('challenges.days', { count: lengthOf(c) })} · {t('challenges.joinedCount', { count: c.members })}</small></span>
    {c.joined && <span className="chip">{t('challenges.joined')}</span>}<ArrowRight />
  </Link>;
}

export function ChallengesSection({ startCreate = false }: { startCreate?: boolean }) {
  const { t } = useTranslation(); const { openDetail } = useGatherwell();
  const { list, leader, teamId, isLoading } = useChallenges();
  const [tab, setTab] = useState<Phase | 'draft'>('active'); const [editing, setEditing] = useState<Partial<Challenge> | null>(null);
  useEffect(() => { if (startCreate && leader) setEditing({}); }, [startCreate, leader]);
  const groups = useMemo(() => ({ draft: list.filter(c => c.status === 'draft'), active: list.filter(c => c.status === 'published' && phaseOf(c) === 'active'), upcoming: list.filter(c => c.status === 'published' && phaseOf(c) === 'upcoming').reverse(), past: list.filter(c => c.status === 'published' && phaseOf(c) === 'past') }), [list]);
  if (isLoading) return <ListSkeleton />;
  return <section className="panel" id="challenges">
    <div className="section-heading"><h2>{t('challenges.title')}</h2>{leader ? <Button onClick={() => setEditing({})}><Plus />{t('challenges.new')}</Button> : null}</div>
    {list.length ? <>
      <div className="segmented-tabs" role="tablist">{(['active', 'upcoming', 'past', ...(leader ? ['draft' as const] : [])] as const).map(k => <Button variant="ghost" key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>{t(k === 'draft' ? 'templates.draft' : `challenges.phase.${k}`)} <span className="tab-count">{groups[k].length}</span></Button>)}</div>
      {groups[tab].length ? <div className="challenge-list">{groups[tab].map(c => <ChallengeRow key={c.id} c={c} />)}</div> : <p className="auth-subtitle">{t(tab === 'draft' ? 'challenges.noDrafts' : `challenges.none.${tab}`)}</p>}
    </> : <p className="auth-subtitle">{t('challenges.noneYet')}</p>}
    {leader && <ChallengeBuilder draft={editing} teamId={teamId} onClose={() => setEditing(null)} />}
  </section>;
}

async function storyCard(name: string, title: string, days: number, line: string, daysLabel: string) {
  await document.fonts?.ready;
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const x = c.getContext('2d'); if (!x) return;
  const g = x.createLinearGradient(0, 0, 1080, 1920); g.addColorStop(0, '#2F2340'); g.addColorStop(1, '#7A5FA8'); x.fillStyle = g; x.fillRect(0, 0, 1080, 1920);
  x.strokeStyle = 'rgba(255,255,255,0.08)'; x.lineWidth = 2; for (let r = 220; r < 1400; r += 140) { x.beginPath(); x.arc(980, 260, r, 0, Math.PI * 2); x.stroke(); }
  x.fillStyle = '#F3C6A5'; x.fillRect(96, 140, 96, 96); x.fillStyle = '#2F2340'; x.font = '600 72px Inter, sans-serif'; x.textAlign = 'center'; x.fillText('g', 144, 212);
  x.textAlign = 'left'; x.fillStyle = '#FFFFFF'; x.font = '700 44px Inter, sans-serif'; x.fillText('ZoheeWell', 224, 206);
  x.fillStyle = '#D2CADA'; x.font = '600 36px Inter, sans-serif'; x.fillText(line.toUpperCase(), 96, 880);
  x.fillStyle = '#FFFFFF'; x.font = '700 96px Inter, sans-serif';
  const words = title.split(' '); let row = '', y = 1000;
  for (const w of words) { if (x.measureText(`${row}${w} `).width > 888 && row) { x.fillText(row.trim(), 96, y); row = ''; y += 110; } row += `${w} `; } x.fillText(row.trim(), 96, y);
  x.font = '700 260px Inter, sans-serif'; x.fillStyle = '#F3C6A5'; x.fillText(String(days), 96, y + 330);
  x.font = '500 48px Inter, sans-serif'; x.fillStyle = '#FFFFFF'; x.fillText(daysLabel, 96, y + 410);
  x.font = '600 56px Inter, sans-serif'; x.fillText(name, 96, 1780);
  const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = 'gatherwell-challenge.png'; a.click();
}

function Finisher({ c, days }: { c: Challenge; days: number }) {
  const { t, i18n } = useTranslation(); const { userId } = useGatherwell(); const { data: profile } = useQuery(profileQuery(userId));
  const title = titleOf(c, i18n.resolvedLanguage);
  return <section className="completion-card finisher" role="status"><span className="completion-mark"><Check /></span>
    <div><span className="eyebrow">{t('challenges.finishedEyebrow')}</span><h2>{t('challenges.finishedTitle', { title })}</h2><p>{t('challenges.finishedText', { count: days })}</p></div>
    <Button variant="secondary" onClick={() => void storyCard(profile?.full_name || firstName(profile?.full_name) || '', title, days, t('challenges.storyLine'), t('challenges.storyDays', { count: days }))}><Download />{t('challenges.downloadCard')}</Button></section>;
}

function CheckInSheet({ open, onClose, c, date }: { open: boolean; onClose: () => void; c: Challenge; date: string }) {
  const { t } = useTranslation(); const qc = useQueryClient(); const { userId } = useGatherwell();
  const [note, setNote] = useState(''); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setNote(''); setFile(null); } }, [open]);
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      let photo: string | null = null;
      if (file) { const small = await compressImage(file, 1400); const { data: room } = await supabase.rpc('storage_allows', { _bytes: small.size }); if (room === false) throw new Error('storage_limit'); photo = `${userId}/${c.id}/${crypto.randomUUID()}.jpg`; const up = await supabase.storage.from('challenge-photos').upload(photo, small, { contentType: small.type }); if (up.error) throw up.error; }
      const { data, error } = await supabase.rpc('challenge_check_in', { _c: c.id, _date: date, _tz: c.timezone ?? 'UTC', _note: note, ...(photo ? { _photo: photo } : {}) }); if (!error) trackEvent('challenge_checkin');
      if (error) throw error;
      const r = data as { current?: number } | null;
      toast.success(t('challenges.checkedIn'), { description: t('challenges.streakShort', { count: r?.current ?? 1 }) });
      await Promise.all([qc.invalidateQueries({ queryKey: ['challenge-checkins', userId, c.id] }), qc.invalidateQueries({ queryKey: ['challenge-board', c.id] }), qc.invalidateQueries({ queryKey: ['challenge-progress', c.id] }), qc.invalidateQueries({ queryKey: ['challenge-stats', c.id] })]);
      onClose();
    } catch (e) { toast.error(t(rpcErrorKey(e))); }
    setBusy(false);
  };
  return <ResponsiveSheet open={open} onOpenChange={o => !o && onClose()} title={t('challenges.checkInFor', { date: date === localDate() ? t('challenges.today') : t('challenges.yesterday') })}>
    <div className="edit-form">
      <div className="form-field"><label className="field-label" htmlFor="ci-note">{t('challenges.noteOptional')}</label><Textarea id="ci-note" rows={3} maxLength={280} className="field-textarea" value={note} onChange={e => setNote(e.target.value)} /></div>
      <div className="form-field"><span className="field-label">{t('challenges.photoOptional')}</span>
        <label className="file-button"><Camera />{file ? file.name : t('challenges.addPhoto')}<input type="file" accept="image/*" hidden onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
        <p className="field-hint"><Lock className="inline-icon" />{t('challenges.photoPrivate')}</p></div>
      <Button className="onboarding-continue" disabled={busy} onClick={submit}><Check />{busy ? t('onboarding.saving') : t('challenges.checkIn')}</Button>
    </div>
  </ResponsiveSheet>;
}

function LeaderPanel({ c }: { c: Challenge }) {
  const { t } = useTranslation(); const [open, setOpen] = useState(false); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const { data } = useQuery({ queryKey: ['challenge-stats', c.id], refetchInterval: 30_000, queryFn: async () => { const r = await supabase.rpc('challenge_stats', { _c: c.id, _tz: userTz() }); if (r.error) throw r.error; return r.data as { members: number; today: number; completion: number; finishers: number } } });
  const send = async () => {
    setBusy(true); const { error } = await supabase.rpc('post_challenge_encouragement', { _c: c.id, _message: msg }); setBusy(false);
    if (error) { toast.error(t(rpcErrorKey(error))); return; }
    toast.success(t('challenges.cheerSent')); setOpen(false); setMsg('');
  };
  return <section className="panel"><div className="section-heading"><h2>{t('challenges.leaderView')}</h2><span className="chip">{t('roles.leader')}</span></div>
    <div className="summary-grid challenge-stats">{([['members', data?.members], ['today', data?.today], ['completion', data ? `${data.completion}%` : undefined], ['finishers', data?.finishers]] as const).map(([k, v]) => <div key={k} className="stat-card"><span className="stat-heading">{t(`challenges.stat.${k}`)}</span><strong className="stat-value">{v ?? '–'}</strong></div>)}</div>
    <Button variant="secondary" onClick={() => { setMsg(t('challenges.cheerDefault')); setOpen(true); }}><Megaphone />{t('challenges.sendCheer')}</Button>
    <ResponsiveSheet open={open} onOpenChange={setOpen} title={t('challenges.sendCheer')} description={t('challenges.cheerText')}>
      <div className="edit-form"><Textarea rows={4} maxLength={280} className="field-textarea" aria-label={t('challenges.sendCheer')} value={msg} onChange={e => setMsg(e.target.value)} /><small className="field-hint">{msg.length}/280</small>
        <Button className="onboarding-continue" disabled={busy || !msg.trim()} onClick={send}>{t('challenges.postToWins')}</Button></div>
    </ResponsiveSheet>
  </section>;
}

function PhotoGallery({ paths }: { paths: string[] }) {
  const { t } = useTranslation();
  const { data: urls = [] } = useQuery({ queryKey: ['challenge-photos', paths.join(',')], queryFn: () => challengePhotoUrls(paths), enabled: paths.length > 0, staleTime: 50 * 60_000 });
  return <section className="panel"><div className="section-heading"><div><h2>{t('challenges.myPhotos')}</h2><p><Lock className="inline-icon" />{t('challenges.photosPrivate')}</p></div></div>
    {urls.length ? <div className="photo-grid">{urls.map(u => <a key={u} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt={t('challenges.progressPhoto')} loading="lazy" /></a>)}</div> : <EmptyState compact icon="Camera" text={t('challenges.noPhotos')} />}</section>;
}

/** One assigned activity on the participant view: instructions, due time, and its link/resource/file. */
function ActivityRow({ a, lang }: { a: ChallengeActivity; lang: string }) {
  const { t } = useTranslation();
  const { data: fileUrl } = useQuery({ queryKey: ['challenge-file', a.file_path], queryFn: () => learnFileUrl(a.file_path), enabled: !!a.file_path, staleTime: 50 * 60_000 });
  const title = pick(lang, a.title_en, a.title_es); const instructions = pick(lang, a.instructions_en, a.instructions_es);
  const res = a.resource_kind === 'offer' && a.resource_id ? { to: '/offer/$id', params: { id: a.resource_id } }
    : a.resource_kind === 'track' && a.resource_id ? { to: '/learn/track/$id', params: { id: a.resource_id } }
    : a.resource_kind === 'recipe' && a.resource_id ? { to: '/learn/recipe/$id', params: { id: a.resource_id } } : null;
  return <li className="challenge-activity">
    <div className="lesson-info"><strong>{title}</strong>{instructions ? <small>{instructions}</small> : null}
      <small>{[a.due_hour != null ? t('challenges.dueAt', { hour: a.due_hour }) : null, a.requires_checkin ? t('challenges.builder.requiresCheckin') : null, a.requires_note ? t('challenges.builder.requiresNote') : null].filter(Boolean).join(' · ')}</small></div>
    <div className="offer-row-actions">
      {res && <Button asChild variant="secondary" size="sm"><Link to={res.to} params={res.params}>{t('resources.open')}</Link></Button>}
      {a.link_url && /^https?:\/\/\S+$/i.test(a.link_url) && <Button asChild variant="secondary" size="sm"><a href={a.link_url} target="_blank" rel="noopener noreferrer">{t('challenges.openLink')}</a></Button>}
      {fileUrl && <Button asChild variant="secondary" size="sm"><a href={fileUrl} target="_blank" rel="noopener noreferrer">{t('challenges.openFile')}</a></Button>}
    </div>
  </li>;
}

export function ChallengePage({ id }: { id: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en'; const qc = useQueryClient();
  const { userId } = useGatherwell(); const { data: workspace } = useQuery(workspaceQuery(userId));
  const { data: c, isLoading, isError, refetch } = useQuery({ queryKey: ['challenge', id, userId], staleTime: 0, refetchInterval: 15000, queryFn: async () => {
    const { data, error } = await supabase.from('challenges').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  } });
  const { data: joinedRow, refetch: refetchJoin } = useQuery({ queryKey: ['challenge-joined', id, userId], refetchInterval: 15000, queryFn: async () => { const r = await supabase.from('challenge_members').select('challenge_id,extras').eq('challenge_id', id).eq('user_id', userId).maybeSingle(); if (r.error) throw r.error; return r.data; } });
  const { data: eligible = false } = useQuery({ queryKey: ['challenge-eligible', id, userId], queryFn: async () => { const r = await supabase.rpc('challenge_can_enroll', { _c: id }); if (r.error) throw r.error; return r.data; } });
  const { data: mine = [] } = useQuery(myCheckinsQuery(userId, id));
  const { data: savedProgress } = useQuery({ queryKey: ['challenge-progress', id, userId], enabled: !!joinedRow, refetchInterval: 15000, queryFn: async () => { const r = await supabase.rpc('my_challenge_progress', { _c: id }); if (r.error) throw r.error; return r.data as { total: number; current: number; best: number }; } });
  const { data: board = [] } = useQuery({ ...leaderboardQuery(id, userId), enabled: !!c?.leaderboard_on && (!!joinedRow || c.created_by === userId) });
  const { data: activities = [] } = useQuery({ queryKey: ['challenge-activities', id, userId], enabled: !!joinedRow || c?.created_by === userId, queryFn: async () => ((await supabase.from('challenge_activities').select('*').eq('challenge_id', id).order('sort_order')).data ?? []) as ChallengeActivity[] });
  const { data: messages = [] } = useQuery({ queryKey: ['challenge-messages', id, userId], enabled: !!joinedRow || c?.created_by === userId, queryFn: async () => ((await supabase.from('challenge_messages').select('*').eq('challenge_id', id).order('sort_order')).data ?? []) as ChallengeMessage[] });
  const [sheetDate, setSheetDate] = useState<string | null>(null); const [editing, setEditing] = useState<Partial<Challenge> | null>(null); const [busy, setBusy] = useState(false);
  const [welcomeGone, setWelcomeGone] = useState(false);
  const [selections, setSelections] = useState<Record<string, number>>({});
  const imagesFn = useServerFn(challengeAddonImages);
  const { data: extras = [] } = useQuery({ queryKey: ['challenge-extras', id, userId], enabled: !!c, queryFn: () => imagesFn({ data: { id } }) });
  const { data: counts = [] } = useQuery({ queryKey: ['challenge-counts', id, userId], refetchInterval: 15000, queryFn: async () => { const r = await supabase.rpc('challenge_counts', { _ids: [id] }); if (r.error) throw r.error; return r.data; } });
  if (isError) return <RetryState retry={() => void refetch()} />;
  if (isLoading) return <ListSkeleton />;
  if (!c) return <section className="panel"><Link to="/team" className="back-link"><ArrowLeft />{t('nav.team')}</Link><p className="auth-subtitle">{t('learnHub.notFound')}</p></section>;
  const today = localDate(new Date(), c.timezone ?? 'UTC'); const yesterday = addDays(today, -1); const phase = phaseOf(c, today); const len = lengthOf(c);
  const dates = new Set(mine.map(m => m.checkin_date)); const s = savedProgress ?? streaksOf([...dates], today);
  const todayRow = mine.find(m => m.checkin_date === today);
  const donePeriod = checkedInPeriod([...dates], today, c.starts_on, c.frequency);
  const canYesterday = localHour(c.timezone ?? 'UTC') < 12 && yesterday >= c.starts_on && yesterday <= c.ends_on && !dates.has(yesterday);
  const leader = c.created_by === userId;
  const meRow = board.find(r => r.user_id === userId); const top = board.slice(0, 10);
  const joined = !!joinedRow;
  const join = async () => {
    if (busy || !eligible) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('enroll_challenge', { _c: id, _extras: Object.entries(selections).filter(([, quantity]) => quantity > 0).map(([id, quantity]) => ({ id, quantity })) });
      if (error) throw error;
      await Promise.all([refetchJoin(), qc.invalidateQueries({ queryKey: ['challenge-board', id] }), qc.invalidateQueries({ queryKey: ['challenge-counts', id] }), qc.invalidateQueries({ queryKey: ['challenges'] }), qc.invalidateQueries({ queryKey: ['my-challenges'] })]);
      toast.success(t('challenges.enrollmentSaved'));
    } catch (e) { toast.error(t(rpcErrorKey(e))); }
    finally { setBusy(false); }
  };
  const title = titleOf(c, lang); const prompt = pick(lang, c.daily_prompt_en, c.daily_prompt_es); const desc = pick(lang, c.description_en, c.description_es);
  const timeOf = (iso: string) => new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  const lifecycle = lifecycleOf(c, phase);
  const members = counts[0]?.members ?? 0;
  const full = c.capacity != null && members >= c.capacity;
  const basePrice = c.is_paid ? c.price_cents ?? 0 : 0;
  const extrasPrice = challengeExtrasTotal(extras, selections);
  const total = basePrice + extrasPrice;
  const periods = challengePeriods(len, c.frequency);
  const myScore = challengeScore(modelOf(c), s.total, s.current, c.goal_target);
  const model = modelOf(c);
  const goal = model === 'goal' ? goalProgress(c.goal_target, s.total) : null;
  const todayActs = activitiesForDay(activities, dayNumber(c, today));
  const welcome = messages.find(m => m.kind === 'welcome' && m.enabled && !m.paused);
  const welcomeTitle = welcome ? pick(lang, welcome.title_en, welcome.title_es) : '';
  const welcomeBody = welcome ? pick(lang, welcome.body_en, welcome.body_es) : '';
  return <>
    <Link to="/team" hash="challenges" className="back-link"><ArrowLeft />{t('challenges.title')}</Link>
    <GatheringCover path={c.cover_url} style={c.cover_style} title={title} className="challenge-hero" />
    <div className="lesson-head"><span className="eyebrow">{phase === 'active' ? t('challenges.dayOf', { day: dayNumber(c, today), total: len }) : t(`challenges.phase.${phase}`)}</span>
      {lifecycle === 'draft' && <span className="chip">{t('templates.draft')}</span>}
      <h1>{title}</h1><p className="track-facts">{fmtDate(c.starts_on, lang)} – {fmtDate(c.ends_on, lang)} · {t('challenges.joinedCount', { count: members })}{c.capacity ? ` / ${c.capacity}` : ''}{` · ${basePrice ? formatMoney(basePrice, lang) : t('challenges.free')}`} · {t(`challenges.model.${model}`)}</p>
      {desc && <p className="challenge-desc">{desc}</p>}
      {!joined && phase !== 'past' && <>
        {extras.length > 0 && <section className="challenge-extras" aria-label={t('challenges.extras')}><h2>{t('challenges.extras')}</h2>{extras.map(a => <fieldset key={a.id} className="builder-activity"><legend>{a.name}</legend>{a.image && <BrandImage src={a.image} alt={t('addonImages.alt', { name: a.name })} aspect={4 / 3} className="addon-image" />}<p>{a.description}</p><p>{formatMoney(a.price_cents, lang)}</p><label className="field-label" htmlFor={`choose-${a.id}`}>{t('challenges.quantity')}</label><select id={`choose-${a.id}`} className="field-input" disabled={!a.available || a.inventory === 0 || busy} value={selections[a.id] ?? 0} onChange={e => setSelections(x => ({ ...x, [a.id]: Number(e.target.value) }))}>{Array.from({ length: Math.min(a.max_quantity, a.inventory ?? a.max_quantity) + 1 }, (_, q) => <option key={q} value={q}>{q}</option>)}</select></fieldset>)}</section>}
        <dl className="challenge-totals"><div><dt>{t('challenges.basePrice')}</dt><dd>{basePrice ? formatMoney(basePrice, lang) : t('challenges.free')}</dd></div><div><dt>{t('challenges.extrasPrice')}</dt><dd>{formatMoney(extrasPrice, lang)}</dd></div><div><dt>{t('challenges.total')}</dt><dd>{formatMoney(total, lang)}</dd></div></dl>
        {total > 0 && <p className="not-connected-note" role="note">{t('challenges.checkoutBlocked')}</p>}
        {!eligible && c.enrollment === 'invite' && <p role="status">{t('challenges.inviteRequired')}</p>}
      </>}
      <div className="recipe-actions">{!joined && phase !== 'past' && c.status === 'published' && <Button disabled={busy || full || !eligible || total > 0} onClick={() => void join()}>{busy ? t('onboarding.saving') : full ? t('challenges.full') : t('challenges.joinChallenge')}</Button>}{leader && <Button variant="secondary" onClick={() => setEditing(c)}><Pencil />{t('challenges.edit')}</Button>}</div></div>
      {joinedRow && Array.isArray(joinedRow.extras) && joinedRow.extras.length > 0 && <section aria-label={t('challenges.extrasConfirmed')}><h2>{t('challenges.extrasConfirmed')}</h2>{(joinedRow.extras as { id: string; name: string; quantity: number }[]).map(a => <p key={a.id}>{a.name} × {a.quantity}</p>)}</section>}
      {joined && phase !== 'active' && <p role="status">{t(phase === 'upcoming' ? 'challenges.notStarted' : 'challenges.ended')}</p>}
    {joined && welcome && (welcomeTitle || welcomeBody) && !welcomeGone && <section className="panel challenge-welcome" role="status">
      <div className="section-heading"><h2>{welcomeTitle || t('challenges.msg.welcome')}</h2><Button variant="ghost" size="icon" aria-label={t('common.close')} onClick={() => setWelcomeGone(true)}><X /></Button></div>
      {welcomeBody && <p>{welcomeBody}</p>}</section>}

    {joined && s.total >= periods && <Finisher c={c} days={s.total} />}

    {joined && phase === 'active' && <section className="panel prompt-card"><span className="eyebrow">{t('challenges.todaysPrompt')}</span><p className="prompt-text">{prompt || t('challenges.defaultPrompt')}</p>
      {donePeriod ? <div className="done-today" role="status"><Check /><span><strong>{t(c.frequency === 'weekly' ? 'challenges.periodDone' : 'challenges.doneToday')}</strong><small>{t('challenges.doneAt', { time: todayRow ? timeOf(todayRow.created_at) : '—' })}</small></span></div>
        : <Button className="checkin-big" onClick={() => setSheetDate(today)}><Check />{t('challenges.checkInToday')}</Button>}
      {canYesterday && <button type="button" className="text-link yesterday-link" onClick={() => setSheetDate(yesterday)}>{t('challenges.checkInYesterday')}</button>}</section>}

    {joined && phase === 'active' && todayActs.length > 0 && <section className="panel" aria-label={t('challenges.todayActivities')}>
      <div className="section-heading"><h2>{t('challenges.todayActivities')}</h2></div>
      <ul className="offer-list compact">{todayActs.map((a, i) => <ActivityRow key={a.id ?? i} a={a} lang={lang} />)}</ul></section>}

    {joined && <section className="panel"><p>{t('challenges.score')}: {myScore}</p><div className="streak-row">
      <div className={`streak ${s.current > 0 ? 'is-lit' : ''}`}><Flame className="streak-flame" aria-hidden="true" /><strong>{s.current}</strong><span>{t('challenges.currentStreak')}</span></div>
      <div className="streak"><strong>{s.best}</strong><span>{t('challenges.bestStreak')}</span></div>
      <div className="streak"><strong>{s.total}/{periods}</strong><span>{t('challenges.checkIns')}</span></div></div>
      {goal && goal.target > 0 && <div className="goal-progress">
        <div className="goal-progress-head"><strong>{t('challenges.goalProgress', { done: goal.done, target: goal.target })}</strong>{c.goal_unit ? <span>{c.goal_unit}</span> : null}</div>
        <progress value={goal.pct} max={1} aria-label={t('challenges.goalProgress', { done: goal.done, target: goal.target })} />
        {goal.complete && <p className="field-hint" role="status">{t('challenges.goalComplete')}</p>}</div>}
      <div className="day-grid" role="list" aria-label={t('challenges.calendar')}>{Array.from({ length: len }, (_, i) => { const d = addDays(c.starts_on, i); const on = dates.has(d); return <span role="listitem" key={d} className={`day-cell ${on ? 'is-on' : ''} ${d === today ? 'is-today' : ''} ${d > today ? 'is-future' : ''}`} aria-label={`${fmtDate(d, lang)}${on ? ` · ${t('challenges.checkedIn')}` : ''}`}>{on ? <Check /> : i + 1}</span>; })}</div></section>}

    {c.leaderboard_on && (joined || leader) && <section className="panel"><div className="section-heading"><div><h2>{t('challenges.leaderboard')}</h2><p>{t('challenges.leaderboardNote')}</p></div>{meRow && <span className="chip">{t('challenges.yourRank', { rank: meRow.rank })}</span>}</div>
      {top.length ? <ol className="board">{top.map(r => <li key={r.user_id} className={r.user_id === userId ? 'is-me' : ''}><span className="board-rank">{r.rank}</span><span className="initial-avatar">{initialsOf(r.full_name)}</span><span className="lesson-info"><strong>{r.full_name || t('teamSpace.someone')}</strong><small>{t('challenges.streakShort', { count: r.current_streak })} · {t('challenges.bestShort', { count: r.best_streak })}</small></span><strong className="board-count">{challengeScore(model, r.checkins, r.current_streak, c.goal_target)}</strong></li>)}</ol> : <EmptyState compact icon="Camera" text={t('challenges.boardEmpty')} />}
      {meRow && meRow.rank > 10 && <p className="board-me">{t('challenges.youreRank', { rank: meRow.rank })}</p>}</section>}

    {joined && <PhotoGallery paths={mine.map(m => m.photo_path).filter((p): p is string => !!p)} />}
    {leader && <ChallengeHostPanel id={id} userId={userId} inviteOnly={c.enrollment === 'invite'} />}

    {sheetDate && <CheckInSheet open={!!sheetDate} onClose={() => setSheetDate(null)} c={c} date={sheetDate} />}
    {leader && workspace && <ChallengeBuilder draft={editing} teamId={c.team_id || workspace.teamId} onClose={() => { setEditing(null); void qc.invalidateQueries({ queryKey: ['challenge', id] }); }} />}
  </>;
}
