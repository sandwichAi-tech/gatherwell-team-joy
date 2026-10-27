import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Check, Link2, Pencil, Plus, Trash2, Upload } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { CropFileInput } from '@/components/image-crop';
import { GatheringCover } from '@/components/gathering-cover';
import { ChallengeLanguageField as LangPair } from '@/components/challenge-language-field';
import { AddonImageInput } from '@/components/addon-image-input';
import { challengeTemplate, challengeStepIssues, blankActivity, blankMessages, challengePrice, resizeChallengeSchedule, type ChallengeBasics, type ChallengeAddon } from '@/lib/challenge-templates';
import { emptyAddon } from '@/lib/event-builder';
import { formatMoney } from '@/lib/billing';
import { confirmAction } from '@/components/confirm-dialog';
import { useGatherwell } from '@/components/gatherwell-shell';
import { supabase } from '@/integrations/supabase/client';
import { uploadMedia } from '@/lib/account';
import { COVER_STYLES } from '@/lib/gatherings';
import { uploadLearnFile, trackTitle, type Track } from '@/lib/learn';
import { myOffersQuery, offerTitle, type Offer } from '@/lib/offers';
import { planStatusQuery } from '@/lib/billing';
import {
  addDays, challengeIssues, lengthOf, localDate, modelOf, pick, rpcErrorKey, userTz,
  CHALLENGE_MODELS, MESSAGE_KINDS, STARTER_DAYS, STARTERS,
  type Challenge, type ChallengeActivity, type ChallengeMessage, type ChallengeModel, type Starter,
} from '@/lib/challenges';

const STEPS = ['basics', 'model', 'activities', 'messages', 'review'] as const;
type Step = (typeof STEPS)[number];

type Basics = ChallengeBasics;
const emptyActivity = blankActivity;
const defaultMessages = blankMessages;

/** Step-based challenge creation/edit with a live summary. Replaces the old single fixed form. */
export function ChallengeBuilder({ draft, teamId, onClose }: { draft: Partial<Challenge> | null; teamId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';

  const qc = useQueryClient();
  const { userId } = useGatherwell();
  const today = localDate();

  const empty: Basics = {
    title_en: '', title_es: '', description_en: '', description_es: '', daily_prompt_en: '', daily_prompt_es: '',
    starts_on: addDays(today, 1), ends_on: addDays(today, 21), cover_url: null, cover_style: 0, timezone: userTz(),
    model: 'streak', goal_target: '', goal_unit: '', frequency: 'daily', enrollment: 'open', capacity: '', leaderboard_on: true,
  };
  const [step, setStep] = useState<Step>('basics');
  const [f, setF] = useState<Basics>(empty);
  const [activities, setActivities] = useState<ChallengeActivity[]>([]);
  const [messages, setMessages] = useState<ChallengeMessage[]>(defaultMessages);
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState('');
  const [starter, setStarter] = useState<Starter | 'scratch' | null>(null);
  const [addons, setAddons] = useState<ChallengeAddon[]>([]);
  const [uploading, setUploading] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const section = useRef<HTMLDivElement>(null);
  const errorFocus = useRef<HTMLDivElement>(null);
  const baseline = useRef('');
  const saveLock = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const snapshot = () => JSON.stringify({ f, activities, messages, addons, paid, price });
  useEffect(() => { if (draft && !loading && !baseline.current) baseline.current = snapshot(); }, [f, activities, messages, addons, loading, draft]);
  const { data: planSt } = useQuery(planStatusQuery(userId));
  const canSell = planSt?.connect_status === 'active';

  // Resource attach sources (existing access-checked queries).
  const { data: tracks = [] } = useQuery({ queryKey: ['learn', userId], enabled: !!draft, queryFn: async () => (await supabase.from('tracks').select('*').order('sort_order')).data ?? [] });
  const { data: offers = [] } = useQuery({ ...myOffersQuery(userId), enabled: !!draft });

  // Child reads finish together; failed reads never become an empty editable draft.
  useEffect(() => {
    baseline.current = ''; requestId.current = crypto.randomUUID(); setErrors([]); setLoadError(false);
    if (!draft) return;
    setStep('basics'); setStarter(null); setPaid(!!draft.is_paid); setPrice(draft.price_cents ? String(draft.price_cents / 100) : '');
    setAddons(Array.isArray(draft.addons) ? draft.addons as unknown as ChallengeAddon[] : []);
    if (!draft.id) { setF(empty); setActivities([]); setMessages(defaultMessages()); return; }
    setF({ ...empty, title_en: draft.title_en ?? '', title_es: draft.title_es ?? '', description_en: draft.description_en ?? '', description_es: draft.description_es ?? '', daily_prompt_en: draft.daily_prompt_en ?? '', daily_prompt_es: draft.daily_prompt_es ?? '', starts_on: draft.starts_on ?? empty.starts_on, ends_on: draft.ends_on ?? empty.ends_on, cover_url: draft.cover_url ?? null, cover_style: draft.cover_style ?? 0, timezone: draft.timezone ?? userTz(), model: modelOf(draft), goal_target: draft.goal_target ? String(draft.goal_target) : '', goal_unit: draft.goal_unit ?? '', frequency: draft.frequency === 'weekly' ? 'weekly' : 'daily', enrollment: draft.enrollment === 'invite' ? 'invite' : 'open', capacity: draft.capacity ? String(draft.capacity) : '', leaderboard_on: draft.leaderboard_on ?? false });
    let active = true; setLoading(true);
    void Promise.all([supabase.from('challenge_activities').select('*').eq('challenge_id', draft.id).order('sort_order'), supabase.from('challenge_messages').select('*').eq('challenge_id', draft.id).order('sort_order')]).then(([a, m]) => {
      if (!active) return;
      if (a.error || m.error) setLoadError(true);
      else { setActivities((a.data ?? []) as ChallengeActivity[]); setMessages(m.data?.length ? m.data as ChallengeMessage[] : defaultMessages()); }
      setLoading(false);
    }).catch(() => { if (active) { setLoading(false); setLoadError(true); } });
    return () => { active = false; };
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const useStarter = async (k: Starter | 'scratch') => {
    if (busy || uploading || loading) return;
    if (baseline.current !== snapshot() && !(await confirmAction({ title: t('challenges.builder.replaceTitle'), body: t('challenges.builder.replaceText') }))) return;
    const next = challengeTemplate(k, f.starts_on || addDays(today, 1), lang === 'es' ? 'es' : 'en', key => t(key), f.timezone);
    setStarter(k); setF(next.f); setActivities(next.activities); setMessages(next.messages); setAddons(next.addons); setPaid(false); setPrice(''); setErrors([]);
    baseline.current = JSON.stringify(next);
  };
  const issues = challengeStepIssues('review', f, activities, messages, paid, price, addons);
  const len = f.starts_on && f.ends_on >= f.starts_on ? lengthOf({ starts_on: f.starts_on, ends_on: f.ends_on }) : 0;
  const navigateStep = (next: Step) => {
    if (busy || uploading || loading || loadError) return;
    const nextIndex = STEPS.indexOf(next), current = STEPS.indexOf(step);
    const found = nextIndex > current ? challengeStepIssues(step, f, activities, messages, paid, price, addons) : [];
    if (found.length) { setErrors(found); requestAnimationFrame(() => errorFocus.current?.focus()); return; }
    setErrors([]); setStep(next); requestAnimationFrame(() => section.current?.focus());
  };
  const close = async () => {
    if (busy || uploading) return;
    if (baseline.current !== snapshot() && !(await confirmAction({ title: t('challenges.builder.leaveTitle'), body: t('challenges.builder.leaveText') }))) return;
    onClose();
  };
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (draft && baseline.current !== snapshot()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  });

  const patchAct = (i: number, p: Partial<ChallengeActivity>) => setActivities(a => a.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const moveAct = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= activities.length) return;
    const next = [...activities]; const one = next[i], two = next[j]; if (!one || !two) return; [next[i], next[j]] = [two, one];
    setActivities(next.map((x, k) => ({ ...x, sort_order: k })));
  };
  const removeAct = async (i: number) => {
    const a = activities[i]; if (!a) return;
    if ((a.title_en.trim() || a.title_es.trim() || a.link_url || a.resource_id || a.file_path)
      && !(await confirmAction({ title: t('challenges.builder.removeActivityTitle'), body: t('challenges.builder.removeActivityText'), destructive: true }))) return;
    setActivities(x => x.filter((_, j) => j !== i));
  };

  const save = async (publish: boolean) => {
    if (saveLock.current || busy || uploading || loading || loadError) return;
    const found = challengeStepIssues('review', f, activities, messages, paid, price, addons);
    if (found.length) { setErrors(found); requestAnimationFrame(() => errorFocus.current?.focus()); return; }
    saveLock.current = true; setBusy(true);
    try {
      const row = { ...f, description_en: f.description_en || null, description_es: f.description_es || null, goal_target: f.model === 'goal' ? Number(f.goal_target) : null, goal_unit: f.model === 'goal' ? f.goal_unit || null : null, capacity: f.capacity ? Number(f.capacity) : null, status: publish ? 'published' : 'draft', is_paid: paid, price_cents: paid ? challengePrice(price) : null, currency: 'usd', addons };
      // The generated RPC type omits PostgreSQL's nullable UUID input; serialize the nullable draft ID explicitly.
      const { error } = await supabase.rpc('save_challenge_request', JSON.parse(JSON.stringify({ _id: draft?.id ?? null, _request: requestId.current, _team: teamId, _p: row, _activities: activities.map(({ id, ...a }) => a), _messages: messages.map(({ id, ...m }) => m) })));
      if (error) throw error;
      await Promise.all([qc.invalidateQueries({ queryKey: ['challenges'] }), qc.invalidateQueries({ queryKey: ['challenge'] }), qc.invalidateQueries({ queryKey: ['my-challenges'] }), qc.invalidateQueries({ queryKey: ['challenge-activities'] }), qc.invalidateQueries({ queryKey: ['challenge-messages'] })]);
      baseline.current = snapshot(); toast.success(t('templates.saved')); onClose();
    } catch (e) { toast.error(t(rpcErrorKey(e))); }
    finally { saveLock.current = false; setBusy(false); }
  };

  const stepIndex = STEPS.indexOf(step);
  const summary = useMemo(() => ({
    title: pick(lang, f.title_en, f.title_es) || t('challenges.builder.untitled'),
    dates: `${f.starts_on} → ${f.ends_on}`, days: len,
    model: t(`challenges.model.${f.model}`),
    goal: f.model === 'goal' ? `${f.goal_target || '–'} ${f.goal_unit || t('challenges.checkIns')}` : null,
    acts: activities.length, msgs: messages.filter(m => m.enabled).length,
  }), [f, activities, messages, lang, len, t]);

  if (!draft) return null;
  return <ResponsiveSheet open onOpenChange={o => !o && void close()} footer={<div className="builder-nav">{stepIndex > 0 && <Button variant="secondary" disabled={busy || uploading > 0 || loading} onClick={() => { const prev = STEPS[stepIndex - 1]; if (prev) navigateStep(prev); }}>{t('challenges.builder.back')}</Button>}{stepIndex < STEPS.length - 1 && <Button disabled={busy || uploading > 0 || loading || loadError} onClick={() => { const next = STEPS[stepIndex + 1]; if (next) navigateStep(next); }}>{t('challenges.builder.next')}</Button>}{step === 'review' && <><Button variant="secondary" disabled={busy || uploading > 0 || loading || loadError} onClick={() => void save(false)}>{t('gathering.saveDraft')}</Button><Button disabled={busy || uploading > 0 || loading || loadError || issues.length > 0 || paid} onClick={() => void save(true)}><Check />{busy ? t('onboarding.saving') : t('offers.publish')}</Button></>}</div>} title={draft?.id ? t('challenges.edit') : t('challenges.new')} description={t('challenges.claimRule')}>
    <div className="edit-form challenge-builder" ref={section} tabIndex={-1} aria-label={t(`challenges.builder.step.${step}`)} aria-busy={busy || loading}>
      {loading && <p role="status">{t('publicEvent.loading')}</p>}{loadError && <p role="alert" className="field-error">{t('challenges.builder.loadError')}</p>}
      {errors.length > 0 && <div ref={errorFocus} tabIndex={-1} role="alert" className="builder-issues">{errors.map(k => <p key={k}>{t(`challenges.builder.issue.${k}`)}</p>)}</div>}
      <div className="segmented-tabs builder-steps" role="tablist" aria-label={t('challenges.builder.steps')}>
        {STEPS.map((s, i) => <Button variant="ghost" key={s} type="button" role="tab" disabled={busy || loading || uploading > 0 || loadError || i > stepIndex + 1} aria-selected={step === s} className={step === s ? 'is-active' : ''} onClick={() => navigateStep(s)}>{i + 1}. {t(`challenges.builder.step.${s}`)}</Button>)}
      </div>

      {step === 'basics' && <>
        {!draft?.id && <div className="form-field"><span className="field-label">{t('challenges.startFrom')}</span>
          <div className="starter-grid">{([...STARTERS, 'scratch'] as const).map(k => <Button variant="outline" type="button" disabled={busy || loading || uploading > 0} key={k} className={`choice-card ${starter === k ? 'is-selected' : ''}`} aria-pressed={starter === k} onClick={() => void useStarter(k)}><strong>{t(k === 'scratch' ? 'challenges.scratch' : `challenges.starter.${k}.title`)}</strong><small>{t(k === 'scratch' ? 'challenges.scratchPreview' : `challenges.starter.${k}.preview`)}</small></Button>)}</div></div>}
        <LangPair id="chb-title" label={t('templates.title')} en={f.title_en} es={f.title_es} onEn={v => setF({ ...f, title_en: v })} onEs={v => setF({ ...f, title_es: v })} />
        <LangPair id="chb-desc" label={t('templates.description')} en={f.description_en} es={f.description_es} onEn={v => setF({ ...f, description_en: v })} onEs={v => setF({ ...f, description_es: v })} multiline maxLength={1000} />
        <LangPair id="chb-prompt" label={t('challenges.dailyPrompt')} en={f.daily_prompt_en} es={f.daily_prompt_es}
          onEn={v => setF({ ...f, daily_prompt_en: v })} onEs={v => setF({ ...f, daily_prompt_es: v })} multiline maxLength={280} />
        <div className="choice-pair">
          <div className="form-field"><label className="field-label" htmlFor="chb-start">{t('challenges.startsOn')}</label><Input id="chb-start" type="date" className="field-input" value={f.starts_on} onChange={e => { const keep = Math.max(0, (new Date(f.ends_on).getTime() - new Date(f.starts_on).getTime()) / 86_400_000); setF({ ...f, starts_on: e.target.value, ends_on: e.target.value ? addDays(e.target.value, keep) : f.ends_on }); }} /></div>
          <div className="form-field"><label className="field-label" htmlFor="chb-end">{t('challenges.endsOn')}</label><Input id="chb-end" type="date" min={f.starts_on} className="field-input" value={f.ends_on} onChange={e => { const nextLen = lengthOf({ starts_on: f.starts_on, ends_on: e.target.value }); if (Number.isFinite(nextLen) && nextLen > 0) setActivities(a => resizeChallengeSchedule(a, len, nextLen)); setF({ ...f, ends_on: e.target.value }); }} /></div>
        </div>
        <p className="field-hint">{t('challenges.builder.tzNote', { tz: f.timezone })}</p>
        <div className="form-field"><span className="field-label">{t('onboarding.cover')}</span>
          <GatheringCover path={f.cover_url} style={f.cover_style} title={f.title_en || f.title_es || 'C'} className="cover-preview" />
          <div className="cover-styles">{COVER_STYLES.map((bg, i) => <button key={i} type="button" className={`cover-swatch ${!f.cover_url && f.cover_style === i ? 'is-selected' : ''}`} style={{ backgroundImage: bg }} aria-label={`${t('onboarding.cover')} ${i + 1}`} aria-pressed={!f.cover_url && f.cover_style === i} onClick={() => setF({ ...f, cover_url: null, cover_style: i })} />)}</div>
          <label className="file-button"><Upload />{t('onboarding.uploadCover')}<CropFileInput kind="cover" className="hidden" onCropped={async r => { try { setF({ ...f, cover_url: await uploadMedia(userId, r.file, 'cover') }); } catch { toast.error(t('profile.saveError')); } }} /></label></div>
        <div className="form-field"><span className="field-label">{t('challenges.pricing')}</span><div className="segmented full" role="group" aria-label={t('challenges.pricing')}>{[false, true].map(p => <Button key={String(p)} variant="ghost" aria-pressed={paid === p} className={paid === p ? 'selected' : ''} onClick={() => setPaid(p)}>{t(p ? 'challenges.paidChoice' : 'challenges.free')}</Button>)}</div></div>
        {paid && <><div className="choice-pair"><div className="form-field"><label className="field-label" htmlFor="chb-price">{t('billing.price')}</label><Input id="chb-price" inputMode="decimal" className="field-input" value={price} onChange={e => setPrice(e.target.value)} /></div><div className="form-field"><label className="field-label" htmlFor="chb-currency">{t('challenges.currency')}</label><select id="chb-currency" className="field-input" value="usd" disabled><option value="usd">USD</option></select></div></div><p className="not-connected-note" role="note">{t('challenges.checkoutBlocked')} {!canSell && t('billing.priceNeedsPayouts')}</p></>}
        <h3>{t('addonImages.title')}</h3>
        {addons.map(a => <fieldset key={a.id} className="builder-activity"><legend>{a.name || t('builder.addonName')}</legend>
          <AddonImageInput userId={userId} name={a.name} path={a.image_path} onChange={image_path => setAddons(rows => rows.map(x => x.id === a.id ? { ...x, image_path } : x))} onBusy={b => setUploading(n => Math.max(0, n + (b ? 1 : -1)))} />
          <div className="form-field"><label className="field-label" htmlFor={`addon-${a.id}`}>{t('builder.addonName')}</label><Input id={`addon-${a.id}`} value={a.name} maxLength={60} onChange={e => setAddons(rows => rows.map(x => x.id === a.id ? { ...x, name: e.target.value } : x))} /></div>
          <div className="form-field"><label className="field-label" htmlFor={`addesc-${a.id}`}>{t('templates.description')}</label><Input id={`addesc-${a.id}`} value={a.description} maxLength={500} onChange={e => setAddons(rows => rows.map(x => x.id === a.id ? { ...x, description: e.target.value } : x))} /></div>
          <div className="choice-pair"><div className="form-field"><label className="field-label" htmlFor={`adprice-${a.id}`}>{t('billing.price')}</label><Input id={`adprice-${a.id}`} inputMode="decimal" value={a.price_cents / 100} onChange={e => setAddons(rows => rows.map(x => x.id === a.id ? { ...x, price_cents: Math.round(Number(e.target.value) * 100) } : x))} /></div><div className="form-field"><label className="field-label" htmlFor={`adqty-${a.id}`}>{t('challenges.maxQuantity')}</label><Input id={`adqty-${a.id}`} type="number" min={1} max={20} value={a.max_quantity} onChange={e => setAddons(rows => rows.map(x => x.id === a.id ? { ...x, max_quantity: Number(e.target.value) } : x))} /></div></div>
          <div className="form-field"><label className="field-label" htmlFor={`adinventory-${a.id}`}>{t('challenges.inventory')}</label><Input id={`adinventory-${a.id}`} type="number" min={0} value={a.inventory ?? ''} placeholder={t('gathering.noLimit')} onChange={e => setAddons(rows => rows.map(x => x.id === a.id ? { ...x, inventory: e.target.value === '' ? null : Number(e.target.value) } : x))} /></div>
          <label className="switch-row"><Switch checked={a.available} onCheckedChange={available => setAddons(rows => rows.map(x => x.id === a.id ? { ...x, available } : x))} /><span>{t('challenges.available')}</span></label>
          <Button variant="ghost" disabled={uploading > 0} onClick={() => setAddons(rows => rows.filter(x => x.id !== a.id))}><Trash2 />{t('builder.removeAddon')}</Button>
        </fieldset>)}
        <Button variant="secondary" disabled={addons.length >= 8 || uploading > 0} onClick={() => setAddons(rows => [...rows, { ...emptyAddon(), description: '', max_quantity: 1, inventory: null, available: true }])}><Plus />{t('builder.addAddon')}</Button>
      </>}

      {step === 'model' && <>
        <div className="form-field"><span className="field-label">{t('challenges.model.label')}</span>
          <div className="format-cards" role="radiogroup" aria-label={t('challenges.model.label')}>
            {CHALLENGE_MODELS.map(m => <Button variant="outline" key={m} type="button" role="radio" aria-checked={f.model === m} className={`format-card ${f.model === m ? 'is-selected' : ''}`} onClick={() => setF({ ...f, model: m, goal_target: m === 'goal' ? f.goal_target || String(len) : '', goal_unit: m === 'goal' ? f.goal_unit : '' })}>
              <strong>{t(`challenges.model.${m}`)}</strong><small>{t(`challenges.modelText.${m}`)}</small></Button>)}
          </div></div>
        {f.model === 'goal' && <div className="choice-pair">
          <div className="form-field"><label className="field-label" htmlFor="chb-target">{t('challenges.goalTarget')}</label><Input id="chb-target" type="number" min={1} max={1000} className="field-input" value={f.goal_target} onChange={e => setF({ ...f, goal_target: e.target.value.replace(/\D/g, '').slice(0, 4) })} /></div>
          <div className="form-field"><label className="field-label" htmlFor="chb-unit">{t('challenges.goalUnit')}</label><Input id="chb-unit" maxLength={40} className="field-input" value={f.goal_unit} placeholder={t('challenges.goalUnitHint')} onChange={e => setF({ ...f, goal_unit: e.target.value })} /></div>
        </div>}
        {f.model === 'points' && <p className="field-hint">{t('challenges.pointsNote')}</p>}
        <div className="form-field"><span className="field-label">{t('challenges.frequency.label')}</span>
          <div className="segmented full" role="group" aria-label={t('challenges.frequency.label')}>{(['daily', 'weekly'] as const).map(fr => <Button key={fr} variant="ghost" className={f.frequency === fr ? 'selected' : ''} aria-pressed={f.frequency === fr} onClick={() => setF({ ...f, frequency: fr })}>{t(`challenges.frequency.${fr}`)}</Button>)}</div></div>
        <label className="switch-row"><Switch checked={f.leaderboard_on} onCheckedChange={v => setF({ ...f, leaderboard_on: v })} /><span><strong>{t('challenges.leaderboardToggle')}</strong><small>{t('challenges.leaderboardToggleText')}</small></span></label>
        <div className="form-field"><span className="field-label">{t('challenges.enrollment.label')}</span>
          <div className="segmented full" role="group" aria-label={t('challenges.enrollment.label')}>{(['open', 'invite'] as const).map(en => <Button key={en} variant="ghost" className={f.enrollment === en ? 'selected' : ''} aria-pressed={f.enrollment === en} onClick={() => setF({ ...f, enrollment: en })}>{t(`challenges.enrollment.${en}`)}</Button>)}</div></div>
        <div className="form-field"><label className="field-label" htmlFor="chb-cap">{t('challenges.capacity')}</label><Input id="chb-cap" type="number" min={1} className="field-input" value={f.capacity} placeholder={t('gathering.noLimit')} onChange={e => setF({ ...f, capacity: e.target.value.replace(/\D/g, '').slice(0, 5) })} /></div>
      </>}

      {step === 'activities' && <>
        <p className="field-hint">{t('challenges.builder.activitiesHint')}</p>
        {activities.map((a, i) => <fieldset key={i} className="form-section builder-activity">
          <legend>{t('challenges.builder.activity', { count: i + 1 })}</legend>
          <LangPair id={`cha-${i}`} label={t('templates.title')} en={a.title_en} es={a.title_es} onEn={v => patchAct(i, { title_en: v })} onEs={v => patchAct(i, { title_es: v })} maxLength={120} />
          <LangPair id={`chai-${i}`} label={t('challenges.instructions')} en={a.instructions_en ?? ''} es={a.instructions_es ?? ''} onEn={v => patchAct(i, { instructions_en: v })} onEs={v => patchAct(i, { instructions_es: v })} multiline maxLength={1000} />
          <div className="choice-pair">
            <div className="form-field"><label className="field-label" htmlFor={`chad-${i}`}>{t('challenges.builder.activityDay')}</label>
              <select id={`chad-${i}`} className="field-input" value={a.day_offset ?? ''} onChange={e => patchAct(i, { day_offset: e.target.value === '' ? null : Number(e.target.value) })}>
                <option value="">{t('challenges.builder.throughout')}</option>
                {Array.from({ length: Math.max(len, 1) }, (_, d) => <option key={d + 1} value={d + 1}>{t('challenges.builder.dayN', { day: d + 1 })}</option>)}
              </select></div>
            <div className="form-field"><label className="field-label" htmlFor={`chah-${i}`}>{t('challenges.builder.dueTime')}</label>
              <Input id={`chah-${i}`} type="number" min={0} max={23} className="field-input" value={a.due_hour ?? ''} placeholder="—" onChange={e => patchAct(i, { due_hour: e.target.value === '' ? null : Math.max(0, Math.min(23, Number(e.target.value))) })} /></div>
          </div>
          <label className="switch-row"><Switch checked={a.requires_checkin} onCheckedChange={v => patchAct(i, { requires_checkin: v })} /><span><strong>{t('challenges.builder.requiresCheckin')}</strong></span></label>
          <label className="switch-row"><Switch checked={a.requires_note} onCheckedChange={v => patchAct(i, { requires_note: v })} /><span><strong>{t('challenges.builder.requiresNote')}</strong></span></label>
          <div className="form-field"><label className="field-label" htmlFor={`chal-${i}`}>{t('challenges.builder.link')}</label>
            <Input id={`chal-${i}`} type="url" inputMode="url" className="field-input" placeholder="https://" value={a.link_url ?? ''} onChange={e => patchAct(i, { link_url: e.target.value })} aria-invalid={!!a.link_url && !/^https?:\/\/\S+$/i.test(a.link_url)} /></div>
          <div className="form-field"><label className="field-label" htmlFor={`char-${i}`}>{t('challenges.builder.attachResource')}</label>
            <select id={`char-${i}`} className="field-input" value={a.resource_kind && a.resource_id ? `${a.resource_kind}:${a.resource_id}` : ''} onChange={e => { const [k, id] = e.target.value.split(':'); patchAct(i, { resource_kind: k || null, resource_id: id || null }); }}>
              <option value="">{t('challenges.builder.noResource')}</option>
              {tracks.map((tr: Track) => <option key={tr.id} value={`track:${tr.id}`}>{t('resources.type.track')} · {trackTitle(tr, lang)}</option>)}
              {offers.filter((o: Offer) => o.status !== 'archived').map((o: Offer) => <option key={o.id} value={`offer:${o.id}`}>{t(`offers.kind.${o.kind}`)} · {offerTitle(o, lang)}</option>)}
            </select></div>
          <div className="form-field"><span className="field-label">{t('challenges.builder.file')}</span>
            <label className="file-button"><Upload />{a.file_path ? t('offers.replaceFile') : t('offers.uploadFile')}
              <input type="file" hidden onChange={async e => { const x = e.target.files?.[0]; if (!x) return; try { patchAct(i, { file_path: await uploadLearnFile(teamId, x, () => {}) }); } catch { toast.error(t('profile.saveError')); } }} /></label>
            {a.file_path && <small className="muted-small"><Check className="inline-icon" />{t('offers.fileAttached')}</small>}</div>
          <div className="builder-activity-actions">
            <Button variant="ghost" size="icon" disabled={i === 0} aria-label={t('templates.moveUp')} onClick={() => moveAct(i, -1)}><ArrowUp /></Button>
            <Button variant="ghost" size="icon" disabled={i === activities.length - 1} aria-label={t('templates.moveDown')} onClick={() => moveAct(i, 1)}><ArrowDown /></Button>
            <Button variant="ghost" size="icon" aria-label={t('challenges.delete')} onClick={() => void removeAct(i)}><Trash2 /></Button>
          </div>
        </fieldset>)}
        <Button variant="secondary" disabled={activities.length >= 30} onClick={() => setActivities(a => [...a, emptyActivity(a.length)])}><Plus />{t('challenges.builder.addActivity')}</Button>
      </>}

      {step === 'messages' && <>
        <p className="field-hint">{t('challenges.builder.messagesHint')}</p>
        {messages.map((m, i) => <fieldset key={m.kind} className="form-section builder-activity">
          <legend>{t(`challenges.msg.${m.kind}`)}</legend>
          <label className="switch-row"><Switch checked={m.enabled} disabled={m.kind !== 'welcome'} onCheckedChange={v => setMessages(ms => ms.map((x, j) => (j === i ? { ...x, enabled: v } : x)))} /><span><strong>{t('challenges.builder.msgEnabled')}</strong><small>{t(`challenges.msgText.${m.kind}`)}</small></span></label>
          {m.kind !== 'welcome' && <p className="field-hint">{t('challenges.scheduleBlocked')}</p>}
          <>
            <div className="choice-pair">
              <div className="form-field"><label className="field-label" htmlFor={`chmo-${i}`}>{t('challenges.builder.msgOffset')}</label>
                <Input id={`chmo-${i}`} type="number" min={-7} max={Math.max(len, 1)} className="field-input" value={m.send_offset_days} onChange={e => setMessages(ms => ms.map((x, j) => (j === i ? { ...x, send_offset_days: Math.max(-7, Math.min(365, Number(e.target.value) || 0)) } : x)))} /></div>
              <div className="form-field"><label className="field-label" htmlFor={`chmh-${i}`}>{t('challenges.builder.msgHour')}</label>
                <Input id={`chmh-${i}`} type="number" min={0} max={23} className="field-input" value={m.send_hour} onChange={e => setMessages(ms => ms.map((x, j) => (j === i ? { ...x, send_hour: Math.max(0, Math.min(23, Number(e.target.value) || 0)) } : x)))} /></div>
            </div>
            <LangPair id={`chmt-${i}`} label={t('templates.title')} en={m.title_en} es={m.title_es} onEn={v => setMessages(ms => ms.map((x, j) => (j === i ? { ...x, title_en: v } : x)))} onEs={v => setMessages(ms => ms.map((x, j) => (j === i ? { ...x, title_es: v } : x)))} maxLength={120} />
            <LangPair id={`chmb-${i}`} label={t('challenges.builder.msgBody')} en={m.body_en} es={m.body_es} onEn={v => setMessages(ms => ms.map((x, j) => (j === i ? { ...x, body_en: v } : x)))} onEs={v => setMessages(ms => ms.map((x, j) => (j === i ? { ...x, body_es: v } : x)))} multiline maxLength={500} />
            <p className="field-hint">{t('challenges.builder.msgChannel', { channel: t('comms.channel.in_app') })}</p>
          </>
        </fieldset>)}
      </>}

      {step === 'review' && <>
        <section className="builder-summary" aria-label={t('challenges.builder.reviewTitle')}>
          <GatheringCover path={f.cover_url} style={f.cover_style} title={summary.title} className="cover-preview" />
          <h3>{summary.title}</h3><p>{paid ? formatMoney(challengePrice(price) ?? 0, lang) : t('challenges.free')} · USD</p>{paid && <p className="field-error">{t('challenges.checkoutBlocked')}</p>}{addons.map(a => <p key={a.id}>{a.name} · {formatMoney(a.price_cents, lang)}</p>)}
          <p className="track-facts">{summary.dates} · {t('challenges.days', { count: summary.days })} · {summary.model}{summary.goal ? ` · ${summary.goal}` : ''}</p>
          <p className="track-facts">{t('challenges.builder.summaryActs', { count: summary.acts })} · {t('challenges.builder.summaryMsgs', { count: summary.msgs })} · {t(`challenges.enrollment.${f.enrollment}`)}{f.capacity ? ` · ${t('challenges.capacityN', { count: Number(f.capacity) })}` : ''}</p>
          {issues.length > 0 && <ul className="builder-issues" role="alert">{issues.map(k => <li key={k}>{t(`challenges.builder.issue.${k}`)}</li>)}</ul>}
        </section>
        <p className="field-hint">{t('challenges.builder.reviewHint')}</p>
      </>}

    </div>
  </ResponsiveSheet>;
}
