import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { GwIcon } from '@/components/gw-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { ListSkeleton } from '@/components/launch-states';
import { confirmAction } from '@/components/confirm-dialog';
import { formatMoney } from '@/lib/billing';
import { getFounding, removeFoundingCoach, saveFoundingCoach, setCouncilAttendance, setFoundingStart } from '@/lib/admin.functions';

export type FoundingStatus = { start_date: string | null; free_until: string | null; rate_cents: number; in_window: boolean; pending_start: boolean };
export const COMMITMENTS = ['launch', 'twoMonthly', 'council', 'media', 'audience'] as const;

const fmtDate = (d: string, lang: string) => new Date(`${d}T12:00:00`).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export function useIsFounding(id: string | null | undefined) {
  const { data } = useQuery({ queryKey: ['is-founding', id], enabled: !!id, staleTime: 10 * 60_000, queryFn: async () => (await supabase.rpc('is_founding_coach', { _uid: id! })).data === true });
  return !!data;
}

export function FoundingMark() {
  const { t } = useTranslation();
  return <span className="founding-mark"><GwIcon name="Medal" size={14} />{t('founding.badge')}</span>;
}
export function FoundingSeal({ id }: { id: string }) { return useIsFounding(id) ? <> <FoundingMark /></> : null; }

/** Plan screen: what a founding coach pays now and later. */
export function FoundingPlanBanner({ f }: { f: FoundingStatus }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const rate = formatMoney(f.rate_cents, lang);
  return <section className="panel founding-plan" aria-labelledby="founding-plan-title">
    <span className="gw-feature-tile"><GwIcon name="Medal" size={24} /></span>
    <div>
      <span className="eyebrow">{t('founding.badge')}</span>
      <h2 id="founding-plan-title">{f.in_window ? t('founding.nowFree', { price: formatMoney(0, lang) }) : f.pending_start ? t('founding.pending') : t('founding.rateLocked', { rate })}</h2>
      <p className="auth-subtitle">{f.free_until ? t('founding.lockedFrom', { rate, date: fmtDate(f.free_until, lang) }) : t('founding.lockedAfter', { rate })}</p>
      <p className="field-hint">{t('founding.nonCash')}</p>
    </div>
  </section>;
}

/** Host tools: the commitments a founding coach accepts. Shown only to invited coaches. */
export function FoundingCommitmentsCard() {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en'; const qc = useQueryClient();
  const { data: row } = useQuery({ queryKey: ['my-founding'], queryFn: async () => (await supabase.from('founding_coaches').select('id, accepted_at, launch_date').maybeSingle()).data });
  const [busy, setBusy] = useState(false);
  if (!row) return null;
  const accept = async () => {
    setBusy(true); const { error } = await supabase.rpc('accept_founding'); setBusy(false);
    if (error) { toast.error(t('founding.errors.failed')); return; }
    toast.success(t('founding.welcome'));
    void qc.invalidateQueries({ queryKey: ['my-founding'] }); void qc.invalidateQueries({ queryKey: ['plan-status'] }); void qc.invalidateQueries({ queryKey: ['is-founding'] });
  };
  return <section className="panel founding-card" aria-labelledby="founding-card-title">
    <div className="section-heading"><h2 id="founding-card-title">{t('founding.commitTitle')}</h2>{row.accepted_at && <span className="chip connect-active">{t('founding.accepted')}</span>}</div>
    <p className="auth-subtitle">{row.accepted_at ? t('founding.commitDone') : t('founding.commitIntro')}</p>
    <ul className="founding-list">{COMMITMENTS.map(k => <li key={k}><GwIcon name={row.accepted_at ? 'CheckCircle2' : 'Circle'} size={20} /><span>{k === 'launch' && row.launch_date ? t('founding.c.launchOn', { date: fmtDate(row.launch_date, lang) }) : t(`founding.c.${k}`)}</span></li>)}</ul>
    {!row.accepted_at && <Button disabled={busy} onClick={() => void accept()}>{t('founding.accept')}</Button>}
  </section>;
}

type Coach = Awaited<ReturnType<typeof getFounding>>['coaches'][number];
const blank = { email: '', full_name: '', language: 'en' as 'en' | 'es', city: '', small_town: false, has_space: false, coach_type: 'independent' as 'distributor' | 'independent', audience: '', launch_date: null as string | null };

export function FoundingAdmin() {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en'; const qc = useQueryClient();
  const load = useServerFn(getFounding); const start = useServerFn(setFoundingStart); const council = useServerFn(setCouncilAttendance); const remove = useServerFn(removeFoundingCoach);
  const { data } = useQuery({ queryKey: ['admin', 'founding'], queryFn: () => load() });
  const [edit, setEdit] = useState<(typeof blank & { id?: string }) | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  if (!data) return <ListSkeleton rows={3} />;
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin', 'founding'] });
  const p = data.program; const sd = startDate ?? p.start_date ?? '';
  const full = data.coaches.length >= p.max_coaches;
  return <>
    <section className="panel"><h2 className="section-title">{t('founding.admin.clock')}</h2>
      <p className="field-hint">{t('founding.admin.clockHint', { months: p.free_months, rate: formatMoney(p.rate_cents, lang) })}</p>
      <div className="founding-start-row"><label className="field-label" htmlFor="fd-start">{t('founding.admin.startDate')}<Input id="fd-start" type="date" value={sd} onChange={e => setStartDate(e.target.value)} /></label>
        <Button variant="secondary" onClick={async () => { const r = await start({ data: { start_date: sd || null } }); if (r.ok) { toast.success(t('admin.saved')); refresh(); } else toast.error(t('admin.errors.failed')); }}>{t('founding.admin.saveStart')}</Button></div>
    </section>
    <section className="panel">
      <div className="section-heading"><h2>{t('founding.admin.title', { n: data.coaches.length, max: p.max_coaches })}</h2><Button disabled={full} onClick={() => setEdit({ ...blank })}><GwIcon name="UserPlus" size={18} />{t('founding.admin.invite')}</Button></div>
      {!data.coaches.length ? <p className="auth-subtitle">{t('founding.admin.empty')}</p> : <ul className="admin-list">{data.coaches.map((c: Coach) => {
        const onTrack = c.gatherings_month >= 2;
        return <li key={c.id} className="admin-row founding-row">
          <span className="admin-row-main"><strong>{c.full_name || c.email}</strong>
            <small>{[c.city, t(`founding.type.${c.coach_type}`), c.language === 'es' ? t('founding.lang.es') : t('founding.lang.en'), c.small_town ? t('founding.admin.smallTown') : null, c.has_space ? t('founding.admin.hasSpace') : null].filter(Boolean).join(' · ')}</small>
            <small>{c.accepted_at ? t('founding.admin.joined') : t('founding.admin.invited')}{c.launch_date ? ` · ${t('founding.admin.launch', { date: fmtDate(c.launch_date, lang) })}` : ''}</small>
            <span className="founding-progress"><span className={`chip ${onTrack ? 'connect-active' : ''}`}>{t('founding.admin.gatherings', { n: c.gatherings_month })}</span></span></span>
          <label className="founding-council"><span>{t('founding.admin.council')}</span><Switch checked={c.council_this_month} aria-label={t('founding.admin.council')} onCheckedChange={async v => { await council({ data: { id: c.id, attended: v } }); refresh(); }} /></label>
          <Button variant="secondary" onClick={() => setEdit({ id: c.id, email: c.email, full_name: c.full_name, language: c.language, city: c.city, small_town: c.small_town, has_space: c.has_space, coach_type: c.coach_type, audience: c.audience, launch_date: c.launch_date })}>{t('founding.admin.edit')}</Button>
          <Button variant="ghost" aria-label={t('founding.admin.remove')} onClick={async () => { if (await confirmAction({ title: t('founding.admin.remove'), confirmLabel: t('founding.admin.remove'), destructive: true })) { await remove({ data: { id: c.id } }); refresh(); } }}><GwIcon name="Trash2" size={18} /></Button>
        </li>;
      })}</ul>}
    </section>
    {edit && <CoachSheet value={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); refresh(); }} />}
  </>;
}

function CoachSheet({ value, onClose, onSaved }: { value: typeof blank & { id?: string }; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(); const save = useServerFn(saveFoundingCoach);
  const [v, setV] = useState(value); const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); const r = await save({ data: { ...v, launch_date: v.launch_date || null } }).catch(() => ({ ok: false as const, error: 'failed' })); setBusy(false);
    if (r.ok) { toast.success(t('admin.saved')); onSaved(); } else toast.error(t(`founding.errors.${'error' in r ? r.error : 'failed'}`, { defaultValue: t('founding.errors.failed') }));
  };
  const seg = <T extends string>(label: string, opts: readonly T[], cur: T, set: (x: T) => void, lbl: (x: T) => string) => <div><span className="field-label">{label}</span><div className="segmented full" role="group" aria-label={label}>{opts.map(o => <Button key={o} type="button" variant="ghost" aria-pressed={cur === o} className={cur === o ? 'selected' : ''} onClick={() => set(o)}>{lbl(o)}</Button>)}</div></div>;
  return <ResponsiveSheet open onOpenChange={o => { if (!o) onClose(); }} title={value.id ? t('founding.admin.edit') : t('founding.admin.invite')} footer={<Button className="onboarding-continue" disabled={busy || !/^\S+@\S+\.\S+$/.test(v.email)} onClick={() => void submit()}>{t('founding.admin.save')}</Button>}>
    <div className="founding-form">
      <label className="field-label" htmlFor="fc-email">{t('founding.f.email')}<Input id="fc-email" type="email" value={v.email} onChange={e => setV({ ...v, email: e.target.value })} /></label>
      <label className="field-label" htmlFor="fc-name">{t('founding.f.name')}<Input id="fc-name" value={v.full_name} onChange={e => setV({ ...v, full_name: e.target.value })} /></label>
      {seg(t('founding.f.language'), ['en', 'es'] as const, v.language, x => setV({ ...v, language: x }), x => t(`founding.lang.${x}`))}
      <label className="field-label" htmlFor="fc-city">{t('founding.f.city')}<Input id="fc-city" value={v.city} onChange={e => setV({ ...v, city: e.target.value })} /></label>
      <label className="settings-row is-static"><span className="settings-label">{t('founding.f.smallTown')}</span><Switch checked={v.small_town} aria-label={t('founding.f.smallTown')} onCheckedChange={x => setV({ ...v, small_town: x })} /></label>
      <label className="settings-row is-static"><span className="settings-label">{t('founding.f.hasSpace')}</span><Switch checked={v.has_space} aria-label={t('founding.f.hasSpace')} onCheckedChange={x => setV({ ...v, has_space: x })} /></label>
      {seg(t('founding.f.type'), ['distributor', 'independent'] as const, v.coach_type, x => setV({ ...v, coach_type: x }), x => t(`founding.type.${x}`))}
      <label className="field-label" htmlFor="fc-aud">{t('founding.f.audience')}<Input id="fc-aud" maxLength={280} value={v.audience} onChange={e => setV({ ...v, audience: e.target.value })} /></label>
      <label className="field-label" htmlFor="fc-launch">{t('founding.f.launch')}<Input id="fc-launch" type="date" value={v.launch_date ?? ''} onChange={e => setV({ ...v, launch_date: e.target.value || null })} /></label>
    </div>
  </ResponsiveSheet>;
}
