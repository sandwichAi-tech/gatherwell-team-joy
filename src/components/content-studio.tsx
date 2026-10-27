import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Copy, ExternalLink, Pencil, Plus, Trash2, Upload } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { confirmAction } from '@/components/confirm-dialog';
import { EmptyState, ListSkeleton } from '@/components/launch-states';
import { supabase } from '@/integrations/supabase/client';
import { bundleAccessQuery, bundleItemsQuery, duplicateOffer, grantOfferAccess, isHttpsUrl, lessonFileError, offerReadinessQuery, replaceOfferItem, LESSON_FILE_RULES, type BundleItem } from '@/lib/content';
import { offerItemDownloadLink } from '@/lib/offers.functions';
import { learnPathsForTracks, learnPathsOf, lessonTitle, pick, removeUnusedLearnFiles, trackTitle, uploadLearnFile, type Lesson, type Track } from '@/lib/learn';
import { formatMoney } from '@/lib/billing';
import { platformFeeCents } from '@/lib/fees';
import type { Offer } from '@/lib/offers';
import { reorderedIds, safeExternalUrl } from '@/lib/wellness-assessment';
import { WellnessAssessmentBuilder } from '@/components/wellness-assessment-builder';

const db = supabase as unknown as { from: (t: string) => any };

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="form-field"><label className="field-label" htmlFor={id}>{label}</label>{children}</div>;
}

/* ---------- Readiness panel: truthful blockers before publishing ---------- */
export function ReadinessPanel({ offerId, onEdit }: { offerId: string; onEdit: () => void }) {
  const { t } = useTranslation();
  const { data } = useQuery(offerReadinessQuery(offerId));
  if (!data) return null;
  const blockers = data.blockers.filter(b => b !== 'paid_setup_required');
  const paidNote = data.blockers.includes('paid_setup_required');
  return <section className="panel readiness-panel" aria-live="polite">
    <h2>{t('content.readiness')}</h2>
    {blockers.length === 0 ? <p className="muted-small"><span className="inline-ok" />{t('content.readyToPublish')}</p> :
      <ul className="blocker-list">{blockers.map(b => <li key={b}><button type="button" className="text-link" onClick={onEdit}>{t(`content.blocker.${b}`)}</button></li>)}</ul>}
    {paidNote && <p className="muted-small">{t('content.blocker.paid_setup_required')}</p>}
  </section>;
}

/* ---------- Extended details: visibility, enrollment window, metadata, license ---------- */
export function OfferDetailsEditor({ offer, onClose }: { offer: Offer | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const blank = { summary_en: '', summary_es: '', category: '', tags: '', support_email: '', accessibility_notes: '', coauthor_name: '', version_label: '', license_en: '', license_es: '', visibility: 'team', enroll_opens: '', enroll_closes: '', billing_interval: '' };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!offer) return;
    const o: any = offer;
    const local = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };
    setF({ summary_en: o.summary_en ?? '', summary_es: o.summary_es ?? '', category: o.category ?? '', tags: (o.tags ?? []).join(', '), support_email: o.support_email ?? '',
      accessibility_notes: o.accessibility_notes ?? '', coauthor_name: o.coauthor_name ?? '', version_label: o.version_label ?? '', license_en: o.license_en ?? '', license_es: o.license_es ?? '',
      visibility: o.visibility ?? 'team', enroll_opens: local(o.enroll_opens_at), enroll_closes: local(o.enroll_closes_at), billing_interval: o.billing_interval ?? '' });
  }, [offer]);
  if (!offer) return null;
  const emailOk = !f.support_email.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.support_email.trim());
  const windowOk = !f.enroll_opens || !f.enroll_closes || new Date(f.enroll_opens) < new Date(f.enroll_closes);
  const save = async () => {
    setBusy(true);
    const row = { summary_en: f.summary_en.trim() || null, summary_es: f.summary_es.trim() || null, category: f.category.trim() || null,
      tags: f.tags.split(',').map(x => x.trim().toLowerCase()).filter(Boolean).slice(0, 8), support_email: f.support_email.trim() || null,
      accessibility_notes: f.accessibility_notes.trim() || null, coauthor_name: f.coauthor_name.trim() || null, version_label: f.version_label.trim() || null,
      license_en: f.license_en.trim() || null, license_es: f.license_es.trim() || null, visibility: f.visibility,
      enroll_opens_at: f.enroll_opens ? new Date(f.enroll_opens).toISOString() : null, enroll_closes_at: f.enroll_closes ? new Date(f.enroll_closes).toISOString() : null,
      billing_interval: f.billing_interval || null };
    const res = await db.from('offers').update(row).eq('id', offer.id);
    setBusy(false);
    if (res.error) { toast.error(t('offers.saveError')); return; }
    toast.success(t('templates.saved'));
    await qc.invalidateQueries({ queryKey: ['offers'] });
    await qc.invalidateQueries({ queryKey: ['offer-readiness', offer.id] });
    onClose();
  };
  return <ResponsiveSheet open={!!offer} onOpenChange={o => !o && onClose()} title={t('content.details')}>
    <div className="edit-form">
      <div className="bilingual">
        {Field({ id: 'cd-sen', label: `${t('content.summary')} · EN`, children: <Input id="cd-sen" className="field-input" maxLength={200} value={f.summary_en} onChange={e => setF({ ...f, summary_en: e.target.value })} /> })}
        {Field({ id: 'cd-ses', label: `${t('content.summary')} · ES`, children: <Input id="cd-ses" className="field-input" maxLength={200} value={f.summary_es} onChange={e => setF({ ...f, summary_es: e.target.value })} /> })}
      </div>
      <div className="form-field"><span className="field-label">{t('content.visibility')}</span>
        <div className="choice-pair" role="group" aria-label={t('content.visibility')}>
          {(['team', 'public', 'unlisted', 'private'] as const).map(v => <button key={v} type="button" className={`choice-card ${f.visibility === v ? 'is-selected' : ''}`} aria-pressed={f.visibility === v} onClick={() => setF({ ...f, visibility: v })}><strong>{t(`content.visibility.${v}`)}</strong><small>{t(`content.visibilityText.${v}`)}</small></button>)}
        </div></div>
      <div className="bilingual">
        {Field({ id: 'cd-Open', label: t('content.enrollOpens'), children: <Input id="cd-Open" type="datetime-local" className="field-input" value={f.enroll_opens} onChange={e => setF({ ...f, enroll_opens: e.target.value })} /> })}
        {Field({ id: 'cd-Close', label: t('content.enrollCloses'), children: <Input id="cd-Close" type="datetime-local" className="field-input" value={f.enroll_closes} onChange={e => setF({ ...f, enroll_closes: e.target.value })} /> })}
      </div>
      {!windowOk && <p className="field-error" role="alert">{t('content.windowOrder')}</p>}
      <div className="bilingual">
        {Field({ id: 'cd-cat', label: t('content.category'), children: <Input id="cd-cat" className="field-input" maxLength={60} value={f.category} onChange={e => setF({ ...f, category: e.target.value })} /> })}
        {Field({ id: 'cd-tags', label: t('content.tags'), children: <Input id="cd-tags" className="field-input" maxLength={120} placeholder={t('content.tagsPlaceholder')} value={f.tags} onChange={e => setF({ ...f, tags: e.target.value })} /> })}
      </div>
      {Field({ id: 'cd-co', label: t('content.coauthor'), children: <Input id="cd-co" className="field-input" maxLength={120} value={f.coauthor_name} onChange={e => setF({ ...f, coauthor_name: e.target.value })} /> })}
      {Field({ id: 'cd-sup', label: t('content.supportEmail'), children: <Input id="cd-sup" type="email" className="field-input" maxLength={200} value={f.support_email} onChange={e => setF({ ...f, support_email: e.target.value })} /> })}
      {!emailOk && <p className="field-error" role="alert">{t('content.badEmail')}</p>}
      {Field({ id: 'cd-acc', label: t('content.accessibility'), children: <Textarea id="cd-acc" rows={2} className="field-textarea" maxLength={500} value={f.accessibility_notes} onChange={e => setF({ ...f, accessibility_notes: e.target.value })} /> })}
      {offer.kind === 'download' && <>
        {Field({ id: 'cd-ver', label: t('content.versionLabel'), children: <Input id="cd-ver" className="field-input" maxLength={40} value={f.version_label} onChange={e => setF({ ...f, version_label: e.target.value })} /> })}
        <div className="bilingual">
          {Field({ id: 'cd-len', label: `${t('content.license')} · EN`, children: <Textarea id="cd-len" rows={2} className="field-textarea" maxLength={800} value={f.license_en} onChange={e => setF({ ...f, license_en: e.target.value })} /> })}
          {Field({ id: 'cd-les', label: `${t('content.license')} · ES`, children: <Textarea id="cd-les" rows={2} className="field-textarea" maxLength={800} value={f.license_es} onChange={e => setF({ ...f, license_es: e.target.value })} /> })}
        </div></>}
      {(offer.price_cents ?? 0) > 0 && <div className="form-field"><span className="field-label">{t('content.billingInterval')}</span>
        <div className="choice-pair" role="group" aria-label={t('content.billingInterval')}>
          {([['', 'oneTime'], ['month', 'monthly'], ['year', 'yearly']] as const).map(([v, k]) => <button key={k} type="button" className={`choice-card ${f.billing_interval === v ? 'is-selected' : ''}`} aria-pressed={f.billing_interval === v} onClick={() => setF({ ...f, billing_interval: v })}><strong>{t(`content.${k}`)}</strong></button>)}
        </div>
        <p className="muted-small">{t('content.feeEstimate', { fee: formatMoney(platformFeeCents(offer.price_cents ?? 0), 'en'), price: formatMoney(offer.price_cents ?? 0, 'en') })}</p>
        <p className="muted-small">{t('content.feeSeparate')}</p></div>}
      <Button className="onboarding-continue" disabled={busy || !emailOk || !windowOk} onClick={save}>{busy ? t('onboarding.saving') : t('profile.save')}</Button>
    </div>
  </ResponsiveSheet>;
}

/* ---------- Duplicate + manual grant actions ---------- */
export function OfferHostActions({ offer, onChanged }: { offer: Offer; onChanged: () => void }) {
  const { t } = useTranslation(); const navigate = useNavigate();
  const [grantOpen, setGrantOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const duplicate = async () => {
    if (busy) return;
    setBusy(true);
    if (!(await confirmAction({ title: t('content.confirmDuplicate') }))) { setBusy(false); return; }
    const { data: copyId, error } = await duplicateOffer(offer.id);
    setBusy(false);
    if (error) { toast.error(t('offers.saveError')); return; }
    toast.success(t('content.duplicated'));
    onChanged();
    // Open the new draft copy so the coach edits the copy, never the original by mistake.
    if (typeof copyId === 'string') void navigate({ to: '/offer/$id', params: { id: copyId } });
  };
  const grant = async () => {
    setBusy(true);
    const { data, error } = await grantOfferAccess(offer.id, email.trim());
    setBusy(false);
    if (error || data === 'no_account') { toast.error(t('content.grantNoAccount')); return; }
    toast.success(t(data === 'already' ? 'content.grantAlready' : 'content.granted'));
    setGrantOpen(false); setEmail('');
  };
  return <div className="offer-host-actions">
    <Button variant="secondary" size="sm" disabled={busy} onClick={duplicate}><Copy />{t('content.duplicate')}</Button>
    <Button variant="secondary" size="sm" onClick={() => setGrantOpen(true)}><Plus />{t('content.grantAccess')}</Button>
    <ResponsiveSheet open={grantOpen} onOpenChange={o => !o && setGrantOpen(false)} title={t('content.grantAccess')} description={t('content.grantText')}>
      <div className="edit-form">
        {Field({ id: 'grant-email', label: t('content.grantEmail'), children: <Input id="grant-email" type="email" className="field-input" value={email} onChange={e => setEmail(e.target.value)} /> })}
        <Button className="onboarding-continue" disabled={busy || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())} onClick={grant}>{busy ? t('onboarding.saving') : t('content.grantSubmit')}</Button>
      </div>
    </ResponsiveSheet>
  </div>;
}

/* ---------- Curriculum builder: sections + lessons for one offer ---------- */
type LessonRow = Lesson & { description_en?: string | null; description_es?: string | null; is_preview?: boolean; is_published?: boolean; prerequisite_lesson_id?: string | null; attachments?: { name: string; path: string }[]; event_id?: string | null };

const LESSON_TYPES = ['video', 'audio', 'text', 'pdf', 'file', 'link', 'live'] as const;

export function CurriculumPanel({ offer }: { offer: Offer }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const qc = useQueryClient();
  const [section, setSection] = useState<Partial<Track> | null>(null);
  const [lesson, setLesson] = useState<(Partial<LessonRow> & { track_id: string }) | null>(null);
  const [ordering, setOrdering] = useState(false);
  const q = useQuery({
    queryKey: ['curriculum', offer.id],
    queryFn: async () => {
      const { data: tracks, error } = await db.from('tracks').select('*').eq('offer_id', offer.id).order('sort_order');
      if (error) throw error;
      const ids = (tracks ?? []).map((tr: Track) => tr.id);
      const { data: lessons } = ids.length ? await db.from('lessons').select('*').in('track_id', ids).order('sort_order') : { data: [] };
      return { tracks: (tracks ?? []) as Track[], lessons: (lessons ?? []) as LessonRow[] };
    },
  });
  const moveSection = async (tr: Track, dir: -1 | 1) => {
    const list = [...(q.data?.tracks ?? [])];
    const i = list.findIndex(x => x.id === tr.id); const j = i + dir;
    if (j < 0 || j >= list.length) return;
    if (ordering) return; setOrdering(true);
    const { error } = await supabase.rpc('reorder_course_curriculum', { _course: offer.id, _track: null, _ids: reorderedIds(list, i, dir) } as never);
    setOrdering(false); if (error) toast.error(t('profile.saveError'));
    await qc.invalidateQueries({ queryKey: ['curriculum', offer.id] });
  };
  if (q.isPending) return <ListSkeleton />;
  const tracks = q.data?.tracks ?? [];
  const lessons = q.data?.lessons ?? [];
  return <section className="panel curriculum">
    <div className="section-heading"><div><h2>{t('content.curriculum')}</h2><p className="muted-small">{t('content.curriculumText')}</p></div>
      <Button variant="secondary" onClick={() => setSection({ cover_style: tracks.length % 6 })}><Plus />{t('content.addSection')}</Button></div>
    {tracks.length === 0 ? <EmptyState compact icon="BookOpen" text={t('content.noSections')} /> :
      <div className="manage-tracks">{tracks.map((tr, i) => <article key={tr.id} className="manage-track">
        <div className="manage-track-head">
          <div className="order-title"><strong>{trackTitle(tr, lang) || t('content.untitledSection')}</strong><small>{tr.is_published ? t('templates.published') : t('templates.draft')}</small></div>
          <div className="row-actions">
            <Button variant="ghost" size="icon" disabled={ordering || i === 0} aria-label={t('templates.moveUp')} onClick={() => moveSection(tr, -1)}><ArrowUp /></Button>
            <Button variant="ghost" size="icon" disabled={ordering || i === tracks.length - 1} aria-label={t('templates.moveDown')} onClick={() => moveSection(tr, 1)}><ArrowDown /></Button>
            <Button variant="secondary" size="sm" onClick={() => setSection(tr)}><Pencil />{t('templates.edit')}</Button>
          </div></div>
        <LessonList track={tr} lessons={lessons.filter(l => l.track_id === tr.id)} offer={offer} onEdit={l => setLesson(l)} onChanged={() => void qc.invalidateQueries({ queryKey: ['curriculum', offer.id] })} />
      </article>)}</div>}
    <SectionEditor section={section} offer={offer} onClose={() => setSection(null)} />
    <CourseLessonEditor lesson={lesson} offer={offer} siblings={lessons} onClose={() => setLesson(null)} />
  </section>;
}

function SectionEditor({ section, offer, onClose }: { section: Partial<Track> | null; offer: Offer; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const qc = useQueryClient();
  const [f, setF] = useState({ title_en: '', title_es: '', description_en: '', description_es: '', is_published: false });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (section) setF({ title_en: section.title_en ?? '', title_es: section.title_es ?? '', description_en: section.description_en ?? '', description_es: section.description_es ?? '', is_published: !!section.is_published }); }, [section]);
  const ok = !!(f.title_en.trim() || f.title_es.trim());
  const save = async () => {
    setBusy(true);
    const row = { title_en: f.title_en.trim(), title_es: f.title_es.trim(), description_en: f.description_en.trim() || null, description_es: f.description_es.trim() || null, is_published: f.is_published };
    const res = section?.id ? await db.from('tracks').update(row).eq('id', section.id) : await db.from('tracks').insert({ ...row, team_id: offer.team_id, offer_id: offer.id, sort_order: Date.now() % 1_000_000, cover_style: 0 });
    setBusy(false);
    if (res.error) { toast.error(t('profile.saveError')); return; }
    toast.success(t('templates.saved'));
    await qc.invalidateQueries({ queryKey: ['curriculum', offer.id] });
    await qc.invalidateQueries({ queryKey: ['offer-readiness', offer.id] });
    onClose();
  };
  const remove = async () => {
    if (!section?.id || !(await confirmAction({ title: t('learnHub.confirmDeleteTrack'), destructive: true }))) return;
    const files = await learnPathsForTracks([section.id]);
    await db.from('lessons').delete().eq('track_id', section.id);
    const res = await db.from('tracks').delete().eq('id', section.id);
    if (res.error) { toast.error(t('profile.saveError')); return; }
    void removeUnusedLearnFiles(files);
    await qc.invalidateQueries({ queryKey: ['curriculum', offer.id] });
    onClose();
  };
  return <ResponsiveSheet open={!!section} onOpenChange={o => !o && onClose()} title={section?.id ? t('content.editSection') : t('content.addSection')}>
    <div className="edit-form">
      <div className="form-field"><label className="field-label" htmlFor="sec-active">{t('templates.title')}</label><Input id="sec-active" className="field-input" maxLength={120} value={lang === 'es' ? f.title_es : f.title_en} onChange={e => setF({ ...f, [lang === 'es' ? 'title_es' : 'title_en']: e.target.value })} /></div>
      <div className="form-field"><label className="field-label" htmlFor="sec-d-active">{t('templates.description')}</label><Textarea id="sec-d-active" rows={2} className="field-textarea" maxLength={1000} value={lang === 'es' ? f.description_es : f.description_en} onChange={e => setF({ ...f, [lang === 'es' ? 'description_es' : 'description_en']: e.target.value })} /></div>
      <label className="switch-row"><Switch checked={f.is_published} onCheckedChange={v => setF({ ...f, is_published: v })} /><span><strong>{t('content.publishSection')}</strong><small>{t('content.publishSectionText')}</small></span></label>
      <Button className="onboarding-continue" disabled={busy || !ok} onClick={save}>{busy ? t('onboarding.saving') : t('profile.save')}</Button>
      {section?.id && <Button variant="ghost" className="danger-link" onClick={remove}><Trash2 />{t('learnHub.deleteTrack')}</Button>}
    </div>
  </ResponsiveSheet>;
}

function LessonList({ track, lessons, offer, onEdit, onChanged }: { track: Track; lessons: LessonRow[]; offer: Offer; onEdit: (l: Partial<LessonRow> & { track_id: string }) => void; onChanged: () => void }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [ordering, setOrdering] = useState(false);
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [quizTitle, setQuizTitle] = useState<string | null>(null);
  const navigate = useNavigate();
  const addQuiz = async () => {
    if (!quizTitle?.trim() || ordering) return; setOrdering(true);
    const { data, error } = await supabase.rpc('create_course_quiz_item', { _track: track.id, _title: quizTitle.trim(), _language: i18n.resolvedLanguage === 'es' ? 'es' : 'en' });
    setOrdering(false); if (error) { toast.error(t('profile.saveError')); return; }
    const q = data as { id: string }; void navigate({ to: '/learn/quiz/$id', params: { id: q.id } });
  };
  const move = async (l: LessonRow, dir: -1 | 1) => {
    const i = lessons.findIndex(x => x.id === l.id); const j = i + dir;
    if (j < 0 || j >= lessons.length) return;
    if (ordering) return; setOrdering(true);
    const { error } = await supabase.rpc('reorder_course_curriculum', { _course: offer.id, _track: track.id, _ids: reorderedIds(lessons, i, dir) });
    setOrdering(false); if (error) toast.error(t('profile.saveError'));
    await qc.invalidateQueries({ queryKey: ['curriculum', offer.id] });
    onChanged();
  };
  return <div className="lesson-manage">
    {lessons.length > 0 && <ol className="order-list">{lessons.map((l, i) => <li key={l.id}>
      <span className="order-title"><strong>{lessonTitle(l, i18n.resolvedLanguage)}</strong>
        <small>{[t(`learnHub.type.${l.type}`), l.is_published === false ? t('templates.draft') : null, l.is_preview ? t('content.previewBadge') : null].filter(Boolean).join(' · ')}</small></span>
      <Button variant="ghost" size="icon" disabled={ordering || i === 0} aria-label={t('templates.moveUp')} onClick={() => move(l, -1)}><ArrowUp /></Button>
      <Button variant="ghost" size="icon" disabled={ordering || i === lessons.length - 1} aria-label={t('templates.moveDown')} onClick={() => move(l, 1)}><ArrowDown /></Button>
      <Button variant="ghost" size="icon" aria-label={t('templates.edit')} onClick={() => onEdit(l)}><Pencil /></Button></li>)}</ol>}
    <div className="lesson-add"><Button variant="secondary" onClick={() => onEdit({ track_id: track.id, type: 'text', is_published: false })}><Plus />{t('content.addLesson')}</Button><Button variant="secondary" onClick={() => onEdit({ track_id: track.id, type: 'link', is_published: false })}><Plus />{t('resources.create.types.link.name')}</Button><Button variant="secondary" onClick={() => setQuizTitle('')}><Plus />{t('resources.create.types.quiz.name')}</Button><Button variant="secondary" onClick={() => setAssessmentOpen(true)}><Plus />{t('resources.create.types.assessment.name')}</Button></div>
    {quizTitle !== null && <ResponsiveSheet open onOpenChange={o => !o && setQuizTitle(null)} title={t('resources.create.types.quiz.name')} footer={<Button disabled={ordering || !quizTitle.trim()} onClick={() => void addQuiz()}>{t('common.save')}</Button>}><Input aria-label={t('templates.title')} value={quizTitle} maxLength={160} onChange={e => setQuizTitle(e.target.value)} /></ResponsiveSheet>}
    {assessmentOpen && <ResponsiveSheet open onOpenChange={o => !o && setAssessmentOpen(false)} title={t('resources.create.types.assessment.name')}><WellnessAssessmentBuilder course={offer.id} /></ResponsiveSheet>}
  </div>;
}

function CourseLessonEditor({ lesson, offer, siblings, onClose }: { lesson: (Partial<LessonRow> & { track_id: string }) | null; offer: Offer; siblings: LessonRow[]; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const qc = useQueryClient();
  const empty = { title_en: '', title_es: '', type: 'text' as string, url: '', description_en: '', description_es: '', duration: '', is_preview: false, is_published: false, prerequisite: '', notes_en: '', notes_es: '', event_id: '', live: '' };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const { data: events = [] } = useQuery({
    queryKey: ['team-events', offer.team_id],
    queryFn: async () => (await db.from('events').select('id, title, starts_at').eq('team_id', offer.team_id).eq('status', 'published').order('starts_at').limit(50)).data ?? [],
  });
  useEffect(() => {
    if (!lesson) return;
    setF({ title_en: lesson.title_en ?? '', title_es: lesson.title_es ?? '', type: lesson.type ?? 'text', url: lesson.url ?? '', description_en: lesson.description_en ?? '', description_es: lesson.description_es ?? '',
      duration: lesson.duration_minutes ? String(lesson.duration_minutes) : '', is_preview: !!lesson.is_preview, is_published: lesson.is_published ?? false, prerequisite: lesson.prerequisite_lesson_id ?? '',
      notes_en: '', notes_es: '', event_id: lesson.event_id ?? '', live: '' });
    setStoragePath(lesson.storage_path ?? null); setFileName('');
    if (lesson.id) void db.from('lesson_instructor_notes').select('notes_en, notes_es').eq('lesson_id', lesson.id).maybeSingle().then(({ data }: any) => { if (data) setF(x => ({ ...x, notes_en: data.notes_en ?? '', notes_es: data.notes_es ?? '' })); });
  }, [lesson]);
  if (!lesson) return null;
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const needsFile = f.type === 'video' || f.type === 'audio' || f.type === 'pdf' || f.type === 'file';
  const urlOk = !f.url || safeExternalUrl(f.url);
  const ok = !!(f.title_en.trim() || f.title_es.trim()) && urlOk && (f.type !== 'link' || !!f.url.trim()) && (f.type !== 'live' || !!f.event_id);
  const upload = async (file: File) => {
    const err = lessonFileError(f.type, file);
    if (err) { toast.error(t(err === 'too_large' ? 'learnHub.tooLarge' : 'content.badFileType')); return; }
    setBusy(true); setFileName(file.name);
    try { setStoragePath(await uploadLearnFile(offer.team_id, file, () => {})); toast.success(t('learnHub.uploaded')); }
    catch { toast.error(t('offers.uploadError')); setFileName(''); }
    setBusy(false);
  };
  const save = async () => {
    setBusy(true);
    try {
      // An uploaded file replaces any earlier link, so a stale example URL never lingers behind it.
      const row = { title_en: f.title_en.trim(), title_es: f.title_es.trim(), type: f.type, url: needsFile && storagePath ? null : f.url.trim() || null, storage_path: needsFile ? storagePath : null,
        description_en: f.description_en.trim() || null, description_es: f.description_es.trim() || null,
        duration_minutes: parseInt(f.duration, 10) > 0 ? Math.min(600, parseInt(f.duration, 10)) : null,
        is_preview: f.is_preview, is_published: f.is_published, prerequisite_lesson_id: f.prerequisite || null, event_id: f.type === 'live' && f.event_id ? f.event_id : null };
      let id = lesson.id;
      if (id) { const r = await db.from('lessons').update(row).eq('id', id); if (r.error) throw r.error; }
      else { const r = await db.from('lessons').insert({ ...row, track_id: lesson.track_id, sort_order: Date.now() % 1_000_000 }).select('id').single(); if (r.error) throw r.error; id = r.data.id; }
      const notes = { notes_en: f.notes_en.trim() || null, notes_es: f.notes_es.trim() || null, updated_at: new Date().toISOString() };
      const nr = (notes.notes_en || notes.notes_es) ? await db.from('lesson_instructor_notes').upsert({ lesson_id: id, ...notes }) : await db.from('lesson_instructor_notes').delete().eq('lesson_id', id);
      if (nr.error) throw nr.error;
      toast.success(t('templates.saved'));
      await qc.invalidateQueries({ queryKey: ['curriculum', offer.id] });
      await qc.invalidateQueries({ queryKey: ['offer-readiness', offer.id] });
      onClose();
    } catch { toast.error(t('profile.saveError')); }
    setBusy(false);
  };
  const remove = async () => {
    if (!lesson?.id || !(await confirmAction({ title: t('learnHub.confirmDeleteLesson'), destructive: true }))) return;
    const files = learnPathsOf([lesson as never]);
    const r = await db.from('lessons').delete().eq('id', lesson.id);
    if (r.error) { toast.error(t('profile.saveError')); return; }
    void removeUnusedLearnFiles(files);
    await qc.invalidateQueries({ queryKey: ['curriculum', offer.id] });
    onClose();
  };
  const prereqOptions = siblings.filter(s => s.track_id === lesson.track_id && s.id !== lesson.id);
  return <ResponsiveSheet open={!!lesson} onOpenChange={o => !o && onClose()} title={lesson?.id ? t('learnHub.editLesson') : t('content.addLesson')}>
    <div className="edit-form">
      <div className="form-field"><label className="field-label" htmlFor="cl-active">{t('templates.title')}</label><Input id="cl-active" className="field-input" maxLength={140} value={lang === 'es' ? f.title_es : f.title_en} onChange={e => setF({ ...f, [lang === 'es' ? 'title_es' : 'title_en']: e.target.value })} /></div>
      <div className="form-field"><span className="field-label">{t('learnHub.lessonType')}</span>
        <div className="type-choices" role="group" aria-label={t('learnHub.lessonType')}>{LESSON_TYPES.map(ty => <Button variant="secondary" type="button" key={ty} className={`choice-card ${f.type === ty ? 'is-selected' : ''}`} aria-pressed={f.type === ty} onClick={() => setF({ ...f, type: ty })}><strong>{t(`learnHub.type.${ty}`)}</strong></Button>)}</div></div>
      {needsFile && <div className="form-field"><span className="field-label">{t(`learnHub.type.${f.type}`)}</span>
        <label className="file-button"><Upload />{t('learnHub.chooseFile')}<input type="file" accept={LESSON_FILE_RULES[f.type]?.accept} hidden onChange={e => { const x = e.target.files?.[0]; if (x) void upload(x); }} /></label>
        {(storagePath || fileName) && <p className="field-hint">{t('learnHub.fileAttached')} {fileName}<button type="button" className="text-link" onClick={() => { setStoragePath(null); setFileName(''); }}>{t('learnHub.removeFile')}</button></p>}
        <p className="field-hint">{t('content.embedOrFile')}</p></div>}
      {(f.type === 'video' || f.type === 'audio' || f.type === 'link') && !storagePath && <>
        {Field({ id: 'cl-url', label: t(f.type === 'link' ? 'learnHub.link' : 'learnHub.videoLink'), children: <Input id="cl-url" type="url" className="field-input" placeholder="https://" value={f.url} onChange={set('url')} /> })}
        {!urlOk && <p className="field-error" role="alert">{t('content.httpsOnly')}</p>}
        {f.type !== 'link' && f.url && <p className="field-hint">{t('content.embedNote')}</p>}</>}
      {f.type === 'live' && <div className="form-field"><label className="field-label" htmlFor="cl-event">{t('content.linkedEvent')}</label>
        <select id="cl-event" className="field-input" value={f.event_id} onChange={e => setF({ ...f, event_id: e.target.value })}>
          <option value="">{t('content.chooseEvent')}</option>
          {events.map((ev: { id: string; title: string }) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
        </select></div>}
      <div className="form-field"><label className="field-label" htmlFor="cl-d-active">{t('content.lessonDescription')}</label><Textarea id="cl-d-active" rows={3} className="field-textarea" maxLength={4000} value={lang === 'es' ? f.description_es : f.description_en} onChange={e => setF({ ...f, [lang === 'es' ? 'description_es' : 'description_en']: e.target.value })} /></div>
      {Field({ id: 'cl-dur', label: t('learnHub.duration'), children: <Input id="cl-dur" type="number" min={1} max={600} className="field-input" value={f.duration} onChange={set('duration')} /> })}
      {prereqOptions.length > 0 && <div className="form-field"><label className="field-label" htmlFor="cl-pre">{t('content.prerequisite')}</label>
        <select id="cl-pre" className="field-input" value={f.prerequisite} onChange={e => setF({ ...f, prerequisite: e.target.value })}>
          <option value="">{t('content.noPrerequisite')}</option>
          {prereqOptions.map(s => <option key={s.id} value={s.id}>{lessonTitle(s, lang)}</option>)}
        </select></div>}
      <label className="switch-row"><Switch checked={f.is_preview} onCheckedChange={v => setF({ ...f, is_preview: v })} /><span><strong>{t('content.previewLesson')}</strong><small>{t('content.previewLessonText')}</small></span></label>
      <label className="switch-row"><Switch checked={f.is_published} onCheckedChange={v => setF({ ...f, is_published: v })} /><span><strong>{t('content.publishLesson')}</strong><small>{t('content.publishLessonText')}</small></span></label>
      <div className="form-field"><label className="field-label" htmlFor="cl-n-active">{t('content.instructorNotes')}</label><Textarea id="cl-n-active" rows={2} className="field-textarea" maxLength={2000} value={lang === 'es' ? f.notes_es : f.notes_en} onChange={e => setF({ ...f, [lang === 'es' ? 'notes_es' : 'notes_en']: e.target.value })} /></div>
      <p className="field-hint">{t('content.instructorNotesHint')}</p>
      <Button className="onboarding-continue" disabled={busy || !ok} onClick={save}>{busy ? t('onboarding.saving') : t('profile.save')}</Button>
      {lesson?.id && <Button variant="ghost" className="danger-link" onClick={remove}><Trash2 />{t('learnHub.deleteLesson')}</Button>}
    </div>
  </ResponsiveSheet>;
}

/** Public page link chip for hosts (copy/open the shareable page). */
export function PublicOfferLink({ id }: { id: string }) {
  const { t } = useTranslation();
  return <Button asChild variant="ghost" size="sm"><Link to="/o/$id" params={{ id }} target="_blank"><ExternalLink />{t('content.viewPublicPage')}</Link></Button>;
}

/* ---------- Resource bundle: ordered items with version-safe replace ---------- */
export function BundlePanel({ offer }: { offer: Offer }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery(bundleItemsQuery(offer.id));
  const [edit, setEdit] = useState<BundleItem | 'new' | null>(null);
  const [replacing, setReplacing] = useState<BundleItem | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['bundle-items', offer.id] });

  const move = async (i: number, dir: -1 | 1) => {
    const a = items[i], b = items[i + dir];
    if (!a || !b) return;
    await db.from('offer_items').update({ sort_order: b.sort_order }).eq('id', a.id);
    await db.from('offer_items').update({ sort_order: a.sort_order }).eq('id', b.id);
    await refresh();
  };
  const remove = async (item: BundleItem) => {
    if (item.is_published) { toast.error(t('content.removeDraftOnly')); return; }
    if (!(await confirmAction({ title: t('content.confirmRemoveItem'), destructive: true }))) return;
    await db.from('offer_items').delete().eq('id', item.id);
    await refresh();
  };
  const togglePublish = async (item: BundleItem) => {
    await db.from('offer_items').update({ is_published: !item.is_published }).eq('id', item.id);
    await refresh();
    void qc.invalidateQueries({ queryKey: ['offer-readiness', offer.id] });
  };

  return <section className="panel">
    <div className="section-heading"><h2>{t('content.bundle')}</h2><Button size="sm" onClick={() => setEdit('new')}><Plus />{t('content.addItem')}</Button></div>
    <p className="muted-small">{t('content.bundleText')}</p>
    {isLoading ? <ListSkeleton /> : items.length === 0 ? <EmptyState icon="FileText" title={t('content.noItems')} text={t('content.noItemsText')} /> :
      <ol className="lesson-list">{items.map((item, i) => <li key={item.id} className="lesson-row">
        <div className="row-actions" role="group" aria-label={t('content.reorder')}>
          <button type="button" className="icon-btn" disabled={i === 0} aria-label={t('content.moveUp')} onClick={() => void move(i, -1)}><ArrowUp /></button>
          <button type="button" className="icon-btn" disabled={i === items.length - 1} aria-label={t('content.moveDown')} onClick={() => void move(i, 1)}><ArrowDown /></button>
        </div>
        <div className="lesson-row-main">
          <strong>{pick(lang, item.title_en, item.title_es) || t('content.untitledItem')}</strong>
          <small>{t(`content.itemType.${item.type}`)}{item.is_preview ? ` · ${t('content.previewBadge')}` : ''}{!item.allow_download ? ` · ${t('content.noDownload')}` : ''}{!item.is_published ? ` · ${t('offers.status.draft')}` : ''}</small>
        </div>
        <div className="row-actions">
          <button type="button" className="icon-btn" aria-label={t('content.editItem')} onClick={() => setEdit(item)}><Pencil /></button>
          <button type="button" className="icon-btn" aria-label={t('content.replaceItem')} onClick={() => setReplacing(item)}><Copy /></button>
          <button type="button" className="icon-btn" aria-label={t('content.removeItem')} onClick={() => void remove(item)}><Trash2 /></button>
          <button type="button" className="text-link" onClick={() => void togglePublish(item)}>{t(item.is_published ? 'content.unpublishItem' : 'content.publishItem')}</button>
        </div>
      </li>)}</ol>}
    {edit && <BundleItemEditor offer={offer} item={edit === 'new' ? null : edit} onClose={() => { setEdit(null); void refresh(); void qc.invalidateQueries({ queryKey: ['offer-readiness', offer.id] }); }} />}
    {replacing && <BundleItemEditor offer={offer} item={replacing} replace onClose={() => { setReplacing(null); void refresh(); }} />}
  </section>;
}

function BundleItemEditor({ offer, item, replace, onClose }: { offer: Offer; item: BundleItem | null; replace?: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const blank = { type: 'text', title_en: '', title_es: '', body_en: '', body_es: '', url: '', is_preview: false, allow_download: true };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => {
    if (item) setF({ type: item.type, title_en: item.title_en, title_es: item.title_es, body_en: item.body_en ?? '', body_es: item.body_es ?? '', url: item.url ?? '', is_preview: item.is_preview, allow_download: item.allow_download });
    else setF(blank);
    setFile(null);
  }, [item]);
  const linkOk = f.type === 'text' || f.type === 'file' || !f.url || isHttpsUrl(f.url);
  const contentOk = f.type === 'text' ? !!(f.body_en.trim() || f.body_es.trim()) : f.type === 'file' ? !!(file || item?.storage_path) : !!f.url.trim();
  const titleOk = !!(f.title_en.trim() || f.title_es.trim());
  const fileErr = file ? lessonFileError('file', file) : null;

  const save = async () => {
    setBusy(true);
    let storage_path = item?.storage_path ?? null;
    if (f.type === 'file' && file) {
      try { storage_path = await uploadLearnFile(offer.team_id ?? 'offers', file, () => {}); }
      catch { setBusy(false); toast.error(t('learn.uploadError')); return; }
    }
    const row = { type: f.type, title_en: f.title_en.trim(), title_es: f.title_es.trim(), body_en: f.body_en.trim() || null, body_es: f.body_es.trim() || null,
      url: f.type === 'text' || f.type === 'file' ? null : f.url.trim() || null, storage_path: f.type === 'file' ? storage_path : null,
      is_preview: f.is_preview, allow_download: f.allow_download };
    let err: { message: string } | null = null;
    if (replace && item) {
      const res = await replaceOfferItem(item.id, row);
      err = res.error;
    } else if (item) {
      const res = await db.from('offer_items').update(row).eq('id', item.id);
      err = res.error;
    } else {
      const res = await db.from('offer_items').insert({ ...row, offer_id: offer.id, sort_order: Date.now() % 100000 });
      err = res.error;
    }
    setBusy(false);
    if (err) { toast.error(t('offers.saveError')); return; }
    toast.success(t('templates.saved'));
    onClose();
  };

  return <ResponsiveSheet open onOpenChange={o => !o && onClose()} title={t(replace ? 'content.replaceItem' : item ? 'content.editItem' : 'content.addItem')}>
    <div className="edit-form">
      {replace && <p className="muted-small">{t('content.replaceText')}</p>}
      <div className="form-field"><span className="field-label">{t('content.itemTypeLabel')}</span>
        <div className="choice-pair" role="group" aria-label={t('content.itemTypeLabel')}>
          {(['text', 'file', 'link', 'embed'] as const).map(v => <button key={v} type="button" className={`choice-card ${f.type === v ? 'is-selected' : ''}`} aria-pressed={f.type === v} onClick={() => setF({ ...f, type: v })}><strong>{t(`content.itemType.${v}`)}</strong></button>)}
        </div></div>
      <div className="bilingual">
        {Field({ id: 'bi-ten', label: `${t('templates.title')} · EN`, children: <Input id="bi-ten" className="field-input" maxLength={120} value={f.title_en} onChange={e => setF({ ...f, title_en: e.target.value })} /> })}
        {Field({ id: 'bi-tes', label: `${t('templates.title')} · ES`, children: <Input id="bi-tes" className="field-input" maxLength={120} value={f.title_es} onChange={e => setF({ ...f, title_es: e.target.value })} /> })}
      </div>
      {f.type === 'text' && <div className="bilingual">
        {Field({ id: 'bi-ben', label: `${t('content.itemBody')} · EN`, children: <Textarea id="bi-ben" rows={4} className="field-textarea" maxLength={5000} value={f.body_en} onChange={e => setF({ ...f, body_en: e.target.value })} /> })}
        {Field({ id: 'bi-bes', label: `${t('content.itemBody')} · ES`, children: <Textarea id="bi-bes" rows={4} className="field-textarea" maxLength={5000} value={f.body_es} onChange={e => setF({ ...f, body_es: e.target.value })} /> })}
      </div>}
      {f.type === 'file' && <div className="form-field"><span className="field-label">{t('content.itemFile')}</span>
        <label className="upload-box"><Upload /><span>{file ? file.name : item?.storage_path ? t('content.keepFile') : t('content.chooseFile')}</span>
          <input type="file" className="sr-only" accept={LESSON_FILE_RULES['file']!.accept} onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
        {fileErr && <p className="field-error" role="alert">{t(fileErr === 'too_large' ? 'learn.fileTooBig' : 'content.badFileType')}</p>}
        <p className="muted-small">{t('content.fileRules')}</p></div>}
      {(f.type === 'link' || f.type === 'embed') && <>
        {Field({ id: 'bi-url', label: 'URL', children: <Input id="bi-url" type="url" className="field-input" maxLength={500} placeholder="https://" value={f.url} onChange={e => setF({ ...f, url: e.target.value })} /> })}
        {!linkOk && <p className="field-error" role="alert">{t('content.httpsOnly')}</p>}
        {f.type === 'embed' && <p className="muted-small">{t('content.embedNote')}</p>}</>}
      <label className="check-row"><Switch checked={f.is_preview} onCheckedChange={v => setF({ ...f, is_preview: v })} /><span>{t('content.previewItem')}<small>{t('content.previewItemText')}</small></span></label>
      <label className="check-row"><Switch checked={f.allow_download} onCheckedChange={v => setF({ ...f, allow_download: v })} /><span>{t('content.allowDownload')}<small>{t('content.allowDownloadText')}</small></span></label>
      <Button className="onboarding-continue" disabled={busy || !linkOk || !contentOk || !titleOk || !!fileErr} onClick={save}>{busy ? t('onboarding.saving') : t('profile.save')}</Button>
    </div>
  </ResponsiveSheet>;
}

/* ---------- Learner bundle view: published items with signed downloads ---------- */
export function BundleReader({ offerId, userId }: { offerId: string; userId: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const { data: items = [], isLoading } = useQuery(bundleAccessQuery(offerId, userId));
  const [busyId, setBusyId] = useState('');
  if (isLoading) return <ListSkeleton />;
  if (items.length === 0) return null;
  const download = async (item: BundleItem) => {
    setBusyId(item.id);
    const res = await offerItemDownloadLink({ data: { itemId: item.id } });
    setBusyId('');
    if (!res.ok) { toast.error(t('content.downloadError')); return; }
    // The signed URL is issued with Content-Disposition: attachment, so this downloads in place without navigating away.
    window.location.assign(res.url);
  };
  return <section className="panel">
    <h2>{t('content.bundle')}</h2>
    <ol className="lesson-list">{items.map(item => <li key={item.id} className="lesson-row">
      <div className="lesson-row-main">
        <strong>{pick(lang, item.title_en, item.title_es)}</strong>
        <small>{t(`content.itemType.${item.type}`)}</small>
        {item.type === 'text' && <p className="muted-small">{pick(lang, item.body_en, item.body_es)}</p>}
      </div>
      <div className="row-actions">
        {item.type === 'file' && item.allow_download && <Button size="sm" variant="secondary" disabled={busyId === item.id} onClick={() => void download(item)}>{t('content.download')}</Button>}
        {(item.type === 'link' || item.type === 'embed') && item.url && <Button size="sm" variant="secondary" asChild><a href={item.url} target="_blank" rel="noopener noreferrer"><ExternalLink />{t('content.openLink')}</a></Button>}
      </div>
    </li>)}</ol>
  </section>;
}
