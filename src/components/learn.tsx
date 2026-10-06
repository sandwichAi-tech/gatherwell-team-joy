import { EmptyState } from '@/components/launch-states';
import { LessonSummary } from '@/components/smart';
import { ListSkeleton, RetryState } from '@/components/launch-states';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Bell, BellRing, Bookmark, BookmarkCheck, CalendarPlus, Check, Clock, ExternalLink, FileText, Link2, Play, Radio, Settings2, Share2, Video } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useGatherwell } from '@/components/gatherwell-shell';
import { supabase } from '@/integrations/supabase/client';
import { workspaceQuery } from '@/lib/account';
import { COVER_STYLES } from '@/lib/gatherings';
import {
  ancestorsQuery, effectiveType, embedUrl, icsFor, isUpcomingLive, learnFileUrl, learnQuery, lessonTitle, lessonsOf, listOf, pick, recipesQuery,
  remindersQuery, RECIPE_TAGS, trackStats, trackTitle, type LearnData, type Lesson, type Recipe, type Track,
} from '@/lib/learn';

export function useLearn() {
  const { userId } = useGatherwell();
  const { i18n } = useTranslation();
  const { data: workspace } = useQuery(workspaceQuery(userId));
  const teamId = workspace?.teamId ?? '';
  const { data: ancestors = [] } = useQuery({ ...ancestorsQuery(teamId), enabled: !!teamId });
  const { data, isLoading, isError, refetch } = useQuery(learnQuery(userId));
  const leader = workspace?.role === 'leader';
  const tracks = useMemo(() => (data?.tracks ?? []).filter(t => (ancestors.length ? ancestors.includes(t.team_id) : t.team_id === teamId) && (t.is_published || (leader && t.team_id === teamId))), [data, ancestors, teamId, leader]);
  return { userId, workspace, teamId, leader, data, tracks, isLoading, isError, refetch, lang: i18n.resolvedLanguage ?? 'en' };
}

export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

export function ProgressRing({ value, size = 44, label }: { value: number; size?: number; label: string }) {
  const r = (size - 6) / 2; const c = 2 * Math.PI * r;
  return <span className="progress-ring" style={{ width: size, height: size }} role="img" aria-label={label}>
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}><circle cx={size / 2} cy={size / 2} r={r} className="ring-track" /><circle cx={size / 2} cy={size / 2} r={r} className="ring-value" strokeDasharray={c} strokeDashoffset={c * (1 - value)} transform={`rotate(-90 ${size / 2} ${size / 2})`} /></svg>
    <span>{Math.round(value * 100)}%</span>
  </span>;
}

export function LearnCover({ path, style = 0, title, className = '' }: { path?: string | null; style?: number | null; title: string; className?: string }) {
  const { data: url } = useQuery({ queryKey: ['learn-url', path], queryFn: () => learnFileUrl(path), enabled: !!path, staleTime: 50 * 60_000 });
  return <div className={`learn-cover ${className}`} style={{ backgroundImage: url ? `url(${url})` : COVER_STYLES[(style ?? 0) % COVER_STYLES.length] }} aria-hidden="true">{!url && <span>{(title.trim()[0] ?? 'L').toUpperCase()}</span>}</div>;
}

const TYPE_ICON = { video: Video, pdf: FileText, link: Link2, live: Radio } as const;
export const minutesLabel = (t: TFunction, m: number) => (m >= 60 ? t('learnHub.hours', { h: Math.floor(m / 60), m: m % 60 }) : t('learnHub.minutes', { count: m }));

export function countdown(t: TFunction, startsAt: string, now: number) {
  const diff = new Date(startsAt).getTime() - now;
  if (diff <= 0) return t('learnHub.liveNow');
  const m = Math.round(diff / 60_000);
  if (m < 60) return t('learnHub.inMinutes', { count: m });
  const h = Math.round(m / 60);
  if (h < 48) return t('learnHub.inHours', { count: h });
  return t('learnHub.inDays', { count: Math.round(h / 24) });
}

const fmtWhen = (iso: string, lang: string) => new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso));

function TrackCard({ track, data, featured = false }: { track: Track; data: LearnData; featured?: boolean }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage;
  const s = trackStats(data, track.id); const title = trackTitle(track, lang);
  return <article className={`track-card ${featured ? 'is-featured' : ''}`}>
    <LearnCover path={track.cover_url} style={track.cover_style} title={title} />
    <div className="track-body">
      <div className="track-meta">{featured && <span className="chip">{t('learnHub.startHere')}</span>}{!track.is_published && <span className="chip sample-badge">{t('templates.draft')}</span>}</div>
      <h3>{title}</h3>
      {featured && pick(lang, track.description_en, track.description_es) && <p className="track-desc">{pick(lang, track.description_en, track.description_es)}</p>}
      <p className="track-facts">{t('learnHub.lessonCount', { count: s.count })} · {minutesLabel(t, s.minutes)}</p>
      <div className="track-foot"><ProgressRing value={s.pct} label={t('learnHub.progressLabel', { done: s.done, total: s.count })} />
        <Button asChild variant={featured ? 'default' : 'secondary'}>{s.next ? <Link to="/learn/lesson/$id" params={{ id: s.next.id }}>{s.done ? t('learnHub.continue') : t('learnHub.start')}<ArrowRight /></Link> : <Link to="/learn/track/$id" params={{ id: track.id }}>{t('learnHub.review')}<ArrowRight /></Link>}</Button></div>
      <Link to="/learn/track/$id" params={{ id: track.id }} className="track-link">{t('learnHub.viewTrack')}</Link>
    </div>
  </article>;
}

function SampleTracks() {
  const { t } = useTranslation(); const { openDetail } = useGatherwell();
  return <div className="track-grid">{(['welcome', 'host', 'rhythm'] as const).map((k, i) => <article className="track-card" key={k}>
    <div className="learn-cover" style={{ backgroundImage: COVER_STYLES[i] }} aria-hidden="true"><span>{t(`learnHub.sample.${k}.title`)[0]}</span></div>
    <div className="track-body"><div className="track-meta"><span className="chip sample-badge">{t('common.sample')}</span></div><h3>{t(`learnHub.sample.${k}.title`)}</h3><p className="track-facts">{t(`learnHub.sample.${k}.facts`)}</p>
      <div className="track-foot"><ProgressRing value={[0.6, 0.25, 0][i]!} label={t('common.sample')} /><Button variant="secondary" onClick={() => openDetail(t(`learnHub.sample.${k}.title`), t('learnHub.sampleNote'))}>{t('learnHub.start')}<ArrowRight /></Button></div></div>
  </article>)}</div>;
}

export function LiveCard({ lesson, track }: { lesson: Lesson; track?: Track | undefined }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en'; const qc = useQueryClient();
  const { userId } = useGatherwell(); const now = useNow(15_000);
  const { data: reminders } = useQuery(remindersQuery(userId));
  const reminded = reminders?.has(lesson.id) ?? false;
  const starts = new Date(lesson.live_starts_at!).getTime();
  const open = now >= starts - 10 * 60_000;
  const { data: link } = useQuery({ queryKey: ['live-link', lesson.id, open], queryFn: async () => (await supabase.rpc('live_lesson_link', { _lesson: lesson.id })).data ?? null, enabled: open, refetchInterval: open ? false : 60_000 });
  const title = lessonTitle(lesson, lang);
  const remind = async () => {
    const res = reminded ? await supabase.from('lesson_reminders').delete().match({ user_id: userId, lesson_id: lesson.id }) : await supabase.from('lesson_reminders').insert({ user_id: userId, lesson_id: lesson.id });
    if (res.error) { toast.error(t('profile.saveError')); return; }
    if (!reminded) toast(t('learnHub.reminderSet'), { description: t('learnHub.notConnected') });
    await qc.invalidateQueries({ queryKey: ['lesson-reminders', userId] });
  };
  return <article className="live-card">
    <div className="live-head"><span className={`chip ${open ? 'live-chip' : ''}`}>{countdown(t, lesson.live_starts_at!, now)}</span>{track && <span className="live-track">{trackTitle(track, lang)}</span>}</div>
    <h3>{title}</h3>
    <p className="live-when"><Clock />{fmtWhen(lesson.live_starts_at!, lang)}</p>
    <div className="live-actions">
      {open && link ? <Button asChild><a href={link} target="_blank" rel="noopener noreferrer"><Play />{t('learnHub.join')}</a></Button> : <p className="live-note">{t('learnHub.linkSoon')}</p>}
      <Button variant="secondary" onClick={() => icsFor(lesson, title, pick(lang, lesson.notes_en, lesson.notes_es))}><CalendarPlus />{t('learnHub.addCalendar')}</Button>
      <Button variant="secondary" aria-pressed={reminded} onClick={remind}>{reminded ? <BellRing /> : <Bell />}{t(reminded ? 'learnHub.reminded' : 'learnHub.remind')}</Button>
    </div>
    {reminded && <p className="not-connected">{t('learnHub.notConnected')}</p>}
  </article>;
}

export function RecipeCard({ recipe, saved }: { recipe: Recipe; saved?: boolean | undefined }) {
  const { t, i18n } = useTranslation(); const title = pick(i18n.resolvedLanguage, recipe.title_en, recipe.title_es);
  return <Link to="/learn/recipe/$id" params={{ id: recipe.id }} className="recipe-card">
    <LearnCover path={recipe.cover_url} style={recipe.cover_style} title={title} />
    <div className="recipe-body"><h3>{title}</h3><p className="track-facts">{recipe.prep_minutes ? t('learnHub.prep', { count: recipe.prep_minutes }) : null}{saved && <BookmarkCheck aria-label={t('learnHub.saved')} />}</p>
      <div className="recipe-tags">{recipe.tags.filter(x => (RECIPE_TAGS as readonly string[]).includes(x)).slice(0, 3).map(x => <span key={x} className="chip">{t(`learnHub.tags.${x}`)}</span>)}</div></div>
  </Link>;
}

export function LearnHome() {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const { data, tracks, leader, isLoading, isError, refetch, userId } = useLearn();
  const { data: rec } = useQuery(recipesQuery(userId));
  if (isError) return <RetryState retry={() => void refetch()} />;
  if (isLoading || !data) return <ListSkeleton />;
  const startHere = tracks.find(tr => tr.is_start_here && tr.is_published) ?? null;
  const rest = tracks.filter(tr => tr.id !== startHere?.id);
  const ids = new Set(tracks.filter(tr => tr.is_published).map(tr => tr.id));
  const live = data.lessons.filter(l => ids.has(l.track_id) && l.type === 'live' && l.live_starts_at);
  const upcoming = live.filter(isUpcomingLive).sort((a, b) => a.live_starts_at!.localeCompare(b.live_starts_at!));
  const replays = live.filter(l => l.replay_url).sort((a, b) => b.live_starts_at!.localeCompare(a.live_starts_at!)).slice(0, 3);
  const byId = new Map(data.tracks.map(tr => [tr.id, tr]));
  return <>
    <div className="page-heading"><div><span className="eyebrow">{t('learn.eyebrow')}</span><h1>{t('learn.title')}</h1><p>{t('learn.sentence')}</p></div>
      {leader && <Button asChild variant="secondary"><Link to="/learn/manage"><Settings2 />{t('learnHub.manage')}</Link></Button>}</div>
    {startHere && <section className="learn-section"><TrackCard track={startHere} data={data} featured /></section>}
    <section className="learn-section"><div className="section-heading"><h2>{t('learnHub.yourTracks')}</h2>{!tracks.length && <span className="chip sample-badge">{t('common.sample')}</span>}</div>
      {tracks.length ? rest.length ? <div className="track-grid">{rest.map(tr => <TrackCard key={tr.id} track={tr} data={data} />)}</div> : <p className="auth-subtitle">{t('learnHub.allShown')}</p> : <SampleTracks />}</section>
    <section className="learn-section"><div className="section-heading"><h2>{t('learnHub.live')}</h2></div>
      {upcoming.length ? <div className="live-grid">{upcoming.map(l => <LiveCard key={l.id} lesson={l} track={byId.get(l.track_id)} />)}</div> : <EmptyState compact icon="GraduationCap" text={t('learnHub.noLive')} />}
      {replays.length > 0 && <ul className="replay-list">{replays.map(l => <li key={l.id}><Radio /><div><strong>{lessonTitle(l, lang)}</strong><small>{fmtWhen(l.live_starts_at!, lang)}</small></div><Button asChild variant="secondary" size="sm"><Link to="/learn/lesson/$id" params={{ id: l.id }}><Play />{t('learnHub.replay')}</Link></Button></li>)}</ul>}</section>
    <section className="learn-section"><div className="section-heading"><h2>{t('learnHub.recipes')}</h2><Button asChild variant="link"><Link to="/learn/recipes">{t('home.viewAll')}<ArrowRight /></Link></Button></div>
      <div className="recipe-row">{(rec?.recipes ?? []).slice(0, 6).map(r => <RecipeCard key={r.id} recipe={r} saved={rec?.saved.has(r.id)} />)}</div></section>
  </>;
}

function BackLink({ to, params, label }: { to: string; params?: Record<string, string>; label: string }) {
  return <Link to={to} params={params ?? {}} className="back-link"><ArrowLeft />{label}</Link>;
}

export function TrackPage({ id }: { id: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const { data, isLoading, isError, refetch } = useLearn();
  if (isError) return <RetryState retry={() => void refetch()} />;
  if (isLoading || !data) return <ListSkeleton />;
  const track = data.tracks.find(tr => tr.id === id);
  if (!track) return <section className="panel"><BackLink to="/learn" label={t('learn.title')} /><p className="auth-subtitle">{t('learnHub.notFound')}</p></section>;
  const s = trackStats(data, id); const title = trackTitle(track, lang);
  return <>
    <BackLink to="/learn" label={t('learn.title')} />
    <section className="track-hero"><LearnCover path={track.cover_url} style={track.cover_style} title={title} className="is-wide" />
      <div className="track-hero-body"><div className="track-meta">{track.is_start_here && <span className="chip">{t('learnHub.startHere')}</span>}</div><h1>{title}</h1>
        {pick(lang, track.description_en, track.description_es) && <p>{pick(lang, track.description_en, track.description_es)}</p>}
        <div className="track-foot"><ProgressRing value={s.pct} size={52} label={t('learnHub.progressLabel', { done: s.done, total: s.count })} /><span className="track-facts">{t('learnHub.progressLabel', { done: s.done, total: s.count })} · {minutesLabel(t, s.minutes)}</span></div>
        {s.next && <Button asChild className="continue-button"><Link to="/learn/lesson/$id" params={{ id: s.next.id }}>{s.done ? t('learnHub.continueWhere') : t('learnHub.start')}<ArrowRight /></Link></Button>}</div></section>
    {s.complete && <CompletionCard title={title} />}
    <ol className="lesson-list">{lessonsOf(data, id).map((l, i) => { const type = effectiveType(l); const Icon = TYPE_ICON[type]; const done = data.done.has(l.id); return <li key={l.id}>
      <Link to="/learn/lesson/$id" params={{ id: l.id }} className={`lesson-row ${done ? 'is-done' : ''}`}>
        <span className="lesson-index">{done ? <Check /> : i + 1}</span>
        <span className="lesson-info"><strong>{lessonTitle(l, lang)}</strong><small><Icon />{t(`learnHub.type.${l.type === 'live' && l.replay_url ? 'replay' : type}`)}{l.duration_minutes ? ` · ${minutesLabel(t, l.duration_minutes)}` : ''}{l.type === 'live' && l.live_starts_at && !l.replay_url ? ` · ${fmtWhen(l.live_starts_at, lang)}` : ''}</small></span>
        <ArrowRight />
      </Link></li>; })}</ol>
  </>;
}

function CompletionCard({ title }: { title: string }) {
  const { t } = useTranslation();
  return <section className="completion-card" role="status"><span className="completion-mark"><Check /></span><div><span className="eyebrow">{t('learnHub.completeEyebrow')}</span><h2>{t('learnHub.completeTitle', { title })}</h2><p>{t('learnHub.completeText')}</p></div>
    <Button asChild variant="secondary"><Link to="/learn">{t('learnHub.backToLearn')}</Link></Button></section>;
}

function Player({ lesson }: { lesson: Lesson }) {
  const { t } = useTranslation();
  const type = effectiveType(lesson);
  const external = lesson.type === 'live' ? lesson.replay_url : lesson.url;
  const { data: fileUrl } = useQuery({ queryKey: ['learn-url', lesson.storage_path], queryFn: () => learnFileUrl(lesson.storage_path), enabled: !!lesson.storage_path && lesson.type !== 'live', staleTime: 50 * 60_000 });
  const embed = embedUrl(external);
  if (type === 'video') {
    if (fileUrl) return <div className="player"><video src={fileUrl} controls playsInline preload="metadata" /></div>;
    if (embed) return <div className="player"><iframe src={embed} title={t('learnHub.type.video')} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /></div>;
    if (external) return <LinkCard url={external} />;
    return <div className="player player-empty">{lesson.storage_path ? null : t('learnHub.noMedia')}</div>;
  }
  if (type === 'pdf') {
    const src = fileUrl ?? external;
    return src ? <div className="pdf-frame"><iframe src={src} title={t('learnHub.type.pdf')} /><Button asChild variant="secondary"><a href={src} target="_blank" rel="noopener noreferrer"><ExternalLink />{t('learnHub.openPdf')}</a></Button></div> : <div className="player player-empty">{t('learnHub.noMedia')}</div>;
  }
  if (type === 'link') return external ? <LinkCard url={external} /> : null;
  return null;
}

function LinkCard({ url }: { url: string }) {
  const { t } = useTranslation(); let host = url; try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keep raw */ }
  return <a className="link-card" href={url} target="_blank" rel="noopener noreferrer"><span className="creation-icon"><Link2 /></span><span><strong>{t('learnHub.openLink')}</strong><small>{host}</small></span><ExternalLink /></a>;
}

export function LessonPage({ id }: { id: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en'; const qc = useQueryClient(); const navigate = useNavigate();
  const { data, isLoading, isError, refetch, userId, leader } = useLearn();
  const [busy, setBusy] = useState(false); const [justDone, setJustDone] = useState(false);
  if (isError) return <RetryState retry={() => void refetch()} />;
  if (isLoading || !data) return <ListSkeleton />;
  const lesson = data.lessons.find(l => l.id === id);
  if (!lesson) return <section className="panel"><BackLink to="/learn" label={t('learn.title')} /><p className="auth-subtitle">{t('learnHub.notFound')}</p></section>;
  const track = data.tracks.find(tr => tr.id === lesson.track_id)!;
  const list = lessonsOf(data, track.id); const idx = list.findIndex(l => l.id === id);
  const done = data.done.has(id); const s = trackStats(data, track.id);
  const next = list.slice(idx + 1).find(l => !data.done.has(l.id)) ?? list[idx + 1] ?? null;
  const notes = pick(lang, lesson.notes_en, lesson.notes_es);
  const toggle = async () => {
    setBusy(true);
    const res = done ? await supabase.from('lesson_progress').delete().match({ user_id: userId, lesson_id: id }) : await supabase.from('lesson_progress').insert({ user_id: userId, lesson_id: id });
    setBusy(false);
    if (res.error) { toast.error(t('profile.saveError')); return; }
    if (!done) setJustDone(true);
    await qc.invalidateQueries({ queryKey: ['learn', userId] });
  };
  const upcomingLive = lesson.type === 'live' && !lesson.replay_url && lesson.live_starts_at;
  return <>
    <BackLink to="/learn/track/$id" params={{ id: track.id }} label={trackTitle(track, lang)} />
    <div className="lesson-head"><span className="eyebrow">{t('learnHub.lessonOf', { n: idx + 1, total: list.length })}</span><h1>{lessonTitle(lesson, lang)}</h1>
      {lesson.duration_minutes ? <p className="track-facts">{minutesLabel(t, lesson.duration_minutes)}</p> : null}</div>
    {upcomingLive ? <LiveCard lesson={lesson} track={track} /> : <Player lesson={lesson} />}
    {notes && <section className="panel lesson-notes"><h2>{t('learnHub.notes')}</h2><p>{notes}</p></section>}
    <LessonSummary lessonId={id} leader={leader} />
    {!upcomingLive && <div className="lesson-complete">
      <Button className={`complete-button ${justDone ? 'is-celebrating' : ''}`} variant={done ? 'secondary' : 'default'} disabled={busy} onClick={toggle} aria-pressed={done}><Check />{t(done ? 'learnHub.completed' : 'learnHub.markComplete')}</Button>
      {done && <span className="completed-note">{t('learnHub.savedProgress')}</span>}</div>}
    {s.complete && justDone ? <CompletionCard title={trackTitle(track, lang)} /> : next && <button type="button" className="next-lesson" onClick={() => void navigate({ to: '/learn/lesson/$id', params: { id: next.id } })}>
      <span><small>{t('learnHub.upNext')}</small><strong>{lessonTitle(next, lang)}</strong></span><ArrowRight /></button>}
  </>;
}

export function RecipesPage() {
  const { t } = useTranslation(); const { userId, leader } = useLearn();
  const { data } = useQuery(recipesQuery(userId));
  const [filter, setFilter] = useState<string | null>(null); const [savedOnly, setSavedOnly] = useState(false);
  const list = (data?.recipes ?? []).filter(r => (!filter || r.tags.includes(filter)) && (!savedOnly || data?.saved.has(r.id)));
  return <>
    <BackLink to="/learn" label={t('learn.title')} />
    <div className="page-heading"><div><span className="eyebrow">{t('learn.title')}</span><h1>{t('learnHub.recipes')}</h1><p>{t('learnHub.recipesText')}</p></div>
      {leader && <Button asChild variant="secondary"><Link to="/learn/manage" search={{ tab: 'recipes' }}><Settings2 />{t('learnHub.addRecipe')}</Link></Button>}</div>
    <div className="filter-chips" role="group" aria-label={t('learnHub.filter')}>
      <button type="button" className={`filter-chip ${!filter && !savedOnly ? 'is-active' : ''}`} aria-pressed={!filter && !savedOnly} onClick={() => { setFilter(null); setSavedOnly(false); }}>{t('learnHub.all')}</button>
      {RECIPE_TAGS.map(tag => <button type="button" key={tag} className={`filter-chip ${filter === tag ? 'is-active' : ''}`} aria-pressed={filter === tag} onClick={() => setFilter(filter === tag ? null : tag)}>{t(`learnHub.tags.${tag}`)}</button>)}
      <button type="button" className={`filter-chip ${savedOnly ? 'is-active' : ''}`} aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}><Bookmark />{t('learnHub.saved')}</button>
    </div>
    {list.length ? <div className="recipe-grid">{list.map(r => <RecipeCard key={r.id} recipe={r} saved={data?.saved.has(r.id)} />)}</div> : <EmptyState compact icon="GraduationCap" text={t('learnHub.noRecipes')} />}
  </>;
}

export function RecipePage({ id }: { id: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en'; const qc = useQueryClient();
  const { userId } = useLearn(); const { data } = useQuery(recipesQuery(userId));
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const recipe = data?.recipes.find(r => r.id === id);
  if (!data) return <div className="min-h-96" />;
  if (!recipe) return <section className="panel"><BackLink to="/learn/recipes" label={t('learnHub.recipes')} /><p className="auth-subtitle">{t('learnHub.notFound')}</p></section>;
  const title = pick(lang, recipe.title_en, recipe.title_es); const saved = data.saved.has(id);
  const save = async () => {
    const res = saved ? await supabase.from('saved_recipes').delete().match({ user_id: userId, recipe_id: id }) : await supabase.from('saved_recipes').insert({ user_id: userId, recipe_id: id });
    if (res.error) { toast.error(t('profile.saveError')); return; }
    await qc.invalidateQueries({ queryKey: ['recipes', userId] });
  };
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ title, url }); return; } catch { return; } }
    await navigator.clipboard.writeText(url); toast.success(t('next.copied'));
  };
  return <>
    <BackLink to="/learn/recipes" label={t('learnHub.recipes')} />
    <LearnCover path={recipe.cover_url} style={recipe.cover_style} title={title} className="is-wide recipe-hero" />
    <div className="lesson-head"><h1>{title}</h1><p className="track-facts">{recipe.prep_minutes ? t('learnHub.prep', { count: recipe.prep_minutes }) : null}</p>
      <div className="recipe-tags">{recipe.tags.map(x => <span key={x} className="chip">{(RECIPE_TAGS as readonly string[]).includes(x) ? t(`learnHub.tags.${x}`) : x}</span>)}</div>
      <div className="recipe-actions"><Button variant={saved ? 'default' : 'secondary'} aria-pressed={saved} onClick={save}>{saved ? <BookmarkCheck /> : <Bookmark />}{t(saved ? 'learnHub.saved' : 'learnHub.save')}</Button><Button variant="secondary" onClick={share}><Share2 />{t('learnHub.share')}</Button></div></div>
    <div className="recipe-columns">
      <section className="panel"><h2>{t('learnHub.ingredients')}</h2><ul className="ingredient-list">{listOf(recipe.ingredients, lang).map((x, i) => <li key={i}><label className={checked.has(i) ? 'is-checked' : ''}><input type="checkbox" checked={checked.has(i)} onChange={() => setChecked(s => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} /><span className="check-box"><Check /></span><span>{x}</span></label></li>)}</ul></section>
      <section className="panel"><h2>{t('learnHub.steps')}</h2><ol className="step-list">{listOf(recipe.steps, lang).map((x, i) => <li key={i}><span className="lesson-index">{i + 1}</span><p>{x}</p></li>)}</ol></section>
    </div>
  </>;
}
