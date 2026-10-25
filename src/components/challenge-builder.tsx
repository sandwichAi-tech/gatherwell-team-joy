import { useEffect, useMemo, useState } from 'react';
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
import { LangFields, LangPair } from '@/components/lang-fields';
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

type Basics = {
  title_en: string; title_es: string; description_en: string; description_es: string;
  daily_prompt_en: string; daily_prompt_es: string; starts_on: string; ends_on: string;
  cover_url: string | null; cover_style: number;
  model: ChallengeModel; goal_target: string; goal_unit: string; frequency: 'daily' | 'weekly';
  enrollment: 'open' | 'invite'; capacity: string; leaderboard_on: boolean;
};

const emptyActivity = (sort: number): ChallengeActivity => ({
  title_en: '', title_es: '', instructions_en: '', instructions_es: '', day_offset: null, sort_order: sort,
  requires_checkin: false, requires_note: false, due_hour: null, link_url: null, resource_kind: null, resource_id: null, file_path: null,
});

const defaultMessages = (): ChallengeMessage[] => MESSAGE_KINDS.map((kind, i) => ({
  kind, send_offset_days: kind === 'start_reminder' ? -1 : 0, send_hour: 9,
  title_en: '', title_es: '', body_en: '', body_es: '', channel: 'in_app', enabled: kind !== 'announcement', paused: false, sort_order: i,
}));

/** Step-based challenge creation/edit with a live summary. Replaces the old single fixed form. */
export function ChallengeBuilder({ draft, teamId, onClose }: { draft: Partial<Challenge> | null; teamId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const enT = i18n.getFixedT('en'); const esT = i18n.getFixedT('es');
  const qc = useQueryClient();
  const { userId } = useGatherwell();
  const today = localDate();

  const empty: Basics = {
    title_en: '', title_es: '', description_en: '', description_es: '', daily_prompt_en: '', daily_prompt_es: '',
    starts_on: addDays(today, 1), ends_on: addDays(today, 21), cover_url: null, cover_style: 0,
    model: 'streak', goal_target: '', goal_unit: '', frequency: 'daily', enrollment: 'open', capacity: '', leaderboard_on: true,
  };
  const [step, setStep] = useState<Step>('basics');
  const [f, setF] = useState<Basics>(empty);
  const [activities, setActivities] = useState<ChallengeActivity[]>([]);
  const [messages, setMessages] = useState<ChallengeMessage[]>(defaultMessages);
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState('');
  const [starter, setStarter] = useState<Starter | null>(null);
  const { data: planSt } = useQuery(planStatusQuery(userId));
  const canSell = planSt?.connect_status === 'active';

  // Resource attach sources (existing access-checked queries).
  const { data: tracks = [] } = useQuery({ queryKey: ['learn', userId], enabled: !!draft, queryFn: async () => (await supabase.from('tracks').select('*').order('sort_order')).data ?? [] });
  const { data: offers = [] } = useQuery({ ...myOffersQuery(userId), enabled: !!draft });

  // Load an existing challenge plus its activities and messages.
  useEffect(() => {
    if (!draft) return;
    setStep('basics'); setStarter(null);
    setPaid(!!draft.is_paid); setPrice(draft.price_cents ? String(draft.price_cents / 100) : '');
    if (!draft.id) { setF(empty); setActivities([]); setMessages(defaultMessages()); return; }
    setF({
      title_en: draft.title_en ?? '', title_es: draft.title_es ?? '', description_en: draft.description_en ?? '', description_es: draft.description_es ?? '',
      daily_prompt_en: draft.daily_prompt_en ?? '', daily_prompt_es: draft.daily_prompt_es ?? '',
      starts_on: draft.starts_on ?? empty.starts_on, ends_on: draft.ends_on ?? empty.ends_on,
      cover_url: draft.cover_url ?? null, cover_style: draft.cover_style ?? 0,
      model: modelOf(draft), goal_target: draft.goal_target ? String(draft.goal_target) : '', goal_unit: draft.goal_unit ?? '',
      frequency: draft.frequency === 'weekly' ? 'weekly' : 'daily',
      enrollment: draft.enrollment === 'invite' ? 'invite' : 'open', capacity: draft.capacity ? String(draft.capacity) : '',
      leaderboard_on: draft.leaderboard_on ?? true,
    });
    void supabase.from('challenge_activities').select('*').eq('challenge_id', draft.id).order('sort_order')
      .then(({ data }) => setActivities((data ?? []) as ChallengeActivity[]));
    void supabase.from('challenge_messages').select('*').eq('challenge_id', draft.id).order('sort_order')
      .then(({ data }) => setMessages(data?.length ? (data as ChallengeMessage[]) : defaultMessages()));
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const useStarter = (k: Starter) => {
    setStarter(k);
    const g = (fx: typeof enT, key: string) => fx(`challenges.starter.${k}.${key}`);
    setF({ ...f, title_en: g(enT, 'title'), title_es: g(esT, 'title'), description_en: g(enT, 'description'), description_es: g(esT, 'description'), daily_prompt_en: g(enT, 'prompt'), daily_prompt_es: g(esT, 'prompt'), ends_on: addDays(f.starts_on, STARTER_DAYS[k] - 1), cover_style: STARTERS.indexOf(k) });
  };

  const issues = challengeIssues(f, today);
  const len = f.starts_on && f.ends_on >= f.starts_on ? lengthOf({ starts_on: f.starts_on, ends_on: f.ends_on }) : 0;

  const patchAct = (i: number, p: Partial<ChallengeActivity>) => setActivities(a => a.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const moveAct = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= activities.length) return;
    const next = [...activities]; [next[i], next[j]] = [next[j]!, next[i]!];
    setActivities(next.map((x, k) => ({ ...x, sort_order: k })));
  };
  const removeAct = async (i: number) => {
    const a = activities[i]!;
    if ((a.title_en.trim() || a.title_es.trim() || a.link_url || a.resource_id || a.file_path)
      && !(await confirmAction({ title: t('challenges.builder.removeActivityTitle'), body: t('challenges.builder.removeActivityText'), destructive: true }))) return;
    setActivities(x => x.filter((_, j) => j !== i));
  };

  const save = async (publish: boolean) => {
    setBusy(true);
    const both = (en: string, es: string) => ({ en: en.trim() || es.trim(), es: es.trim() || en.trim() });
    const tt = both(f.title_en, f.title_es), dd = both(f.description_en, f.description_es), pp = both(f.daily_prompt_en, f.daily_prompt_es);
    const row = {
      title_en: tt.en, title_es: tt.es, description_en: dd.en || null, description_es: dd.es || null,
      daily_prompt_en: pp.en || null, daily_prompt_es: pp.es || null,
      starts_on: f.starts_on, ends_on: f.ends_on, cover_url: f.cover_url, cover_style: f.cover_style,
      model: f.model, goal_target: f.model === 'goal' && Number(f.goal_target) > 0 ? Math.min(1000, Number(f.goal_target)) : null,
      goal_unit: f.model === 'goal' ? f.goal_unit.trim() || null : null,
      frequency: f.frequency, enrollment: f.enrollment, capacity: Number(f.capacity) > 0 ? Math.min(10000, Number(f.capacity)) : null,
      timezone: userTz(), leaderboard_on: f.leaderboard_on, status: publish ? 'published' : 'draft',
      ...(canSell || !paid ? { is_paid: paid && !!price, price_cents: paid && price ? Math.round(Number(price) * 100) : null } : {}),
    };
    const res = draft?.id
      ? await supabase.from('challenges').update(row).eq('id', draft.id)
      : await supabase.from('challenges').insert({ ...row, team_id: teamId, created_by: userId }).select('id').single();
    if (res.error) { setBusy(false); toast.error(t(rpcErrorKey(res.error))); return; }
    const cid = (draft?.id ?? ('data' in res ? res.data?.id : null)) as string;
    // Replace activities/messages atomically enough for a leader-only editor: upsert kept rows, delete removed ones.
    const actRows = activities.map((a, i) => ({ ...a, sort_order: i, challenge_id: cid }));
    const keptActIds = actRows.map(a => a.id).filter(Boolean) as string[];
    await supabase.from('challenge_activities').delete().eq('challenge_id', cid).not('id', 'in', keptActIds.length ? `(${keptActIds.join(',')})` : '(00000000-0000-0000-0000-000000000000)');
    if (actRows.length) await supabase.from('challenge_activities').upsert(actRows.map(({ id, ...r }) => (id ? { id, ...r } : r)));
    const msgRows = messages.map((m, i) => ({ ...m, sort_order: i, challenge_id: cid }));
    const keptMsgIds = msgRows.map(m => m.id).filter(Boolean) as string[];
    await supabase.from('challenge_messages').delete().eq('challenge_id', cid).not('id', 'in', keptMsgIds.length ? `(${keptMsgIds.join(',')})` : '(00000000-0000-0000-0000-000000000000)');
    if (msgRows.length) await supabase.from('challenge_messages').upsert(msgRows.map(({ id, ...r }) => (id ? { id, ...r } : r)));
    setBusy(false);
    toast.success(t('templates.saved'));
    await qc.invalidateQueries({ queryKey: ['challenges'] });
    await qc.invalidateQueries({ queryKey: ['challenge', cid] });
    onClose();
  };

  const stepIndex = STEPS.indexOf(step);
  const summary = useMemo(() => ({
    title: pick(lang, f.title_en, f.title_es) || t('challenges.builder.untitled'),
    dates: `${f.starts_on} → ${f.ends_on}`, days: len,
    model: t(`challenges.model.${f.model}`),
    goal: f.model === 'goal' ? `${f.goal_target || '–'} ${f.goal_unit || t('challenges.checkIns')}` : null,
    acts: activities.length, msgs: messages.filter(m => m.enabled).length,
  }), [f, activities, messages, lang, len, t]);

  return <ResponsiveSheet open={!!draft} onOpenChange={o => !o && onClose()} title={draft?.id ? t('challenges.edit') : t('challenges.new')} description={t('challenges.claimRule')}>
    <div className="edit-form challenge-builder">
      <div className="segmented-tabs builder-steps" role="tablist" aria-label={t('challenges.builder.steps')}>
        {STEPS.map((s, i) => <button key={s} type="button" role="tab" aria-selected={step === s} className={step === s ? 'is-active' : ''} onClick={() => setStep(s)}>{i + 1}. {t(`challenges.builder.step.${s}`)}</button>)}
      </div>

      {step === 'basics' && <>
        {!draft?.id && <div className="form-field"><span className="field-label">{t('challenges.startFrom')}</span>
          <div className="starter-grid">{STARTERS.map(k => <button type="button" key={k} className={`choice-card ${starter === k ? 'is-selected' : ''}`} aria-pressed={starter === k} onClick={() => useStarter(k)}><strong>{t(`challenges.starter.${k}.title`)}</strong><small>{t('challenges.days', { count: STARTER_DAYS[k] })}</small></button>)}</div></div>}
        <LangFields idPrefix="chb" titleEn={f.title_en} titleEs={f.title_es} descEn={f.description_en} descEs={f.description_es}
          onChange={p => setF(x => ({ ...x, title_en: p.titleEn ?? x.title_en, title_es: p.titleEs ?? x.title_es, description_en: p.descEn ?? x.description_en, description_es: p.descEs ?? x.description_es }))}
          titleLabel={t('templates.title')} descLabel={t('templates.description')} />
        <LangPair id="chb-prompt" label={t('challenges.dailyPrompt')} en={f.daily_prompt_en} es={f.daily_prompt_es}
          onEn={v => setF({ ...f, daily_prompt_en: v })} onEs={v => setF({ ...f, daily_prompt_es: v })} multiline rows={2} maxLength={280} />
        <div className="choice-pair">
          <div className="form-field"><label className="field-label" htmlFor="chb-start">{t('challenges.startsOn')}</label><Input id="chb-start" type="date" className="field-input" value={f.starts_on} onChange={e => { const keep = Math.max(0, (new Date(f.ends_on).getTime() - new Date(f.starts_on).getTime()) / 86_400_000); setF({ ...f, starts_on: e.target.value, ends_on: e.target.value ? addDays(e.target.value, keep) : f.ends_on }); }} /></div>
          <div className="form-field"><label className="field-label" htmlFor="chb-end">{t('challenges.endsOn')}</label><Input id="chb-end" type="date" min={f.starts_on} className="field-input" value={f.ends_on} onChange={e => setF({ ...f, ends_on: e.target.value })} /></div>
        </div>
        <p className="field-hint">{t('challenges.builder.tzNote', { tz: userTz() })}</p>
        <div className="form-field"><span className="field-label">{t('onboarding.cover')}</span>
          <GatheringCover path={f.cover_url} style={f.cover_style} title={f.title_en || f.title_es || 'C'} className="cover-preview" />
          <div className="cover-styles">{COVER_STYLES.map((bg, i) => <button key={i} type="button" className={`cover-swatch ${!f.cover_url && f.cover_style === i ? 'is-selected' : ''}`} style={{ backgroundImage: bg }} aria-label={`${t('onboarding.cover')} ${i + 1}`} aria-pressed={!f.cover_url && f.cover_style === i} onClick={() => setF({ ...f, cover_url: null, cover_style: i })} />)}</div>
          <label className="file-button"><Upload />{t('onboarding.uploadCover')}<CropFileInput kind="cover" className="hidden" onCropped={async r => { try { setF({ ...f, cover_url: await uploadMedia(userId, r.file, 'cover') }); } catch { toast.error(t('profile.saveError')); } }} /></label></div>
        <label className={`switch-row ${canSell ? '' : 'is-disabled'}`}><Switch checked={paid} disabled={!canSell} onCheckedChange={setPaid} /><span><strong>{t('challenges.paid')}</strong><small>{canSell ? t('billing.priceHint') : t('billing.priceNeedsPayouts')}</small></span></label>
        {paid && canSell && <div><label className="field-label" htmlFor="chb-price">{t('billing.price')}</label><Input id="chb-price" inputMode="decimal" className="field-input" value={price} onChange={e => setPrice(e.target.value.replace(/[^\d.]/g, '').slice(0, 7))} placeholder="$0" /></div>}
      </>}

      {step === 'model' && <>
        <div className="form-field"><span className="field-label">{t('challenges.model.label')}</span>
          <div className="format-cards" role="radiogroup" aria-label={t('challenges.model.label')}>
            {CHALLENGE_MODELS.map(m => <button key={m} type="button" role="radio" aria-checked={f.model === m} className={`format-card ${f.model === m ? 'is-selected' : ''}`} onClick={() => setF({ ...f, model: m })}>
              <strong>{t(`challenges.model.${m}`)}</strong><small>{t(`challenges.modelText.${m}`)}</small></button>)}
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
          <label className="switch-row"><Switch checked={m.enabled} onCheckedChange={v => setMessages(ms => ms.map((x, j) => (j === i ? { ...x, enabled: v } : x)))} /><span><strong>{t('challenges.builder.msgEnabled')}</strong><small>{t(`challenges.msgText.${m.kind}`)}</small></span></label>
          {m.enabled && <>
            <div className="choice-pair">
              <div className="form-field"><label className="field-label" htmlFor={`chmo-${i}`}>{t('challenges.builder.msgOffset')}</label>
                <Input id={`chmo-${i}`} type="number" min={-7} max={Math.max(len, 1)} className="field-input" value={m.send_offset_days} onChange={e => setMessages(ms => ms.map((x, j) => (j === i ? { ...x, send_offset_days: Math.max(-7, Math.min(365, Number(e.target.value) || 0)) } : x)))} /></div>
              <div className="form-field"><label className="field-label" htmlFor={`chmh-${i}`}>{t('challenges.builder.msgHour')}</label>
                <Input id={`chmh-${i}`} type="number" min={0} max={23} className="field-input" value={m.send_hour} onChange={e => setMessages(ms => ms.map((x, j) => (j === i ? { ...x, send_hour: Math.max(0, Math.min(23, Number(e.target.value) || 0)) } : x)))} /></div>
            </div>
            <LangPair id={`chmt-${i}`} label={t('templates.title')} en={m.title_en} es={m.title_es} onEn={v => setMessages(ms => ms.map((x, j) => (j === i ? { ...x, title_en: v } : x)))} onEs={v => setMessages(ms => ms.map((x, j) => (j === i ? { ...x, title_es: v } : x)))} maxLength={120} />
            <LangPair id={`chmb-${i}`} label={t('challenges.builder.msgBody')} en={m.body_en} es={m.body_es} onEn={v => setMessages(ms => ms.map((x, j) => (j === i ? { ...x, body_en: v } : x)))} onEs={v => setMessages(ms => ms.map((x, j) => (j === i ? { ...x, body_es: v } : x)))} multiline rows={2} maxLength={500} />
            <p className="field-hint">{t('challenges.builder.msgChannel', { channel: t('comms.channel.in_app') })}</p>
          </>}
        </fieldset>)}
      </>}

      {step === 'review' && <>
        <section className="panel builder-summary" aria-label={t('challenges.builder.reviewTitle')}>
          <GatheringCover path={f.cover_url} style={f.cover_style} title={summary.title} className="cover-preview" />
          <h3>{summary.title}</h3>
          <p className="track-facts">{summary.dates} · {t('challenges.days', { count: summary.days })} · {summary.model}{summary.goal ? ` · ${summary.goal}` : ''}</p>
          <p className="track-facts">{t('challenges.builder.summaryActs', { count: summary.acts })} · {t('challenges.builder.summaryMsgs', { count: summary.msgs })} · {t(`challenges.enrollment.${f.enrollment}`)}{f.capacity ? ` · ${t('challenges.capacityN', { count: Number(f.capacity) })}` : ''}</p>
          {issues.length > 0 && <ul className="builder-issues" role="alert">{issues.map(k => <li key={k}>{t(`challenges.builder.issue.${k}`)}</li>)}</ul>}
        </section>
        <p className="field-hint">{t('challenges.builder.reviewHint')}</p>
      </>}

      <div className="builder-nav">
        {stepIndex > 0 && <Button variant="secondary" onClick={() => setStep(STEPS[stepIndex - 1]!)}>{t('templates.back')}</Button>}
        {stepIndex < STEPS.length - 1 && <Button onClick={() => setStep(STEPS[stepIndex + 1]!)}>{t('templates.next')}</Button>}
        {step === 'review' && <>
          <Button variant="secondary" disabled={busy || issues.length > 0} onClick={() => void save(false)}>{t('gathering.saveDraft')}</Button>
          <Button disabled={busy || issues.length > 0} onClick={() => void save(true)}><Check />{busy ? t('onboarding.saving') : t('offers.publish')}</Button>
        </>}
      </div>
    </div>
  </ResponsiveSheet>;
}
