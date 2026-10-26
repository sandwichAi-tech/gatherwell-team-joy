import { EmptyState } from '@/components/launch-states';
import { LessonSummary } from '@/components/smart';
import { ListSkeleton, RetryState } from '@/components/launch-states';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { isLive } from '@/lib/resource-flow';
import { ArrowLeft, ArrowRight, Bell, BellRing, Bookmark, BookmarkCheck, CalendarPlus, Check, Clock, ExternalLink, FileText, Link2, Play, Radio, Settings2, Share2, Video, Waveform, Download } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useGatherwell } from '@/components/gatherwell-shell';
import { supabase } from '@/integrations/supabase/client';
import { workspaceQuery } from '@/lib/account';
import { COVER_STYLES } from '@/lib/gatherings';
import { BrandImage } from '@/components/brand-image';
import { learnRendition } from '@/lib/learn';
import {
  ancestorsQuery, effectiveType, embedUrl, icsFor, isUpcomingLive, learnFileUrl, learnQuery, lessonTitle, lessonsOf, listOf, pick, recipesQuery, visibleLessons,
  remindersQuery, RECIPE_TAGS, populatedTracks, trackStats, trackTitle, type LearnData, type Lesson, type Recipe, type Track,
} from '@/lib/learn';
import { myLearningQuery } from '@/lib/content';

export function useLearn() {
  const { userId } = useGatherwell();
  const { i18n } = useTranslation();
  const { data: workspace } = useQuery(workspaceQuery(userId));
  const teamId = workspace?.teamId ?? '';
  const { data: ancestors = [] } = useQuery({ ...ancestorsQuery(teamId), enabled: !!teamId });
  const { data, isLoading, isError, refetch } = useQuery(learnQuery(userId));
  const { data: learning = [] } = useQuery(myLearningQuery(userId));
  const leader = workspace?.role === 'leader';
  const entitledOffers = useMemo(() => new Set(learning.map(e => e.id)), [learning]);
  const tracks = useMemo(() => (data?.tracks ?? []).filter(t =>
    ((ancestors.length ? ancestors.includes(t.team_id) : t.team_id === teamId) && (t.is_published || (leader && t.team_id === teamId)))
    || (t.offer_id && entitledOffers.has(t.offer_id) && t.is_published)), [data, ancestors, teamId, leader, entitledOffers]);
  return { userId, workspace, teamId, leader, data, tracks, learning, isLoading, isError, refetch, lang: i18n.resolvedLanguage ?? 'en' };
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

/** Display-size hint per resource-cover placement. */
export function learnCoverSizes(className: string): string {
  if (/\bis-thumb\b/.test(className)) return '64px';
  if (/\brecipe-hero\b/.test(className)) return '(min-width: 1280px) 1200px, 100vw';
  if (/\bis-wide\b/.test(className)) return '(min-width: 768px) 640px, 100vw';
  return '(min-width: 768px) 50vw, 100vw';
}

export function LearnCover({ path, style = 0, title, className = '', onNaturalWidth }: { path?: string | null; style?: number | null; title: string; className?: string; onNaturalWidth?: (width: number) => void }) {
  const { data: img } = useQuery({ queryKey: ['learn-rendition', path], queryFn: () => learnRendition(path), enabled: !!path, staleTime: 50 * 60_000 });
  return <div className={`learn-cover ${className}`} style={img ? undefined : { backgroundImage: COVER_STYLES[(style ?? 0) % COVER_STYLES.length] }} aria-hidden="true">{img ? <BrandImage src={img} alt="" className="offer-cover-photo" sizes={learnCoverSizes(className)} onNaturalWidth={onNaturalWidth} /> : <span>{(title.trim()[0] ?? 'L').toUpperCase()}</span>}</div>;
}

export const TYPE_ICON = { video: Video, pdf: FileText, link: Link2, live: Radio, text: FileText, audio: Waveform, file: Download } as const;
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

function BackLink({ to, params, label }: { to: string; params?: Record<string, string>; label: string }) {
  return <Link to={to} params={params ?? {}} className="back-link"><ArrowLeft />{label}</Link>;
}

export function TrackPage({ id }: { id: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const { data, isLoading, isError, refetch, leader, teamId } = useLearn();
  if (isError) return <RetryState retry={() => void refetch()} />;
  if (isLoading || !data) return <ListSkeleton />;
  const track = data.tracks.find(tr => tr.id === id);
  if (!track) return <section className="panel"><BackLink to="/learn" label={t('learn.title')} /><p className="auth-subtitle">{t('learnHub.notFound')}</p></section>;
  // Participants see published lessons only; leaders of the track's team also see drafts (labeled).
  const showDrafts = leader && track.team_id === teamId;
  const outline = visibleLessons(data, id, showDrafts);
  const s = trackStats(data, id, outline); const title = trackTitle(track, lang);
  const opensAt = (track as { available_from?: string | null }).available_from;
  // Before activation, participants see an honest scheduled state and no lessons (the server also withholds them).
  if (!isLive(opensAt) && !showDrafts) return <section className="panel"><BackLink to="/learn" label={t('learn.title')} />
    <h1>{title}</h1><p className="chip" role="status">{t('resources.item.notYet')}</p>
    <p className="auth-subtitle">{t('resources.item.notYetText', { date: new Date(opensAt!).toLocaleString(lang) })}</p></section>;
  return <>
    <BackLink to="/learn" label={t('learn.title')} />
    <section className="track-hero"><LearnCover path={track.cover_url} style={track.cover_style} title={title} className="is-wide" />
      <div className="track-hero-body"><div className="track-meta">{track.is_start_here && <span className="chip">{t('learnHub.startHere')}</span>}</div><h1>{title}</h1>
        {pick(lang, track.description_en, track.description_es) && <p>{pick(lang, track.description_en, track.description_es)}</p>}
        <div className="track-foot"><ProgressRing value={s.pct} size={52} label={t('learnHub.progressLabel', { done: s.done, total: s.count })} /><span className="track-facts">{t('learnHub.progressLabel', { done: s.done, total: s.count })} · {minutesLabel(t, s.minutes)}</span></div>
        {s.next && <Button asChild className="continue-button"><Link to="/learn/lesson/$id" params={{ id: s.next.id }}>{s.done ? t('learnHub.continueWhere') : t('learnHub.start')}<ArrowRight /></Link></Button>}</div></section>
    {s.complete && <CompletionCard title={title} />}
    <ol className="lesson-list">{outline.map((l, i) => { const type = effectiveType(l); const Icon = TYPE_ICON[type]; const done = data.done.has(l.id); return <li key={l.id}>
      <Link to="/learn/lesson/$id" params={{ id: l.id }} className={`lesson-row ${done ? 'is-done' : ''}`}>
        <span className="lesson-index">{done ? <Check /> : i + 1}</span>
        <span className="lesson-info"><strong>{lessonTitle(l, lang)}</strong><small><Icon />{t(`learnHub.type.${l.type === 'live' && l.replay_url ? 'replay' : type}`)}{l.duration_minutes ? ` · ${minutesLabel(t, l.duration_minutes)}` : ''}{l.type === 'live' && l.live_starts_at && !l.replay_url ? ` · ${fmtWhen(l.live_starts_at, lang)}` : ''}{!l.is_published ? ` · ${t('templates.draft')}` : ''}</small></span>
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
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
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
    if (lesson.storage_path && !fileUrl) return <div className="player player-empty" aria-busy="true">{t('publicEvent.loading')}</div>;
    return src ? <div className="pdf-frame"><iframe src={src} title={lessonTitle(lesson, lang) || t('learnHub.type.pdf')} />
      <div className="sheet-actions"><Button asChild variant="secondary"><a href={src} target="_blank" rel="noopener noreferrer"><ExternalLink />{t('learnHub.openPdf')}</a></Button>
        {fileUrl && <Button asChild variant="secondary"><a href={fileUrl} download><Download />{t('learnHub.downloadPdf')}</a></Button>}</div></div>
      : <div className="player player-empty">{t('learnHub.noMedia')}</div>;
  }
  if (type === 'link') return external ? <LinkCard url={external} /> : null;
  if (type === 'audio') return fileUrl ? <div className="player player-audio"><audio src={fileUrl} controls preload="metadata" /></div> : external ? <LinkCard url={external} /> : <div className="player player-empty">{t('learnHub.noMedia')}</div>;
  if (type === 'file') return fileUrl ? <Button asChild variant="secondary"><a href={fileUrl} target="_blank" rel="noopener noreferrer"><Download />{t('learnHub.type.file')}</a></Button> : <div className="player player-empty">{t('learnHub.noMedia')}</div>;
  if (type === 'text') { const body = pick(lang, lesson.description_en, lesson.description_es); return body ? <section className="panel lesson-text"><p>{body}</p></section> : null; }
  return null;
}

function LinkCard({ url }: { url: string }) {
  const { t } = useTranslation(); let host = url; try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keep raw */ }
  return <a className="link-card" href={url} target="_blank" rel="noopener noreferrer"><span className="creation-icon"><Link2 /></span><span><strong>{t('learnHub.openLink')}</strong><small>{host}</small></span><ExternalLink /></a>;
}

export function LessonPage({ id }: { id: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en'; const qc = useQueryClient(); const navigate = useNavigate();
  const { data, isLoading, isError, refetch, userId, leader, teamId } = useLearn();
  const [busy, setBusy] = useState(false); const [justDone, setJustDone] = useState(false);
  if (isError) return <RetryState retry={() => void refetch()} />;
  if (isLoading || !data) return <ListSkeleton />;
  const lesson = data.lessons.find(l => l.id === id);
  if (!lesson) return <section className="panel"><BackLink to="/learn" label={t('learn.title')} /><p className="auth-subtitle">{t('learnHub.notFound')}</p></section>;
  const track = data.tracks.find(tr => tr.id === lesson.track_id)!;
  // Draft lessons are leader-only: a participant with a direct link gets the not-found state.
  const showDrafts = leader && track.team_id === teamId;
  if (!lesson.is_published && !showDrafts) return <section className="panel"><BackLink to="/learn" label={t('learn.title')} /><p className="auth-subtitle">{t('learnHub.notFound')}</p></section>;
  const list = visibleLessons(data, track.id, showDrafts); const idx = list.findIndex(l => l.id === id);
  const done = data.done.has(id); const s = trackStats(data, track.id);
  const next = list.slice(idx + 1).find(l => !data.done.has(l.id)) ?? list[idx + 1] ?? null;
  const notes = pick(lang, lesson.notes_en, lesson.notes_es);
  const toggle = async () => {
    if (busy) return; // ignore double clicks; the server call is idempotent anyway
    setBusy(true);
    // One server-checked path: published, accessible, already-available lessons only.
    const res = await supabase.rpc('set_lesson_progress', { _lesson: id, _completed: !done });
    if (res.error) { setBusy(false); toast.error(t('learnHub.completeError')); return; }
    await qc.invalidateQueries({ queryKey: ['learn', userId] });
    setBusy(false);
    if (!done) { setJustDone(true); toast.success(t('learnHub.completeSaved')); }
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
