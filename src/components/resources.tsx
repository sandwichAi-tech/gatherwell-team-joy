import { listedInTeam } from '@/lib/resource-placement';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, Award, BookOpen, ClipboardCheck, Compass, CopyPlus, Download, FileText, GraduationCap, Layers, Leaf, Link2, Pencil, Play, Plus, Radio, Sparkles, Trash2, UsersRound, Video, Waveform,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { EmptyState, ListSkeleton, RetryState } from '@/components/launch-states';
import { confirmAction } from '@/components/confirm-dialog';
import { CertificateList } from '@/components/quiz';
import { OfferCover } from '@/components/offers';
import { LearnCover, LiveCard, minutesLabel, useLearn } from '@/components/learn';
import { isUpcomingLive, lessonTitle, pick, recipesQuery } from '@/lib/learn';
import { myOffersQuery, offerTitle } from '@/lib/offers';
import {
  RESOURCE_SOURCES, RESOURCE_TABS, RESOURCE_TYPES, applyResourceTemplate, deleteResourceTemplate, draftDestination, filterResources, inProgress, lessonResources,
  quizMarkersQuery, quizCard, teamQuizzesQuery, recipeCard, resourceTemplatesQuery, saveResourceTemplate, savedOfferResourcesQuery, splitTemplates, templateParts, toResources,
  type ResourceCardData, type ResourceSourceFilter, type ResourceTab, type ResourceTemplate, type ResourceType, type ResourceTypeFilter,
} from '@/lib/resources';
import { CREATE_GROUPS, type CreateType } from '@/lib/create-resource';
import { MyResourceCoaches } from '@/components/my-resource-coaches';

const TYPE_ICON: Record<ResourceType, typeof Video> = { assessment: Compass, course: GraduationCap, track: Layers, video: Video, audio: Waveform, guide: FileText, file: Download, link: Link2, recipe: Leaf, live: Radio, quiz: ClipboardCheck };

/** Same eligibility as Events: any non-member workspace role. Server checks stay authoritative. */
export function useCanCreate() {
  const { workspace } = useLearn();
  return !!workspace && workspace.role !== 'member';
}

function errText(t: TFunction, e: unknown) {
  const m = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  return m.includes('not_allowed') ? t('resources.notAllowed') : t('resources.error');
}

export function ResourceCard({ r, creator, onSaveTemplate }: { r: ResourceCardData; creator?: boolean | undefined; onSaveTemplate?: ((r: ResourceCardData) => void) | undefined }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const title = pick(lang, r.title_en, r.title_es) || t('resources.untitled');
  const Icon = TYPE_ICON[r.type];
  const started = !!r.progress && r.progress.done > 0 && r.progress.done < r.progress.total;
  const action = r.entity === 'quiz' ? (creator ? t('resources.edit') : r.progress?.done ? t('resources.review') : t('resources.start')) : r.entity === 'recipe' || r.entity === 'download' || !r.progress ? t('resources.open') : started ? t('resources.continue') : r.progress.done === r.progress.total ? t('resources.review') : t('resources.start');
  // Reopen any item in the dedicated builder; the builder loads the record and adopts its true type.
  const editType = r.entity === 'recipe' ? 'recipe' : r.entity === 'course' ? 'course' : r.entity === 'download' ? 'file' : 'video';
  const edit = { to: '/learn/create' as const, search: { type: editType, id: r.id } };
  return <article className="resource-card" aria-label={`${title}, ${t(`resources.typeChip.${r.type}`)}, ${t(`resources.sourceChip.${r.source}`)}`}>
    {r.cover === 'offer' ? <OfferCover offer={{ cover_style: r.cover_style, cover_url: r.cover_url, kind: r.entity === 'download' ? 'download' : 'course', title_en: r.title_en, title_es: r.title_es }} wide />
      : <LearnCover path={r.cover_url} style={r.cover_style} title={title} />}
    <div className="resource-body">
      <div className="resource-chips">
        <span className="chip"><Icon aria-hidden="true" />{t(`resources.typeChip.${r.type}`)}</span>
        <span className={`chip ${r.source === 'zoheewell' ? 'warm-chip' : ''}`}>{r.source === 'zoheewell' ? <Sparkles aria-hidden="true" /> : <UsersRound aria-hidden="true" />}{t(`resources.sourceChip.${r.source}`)}</span>
        {r.status !== 'published' && <span className="chip">{t(`resources.status.${r.status}`)}</span>}
        {r.hasQuiz && <span className="chip"><ClipboardCheck aria-hidden="true" />{t('resources.quiz')}</span>}
      </div>
      <h3>{title}</h3>
      <p className="muted-small">{r.price_cents ? new Intl.NumberFormat(lang, { style: 'currency', currency: 'USD' }).format(r.price_cents / 100) : t('offers.free')}</p>
      <p className="track-facts">{[r.creator, r.progress && r.progress.total > 1 ? t('learnHub.progressLabel', { done: r.progress.done, total: r.progress.total }) : null,
        r.minutes ? (r.entity === 'recipe' ? t('learnHub.prep', { count: r.minutes }) : minutesLabel(t, r.minutes)) : null].filter(Boolean).join(' · ')}</p>
      {r.entity !== 'quiz' && r.progress && r.progress.total > 1 && <progress className="attendance-progress" value={r.progress.done} max={r.progress.total} aria-hidden="true" />}
      <div className="resource-actions">
        <Button asChild variant={started ? 'default' : 'secondary'}><Link to={r.href.to} params={r.href.params ?? {}}>{action}<ArrowRight /></Link></Button>
        {creator && r.entity !== 'quiz' && <Button asChild variant="ghost"><Link to={edit.to} search={edit.search}><Pencil />{t('resources.edit')}</Link></Button>}
        {creator && onSaveTemplate && r.source === 'team' && <Button variant="ghost" onClick={() => onSaveTemplate(r)}><CopyPlus />{t('resources.saveTemplate')}</Button>}
      </div>
    </div>
  </article>;
}

function Grid({ list, creator, onSaveTemplate }: { list: ResourceCardData[]; creator?: boolean | undefined; onSaveTemplate?: ((r: ResourceCardData) => void) | undefined }) {
  return <div className="resource-grid">{list.map(r => <ResourceCard key={r.key} r={r} creator={creator} onSaveTemplate={onSaveTemplate} />)}</div>;
}

function Empty({ tab, action }: { tab: ResourceTab; action?: React.ReactNode }) {
  const { t } = useTranslation();
  return <section className="panel empty-gatherings" role="status"><h2>{t(`resources.empty.${tab}.title`)}</h2><p>{t(`resources.empty.${tab}.text`)}</p>{action}</section>;
}

export function ResourcesPage({ tab, type, source }: { tab: ResourceTab; type: ResourceTypeFilter; source: ResourceSourceFilter }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en'; const navigate = useNavigate();
  const { data, tracks, learning, workspace, teamId, userId, isLoading, isError, refetch } = useLearn();
  const canCreate = useCanCreate();
  const createLabel = t('resources.create.button', { defaultValue: lang === 'es' ? 'Crear recurso' : 'Create resource' });
  const { data: rec } = useQuery(recipesQuery(userId));
  const { data: quiz } = useQuery(quizMarkersQuery(userId));
  const { data: teamQuizzes = [] } = useQuery(teamQuizzesQuery(teamId));
  const { data: savedOffers = [] } = useQuery({ ...savedOfferResourcesQuery(userId), enabled: tab === 'saved' });
  const { data: myOffers = [] } = useQuery({ ...myOffersQuery(userId), enabled: tab === 'mine' && canCreate });
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState<ResourceCardData | null>(null);
  const teamName = workspace?.name ?? null;

  const library = useMemo(() => data ? toResources({ data, tracks: tracks.filter(tr => tr.is_published && listedInTeam(tr)), learning, recipes: (rec?.recipes ?? []).filter(r => r.is_published && listedInTeam(r)), quizOffers: quiz?.offers, quizLessons: quiz?.lessons, teamName }).concat(teamQuizzes.filter(z => z.is_published && listedInTeam(z)).map(z => quizCard(z, teamName))) : [], [data, tracks, learning, rec, quiz, teamName, teamQuizzes]);
  if (isError) return <RetryState retry={() => void refetch()} />;
  const setSearch = (next: Partial<{ tab: ResourceTab; type: ResourceTypeFilter; source: ResourceSourceFilter }>) =>
    void navigate({ to: '/learn', search: prev => ({ ...prev, ...next }), replace: true, resetScroll: false });
  const tabs = RESOURCE_TABS.filter(k => k !== 'mine' || canCreate);
  const showFilters = tab === 'library' || tab === 'saved' || tab === 'mine';

  let body: React.ReactNode = null;
  if (isLoading || !data) body = <ListSkeleton />;
  else if (tab === 'foryou') {
    const ids = new Set(tracks.filter(tr => tr.is_published).map(tr => tr.id));
    const upcoming = data.lessons.filter(l => ids.has(l.track_id) && isUpcomingLive(l)).sort((a, b) => a.live_starts_at!.localeCompare(b.live_starts_at!)).slice(0, 3);
    const cont = inProgress(library);
    const startHere = library.find(r => r.entity === 'track' && tracks.find(tr => tr.id === r.id)?.is_start_here);
    const memberships = learning.filter(e => e.kind === 'membership');
    const byId = new Map(data.tracks.map(tr => [tr.id, tr]));
    const empty = !cont.length && !startHere && !upcoming.length && !memberships.length;
    body = <>
      {cont.length > 0 && <section className="learn-section"><div className="section-heading"><h2>{t('resources.continueHeading')}</h2></div><Grid list={cont} /></section>}
      {startHere && !cont.some(r => r.key === startHere.key) && <section className="learn-section"><div className="section-heading"><h2>{t('learnHub.startHere')}</h2></div><Grid list={[startHere]} /></section>}
      {upcoming.length > 0 && <section className="learn-section"><div className="section-heading"><h2>{t('resources.nextLive')}</h2><Button asChild variant="link"><Link to="/learn" search={{ tab: 'live' }}>{t('home.viewAll')}<ArrowRight /></Link></Button></div>
        <div className="live-grid">{upcoming.map(l => <LiveCard key={l.id} lesson={l} track={byId.get(l.track_id)} />)}</div></section>}
      {memberships.length > 0 && <section className="learn-section"><div className="section-heading"><h2>{t('resources.memberships')}</h2></div>
        <ul className="offer-list compact">{memberships.map(e => <li key={e.id}><Link to="/offer/$id" params={{ id: e.id }} className="offer-row is-link">
          <OfferCover offer={{ cover_style: e.cover_style, cover_url: e.cover_url, kind: 'membership', title_en: e.title_en, title_es: e.title_es }} />
          <div className="offer-row-main"><strong>{offerTitle(e, lang)}</strong><small>{t('resources.membership')}{e.host_name ? ` · ${e.host_name}` : ''}</small></div><ArrowRight /></Link></li>)}</ul></section>}
      <MyResourceCoaches userId={userId} />
      <CertificateList userId={userId} />
      {empty && <Empty tab="foryou" action={<Button onClick={() => setSearch({ tab: 'library' })}><BookOpen />{t('resources.empty.foryou.action')}</Button>} />}
    </>;
  } else if (tab === 'library') {
    const list = filterResources([...library, ...lessonResources(data, tracks, type)], type, source);
    body = list.length ? <Grid list={list} /> : <Empty tab="library" action={(type !== 'all' || source !== 'all') ? <Button variant="secondary" onClick={() => setSearch({ type: 'all', source: 'all' })}>{t('resources.empty.library.action')}</Button> : canCreate ? <Button onClick={() => setCreating(true)}><Plus />{createLabel}</Button> : undefined} />;
  } else if (tab === 'live') {
    const ids = new Set(tracks.filter(tr => tr.is_published).map(tr => tr.id));
    const live = data.lessons.filter(l => ids.has(l.track_id) && l.type === 'live' && l.live_starts_at);
    const upcoming = live.filter(isUpcomingLive).sort((a, b) => a.live_starts_at!.localeCompare(b.live_starts_at!));
    const replays = live.filter(l => l.replay_url).sort((a, b) => b.live_starts_at!.localeCompare(a.live_starts_at!));
    const byId = new Map(data.tracks.map(tr => [tr.id, tr]));
    body = upcoming.length || replays.length ? <>
      {upcoming.length > 0 && <section className="learn-section"><div className="section-heading"><h2>{t('resources.upcoming')}</h2></div><div className="live-grid">{upcoming.map(l => <LiveCard key={l.id} lesson={l} track={byId.get(l.track_id)} />)}</div></section>}
      {replays.length > 0 && <section className="learn-section"><div className="section-heading"><h2>{t('resources.replays')}</h2></div>
        <ul className="replay-list">{replays.map(l => <li key={l.id}><Radio /><div><strong>{lessonTitle(l, lang)}</strong></div><Button asChild variant="secondary" size="sm"><Link to="/learn/lesson/$id" params={{ id: l.id }}><Play />{t('learnHub.replay')}</Link></Button></li>)}</ul></section>}
    </> : <Empty tab="live" />;
  } else if (tab === 'saved') {
    const saved = [...(rec?.recipes ?? []).filter(r => rec?.saved.has(r.id)).map(r => recipeCard(r, teamName)), ...savedOffers];
    const list = filterResources(saved, type, source);
    body = list.length ? <Grid list={list} /> : <Empty tab="saved" action={<Button variant="secondary" onClick={() => setSearch({ tab: 'library', type: 'all', source: 'all' })}><BookOpen />{t('resources.empty.saved.action')}</Button>} />;
  } else if (tab === 'mine' && canCreate) {
    const own: ResourceCardData[] = [
      ...toResources({ data: { ...data, lessons: data.lessons }, tracks: data.tracks.filter(tr => tr.team_id === teamId && !tr.offer_id), learning: [], recipes: [], teamName }),
      ...data.tracks.filter(tr => tr.team_id === teamId && !tr.offer_id && !data.lessons.some(l => l.track_id === tr.id)).map(tr => ({
        key: `track:${tr.id}`, id: tr.id, entity: 'track' as const, type: 'track' as const, source: 'team' as const, title_en: tr.title_en, title_es: tr.title_es, cover_url: tr.cover_url, cover_style: tr.cover_style,
        cover: 'learn' as const, status: tr.is_published ? 'published' as const : 'draft' as const, creator: teamName, progress: null, minutes: null, hasQuiz: false, href: { to: '/learn/track/$id', params: { id: tr.id } } })),
      ...myOffers.filter(o => o.kind === 'course' || o.kind === 'download').map(o => ({
        key: `offer:${o.id}`, id: o.id, entity: o.kind as 'course' | 'download', type: (o.kind === 'course' ? 'course' : 'file') as ResourceType, source: 'team' as const, title_en: o.title_en, title_es: o.title_es,
        price_cents: o.price_cents, cover_url: o.cover_url, cover_style: o.cover_style, cover: 'offer' as const, status: o.status, creator: null, progress: null, minutes: null, hasQuiz: !!quiz?.offers.has(o.id), href: { to: '/offer/$id', params: { id: o.id } } })),
      ...(rec?.recipes ?? []).filter(r => r.team_id === teamId).map(r => recipeCard(r, teamName)),
      ...teamQuizzes.filter(z => z.mine).map(z => quizCard(z, teamName)),
    ];
    const list = filterResources(own, type, 'all');
    body = list.length ? <Grid list={list} creator onSaveTemplate={setSaving} /> : <Empty tab="mine" action={<Button onClick={() => setCreating(true)}><Plus />{createLabel}</Button>} />;
  }

  return <>
    <div className="page-heading"><div><span className="eyebrow">{t('learn.eyebrow')}</span><h1>{t('resources.title')}</h1><p>{t('resources.sentence')}</p></div>
      {canCreate && <div className="blueprint-page-actions"><Button asChild variant="secondary"><Link to="/learn/templates">{t('resources.templatesButton')}</Link></Button>
        <Button className="page-create" onClick={() => setCreating(true)}><Plus />{createLabel}</Button></div>}</div>
    <div className="resource-controls">
      <div className="scroll-row"><div className="segmented" role="tablist" aria-label={t('resources.title')}>{tabs.map(k => <Button key={k} role="tab" variant="ghost" aria-selected={tab === k} className={tab === k ? 'selected' : ''} onClick={() => setSearch({ tab: k })}>{t(`resources.tabs.${k}`)}</Button>)}</div></div>
      {showFilters && <div className="scroll-row"><div className="filter-chips" role="group" aria-label={t('resources.typeLabel')}>{RESOURCE_TYPES.map(k => <button type="button" key={k} className={`filter-chip ${type === k ? 'is-active' : ''}`} aria-pressed={type === k} onClick={() => setSearch({ type: k })}>{t(`resources.types.${k}`)}</button>)}</div></div>}
      {showFilters && tab !== 'mine' && <div className="scroll-row"><div className="filter-chips" role="group" aria-label={t('resources.sourceLabel')}>{RESOURCE_SOURCES.map(k => <button type="button" key={k} className={`filter-chip ${source === k ? 'is-active' : ''}`} aria-pressed={source === k} onClick={() => setSearch({ source: k })}>{t(`resources.sources.${k}`)}</button>)}</div></div>}
    </div>
    <div role="tabpanel" aria-label={t(`resources.tabs.${tab}`)}>{body}</div>
    <CreateResourceSheet open={creating} onOpenChange={setCreating} />
    <SaveTemplateSheet resource={saving} onClose={() => setSaving(null)} />
  </>;
}

const CREATE_ICON: Record<CreateType, typeof Video> = { assessment: ClipboardCheck, video: Video, quiz: ClipboardCheck, guide: FileText, audio: Waveform, file: Download, link: Link2, live: Radio, recipe: Leaf, course: GraduationCap, bundle: Layers };

/** Fast launcher into the type-first chooser on /learn/create. */
export function CreateResourceSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation(); const navigate = useNavigate();
  const go = (type: CreateType) => { onOpenChange(false); void navigate({ to: '/learn/create', search: { type } }); };
  return <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('resources.createSheet.title')} description={t('resources.createSheet.text')} icon="BookOpen">
    <div className="creation-options">{CREATE_GROUPS.map(group => <section key={group.key}><h2>{t(`resources.create.groups.${group.key}`)}</h2>{group.types.map(type => { const Icon = CREATE_ICON[type]; return <Button key={type} variant="ghost" className="creation-option" onClick={() => go(type)}>
      <span className="creation-icon"><Icon /></span><span><strong>{t(`resources.create.types.${type}.name`)}</strong><small>{t(`resources.create.types.${type}.example`)}</small></span><ArrowRight /></Button>; })}</section>)}
      <Button variant="ghost" className="creation-option" onClick={() => { onOpenChange(false); void navigate({ to: '/learn/templates' }); }}><span className="creation-icon"><Sparkles /></span><span><strong>{t('resources.createSheet.fromTemplate')}</strong><small>{t('resources.createSheet.fromTemplateText')}</small></span><ArrowRight /></Button>
    </div>
  </ResponsiveSheet>;
}

function SaveTemplateSheet({ resource, onClose }: { resource: ResourceCardData | null; onClose: () => void }) {
  const { t } = useTranslation(); const qc = useQueryClient();
  const [names, setNames] = useState<{ key: string; en: string; es: string }>({ key: '', en: '', es: '' });
  const [busy, setBusy] = useState(false);
  if (resource && names.key !== resource.key) setNames({ key: resource.key, en: resource.title_en, es: resource.title_es });
  const save = async () => {
    if (!resource) return;
    setBusy(true);
    try {
      await saveResourceTemplate(resource.entity === 'recipe' ? 'recipe' : resource.entity === 'track' ? 'track' : 'offer', resource.id, names.en, names.es);
      await qc.invalidateQueries({ queryKey: ['resource-templates'] });
      toast.success(t('templatesR.saved'), { action: { label: t('templatesR.mine'), onClick: () => { window.location.assign('/learn/templates?tab=mine'); } } });
      onClose();
    } catch (e) { toast.error(errText(t, e)); } finally { setBusy(false); }
  };
  const valid = !!(names.en.trim() || names.es.trim());
  return <ResponsiveSheet open={!!resource} onOpenChange={v => { if (!v) onClose(); }} title={t('templatesR.saveTitle')} description={t('templatesR.saveText')} icon="CopyPlus"
    footer={<Button className="onboarding-continue" disabled={busy || !valid} onClick={() => void save()}>{busy ? t('templatesR.saving') : t('templatesR.save')}</Button>}>
    <div className="form-field"><label className="field-label" htmlFor="rt-en">{t('templatesR.nameEn')}</label><Input id="rt-en" className="field-input" maxLength={120} value={names.en} onChange={e => setNames({ ...names, en: e.target.value })} /></div>
    <div className="form-field"><label className="field-label" htmlFor="rt-es">{t('templatesR.nameEs')}</label><Input id="rt-es" className="field-input" maxLength={120} value={names.es} onChange={e => setNames({ ...names, es: e.target.value })} /></div>
  </ResponsiveSheet>;
}

const TEMPLATE_ICON: Record<ResourceTemplate['kind'], typeof Video> = { video_lesson: Video, guide: FileText, mini_course: GraduationCap, bundle: Download, recipe: Leaf, live_workshop: Radio, track: Layers };

export function ResourceTemplatesPage({ tab }: { tab: 'starters' | 'mine' }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en'; const navigate = useNavigate(); const qc = useQueryClient();
  const { teamId, workspace } = useLearn(); const canCreate = useCanCreate();
  const q = useQuery({ ...resourceTemplatesQuery(), enabled: canCreate });
  const [busy, setBusy] = useState<string | null>(null);
  const back = <Link to="/learn" className="back-link"><ArrowLeft />{t('resources.title')}</Link>;
  if (!workspace) return <ListSkeleton />;
  if (!canCreate) return <section className="panel">{back}<p className="auth-subtitle">{t('templatesR.creatorsOnly')}</p></section>;
  const { starters, mine } = splitTemplates(q.data ?? [], teamId);
  const list = tab === 'mine' ? mine : starters;
  const use = async (tpl: ResourceTemplate) => {
    setBusy(tpl.id);
    try {
      const res = await applyResourceTemplate(tpl.id, teamId);
      await Promise.all([qc.invalidateQueries({ queryKey: ['learn'] }), qc.invalidateQueries({ queryKey: ['recipes'] }), qc.invalidateQueries({ queryKey: ['offers'] })]);
      toast.success(t('templatesR.created'));
      void navigate(draftDestination(res.target, res.id));
    } catch (e) { toast.error(errText(t, e)); } finally { setBusy(null); }
  };
  const remove = async (tpl: ResourceTemplate) => {
    if (!(await confirmAction({ title: t('templatesR.deleteConfirm'), confirmLabel: t('templatesR.delete'), destructive: true }))) return;
    try { await deleteResourceTemplate(tpl.id); await qc.invalidateQueries({ queryKey: ['resource-templates'] }); toast.success(t('templatesR.deleted')); } catch (e) { toast.error(errText(t, e)); }
  };
  return <>
    {back}
    <div className="page-heading"><div><span className="eyebrow">{t('resources.title')}</span><h1>{t('templatesR.title')}</h1><p>{t('templatesR.sentence')}</p></div></div>
    <div className="scroll-row"><div className="segmented" role="tablist" aria-label={t('templatesR.title')}>{(['starters', 'mine'] as const).map(k => <Button key={k} role="tab" variant="ghost" aria-selected={tab === k} className={tab === k ? 'selected' : ''} onClick={() => void navigate({ to: '/learn/templates', search: { tab: k }, replace: true, resetScroll: false })}>{t(`templatesR.${k}`)}</Button>)}</div></div>
    <div role="tabpanel" aria-label={t(`templatesR.${tab}`)}>
      {q.isPending ? <ListSkeleton /> : q.isError ? <RetryState retry={() => void q.refetch()} /> : list.length ? <div className="resource-grid">{list.map(tpl => {
        const Icon = TEMPLATE_ICON[tpl.kind]; const p = templateParts(tpl); const title = pick(lang, tpl.title_en, tpl.title_es);
        return <article key={tpl.id} className="resource-card template-card">
          <div className="template-head"><span className="creation-icon"><Icon /></span><span className={`chip ${tpl.team_id ? '' : 'warm-chip'}`}>{tpl.team_id ? <UsersRound aria-hidden="true" /> : <Sparkles aria-hidden="true" />}{t(tpl.team_id ? 'templatesR.teamChip' : 'templatesR.starterChip')}</span></div>
          <div className="resource-body">
            <h3>{title}</h3>
            {pick(lang, tpl.description_en, tpl.description_es) && <p>{pick(lang, tpl.description_en, tpl.description_es)}</p>}
            <p className="track-facts">{[t(`templatesR.target.${tpl.target}`), p.parts ? t('templatesR.parts', { count: p.parts }) : null].filter(Boolean).join(' · ')}</p>
            {p.needsAssets > 0 && <p className="muted-small">{t('templatesR.needsAssets', { count: p.needsAssets })}</p>}
            <div className="resource-actions">
              <Button disabled={!!busy} onClick={() => void use(tpl)}><CopyPlus />{busy === tpl.id ? t('templatesR.using') : t('templatesR.use')}</Button>
              {tpl.team_id && <Button variant="ghost" onClick={() => void remove(tpl)} aria-label={`${t('templatesR.delete')}: ${title}`}><Trash2 />{t('templatesR.delete')}</Button>}
            </div>
          </div>
        </article>; })}</div>
        : <EmptyState icon="BookOpen" title={t('templatesR.emptyMine')} text={t('templatesR.emptyMineText')} action={<Button asChild><Link to="/learn" search={{ tab: 'mine' }}><Award />{t('templatesR.emptyMineAction')}</Link></Button>} />}
    </div>
  </>;
}
