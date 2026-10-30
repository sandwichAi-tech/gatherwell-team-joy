import { useFeature } from '@/lib/feature-flags';
import { isHistoryGuard } from '@/lib/resource-removal';
import { urlHint } from '@/lib/url-hint';
import { BuilderStepFooter, focusField } from '@/components/builder-step-footer';
import { DestinationSummary, ResourceAccessFields } from '@/components/resource-access-fields';
import { CurriculumPanel } from '@/components/content-studio';
import { CourseOutlinePreview } from '@/components/course-outline-preview';
import { destinationIssues, destinationsPrice, fromSavedDestinations, isStandalone, newDestinations, saveDestinations, type Destinations } from '@/lib/resource-placement';
import { uploadMedia } from '@/lib/account';
import { OfferCover } from '@/components/offers';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Eye, GraduationCap, Pencil, Plus, Save, Trash2, Upload,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { confirmAction } from '@/components/confirm-dialog';
import { CoverPicker, Field } from '@/components/learn-manage';
import { LangFields, LangPair } from '@/components/lang-fields';
import { LearnCover, useLearn } from '@/components/learn';
import { RefundSelect } from '@/components/refund-line';
import { RichTextEditor, RichTextView } from '@/components/rich-text';
import { getPaymentsReadiness } from '@/lib/billing.functions';
import { canSellPaid } from '@/lib/payments-readiness';
import {
  CREATE_TYPES, createTypeAllowed, emptyBuilderDraft, fileMatchesLessonType, isTrackFlow, lessonEditorConfig, lessonPresetFor, offerKindFor, typeContentAtRisk,
  type BuilderDraft, type CreateType,
} from '@/lib/create-resource';
import { learnPathsOf, listOf, pick, RECIPE_TAGS, removeUnusedLearnFiles, uploadLearnFile, type Lesson } from '@/lib/learn';
import { myOffersQuery, offerTitle, saveOffer, uploadOfferFile, type Offer } from '@/lib/offers';
import type { RefundPolicy } from '@/lib/refunds';
import { activationIso, hasPlaceholder, isMultiLessonTrack, lessonsToPublishWithTrack, placeholderLessons, publishedDestination, stepBlockers, stepNav, RESOURCE_ISSUE_STEP, RESOURCE_FIX_STEP } from '@/lib/resource-flow';
import {
  ACCENT_KEYS, accentPair, cardLayoutsFor, defaultCtaKey, emptyItemState, itemIssues, itemSnapshot,
  sanitizeRichText, sectionsFor, type Accent, type CardLayout, type ItemSection, type ItemState,
} from '@/lib/resource-item';

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const validUrl = (u: string) => !u || /^https?:\/\/\S+$/i.test(u);
// The generated types lag behind hand-written selects; keep the cast local.
const db = supabase as unknown as { from: (t: string) => any };

type LoadedRef = { entity: 'track' | 'recipe' | 'offer'; id: string; status: 'draft' | 'published'; trackId?: string | undefined };

/** Map a stored track's first lesson back onto a builder type. */
const typeForLesson = (t?: string | null): CreateType =>
  t === 'pdf' || t === 'file' ? 'guide' : t === 'video' || t === 'audio' || t === 'link' || t === 'live' ? t : 'video';

/** Live public-card preview: the three branded layouts with the chosen accent. */
function CardPreview({ item, type, lang, cta }: { item: ItemState; type: CreateType; lang: string; cta: string }) {
  const { t } = useTranslation();
  const pair = accentPair(item.accent);
  const title = (lang === 'es' ? item.titleEs || item.titleEn : item.titleEn || item.titleEs) || t('resources.untitled');
  const subtitle = (lang === 'es' ? item.subtitleEs || item.subtitleEn : item.subtitleEn || item.subtitleEs);
  if (item.cardLayout === 'button') {
    return <div className="card-preview is-button" style={{ background: pair.bg, color: pair.fg }}>
      <strong>{title}</strong>
      <span className="card-preview-cta" style={{ background: pair.fg, color: pair.bg }}>{cta}</span>
    </div>;
  }
  if (item.cardLayout === 'callout') {
    return <div className="card-preview is-callout" style={{ background: pair.bg, color: pair.fg }}>
      <span className="eyebrow" style={{ color: pair.fg }}>{t(`resources.create.types.${type}.name`)}</span>
      <strong>{title}</strong>
      {subtitle && <p>{subtitle}</p>}
      <span className="card-preview-cta" style={{ background: pair.fg, color: pair.bg }}>{cta}</span>
    </div>;
  }
  return <div className="card-preview is-preview">
    <ItemCover item={item} type={type} title={title} />
    <div className="card-preview-body">
      <strong>{title}</strong>
      {subtitle && <p>{subtitle}</p>}
      <span className="card-preview-cta" style={{ background: pair.bg, color: pair.fg }}>{cta}</span>
    </div>
  </div>;
}

/** Offer-backed covers live in the host's media folder; track/recipe covers in team learn media. */
function ItemCover({ item, type, title }: { item: ItemState; type: CreateType; title: string }) {
  const kind = offerKindFor(type);
  return kind ? <OfferCover offer={{ cover_style: item.coverStyle, cover_url: item.coverPath, kind, title_en: item.titleEn, title_es: item.titleEs }} wide />
    : <LearnCover path={item.coverPath} style={item.coverStyle} title={title} />;
}

/** Participant-facing landing/access page preview — promotional copy only, never protected content. */
function LandingPreview({ item, type, lang, cta, paid }: { item: ItemState; type: CreateType; lang: string; cta: string; paid: boolean }) {
  const { t } = useTranslation();
  const pair = accentPair(item.accent);
  const title = (lang === 'es' ? item.titleEs || item.titleEn : item.titleEn || item.titleEs) || t('resources.untitled');
  const subtitle = (lang === 'es' ? item.subtitleEs || item.subtitleEn : item.subtitleEn || item.subtitleEs);
  const promo = lang === 'es' ? item.promoEs || item.promoEn : item.promoEn || item.promoEs;
  const price = paid && item.access.price ? `$${item.access.price}` : null;
  return <div className="landing-preview">
    <ItemCover item={item} type={type} title={title} />
    <div className="landing-preview-body">
      <span className="eyebrow">{t(`resources.create.types.${type}.name`)}</span>
      <h3>{title}</h3>
      {subtitle && <p className="auth-subtitle">{subtitle}</p>}
      <RichTextView html={promo} />
      <span className="card-preview-cta" style={{ background: pair.bg, color: pair.fg }}>
        {cta}{price ? ` · ${price}` : paid ? '' : ` · ${t('resources.item.free')}`}
      </span>
      <small className="muted-small">{t(paid ? 'resources.item.previewPaidNote' : 'resources.item.previewFreeNote')}</small>
    </div>
  </div>;
}

/** Course curriculum: lessons of the course's track with add/edit/delete and explicit ordering. */
function Curriculum({ trackId, teamId, lang, onLessons }: { trackId: string; teamId: string; lang: string; onLessons?: (l: Lesson[]) => void }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ titleEn: '', titleEs: '', type: 'video', url: '', notesEn: '', notesEs: '', published: true });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await db.from('lessons').select('*').eq('track_id', trackId).order('sort_order').order('created_at');
    setLessons((data ?? []) as Lesson[]); onLessons?.((data ?? []) as Lesson[]);
  };
  useEffect(() => { void load(); }, [trackId]);

  const startEdit = (l: Lesson) => {
    setEditing(l.id);
    setForm({ titleEn: l.title_en, titleEs: l.title_es, type: l.type, url: l.url ?? '', notesEn: l.notes_en ?? '', notesEs: l.notes_es ?? '', published: l.is_published });
  };
  const saveLesson = async (id: string) => {
    // Never save a lesson whose link can't open.
    if (form.type !== 'text' && form.url.trim() && !validUrl(form.url)) { toast.error(t('resources.item.issues', { fields: t('resources.item.issue.url') })); return; }
    setBusy(true);
    const { error } = await db.from('lessons').update({
      title_en: form.titleEn.trim() || 'Lesson', title_es: form.titleEs.trim() || form.titleEn.trim() || 'Lección',
      type: form.type, url: form.url.trim() || null, notes_en: form.notesEn.trim() || null, notes_es: form.notesEs.trim() || null,
      is_published: form.published,
    }).eq('id', id);
    setBusy(false);
    // Keep the open editor and its text on failure so nothing typed is lost.
    if (error) { toast.error(t(String(error.message).includes('blueprint_placeholder') ? 'resources.item.placeholderBlock' : 'profile.saveError')); return; }
    toast.success(t('templates.saved')); setEditing(null); void load(); void qc.invalidateQueries();
  };
  const addLesson = async () => {
    setBusy(true);
    const next = (lessons.reduce((m, l) => Math.max(m, l.sort_order), 0) || 0) + 1;
    const { error } = await db.from('lessons').insert({
      track_id: trackId, title_en: i18n.getFixedT('en')('resources.item.curriculum.newLesson'), title_es: i18n.getFixedT('es')('resources.item.curriculum.newLesson'),
      type: 'text', sort_order: next, is_published: false,
    });
    setBusy(false);
    if (error) { toast.error(t('profile.saveError')); return; }
    void load();
  };
  const removeLesson = async (l: Lesson) => {
    const ok = await confirmAction({ title: t('resources.item.curriculum.deleteTitle'), body: t('resources.item.curriculum.deleteText'), confirmLabel: t('resources.item.deleteLesson'), destructive: true });
    if (!ok) return;
    const files = learnPathsOf([l]);
    const { error } = await db.from('lessons').delete().eq('id', l.id);
    if (!error) void removeUnusedLearnFiles(files);
    if (error) { toast.error(isHistoryGuard(error) ? t('resources.removal.historyBlocked') : t('profile.saveError')); return; }
    void load(); void qc.invalidateQueries();
  };
  const move = async (l: Lesson, dir: -1 | 1) => {
    const idx = lessons.findIndex(x => x.id === l.id);
    const other = lessons[idx + dir];
    if (!other) return;
    setBusy(true);
    try {
      // Equal sort values (e.g. copied lessons) would make a swap a no-op, so fall back to positions.
      const [a, b] = l.sort_order === other.sort_order ? [idx + dir, idx] : [other.sort_order, l.sort_order];
      const r1 = await db.from('lessons').update({ sort_order: a }).eq('id', l.id);
      const r2 = await db.from('lessons').update({ sort_order: b }).eq('id', other.id);
      if (r1.error || r2.error) toast.error(t('profile.saveError'));
    } finally { setBusy(false); await load(); }
  };

  return <div className="curriculum">
    <div className="label-row"><span className="field-label">{t('resources.item.curriculum.title')}</span>
      <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={addLesson}><Plus />{t('resources.item.curriculum.add')}</Button></div>
    {lessons.length === 0 && <p className="muted-small">{t('resources.item.curriculum.empty')}</p>}
    <ol className="curriculum-list">
      {lessons.map((l, i) => <li key={l.id} className="curriculum-row">
        {editing === l.id ? <div className="curriculum-edit">
          <LangPair id={`cl-${l.id}`} label={t('templates.title')} en={form.titleEn} es={form.titleEs}
            onEn={v => setForm(f => ({ ...f, titleEn: v }))} onEs={v => setForm(f => ({ ...f, titleEs: v }))} maxLength={120} />
          <Field id={`clt-${l.id}`} label={t('resources.item.curriculum.lessonType')}>
            <select id={`clt-${l.id}`} className="field-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {['video', 'pdf', 'audio', 'link', 'text', ...(form.type === 'live' ? ['live'] : [])].map(x => <option key={x} value={x}>{t(`resources.item.lessonTypes.${x}`)}</option>)}
            </select>
          </Field>
          {form.type !== 'text' && <Field id={`clu-${l.id}`} label={t('learnHub.link')}>
            <Input id={`clu-${l.id}`} type="url" className="field-input" placeholder="https://" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} aria-invalid={!validUrl(form.url)} />
          </Field>}
          <LangPair id={`cln-${l.id}`} label={t('resources.item.curriculum.instructions')} en={form.notesEn} es={form.notesEs}
            onEn={v => setForm(f => ({ ...f, notesEn: v }))} onEs={v => setForm(f => ({ ...f, notesEs: v }))} multiline rows={3} maxLength={2000} />
          <label className="switch-row"><Switch checked={form.published} onCheckedChange={v => setForm(f => ({ ...f, published: v }))} /><span><strong>{t('offers.publish')}</strong><small>{t(form.published ? 'templates.published' : 'templates.draft')}</small></span></label>
          <div className="sheet-actions">
            <Button type="button" size="sm" disabled={busy} onClick={() => void saveLesson(l.id)}><Save />{t('common.save')}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>{t('resources.item.cancelEdit')}</Button>
          </div>
        </div> : <div className="curriculum-summary">
          <span className="curriculum-title"><strong>{lang === 'es' ? l.title_es || l.title_en : l.title_en || l.title_es}</strong>
            <small>{t(`resources.item.lessonTypes.${l.type}`, { defaultValue: l.type })}{!l.is_published ? ` · ${t('templates.draft')}` : ''}</small></span>
          <span className="curriculum-actions">
            <button type="button" className="icon-button" aria-label={t('resources.item.curriculum.up')} disabled={busy || i === 0} onClick={() => void move(l, -1)}><ArrowUp /></button>
            <button type="button" className="icon-button" aria-label={t('resources.item.curriculum.down')} disabled={busy || i === lessons.length - 1} onClick={() => void move(l, 1)}><ArrowDown /></button>
            <button type="button" className="icon-button" aria-label={t('resources.edit')} onClick={() => startEdit(l)}><Pencil /></button>
            <button type="button" className="icon-button" aria-label={t('resources.item.deleteLesson')} onClick={() => void removeLesson(l)}><Trash2 /></button>
          </span>
        </div>}
      </li>)}
    </ol>
  </div>;
}

/**
 * One item-level editor per resource: Presentation / Content / Access / Options / Preview
 * sections over a single shared state model, with a live participant preview, draft and
 * publish actions, and reopening of existing items via ?id=. Switching type keeps shared
 * input and asks before discarding incompatible type-specific content.
 */
const RESOURCE_FIELD: Record<string, string> = { title: 'rb-title', url: 'rb-url', live_time: 'rb-live', price: 'rb-price', destination: 'rb-destinations', courseUnavailable: 'rb-destinations' };

export function ResourceBuilder({ initialType, initialId }: { initialType: CreateType; initialId?: string | undefined }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [coursesOn] = useFeature('feature_courses'); const [assessmentOn] = useFeature('feature_assessment');
  const [sellingOn] = useFeature('feature_selling');
  const { teamId, userId } = useLearn();

  const [type, setType] = useState<CreateType>(initialType);
  useEffect(() => { if (!initialId) setType(initialType); }, [initialType, initialId]);
  const [item, setItem] = useState<ItemState>(emptyItemState);
  const [draft, setDraft] = useState<BuilderDraft>(emptyBuilderDraft);
  const [section, setSection] = useState<ItemSection>('presentation');
  const [loaded, setLoaded] = useState<LoadedRef | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadingItem, setLoadingItem] = useState(!!initialId);
  const [snapshot, setSnapshot] = useState(itemSnapshot(emptyItemState()));
  const [draftSnap, setDraftSnap] = useState(JSON.stringify(emptyBuilderDraft()));
  const [refund, setRefund] = useState<RefundPolicy>('24h');
  const [visibility, setVisibility] = useState<'team' | 'public' | 'unlisted'>('team');
  const [drip, setDrip] = useState(7);
  const [activeFrom, setActiveFrom] = useState('');
  const submitting = useRef(false);
  const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
  // One resource, many destinations: Team Resources, coach page and any number of the host's courses.
  const [dest, setDest] = useState<Destinations>(newDestinations());
  const [destSnap, setDestSnap] = useState(JSON.stringify(newDestinations()));
  const loadDest = async (entity: 'track' | 'recipe' | 'offer', id: string) => {
    const r = await (supabase as any).rpc('resource_destinations', { _kind: entity, _id: id });
    const d = fromSavedDestinations(r.data); if (d) { setDest(d); setDestSnap(JSON.stringify(d)); }
  };
  const [busy, setBusy] = useState(false);
  // Multi-lesson tracks (e.g. from a blueprint) edit every lesson in the curriculum instead of one preset lesson.
  const [trackLessons, setTrackLessons] = useState<Lesson[] | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [fileName, setFileName] = useState('');
  const loadedOnce = useRef(false);
  // A reopened item starts clean: its loaded values become the saved baseline.
  const baselinePending = useRef(!!initialId);

  const offers = useQuery(myOffersQuery(userId));
  const courses = (offers.data ?? []).filter(o => o.kind === 'course' && o.status !== 'archived');
  const readiness = useQuery({ queryKey: ['payments-readiness'], queryFn: () => getPaymentsReadiness(), staleTime: 30_000 });
  const sellReady = readiness.data ? canSellPaid(readiness.data) : false;

  // After the first save, put the item id in the address so a refresh or shared link reopens this draft instead of a blank builder.
  useEffect(() => {
    if (initialId || !loaded?.id) return;
    loadedOnce.current = true;
    void navigate({ to: '/learn/create', search: { type, id: loaded.id }, replace: true });
  }, [loaded?.id, initialId, type, navigate]);

  /* ---- Reopen an existing item ---- */
  useEffect(() => {
    if (!initialId || loadedOnce.current) return;
    loadedOnce.current = true;
    void (async () => {
      const tr = await db.from('tracks').select('*').eq('id', initialId).maybeSingle();
      if (tr.data) {
        const all = ((await db.from('lessons').select('*').eq('track_id', initialId).order('sort_order').order('created_at')).data ?? []) as Lesson[];
        const l = all[0] ?? null;
        if (isMultiLessonTrack(all)) setTrackLessons(all);
        setType(typeForLesson(l?.type));
        setItem({
          ...emptyItemState(),
          titleEn: tr.data.title_en ?? '', titleEs: tr.data.title_es ?? '',
          subtitleEn: tr.data.subtitle_en ?? '', subtitleEs: tr.data.subtitle_es ?? '',
          descEn: tr.data.description_en ?? '', descEs: tr.data.description_es ?? '',
          promoEn: tr.data.promo_en ?? '', promoEs: tr.data.promo_es ?? '',
          ctaEn: tr.data.cta_en ?? '', ctaEs: tr.data.cta_es ?? '',
          coverPath: tr.data.cover_url, coverStyle: tr.data.cover_style ?? 0,
          cardLayout: (tr.data.card_layout ?? 'preview') as CardLayout, accent: (tr.data.accent ?? 'plum') as Accent,
        });
        if (l) setDraft(d => ({ ...d, lesson: {
          url: l.url ?? '', storagePath: l.storage_path, replay: l.replay_url ?? '',
          live: l.live_starts_at ? toLocalInput(new Date(l.live_starts_at)) : '', meeting: '',
        } }));
        setActiveFrom(tr.data.available_from ? toLocalInput(new Date(tr.data.available_from)) : '');
        await loadDest('track', initialId);
        if (tr.data.commerce_offer_id) { const o = (await db.from('offers').select('price_cents').eq('id', tr.data.commerce_offer_id).maybeSingle()).data; if (o) setItem(i => ({ ...i, access: { free: !o.price_cents, price: o.price_cents ? String(o.price_cents / 100) : '' } })); }
        setVisibility(tr.data.visibility === 'public' || tr.data.visibility === 'unlisted' ? tr.data.visibility : 'team');
        setLoaded({ entity: 'track', id: initialId, status: tr.data.is_published ? 'published' : 'draft', trackId: initialId });
        setLoadingItem(false);
        return;
      }
      const rc = await db.from('recipes').select('*').eq('id', initialId).maybeSingle();
      if (rc.data) {
        setType('recipe'); await loadDest('recipe', initialId);
        const recipePrice = rc.data.commerce_offer_id ? (await db.from('offers').select('price_cents').eq('id', rc.data.commerce_offer_id).maybeSingle()).data?.price_cents ?? 0 : 0;
        setItem({
          ...emptyItemState(),
          titleEn: rc.data.title_en ?? '', titleEs: rc.data.title_es ?? '',
          subtitleEn: rc.data.subtitle_en ?? '', subtitleEs: rc.data.subtitle_es ?? '',
          promoEn: rc.data.promo_en ?? '', promoEs: rc.data.promo_es ?? '',
          ctaEn: rc.data.cta_en ?? '', ctaEs: rc.data.cta_es ?? '',
          access: { free: !recipePrice, price: recipePrice ? String(recipePrice / 100) : '' },
          coverPath: rc.data.cover_url, coverStyle: rc.data.cover_style ?? 0,
          cardLayout: (rc.data.card_layout ?? 'preview') as CardLayout, accent: (rc.data.accent ?? 'plum') as Accent,
        });
        setDraft(d => ({ ...d, recipe: {
          prep: rc.data.prep_minutes ? String(rc.data.prep_minutes) : '', tags: (rc.data.tags ?? []) as string[],
          ingEn: listOf(rc.data.ingredients, 'en').join('\n'), ingEs: listOf(rc.data.ingredients, 'es').join('\n'),
          stepsEn: listOf(rc.data.steps, 'en').join('\n'), stepsEs: listOf(rc.data.steps, 'es').join('\n'),
        } }));
        setActiveFrom(rc.data.available_from ? toLocalInput(new Date(rc.data.available_from)) : '');
        setLoaded({ entity: 'recipe', id: initialId, status: rc.data.is_published ? 'published' : 'draft' });
        setLoadingItem(false);
        return;
      }
      const of = await db.from('offers').select('*').eq('id', initialId).maybeSingle();
      if (of.data) {
        const o = of.data as Offer;
        setType(o.kind === 'course' ? 'course' : (o as any).resource_type === 'bundle' ? 'bundle' : 'file'); await loadDest('offer', initialId);
        setItem({
          ...emptyItemState(),
          titleEn: o.title_en ?? '', titleEs: o.title_es ?? '',
          subtitleEn: (o as any).subtitle_en ?? '', subtitleEs: (o as any).subtitle_es ?? '',
          descEn: o.description_en ?? '', descEs: o.description_es ?? '',
          promoEn: (o as any).promo_en ?? '', promoEs: (o as any).promo_es ?? '',
          ctaEn: (o as any).cta_en ?? '', ctaEs: (o as any).cta_es ?? '',
          coverPath: o.cover_url, coverStyle: o.cover_style ?? 0,
          cardLayout: ((o as any).card_layout ?? 'preview') as CardLayout, accent: ((o as any).accent ?? 'plum') as Accent,
          access: { free: !o.price_cents, price: o.price_cents ? (o.price_cents / 100).toString() : '' },
        });
        setDraft(d => ({ ...d, offer: { price: o.price_cents ? (o.price_cents / 100).toString() : '', filePath: o.file_path } }));
        setRefund((o as any).refund_policy ?? '24h'); setDrip(o.drip_days ?? 7);
        setVisibility(((o as any).visibility === 'public' || (o as any).visibility === 'unlisted' ? (o as any).visibility : 'team'));
        setActiveFrom(o.available_from ? toLocalInput(new Date(o.available_from)) : '');
        let trackId: string | undefined;
        if (o.kind === 'course') {
          const linked = await db.from('tracks').select('id').eq('offer_id', initialId).limit(1).maybeSingle();
          trackId = linked.data?.id;
        }
        setLoaded({ entity: 'offer', id: initialId, status: o.status === 'published' ? 'published' : 'draft', trackId });
        setLoadingItem(false);
        return;
      }
      setLoadError(true); setLoadingItem(false);
    })();
  }, [initialId]);

  useEffect(() => {
    if (loadingItem || !baselinePending.current) return;
    baselinePending.current = false;
    setSnapshot(itemSnapshot(item)); setDraftSnap(JSON.stringify(draft));
  }, [loadingItem, item, draft]);

  const stepsRef = useRef<HTMLDivElement>(null);
  const goStep = (s: ItemSection) => {
    setSection(s);
    requestAnimationFrame(() => document.getElementById('rb-step-heading')?.focus());
  };
  const patchItem = (p: Partial<ItemState>) => setItem(s => ({ ...s, ...p }));
  const patchLesson = (p: Partial<BuilderDraft['lesson']>) => setDraft(d => ({ ...d, lesson: { ...d.lesson, ...p } }));
  const patchRecipe = (p: Partial<BuilderDraft['recipe']>) => setDraft(d => ({ ...d, recipe: { ...d.recipe, ...p } }));
  const patchOffer = (p: Partial<BuilderDraft['offer']>) => setDraft(d => ({ ...d, offer: { ...d.offer, ...p } }));

  const pickType = async (next: CreateType) => {
    if (next === type) return;
    // Covers for offer-backed and track/recipe items live in different storage folders; never carry one across.
    if (!!offerKindFor(type) !== !!offerKindFor(next) && item.coverPath) patchItem({ coverPath: null });
    if (typeContentAtRisk(draft, type, next)) {
      const ok = await confirmAction({ title: t('resources.builder.switchTitle'), body: t('resources.builder.switchText'), confirmLabel: t('resources.builder.switchConfirm') });
      if (!ok) return;
      if (isTrackFlow(type) && !isTrackFlow(next)) patchLesson({ url: '', storagePath: null, live: '', meeting: '', replay: '' });
      if (type === 'recipe' && next !== 'recipe') setDraft(d => ({ ...d, recipe: emptyBuilderDraft().recipe }));
      if (offerKindFor(type) && !offerKindFor(next)) patchOffer({ price: '', filePath: null });
    }
    setType(next);
    if (!cardLayoutsFor(next).includes(item.cardLayout)) patchItem({ cardLayout: cardLayoutsFor(next)[0] ?? 'preview' });
    void navigate({ to: '/learn/create', search: { type: next }, replace: true, resetScroll: false });
  };

  const uploadLessonFile = async (file: File) => {
    if (lessonType && !fileMatchesLessonType(lessonType, file)) { toast.error(t('learnHub.wrongFileType')); return; }
    setFileName(file.name); setProgress(0);
    try { const p = await uploadLearnFile(teamId, file, setProgress); patchLesson({ storagePath: p, url: '' }); setProgress(100); }
    catch { toast.error(t('profile.saveError')); setProgress(null); setFileName(''); }
  };
  const uploadOfferFileAction = async (file: File) => {
    if (file.size > 100 * 1024 * 1024) { toast.error(t('offers.fileTooBig')); return; }
    setBusy(true);
    try { const p = await uploadOfferFile(userId, file); patchOffer({ filePath: p }); toast.success(t('offers.fileReady')); }
    catch { toast.error(t('offers.uploadError')); }
    setBusy(false);
  };

  const lessonType = isTrackFlow(type) ? lessonPresetFor(type) : null;
  const cfg = lessonType ? lessonEditorConfig(lessonType) : null;
  // Only the host's own active courses in this team can hold the resource (the server re-checks).
  const placeable = courses.filter(o => o.team_id === teamId && o.id !== loaded?.id);
  const courseIds = placeable.map(o => o.id);
  const courseOptions = placeable.map(o => ({ id: o.id, title: offerTitle(o, lang) }));
  const priceCents = destinationsPrice(dest, item.access.free, item.access.price);
  const paid = isStandalone(dest) && !item.access.free;
  const sections = sectionsFor(type);
  const dirty = itemSnapshot(item) + JSON.stringify(draft) + JSON.stringify(dest) !== snapshot + draftSnap + destSnap;
  const status = loaded?.status ?? 'draft';

  const issues = itemIssues(type, item, {
    lessonUrl: draft.lesson.url, live: draft.lesson.live, filePath: draft.offer.filePath, courseId: 'standalone', publish: true,
  });
  const paidBlocked = paid && !sellReady;
  const destIssues = destinationIssues(dest, courseIds);
  for (const i of destIssues) issues.push(i as never);
  if (!isStandalone(dest)) { const i = issues.indexOf('price'); if (i >= 0) issues.splice(i, 1); }
  const lessonsWithPlaceholders = trackLessons ? placeholderLessons(trackLessons) : [];
  const placeholder = hasPlaceholder(item.titleEn, item.titleEs, item.descEn, item.descEs, item.subtitleEn, item.subtitleEs) || lessonsWithPlaceholders.length > 0;
  const draftLessonsToPublish = trackLessons ? lessonsToPublishWithTrack(trackLessons, loaded?.status === 'published') : [];
  const canSave = itemIssues(type, item, { publish: false, courseId: 'standalone', lessonUrl: draft.lesson.url, live: draft.lesson.live }).filter(i => i === 'title' || (i === 'price' && isStandalone(dest))).length === 0 && !destIssues.includes('courseUnavailable') && (progress === null || progress === 100) && !busy;
  const canPublish = canSave && issues.length === 0 && !paidBlocked && !placeholder;
  const stepIssues = stepBlockers(issues, section, RESOURCE_ISSUE_STEP);
  const nav = stepNav(sections, sections.includes(section) ? section : 'presentation');
  const wasPublished = loaded?.status === 'published';

  const finish = async (ok: boolean, published?: { entity: 'track' | 'recipe' | 'offer'; id: string | undefined }, err?: string) => {
    setBusy(false);
    // State is kept on failure — the same button retries.
    if (!ok) { toast.error(t(err?.includes('blueprint_placeholder') ? 'resources.item.placeholderBlock' : 'resources.item.saveFailed')); return; }
    await qc.invalidateQueries();
    if (published?.id) {
      toast.success(t(wasPublished ? 'resources.item.updatedToast' : 'resources.item.publishedToast'));
      void navigate(publishedDestination(published.entity, published.id));
      return;
    }
    toast.success(t('resources.item.draftToast'));
  };
  const activation = { available_from: activationIso(activeFrom), available_tz: activeFrom ? tz : null };

  const presentationCols = {
    subtitle_en: item.subtitleEn.trim() || null, subtitle_es: item.subtitleEs.trim() || null,
    cta_en: item.ctaEn.trim() || null, cta_es: item.ctaEs.trim() || null,
    card_layout: item.cardLayout, accent: item.accent,
    promo_en: sanitizeRichText(item.promoEn) || null, promo_es: sanitizeRichText(item.promoEs) || null,
  };

  const save = async (publish: boolean) => {
    if (submitting.current) return; // one submission at a time: no duplicate records
    submitting.current = true;
    try { await saveOnce(publish); } catch { setBusy(false); toast.error(t('resources.item.saveFailed')); } finally { submitting.current = false; }
  };
  const saveOnce = async (publish: boolean) => {
    if (priceCents === null || (publish && paidBlocked)) return;
    setBusy(true);
    const configure = async (entity: 'track' | 'recipe' | 'quiz' | 'offer', id: string) => { await saveDestinations((fn, args) => (supabase as any).rpc(fn, args), entity, id, dest, courseIds, priceCents); setDestSnap(JSON.stringify(dest)); };
    const base = {
      title_en: item.titleEn.trim(), title_es: item.titleEs.trim(),
      description_en: item.descEn.trim() || null, description_es: item.descEs.trim() || null,
      cover_url: item.coverPath, cover_style: item.coverStyle, ...presentationCols, ...activation,
    };
    if (isTrackFlow(type) && lessonType) {
      const row = { ...base, is_published: false, visibility: dest.coach ? 'public' : 'team', host_id: userId, resource_kind: lessonType };
      const tr = loaded?.entity === 'track'
        ? await db.from('tracks').update(row).eq('id', loaded.id).select('id').single()
        : await db.from('tracks').insert({ ...row, team_id: teamId, sort_order: Date.now() % 1_000_000 }).select('id').single();
      if (tr.error) return finish(false, undefined, tr.error.message);
      const trackId = tr.data.id as string;
      setLoaded({ entity: 'track', id: trackId, status: 'draft', trackId });
      try { await configure('track', trackId); } catch { return finish(false); }
      if (trackLessons) {
        if (publish && draftLessonsToPublish.length) {
          const pl = await db.from('lessons').update({ is_published: true }).in('id', draftLessonsToPublish);
          if (pl.error) return finish(false, undefined, pl.error.message);
        }
        if (publish) { const p = await db.from('tracks').update({ is_published: true }).eq('id', trackId); if (p.error) return finish(false); }
        setLoaded({ entity: 'track', id: trackId, status: publish ? 'published' : 'draft', trackId });
        setSnapshot(itemSnapshot(item)); setDraftSnap(JSON.stringify(draft));
        return finish(true, publish ? { entity: 'track', id: trackId } : undefined);
      }
      const lessonRow = {
        title_en: base.title_en, title_es: base.title_es, type: lessonType, track_id: trackId,
        url: lessonType === 'live' ? null : draft.lesson.url.trim() || null,
        storage_path: cfg?.keepsFile ? draft.lesson.storagePath : null,
        live_starts_at: lessonType === 'live' && draft.lesson.live ? new Date(draft.lesson.live).toISOString() : null,
        replay_url: lessonType === 'live' ? draft.lesson.replay.trim() || null : null,
        // The single lesson is the resource itself: it is visible exactly when the resource is published.
        is_published: publish ? true : undefined,
      };
      const existing = loaded?.entity === 'track'
        ? (await db.from('lessons').select('id').eq('track_id', trackId).order('sort_order').limit(1).maybeSingle()).data
        : null;
      const ls = existing
        ? await db.from('lessons').update(lessonRow).eq('id', existing.id)
        : await db.from('lessons').insert({ ...lessonRow, sort_order: 1 }).select('id').single();
      if (ls.error) return finish(false, undefined, ls.error.message);
      if (lessonType === 'live' && draft.lesson.meeting.trim() && !existing) await supabase.from('lesson_live_links').insert({ lesson_id: (ls.data as { id: string } | null)?.id ?? existing?.id, url: draft.lesson.meeting.trim() });
      if (publish) { const p = await db.from('tracks').update({ is_published: true }).eq('id', trackId); if (p.error) return finish(false); }
      setLoaded({ entity: 'track', id: trackId, status: publish ? 'published' : 'draft' });
      setSnapshot(itemSnapshot(item)); setDraftSnap(JSON.stringify(draft));
      return finish(true, publish ? { entity: 'track', id: trackId } : undefined);
    }
    if (type === 'recipe') {
      const lines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 40).map(x => x.slice(0, 300));
      const row = {
        title_en: base.title_en, title_es: base.title_es, cover_url: base.cover_url, cover_style: base.cover_style, ...presentationCols, ...activation,
        is_published: false,
        prep_minutes: parseInt(draft.recipe.prep, 10) > 0 ? Math.min(600, parseInt(draft.recipe.prep, 10)) : null,
        tags: draft.recipe.tags,
        ingredients: { en: lines(draft.recipe.ingEn), es: lines(draft.recipe.ingEs) },
        steps: { en: lines(draft.recipe.stepsEn), es: lines(draft.recipe.stepsEs) },
      };
      const r = loaded?.entity === 'recipe'
        ? await db.from('recipes').update(row).eq('id', loaded.id).select('id').single()
        : await db.from('recipes').insert({ ...row, team_id: teamId, created_by: userId }).select('id').single();
      if (r.error) return finish(false, undefined, r.error.message);
      const rid = r.data.id as string; setLoaded({ entity: 'recipe', id: rid, status: 'draft' });
      try { await configure('recipe', rid); } catch { return finish(false); }
      if (publish) { const p = await db.from('recipes').update({ is_published: true }).eq('id', rid); if (p.error) return finish(false); }
      setLoaded({ entity: 'recipe', id: rid, status: publish ? 'published' : 'draft' }); setSnapshot(itemSnapshot(item)); setDraftSnap(JSON.stringify(draft));
      return finish(true, publish ? { entity: 'recipe', id: rid } : undefined);
    }
    const kind = offerKindFor(type);
    if (kind) {
      const row = {
        kind, ...base, price_cents: priceCents, refund_policy: refund, drip_days: drip,
        file_path: kind === 'download' ? draft.offer.filePath : null,
        status: 'draft' as const, visibility: dest.coach ? 'public' : 'team', resource_type: type,
      };
      const r = loaded?.entity === 'offer' ? await saveOffer(row, loaded.id)
        : await db.from('offers').insert({ ...row, includes_en: [], includes_es: [], team_id: teamId, host_id: userId }).select('id').single();
      if (r.error) { const m = String(r.error.message); if (!m.includes('payouts_required')) return finish(false, undefined, m); setBusy(false); toast.error(t('billing.payoutsRequired')); return; }
      // Use the id of the row just created, never "my latest offer" (wrong item when two are saved close together).
      const offerId = (loaded?.id ?? (r.data as { id: string } | null)?.id) as string;
      setLoaded({ entity: 'offer', id: offerId, status: 'draft', trackId: loaded?.trackId });
      try { await configure('offer', offerId); } catch { return finish(false); }
      if (publish) { const p = await db.from('offers').update({ status: 'published' }).eq('id', offerId); if (p.error) return finish(false); }
      // A course gets its own curriculum track so lessons can be attached right away.
      let trackId = loaded?.trackId;
      if (kind === 'course' && !trackId && offerId) {
        const ct = await db.from('tracks').insert({
          title_en: base.title_en, title_es: base.title_es, team_id: teamId, offer_id: offerId,
          is_published: publish, sort_order: Date.now() % 1_000_000,
        }).select('id').single();
        trackId = ct.data?.id;
      } else if (kind === 'course' && trackId && publish) {
        // A course drafted first keeps a hidden curriculum; publishing the course must make its curriculum visible too.
        const up = await db.from('tracks').update({ is_published: true }).eq('id', trackId);
        if (up.error) return finish(false, undefined, up.error.message);
      }
      setLoaded({ entity: 'offer', id: offerId, status: publish ? 'published' : 'draft', trackId });
      setSnapshot(itemSnapshot(item)); setDraftSnap(JSON.stringify(draft));
      return finish(true, publish ? { entity: 'offer', id: offerId } : undefined);
    }
    // quiz: create a draft (standalone in the team, or on the chosen course), then open the quiz studio.
    // Quizzes stay one team-owned record; course placements are references, never copies.
    if (!teamId) return finish(false);
    const q = await supabase.from('quizzes').insert({
      title_en: base.title_en, title_es: base.title_es, team_id: teamId, mode: 'scored',
      pass_pct: 80, cooldown_minutes: 0, is_required: false, show_score: true, reveal_answers: 'after_pass', is_published: false, sort_order: 1,
    } as never).select('id').single();
    setBusy(false);
    if (q.error || !q.data) { toast.error(t('profile.saveError')); return; }
    try { await configure('quiz', (q.data as { id: string }).id); } catch { return finish(false); }
    toast.success(t('resources.builder.quizReady'));
    setSnapshot(itemSnapshot(item)); setDraftSnap(JSON.stringify(draft));
    void qc.invalidateQueries({ queryKey: ['team-quizzes'] });
    void navigate({ to: '/learn/quiz/$id', params: { id: (q.data as { id: string }).id } });
  };

  const priceLabel = !isStandalone(dest) ? t('resourcePlacement.courseAccess') : paid ? (priceCents !== null && priceCents > 0 ? new Intl.NumberFormat(lang, { style: 'currency', currency: 'USD' }).format(priceCents / 100) : t('resources.review.priceMissing')) : t('offers.free');
  const cta = (lang === 'es' ? item.ctaEs || item.ctaEn : item.ctaEn || item.ctaEs) || t(defaultCtaKey(paid));

  if (loadingItem) return <section className="panel builder-panel"><p className="muted-small">{t('publicEvent.loading')}</p></section>;
  if (loadError) return <section className="panel builder-panel">
    <Link to="/learn" className="back-link"><ArrowLeft />{t('resources.title')}</Link>
    <p className="auth-subtitle">{t('resources.item.notFound')}</p>
    <Button variant="secondary" onClick={() => { loadedOnce.current = false; setLoadError(false); setLoadingItem(true); }}>{t('error.retry')}</Button>
  </section>;

  const activationField = <Field id="rb-active" label={t('resources.item.activeFrom')}>
    <Input id="rb-active" type="datetime-local" className="field-input" value={activeFrom} onChange={e => setActiveFrom(e.target.value)} aria-describedby="rb-active-hint" />
    <p id="rb-active-hint" className="field-hint">{t('resources.item.activeFromHint', { tz })}</p>
  </Field>;
  const preview = <>
    <DestinationSummary paid={paid} dest={dest} courses={courseOptions} onFix={() => { goStep(sections.includes('access') ? 'access' : 'presentation'); requestAnimationFrame(() => document.getElementById('rb-destinations')?.focus()); }} />
    {type === 'course' && loaded?.id && <CourseOutlinePreview id={loaded.id} />}
    {trackLessons && <div className="form-field" role="status"><span className="field-label">{t('resources.item.lessonStatusTitle')}</span>
      <ul className="lesson-status-list">{trackLessons.map(l => { const ph = hasPlaceholder(l.title_en, l.title_es, l.notes_en, l.notes_es, l.description_en, l.description_es);
        return <li key={l.id}><strong>{pick(lang, l.title_en, l.title_es)}</strong> <small>{ph ? t('resources.item.lessonNeedsReview') : l.is_published && wasPublished ? t('resources.item.lessonLive') : l.is_published || draftLessonsToPublish.includes(l.id) ? t('resources.item.lessonVisible') : t('resources.item.lessonHidden')}</small></li>; })}</ul>
      {!wasPublished && draftLessonsToPublish.length > 0 && <p className="field-hint">{t('resources.item.publishesLessons', { count: draftLessonsToPublish.length })}</p>}
    </div>}
    <div className="form-field"><span className="field-label">{t('resources.item.cardOnPage')}</span><CardPreview item={item} type={type} lang={lang} cta={`${cta} · ${priceLabel}`} /></div>
    <div className="form-field"><span className="field-label">{t('resources.item.landingTitle')}</span><LandingPreview item={item} type={type} lang={lang} cta={cta} paid={paid} /></div>
  </>;

  return <>
    <Link to={loaded ? '/learn' : '/learn/create'} className="back-link"><ArrowLeft />{loaded ? t('resources.title') : t('resources.create.chooseAnother')}</Link>
    <div className="page-heading"><div>
      <span className="eyebrow">{t(loaded ? 'resources.item.reopenTitle' : 'resources.create.title')}</span>
      <h1>{t(`resources.create.types.${type}.name`)}</h1>
      <p>{t(`resources.create.types.${type}.example`)}</p>
    </div>
      <span className={`chip status-chip ${status === 'published' ? 'warm-chip' : ''}`}>{t(`resources.item.status.${status}`)}{dirty ? ` · ${t('resources.item.unsaved')}` : ''}</span>
    </div>

    <div className="item-editor">
      <section className="panel builder-panel">
        <Field id="rb-type" label={t('resources.builder.typeLabel')}>
          <select id="rb-type" className="field-input" value={type} onChange={e => void pickType(e.target.value as CreateType)} disabled={!!loaded}>
            {CREATE_TYPES.filter(ct => ct === type || createTypeAllowed(ct, { courses: coursesOn, assessment: assessmentOn })).map(ct => <option key={ct} value={ct}>{t(`resources.create.types.${ct}.name`)}</option>)}
          </select>
          {loaded && <p className="field-hint">{t('resources.item.typeLocked')}</p>}
        </Field>

        <p className="muted-small" aria-live="polite">{t('resources.item.stepOf', { n: nav.index + 1, total: nav.total })}</p>
        <div ref={stepsRef} className="segmented-tabs builder-steps" role="tablist" aria-label={t('resources.item.sections')}>
          {sections.map((s, i) => { const needs = stepBlockers(issues, s, RESOURCE_ISSUE_STEP).length > 0;
            return <button key={s} type="button" role="tab" aria-selected={section === s} className={section === s ? 'is-active' : ''} onClick={() => goStep(s)}
              aria-label={`${i + 1}. ${t(`resources.item.tabs.${s}`)}${needs ? ` · ${t('resources.item.stepNeedsAttention')}` : ''}`}>
              {i + 1}. {t(`resources.item.tabs.${s}`)}{needs && <span aria-hidden="true" className="step-needs-dot" />}
            </button>; })}
        </div>
        <h2 id="rb-step-heading" tabIndex={-1} className="builder-step-heading">{t(`resources.item.tabs.${section}`)}</h2>

        {/* ---- Presentation ---- */}
        {section === 'presentation' && <>
          <LangFields idPrefix="rb" titleEn={item.titleEn} titleEs={item.titleEs} descEn={item.descEn} descEs={item.descEs}
            onChange={p => setItem(s => ({ ...s, titleEn: p.titleEn ?? s.titleEn, titleEs: p.titleEs ?? s.titleEs, descEn: p.descEn ?? s.descEn, descEs: p.descEs ?? s.descEs }))}
            titleLabel={t('templates.title')} descLabel={t('templates.description')} titlePlaceholder={t(`resources.preset.track.${isTrackFlow(type) ? type : 'video'}`)} />
          <LangPair id="rb-subtitle" label={t('resources.item.subtitle')} en={item.subtitleEn} es={item.subtitleEs}
            onEn={v => patchItem({ subtitleEn: v })} onEs={v => patchItem({ subtitleEs: v })} maxLength={160} placeholder={t('resources.item.subtitleHint')} />
          {type !== 'quiz' && <CoverPicker teamId={teamId} path={item.coverPath} styleIdx={item.coverStyle} title={item.titleEn || item.titleEs}
            onPath={p => patchItem({ coverPath: p })} onStyle={n => patchItem({ coverStyle: n })}
            {...(offerKindFor(type) ? {
              // Offer covers must live in the host's own media folder (database rule), not team learn media.
              upload: (f: File) => uploadMedia(userId, f, 'cover'),
              renderCover: () => <OfferCover offer={{ cover_style: item.coverStyle, cover_url: item.coverPath, kind: offerKindFor(type)!, title_en: item.titleEn, title_es: item.titleEs }} wide />,
            } : {})} />}
          <LangPair id="rb-cta" label={t('resources.item.ctaLabel')} en={item.ctaEn} es={item.ctaEs}
            onEn={v => patchItem({ ctaEn: v })} onEs={v => patchItem({ ctaEs: v })} maxLength={40} placeholder={t(defaultCtaKey(paid))} />
          <div className="form-field"><span className="field-label">{t('resources.item.layoutLabel')}</span>
            <div className="filter-chips" role="radiogroup" aria-label={t('resources.item.layoutLabel')}>
              {cardLayoutsFor(type).map(l => <button key={l} type="button" role="radio" aria-checked={item.cardLayout === l}
                className={`filter-chip ${item.cardLayout === l ? 'is-active' : ''}`} onClick={() => patchItem({ cardLayout: l })}>{t(`resources.item.layout.${l}`)}</button>)}
            </div></div>
          <div className="form-field"><span className="field-label">{t('resources.item.accentLabel')}</span>
            <div className="accent-swatches" role="radiogroup" aria-label={t('resources.item.accentLabel')}>
              {ACCENT_KEYS.map(a => { const p = accentPair(a); return <button key={a} type="button" role="radio" aria-checked={item.accent === a}
                className={`accent-swatch ${item.accent === a ? 'is-active' : ''}`} style={{ background: p.bg, color: p.fg }}
                aria-label={t(`resources.item.accent.${a}`)} onClick={() => patchItem({ accent: a })}>{item.accent === a ? <Check aria-hidden="true" /> : null}</button>; })}
            </div></div>
        </>}

        {/* ---- Content ---- */}
        {section === 'content' && <>
          {trackLessons && loaded?.trackId && <>
            <p className="field-hint">{t('resources.item.multiLessonHint')}</p>
            <Curriculum trackId={loaded.trackId} teamId={teamId} lang={lang} onLessons={setTrackLessons} />
          </>}
          {isTrackFlow(type) && cfg && !trackLessons && <>
            {cfg.uploadAccept && <div className="form-field"><span className="field-label">{t(type === 'video' ? 'learnHub.uploadVideo' : type === 'audio' ? 'learnHub.uploadAudio' : 'learnHub.uploadPdf')}</span>
              <label className="file-button"><Upload />{t('learnHub.chooseFile')}<input type="file" accept={cfg.uploadAccept} hidden onChange={e => { const x = e.target.files?.[0]; if (x) void uploadLessonFile(x); }} /></label>
              {progress !== null && <div className="upload-progress"><span>{fileName}</span><progress value={progress} max={100} aria-label={t('learnHub.uploading')} /><small>{progress < 100 ? t('learnHub.uploadingPct', { pct: progress }) : t('learnHub.uploaded')}</small></div>}
              {progress === null && draft.lesson.storagePath && <p className="field-hint">{t('learnHub.fileAttached')} <button type="button" className="text-link" onClick={() => patchLesson({ storagePath: null })}>{t('learnHub.removeFile')}</button></p>}
              <p className="field-hint">{t(type === 'video' ? 'learnHub.videoHint' : type === 'audio' ? 'learnHub.audioHint' : 'learnHub.pdfHint')}</p></div>}
            {cfg.showsUrl && !draft.lesson.storagePath && <Field id="rb-url" label={t(type === 'video' ? 'learnHub.videoLink' : type === 'guide' ? 'learnHub.pdfLink' : type === 'audio' ? 'learnHub.audioLink' : 'learnHub.link')}>
              <Input id="rb-url" type="url" inputMode="url" className="field-input" placeholder="https://" value={draft.lesson.url} onChange={e => patchLesson({ url: e.target.value })} aria-invalid={!validUrl(draft.lesson.url)} aria-describedby="rb-url-hint" />
              <p id="rb-url-hint" className="field-hint" aria-live="polite">{(() => { const h = urlHint(draft.lesson.url); return t(`resources.content.${h.key}`, { host: h.host }); })()}</p>
            </Field>}
            {type === 'live' && <>
              <Field id="rb-live" label={t('learnHub.liveStarts')}><Input id="rb-live" type="datetime-local" className="field-input" value={draft.lesson.live} onChange={e => patchLesson({ live: e.target.value })} /></Field>
              <Field id="rb-meet" label={t('learnHub.meetingLink')}><Input id="rb-meet" type="url" className="field-input" placeholder="https://" value={draft.lesson.meeting} onChange={e => patchLesson({ meeting: e.target.value })} /></Field>
              <Field id="rb-replay" label={t('learnHub.replayLink')}><Input id="rb-replay" type="url" className="field-input" placeholder="https://" value={draft.lesson.replay} onChange={e => patchLesson({ replay: e.target.value })} /></Field>
              <p className="field-hint">{t('resources.content.liveHint', { tz })}</p>
            </>}
          </>}

          {type === 'recipe' && <>
            <Field id="rb-prep" label={t('learnHub.prepLabel')}><Input id="rb-prep" type="number" min={1} max={600} className="field-input" value={draft.recipe.prep} onChange={e => patchRecipe({ prep: e.target.value })} /></Field>
            <div className="form-field"><span className="field-label">{t('learnHub.tagsLabel')}</span><div className="filter-chips">{RECIPE_TAGS.map(tag => { const on = draft.recipe.tags.includes(tag); return <button type="button" key={tag} className={`filter-chip ${on ? 'is-active' : ''}`} aria-pressed={on} onClick={() => patchRecipe({ tags: on ? draft.recipe.tags.filter(x => x !== tag) : [...draft.recipe.tags, tag] })}>{t(`learnHub.tags.${tag}`)}</button>; })}</div></div>
            <p className="field-hint">{t('learnHub.onePerLine')}</p>
            <Field id="rb-ing" label={`${t('learnHub.ingredients')} · ${lang.toUpperCase()}`}><textarea id="rb-ing" rows={5} className="field-textarea" value={lang === 'es' ? draft.recipe.ingEs : draft.recipe.ingEn} onChange={e => patchRecipe(lang === 'es' ? { ingEs: e.target.value } : { ingEn: e.target.value })} /></Field>
            <Field id="rb-steps" label={`${t('learnHub.steps')} · ${lang.toUpperCase()}`}><textarea id="rb-steps" rows={5} className="field-textarea" value={lang === 'es' ? draft.recipe.stepsEs : draft.recipe.stepsEn} onChange={e => patchRecipe(lang === 'es' ? { stepsEs: e.target.value } : { stepsEn: e.target.value })} /></Field>
          </>}

          {(type === 'file' || type === 'bundle') && <div className="form-field"><span className="field-label">{t('offers.file')}</span>
            <label className="file-button"><Upload />{draft.offer.filePath ? t('offers.replaceFile') : t('offers.uploadFile')}
              <input type="file" accept="application/pdf,.pdf,.epub,.zip" hidden onChange={e => { const x = e.target.files?.[0]; if (x) void uploadOfferFileAction(x); }} /></label>
            <p className="field-hint">{t('resources.content.fileHint')}</p>
            {busy && !draft.offer.filePath && <p className="field-hint" role="status">{t('learnHub.uploading')}</p>}
            {draft.offer.filePath && <small className="muted-small"><Check className="inline-icon" />{t('offers.fileAttached')}</small>}
            {type === 'bundle' && <p className="field-hint">{t('resources.preset.bundle.hint')}</p>}</div>}

          {type === 'course' && (loaded?.entity === 'offer' && courses.find(o => o.id === loaded.id)
            ? <CurriculumPanel offer={courses.find(o => o.id === loaded.id) as Offer} />
            : <p className="muted-small">{t('resources.item.curriculum.saveFirst')}</p>)}

          {!sections.includes('access') && type !== 'quiz' && activationField}
          {/* Promotional landing copy — public, separate from protected content. */}
          {type !== 'quiz' && <div className="form-field">
            <RichTextEditor id="rb-promo" label={`${t('resources.item.promoLabel')} · ${lang.toUpperCase()}`}
              value={lang === 'es' ? item.promoEs : item.promoEn}
              onChange={v => patchItem(lang === 'es' ? { promoEs: v } : { promoEn: v })} />
          </div>}
        </>}

        {/* ---- Access / Checkout ---- */}
        {section === 'access' && <>
          <ResourceAccessFields type={type} dest={dest} onDest={setDest} free={item.access.free} price={item.access.price}
            onAccess={(free, price) => patchItem({ access: { free, price } })} courses={courseOptions} ready={sellReady} prefix="rb" />
          {activationField}
          {paid && <RefundSelect id="rb-refund" value={refund} onChange={setRefund} />}
          {type === 'course' && <Field id="rb-drip" label={t('offers.drip')}><Input id="rb-drip" type="number" min={0} max={60} className="field-input" value={drip} onChange={e => setDrip(Math.max(0, Math.min(60, Number(e.target.value) || 0)))} /></Field>}
        </>}

        {/* ---- Options ---- */}

        {/* ---- Preview (all sizes; desktop also shows the aside) ---- */}
        {section === 'preview' && <section className="review-checklist" aria-labelledby="rb-ready-title">
          <h3 id="rb-ready-title">{t(canPublish ? 'resources.review.ready' : 'resources.review.notReady')}</h3>
          <dl className="review-rows">
            <div><dt>{t('resources.review.type')}</dt><dd>{t(`resources.create.types.${type}.name`)}</dd></div>
            <div><dt>{t('resources.review.titleRow')}</dt><dd>{pick(lang, item.titleEn, item.titleEs) || '—'}</dd></div>
            <div><dt>{t('resources.review.access')}</dt><dd>{paid ? (priceCents !== null && priceCents > 0 ? new Intl.NumberFormat(lang, { style: 'currency', currency: 'USD' }).format(priceCents / 100) : t('resources.review.paidNoPrice')) : t('offers.free')}{paidBlocked && <small className="muted-small"> {t('resources.review.paymentsPending')}</small>}</dd></div>
            <div><dt>{t('resources.review.languages')}</dt><dd>{[item.titleEn.trim() && 'English', item.titleEs.trim() && 'Español'].filter(Boolean).join(' · ') || '—'}{!!(item.titleEn.trim() || item.titleEs.trim()) && !(item.titleEn.trim() && item.titleEs.trim()) && <small className="muted-small"> {t('resources.review.oneLanguage')}</small>}</dd></div>
          </dl>
          {[...new Set(issues)].length > 0 && <ul className="review-fix-list">{[...new Set(issues)].map(i => <li key={i}>
            <span>{t(`resources.item.issue.${i}`)}</span>
            <Button variant="secondary" size="sm" onClick={() => { const step = RESOURCE_FIX_STEP[i]; if (step && sections.includes(step as ItemSection)) goStep(step as ItemSection); requestAnimationFrame(() => focusField(RESOURCE_FIELD[i] ?? 'rb-step-heading')); }}
              aria-label={`${t('resources.review.fix')}: ${t(`resources.item.issue.${i}`)}`}>{t('resources.review.fix')}</Button>
          </li>)}</ul>}
        </section>}
        {section === 'preview' && <div className="item-preview-mobile">{preview}</div>}

        {placeholder && <p className="field-hint" role="alert">{t('resources.item.placeholderBlock')}{lessonsWithPlaceholders.length > 0 && ` ${t('resources.item.placeholderLessons', { names: lessonsWithPlaceholders.map(l => pick(lang, l.title_en, l.title_es)).join(', ') })}`}</p>}
        {section === 'preview' && issues.length > 0 && <p className="field-hint" role="alert">{t('resources.item.issues', { fields: issues.map(i => t(`resources.item.issue.${i}`)).join(', ') })}</p>}

        <BuilderStepFooter
          onBack={nav.prev ? () => goStep(nav.prev!) : undefined}
          onSave={() => void save(false)} saveDisabled={!canSave} saving={busy}
          onNext={nav.next ? () => goStep(nav.next!) : undefined}
          blockers={stepIssues.map(i => t(`resources.item.issue.${i}`))}
          onBlocked={() => focusField(RESOURCE_FIELD[stepIssues[0]!] ?? 'rb-step-heading')}
          final={<Button className="onboarding-continue builder-footer-primary" disabled={!canPublish} aria-busy={busy} onClick={() => void save(true)}
            title={paidBlocked ? t('resources.item.paidBlocked') : undefined}>
            {busy ? t('onboarding.saving') : t(wasPublished ? 'resources.item.update' : 'offers.publish')}
          </Button>} />
      </section>

      <aside className="item-preview-aside" aria-label={t('resources.item.previewTitle')}>
        <span className="eyebrow"><Eye aria-hidden="true" /> {t('resources.item.previewTitle')}</span>
        {preview}
      </aside>
    </div>
  </>;
}
