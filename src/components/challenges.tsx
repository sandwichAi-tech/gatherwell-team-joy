import { trackEvent } from '@/lib/analytics';
import { ListSkeleton, RetryState } from '@/components/launch-states';
import { useServerFn } from '@tanstack/react-start';
import { usePaymentGate } from '@/components/plan-page';
import { startChallengeCheckout } from '@/lib/billing.functions';
import { planStatusQuery, formatMoney } from '@/lib/billing';
import { ClaimGuard } from '@/components/smart';
import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Camera, Check, Download, Flame, Lock, Megaphone, Pencil, Plus, Trash2, Upload } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { GatheringCover } from '@/components/gathering-cover';
import { useGatherwell } from '@/components/gatherwell-shell';
import { supabase } from '@/integrations/supabase/client';
import { firstName, initialsOf, profileQuery, uploadMedia, workspaceQuery } from '@/lib/account';
import { COVER_STYLES } from '@/lib/gatherings';
import { ancestorsQuery, compressImage } from '@/lib/learn';
import {
  addDays, challengePhotoUrls, challengesQuery, dayNumber, leaderboardQuery, lengthOf, localDate, localHour, myCheckinsQuery, phaseOf, pick, rpcErrorKey,
  STARTER_DAYS, STARTERS, streaksOf, titleOf, userTz, type Challenge, type ChallengeItem, type Phase, type Starter,
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

export function ChallengesSection() {
  const { t } = useTranslation(); const { openDetail } = useGatherwell();
  const { list, leader, teamId, isLoading } = useChallenges();
  const [tab, setTab] = useState<Phase>('active'); const [editing, setEditing] = useState<Partial<Challenge> | null>(null);
  const groups = useMemo(() => ({ active: list.filter(c => phaseOf(c) === 'active'), upcoming: list.filter(c => phaseOf(c) === 'upcoming').reverse(), past: list.filter(c => phaseOf(c) === 'past') }), [list]);
  if (isLoading) return <ListSkeleton />;
  return <section className="panel" id="challenges">
    <div className="section-heading"><h2>{t('challenges.title')}</h2>{leader ? <Button onClick={() => setEditing({})}><Plus />{t('challenges.new')}</Button> : !list.length && <span className="chip sample-badge">{t('common.sample')}</span>}</div>
    {list.length ? <>
      <div className="segmented-tabs" role="tablist">{(['active', 'upcoming', 'past'] as const).map(k => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>{t(`challenges.phase.${k}`)} <span className="tab-count">{groups[k].length}</span></button>)}</div>
      {groups[tab].length ? <div className="challenge-list">{groups[tab].map(c => <ChallengeRow key={c.id} c={c} />)}</div> : <p className="auth-subtitle">{t(`challenges.none.${tab}`)}</p>}
    </> : <div className="challenge-list">{STARTERS.slice(0, 2).map((k, i) => <button type="button" key={k} className="challenge-row" onClick={() => openDetail(t(`challenges.starter.${k}.title`), t('challenges.sampleNote'))}>
      <div className="gathering-cover challenge-thumb" style={{ backgroundImage: COVER_STYLES[i] }} aria-hidden="true"><span>{t(`challenges.starter.${k}.title`)[0]}</span></div>
      <span className="lesson-info"><strong>{t(`challenges.starter.${k}.title`)}</strong><small>{t('challenges.dayOf', { day: 6 - i * 3, total: STARTER_DAYS[k] })} · {t('challenges.joinedCount', { count: 18 - i * 7 })}</small></span><span className="chip sample-badge">{t('common.sample')}</span></button>)}</div>}
    {leader && <ChallengeEditor draft={editing} teamId={teamId} onClose={() => setEditing(null)} />}
  </section>;
}

export function ChallengeEditor({ draft, teamId, onClose }: { draft: Partial<Challenge> | null; teamId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation(); const qc = useQueryClient(); const { userId } = useGatherwell();
  const enT = i18n.getFixedT('en'); const esT = i18n.getFixedT('es');
  const today = localDate();
  const empty = { title_en: '', title_es: '', description_en: '', description_es: '', daily_prompt_en: '', daily_prompt_es: '', starts_on: addDays(today, 1), ends_on: addDays(today, 21), cover_url: null as string | null, cover_style: 0 };
  const [f, setF] = useState(empty); const [busy, setBusy] = useState(false); const [starter, setStarter] = useState<Starter | null>(null);
  const { data: planSt } = useQuery(planStatusQuery(userId)); const canSell = planSt?.connect_status === 'active';
  const [paid, setPaid] = useState(false); const [price, setPrice] = useState('');
  useEffect(() => { setPaid(!!draft?.is_paid); setPrice(draft?.price_cents ? String(draft.price_cents / 100) : ''); }, [draft]);
  useEffect(() => { if (draft) { setStarter(null); setF(draft.id ? { title_en: draft.title_en ?? '', title_es: draft.title_es ?? '', description_en: draft.description_en ?? '', description_es: draft.description_es ?? '', daily_prompt_en: draft.daily_prompt_en ?? '', daily_prompt_es: draft.daily_prompt_es ?? '', starts_on: draft.starts_on ?? empty.starts_on, ends_on: draft.ends_on ?? empty.ends_on, cover_url: draft.cover_url ?? null, cover_style: draft.cover_style ?? 0 } : empty); } }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps
  const useStarter = (k: Starter) => {
    setStarter(k);
    const g = (fx: typeof enT, key: string) => fx(`challenges.starter.${k}.${key}`);
    setF({ ...f, title_en: g(enT, 'title'), title_es: g(esT, 'title'), description_en: g(enT, 'description'), description_es: g(esT, 'description'), daily_prompt_en: g(enT, 'prompt'), daily_prompt_es: g(esT, 'prompt'), ends_on: addDays(f.starts_on, STARTER_DAYS[k] - 1), cover_style: STARTERS.indexOf(k) });
  };
  const { data: types = [] } = useQuery({ queryKey: ['challenge-types'], enabled: !!draft && !draft.id, queryFn: async () => (await supabase.from('challenge_types').select('*').eq('is_published', true).order('sort_order')).data ?? [] });
  const [typeId, setTypeId] = useState<string | null>(null);
  const useType = (ct: (typeof types)[number]) => { setStarter(null); setTypeId(ct.id); setF({ ...f, title_en: ct.title_en, title_es: ct.title_es, description_en: ct.description_en ?? '', description_es: ct.description_es ?? '', daily_prompt_en: ct.daily_prompt_en ?? '', daily_prompt_es: ct.daily_prompt_es ?? '', ends_on: addDays(f.starts_on, ct.duration_days - 1) }); };
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const ok = !!(f.title_en.trim() || f.title_es.trim()) && f.starts_on && f.ends_on >= f.starts_on;
  const save = async () => {
    setBusy(true);
    const row = { title_en: f.title_en.trim(), title_es: f.title_es.trim(), description_en: f.description_en.trim() || null, description_es: f.description_es.trim() || null, daily_prompt_en: f.daily_prompt_en.trim() || null, daily_prompt_es: f.daily_prompt_es.trim() || null, starts_on: f.starts_on, ends_on: f.ends_on, cover_url: f.cover_url, cover_style: f.cover_style, ...(canSell || !paid ? { is_paid: paid && !!price, price_cents: paid && price ? Math.round(Number(price) * 100) : null } : {}) };
    const res = draft?.id ? await supabase.from('challenges').update(row).eq('id', draft.id) : await supabase.from('challenges').insert({ ...row, team_id: teamId, created_by: userId });
    setBusy(false);
    if (res.error) { toast.error(t(rpcErrorKey(res.error))); return; }
    toast.success(t('templates.saved')); await qc.invalidateQueries({ queryKey: ['challenges'] }); onClose();
  };
  const remove = async () => {
    if (!draft?.id || !window.confirm(t('challenges.confirmDelete'))) return;
    const res = await supabase.from('challenges').delete().eq('id', draft.id);
    if (res.error) { toast.error(t(rpcErrorKey(res.error))); return; }
    await qc.invalidateQueries({ queryKey: ['challenges'] }); onClose();
  };
  const field = (id: string, label: string, k: keyof typeof empty, area = false) => <div className="form-field"><label className="field-label" htmlFor={id}>{label}</label>{area ? <Textarea id={id} rows={3} maxLength={1000} className="field-textarea" value={f[k] as string} onChange={set(k)} /> : <Input id={id} maxLength={120} className="field-input" value={f[k] as string} onChange={set(k)} />}{area && <ClaimGuard text={f[k] as string} lang={String(k).endsWith('_es') ? 'es' : 'en'} onUse={v => setF({ ...f, [k]: v })} />}</div>;
  return <ResponsiveSheet open={!!draft} onOpenChange={o => !o && onClose()} title={draft?.id ? t('challenges.edit') : t('challenges.new')} description={t('challenges.claimRule')}>
    <div className="edit-form">
      {!draft?.id && <div className="form-field"><span className="field-label">{t('challenges.startFrom')}</span>
        <div className="starter-grid">{STARTERS.map(k => <button type="button" key={k} className={`choice-card ${starter === k ? 'is-selected' : ''}`} aria-pressed={starter === k} onClick={() => useStarter(k)}><strong>{t(`challenges.starter.${k}.title`)}</strong><small>{t('challenges.days', { count: STARTER_DAYS[k] })}</small></button>)}
          {types.map(ct => <button type="button" key={ct.id} className={`choice-card ${typeId === ct.id ? 'is-selected' : ''}`} aria-pressed={typeId === ct.id} onClick={() => useType(ct)}><strong>{i18n.resolvedLanguage === 'es' ? ct.title_es : ct.title_en}</strong><small>{t('challenges.days', { count: ct.duration_days })}</small></button>)}</div></div>}
      <div className="bilingual">{field('ch-ten', `${t('templates.title')} · EN`, 'title_en')}{field('ch-tes', `${t('templates.title')} · ES`, 'title_es')}</div>
      <div className="choice-pair">
        <div className="form-field"><label className="field-label" htmlFor="ch-start">{t('challenges.startsOn')}</label><Input id="ch-start" type="date" className="field-input" value={f.starts_on} onChange={e => { const len = Math.max(0, (new Date(f.ends_on).getTime() - new Date(f.starts_on).getTime()) / 86_400_000); setF({ ...f, starts_on: e.target.value, ends_on: e.target.value ? addDays(e.target.value, len) : f.ends_on }); }} /></div>
        <div className="form-field"><label className="field-label" htmlFor="ch-end">{t('challenges.endsOn')}</label><Input id="ch-end" type="date" min={f.starts_on} className="field-input" value={f.ends_on} onChange={set('ends_on')} /></div>
      </div>
      <div className="bilingual">{field('ch-den', `${t('templates.description')} · EN`, 'description_en', true)}{field('ch-des', `${t('templates.description')} · ES`, 'description_es', true)}</div>
      <div className="bilingual">{field('ch-pen', `${t('challenges.dailyPrompt')} · EN`, 'daily_prompt_en', true)}{field('ch-pes', `${t('challenges.dailyPrompt')} · ES`, 'daily_prompt_es', true)}</div>
      <div className="form-field"><span className="field-label">{t('onboarding.cover')}</span>
        <GatheringCover path={f.cover_url} style={f.cover_style} title={f.title_en || f.title_es || 'C'} className="cover-preview" />
        <div className="cover-styles">{COVER_STYLES.map((bg, i) => <button key={i} type="button" className={`cover-swatch ${!f.cover_url && f.cover_style === i ? 'is-selected' : ''}`} style={{ backgroundImage: bg }} aria-label={`${t('onboarding.cover')} ${i + 1}`} aria-pressed={!f.cover_url && f.cover_style === i} onClick={() => setF({ ...f, cover_url: null, cover_style: i })} />)}</div>
        <label className="file-button"><Upload />{t('onboarding.uploadCover')}<input type="file" accept="image/*" hidden onChange={async e => { const x = e.target.files?.[0]; if (!x) return; try { setF({ ...f, cover_url: await uploadMedia(userId, await compressImage(x), 'cover') }); } catch { toast.error(t('profile.saveError')); } }} /></label></div>
      <label className={`switch-row ${canSell ? '' : 'is-disabled'}`}><Switch checked={paid} disabled={!canSell} onCheckedChange={setPaid} /><span><strong>{t('challenges.paid')}</strong><small>{canSell ? t('billing.priceHint') : t('billing.priceNeedsPayouts')}</small></span></label>
      {paid && canSell && <div><label className="field-label" htmlFor="c-price">{t('billing.price')}</label><Input id="c-price" inputMode="decimal" className="field-input" value={price} onChange={e => setPrice(e.target.value.replace(/[^\d.]/g, '').slice(0, 7))} placeholder="$0" /></div>}
      <Button className="onboarding-continue" disabled={busy || !ok} onClick={save}>{busy ? t('onboarding.saving') : t('profile.save')}</Button>
      {draft?.id && <Button variant="ghost" className="danger-link" onClick={remove}><Trash2 />{t('challenges.delete')}</Button>}
    </div>
  </ResponsiveSheet>;
}

async function storyCard(name: string, title: string, days: number, line: string, daysLabel: string) {
  await document.fonts?.ready;
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 1080, 1920); g.addColorStop(0, '#2F2340'); g.addColorStop(1, '#7A5FA8'); x.fillStyle = g; x.fillRect(0, 0, 1080, 1920);
  x.strokeStyle = 'rgba(255,255,255,0.08)'; x.lineWidth = 2; for (let r = 220; r < 1400; r += 140) { x.beginPath(); x.arc(980, 260, r, 0, Math.PI * 2); x.stroke(); }
  x.fillStyle = '#F3C6A5'; x.fillRect(96, 140, 96, 96); x.fillStyle = '#2F2340'; x.font = '600 72px Inter, sans-serif'; x.textAlign = 'center'; x.fillText('g', 144, 212);
  x.textAlign = 'left'; x.fillStyle = '#FFFFFF'; x.font = '700 44px Inter, sans-serif'; x.fillText('Gatherwell', 224, 206);
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
    setBusy(true);
    try {
      let photo: string | null = null;
      if (file) { const small = await compressImage(file, 1400); const { data: room } = await supabase.rpc('storage_allows', { _bytes: small.size }); if (room === false) throw new Error('storage_limit'); photo = `${userId}/${c.id}/${crypto.randomUUID()}.jpg`; const up = await supabase.storage.from('challenge-photos').upload(photo, small, { contentType: small.type }); if (up.error) throw up.error; }
      const { data, error } = await supabase.rpc('challenge_check_in', { _c: c.id, _date: date, _tz: userTz(), _note: note, ...(photo ? { _photo: photo } : {}) }); if (!error) trackEvent('challenge_checkin');
      if (error) throw error;
      const r = data as { current?: number } | null;
      toast.success(t('challenges.checkedIn'), { description: t('challenges.streakShort', { count: r?.current ?? 1 }) });
      await Promise.all([qc.invalidateQueries({ queryKey: ['challenge-checkins', userId, c.id] }), qc.invalidateQueries({ queryKey: ['challenge-board', c.id] }), qc.invalidateQueries({ queryKey: ['challenge-stats', c.id] })]);
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
    {urls.length ? <div className="photo-grid">{urls.map(u => <a key={u} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt={t('challenges.progressPhoto')} loading="lazy" /></a>)}</div> : <p className="auth-subtitle">{t('challenges.noPhotos')}</p>}</section>;
}

export function ChallengePage({ id }: { id: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en'; const qc = useQueryClient();
  const { userId } = useGatherwell(); const { data: workspace } = useQuery(workspaceQuery(userId));
  const { data: c, isLoading, isError, refetch } = useQuery({ queryKey: ['challenge', id], queryFn: async () => {
    const { data, error } = await supabase.from('challenges').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  } });
  const { data: joinedRow, refetch: refetchJoin } = useQuery({ queryKey: ['challenge-joined', id, userId], queryFn: async () => !!(await supabase.from('challenge_members').select('challenge_id').eq('challenge_id', id).eq('user_id', userId).maybeSingle()).data });
  const { data: mine = [] } = useQuery(myCheckinsQuery(userId, id));
  const { data: board = [] } = useQuery(leaderboardQuery(id));
  const [sheetDate, setSheetDate] = useState<string | null>(null); const [editing, setEditing] = useState<Partial<Challenge> | null>(null); const [busy, setBusy] = useState(false);
  const payGate = usePaymentGate(); const payChallenge = useServerFn(startChallengeCheckout);
  if (isError) return <RetryState retry={() => void refetch()} />;
  if (isLoading) return <ListSkeleton />;
  if (!c) return <section className="panel"><Link to="/team" className="back-link"><ArrowLeft />{t('nav.team')}</Link><p className="auth-subtitle">{t('learnHub.notFound')}</p></section>;
  const today = localDate(); const yesterday = addDays(today, -1); const phase = phaseOf(c, today); const len = lengthOf(c);
  const dates = new Set(mine.map(m => m.checkin_date)); const s = streaksOf([...dates], today);
  const todayRow = mine.find(m => m.checkin_date === today);
  const canYesterday = localHour() < 12 && yesterday >= c.starts_on && yesterday <= c.ends_on && !dates.has(yesterday);
  const leader = workspace?.role === 'leader';
  const meRow = board.find(r => r.user_id === userId); const top = board.slice(0, 10);
  const joined = !!joinedRow;
  const join = async () => {
    if (c.is_paid && c.price_cents) { void payGate.run(() => payChallenge({ data: { challengeId: id, origin: window.location.origin, lang: lang === 'es' ? 'es' : 'en' } })); return; }
    setBusy(true); const { error } = await supabase.from('challenge_members').insert({ challenge_id: id, user_id: userId }); setBusy(false);
    if (error) { toast.error(t(rpcErrorKey(error))); return; }
    await Promise.all([refetchJoin(), qc.invalidateQueries({ queryKey: ['challenge-board', id] }), qc.invalidateQueries({ queryKey: ['challenges'] })]);
  };
  const title = titleOf(c, lang); const prompt = pick(lang, c.daily_prompt_en, c.daily_prompt_es); const desc = pick(lang, c.description_en, c.description_es);
  const timeOf = (iso: string) => new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  return <>
    <Link to="/team" hash="challenges" className="back-link"><ArrowLeft />{t('challenges.title')}</Link>
    {payGate.sheet}
    <GatheringCover path={c.cover_url} style={c.cover_style} title={title} className="challenge-hero" />
    <div className="lesson-head"><span className="eyebrow">{phase === 'active' ? t('challenges.dayOf', { day: dayNumber(c, today), total: len }) : t(`challenges.phase.${phase}`)}</span>
      <h1>{title}</h1><p className="track-facts">{fmtDate(c.starts_on, lang)} – {fmtDate(c.ends_on, lang)} · {t('challenges.joinedCount', { count: board.length })}{c.is_paid && c.price_cents ? ` · ${formatMoney(c.price_cents, lang)}` : ''}</p>
      {desc && <p className="challenge-desc">{desc}</p>}
      <div className="recipe-actions">{!joined && phase !== 'past' && <Button disabled={busy} onClick={join}>{t('challenges.joinChallenge')}</Button>}{leader && <Button variant="secondary" onClick={() => setEditing(c)}><Pencil />{t('challenges.edit')}</Button>}</div></div>

    {joined && s.total >= len && <Finisher c={c} days={len} />}

    {joined && phase === 'active' && <section className="panel prompt-card"><span className="eyebrow">{t('challenges.todaysPrompt')}</span><p className="prompt-text">{prompt || t('challenges.defaultPrompt')}</p>
      {todayRow ? <div className="done-today" role="status"><Check /><span><strong>{t('challenges.doneToday')}</strong><small>{t('challenges.doneAt', { time: timeOf(todayRow.created_at) })}</small></span></div>
        : <Button className="checkin-big" onClick={() => setSheetDate(today)}><Check />{t('challenges.checkInToday')}</Button>}
      {canYesterday && <button type="button" className="text-link yesterday-link" onClick={() => setSheetDate(yesterday)}>{t('challenges.checkInYesterday')}</button>}</section>}

    {joined && <section className="panel"><div className="streak-row">
      <div className={`streak ${s.current > 0 ? 'is-lit' : ''}`}><Flame className="streak-flame" aria-hidden="true" /><strong>{s.current}</strong><span>{t('challenges.currentStreak')}</span></div>
      <div className="streak"><strong>{s.best}</strong><span>{t('challenges.bestStreak')}</span></div>
      <div className="streak"><strong>{s.total}/{len}</strong><span>{t('challenges.checkIns')}</span></div></div>
      <div className="day-grid" role="list" aria-label={t('challenges.calendar')}>{Array.from({ length: len }, (_, i) => { const d = addDays(c.starts_on, i); const on = dates.has(d); return <span role="listitem" key={d} className={`day-cell ${on ? 'is-on' : ''} ${d === today ? 'is-today' : ''} ${d > today ? 'is-future' : ''}`} aria-label={`${fmtDate(d, lang)}${on ? ` · ${t('challenges.checkedIn')}` : ''}`}>{on ? <Check /> : i + 1}</span>; })}</div></section>}

    <section className="panel"><div className="section-heading"><div><h2>{t('challenges.leaderboard')}</h2><p>{t('challenges.leaderboardNote')}</p></div>{meRow && <span className="chip">{t('challenges.yourRank', { rank: meRow.rank })}</span>}</div>
      {top.length ? <ol className="board">{top.map(r => <li key={r.user_id} className={r.user_id === userId ? 'is-me' : ''}><span className="board-rank">{r.rank}</span><span className="initial-avatar">{initialsOf(r.full_name)}</span><span className="lesson-info"><strong>{r.full_name || t('teamSpace.someone')}</strong><small>{t('challenges.streakShort', { count: r.current_streak })} · {t('challenges.bestShort', { count: r.best_streak })}</small></span><strong className="board-count">{r.checkins}</strong></li>)}</ol> : <p className="auth-subtitle">{t('challenges.boardEmpty')}</p>}
      {meRow && meRow.rank > 10 && <p className="board-me">{t('challenges.youreRank', { rank: meRow.rank })}</p>}</section>

    {joined && <PhotoGallery paths={mine.map(m => m.photo_path).filter((p): p is string => !!p)} />}
    {leader && <LeaderPanel c={c} />}
    {sheetDate && <CheckInSheet open={!!sheetDate} onClose={() => setSheetDate(null)} c={c} date={sheetDate} />}
    {leader && workspace && <ChallengeEditor draft={editing} teamId={c.team_id || workspace.teamId} onClose={() => { setEditing(null); void qc.invalidateQueries({ queryKey: ['challenge', id] }); }} />}
  </>;
}
