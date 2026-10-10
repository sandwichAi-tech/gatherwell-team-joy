import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Check, ChevronRight, Lock, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { GwIcon, type GwIconName } from '@/components/gw-icon';
import { supabase } from '@/integrations/supabase/client';
import { formatMoney } from '@/lib/billing';

type Checklist = { profile: boolean; offer: boolean; shared: boolean; first_rsvp: boolean; first_paid: boolean; earned_cents: number; celebrated: string[]; is_host: boolean };
export const coachChecklistQuery = { queryKey: ['coach-checklist'], queryFn: async (): Promise<Checklist | null> => {
  const { data, error } = await supabase.rpc('coach_checklist'); if (error) throw error; return (data as unknown as Checklist) ?? null;
} };

/** Called from share actions so "Share the link" ticks itself. */
export async function markLinkShared() {
  try { await supabase.from('coach_steps').upsert({ step: 'shared' }, { onConflict: 'user_id,step', ignoreDuplicates: true }); } catch { /* best effort */ }
}

const STEPS: { key: string; icon: GwIconName; to: string }[] = [
  { key: 'profile', icon: 'UserRound', to: '/me' },
  { key: 'offer', icon: 'Sparkles', to: '/offers' },
  { key: 'shared', icon: 'Share2', to: '/events' },
  { key: 'first_rsvp', icon: 'CalendarCheck', to: '/events' },
  { key: 'first_paid', icon: 'HandHeart', to: '/earnings' },
  { key: 'first_100', icon: 'Trophy', to: '/earnings' },
];
const EARN = [{ key: 'earn_100', cents: 10000 }, { key: 'earn_1000', cents: 100000 }, { key: 'earn_10000', cents: 1000000 }] as const;

function doneMap(c: Checklist): Record<string, boolean> {
  return { profile: c.profile, offer: c.offer, shared: c.shared || c.first_rsvp, first_rsvp: c.first_rsvp, first_paid: c.first_paid, first_100: c.earned_cents >= 10000 };
}

function Ring({ value, total }: { value: number; total: number }) {
  const r = 26; const c = 2 * Math.PI * r; const pct = total ? value / total : 0;
  return <svg className="coach-ring" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${value} / ${total}`}>
    <circle cx="32" cy="32" r={r} className="coach-ring-track" />
    <circle cx="32" cy="32" r={r} className="coach-ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 32 32)" />
    <text x="32" y="37" textAnchor="middle" className="coach-ring-label">{value}/{total}</text>
  </svg>;
}

function Celebration({ step, onClose }: { step: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  return <Dialog open={!!step} onOpenChange={o => !o && onClose()}>
    <DialogContent className="coach-celebrate">
      <span className="coach-celebrate-medal"><GwIcon name="Trophy" variant="feature" size={40} /></span>
      <DialogTitle>{step ? t(`coach.celebrate.${step}.title`) : ''}</DialogTitle>
      <DialogDescription>{step ? t(`coach.celebrate.${step}.text`) : ''}</DialogDescription>
      <p className="gw-muted-line"><Lock className="inline-icon" />{t('coach.private')}</p>
      <Button className="onboarding-continue" onClick={onClose}>{t('coach.keepGoing')}</Button>
    </DialogContent>
  </Dialog>;
}

/** Celebrates each newly reached step once, then remembers it in the backend. */
function useCelebrations(c: Checklist | null | undefined, keys: string[], done: Record<string, boolean>) {
  const qc = useQueryClient(); const [step, setStep] = useState<string | null>(null); const busy = useRef(false);
  useEffect(() => {
    if (!c || step || busy.current) return;
    const next = keys.find(k => done[k] && !c.celebrated.includes(k));
    if (!next) return;
    busy.current = true;
    // a step already reached before the checklist existed is recorded quietly
    const quiet = c.celebrated.length === 0 && keys.filter(k => done[k]).length > 1;
    void supabase.from('coach_steps').insert(quiet ? keys.filter(k => done[k] && !c.celebrated.includes(k)).map(k => ({ step: k })) : { step: next }).then(() => {
      busy.current = false; if (!quiet) setStep(next); void qc.invalidateQueries({ queryKey: coachChecklistQuery.queryKey });
    });
  }, [c, step, keys, done, qc]);
  return { step, close: () => setStep(null) };
}

export function CoachLaunchCard() {
  const { t } = useTranslation(); const qc = useQueryClient();
  const { data: c } = useQuery(coachChecklistQuery);
  const done = c ? doneMap(c) : {};
  const keys = STEPS.map(s => s.key);
  const { step, close } = useCelebrations(c, keys, done);
  if (!c || !c.is_host) return <Celebration step={step} onClose={close} />;
  const count = keys.filter(k => done[k]).length;
  const hidden = c.celebrated.includes('dismissed') || count === keys.length;
  return <>
    <Celebration step={step} onClose={close} />
    {!hidden && <section className="panel coach-launch" aria-labelledby="coach-h">
      <header className="coach-launch-head">
        <Ring value={count} total={keys.length} />
        <div><span className="gw-eyebrow">{t('coach.eyebrow')}</span><h2 id="coach-h">{t('coach.title')}</h2><p className="gw-muted-line"><Lock className="inline-icon" />{t('coach.private')}</p></div>
        <Button variant="ghost" size="icon" aria-label={t('coach.hide')} onClick={async () => { await supabase.from('coach_steps').insert({ step: 'dismissed' }); await qc.invalidateQueries({ queryKey: coachChecklistQuery.queryKey }); }}><X /></Button>
      </header>
      <Button asChild className="qs-entry"><Link to="/start">{t('quickStart.entry')}</Link></Button>
      <ol className="coach-steps">{STEPS.map(s => <li key={s.key} className={done[s.key] ? 'is-done' : ''}>
        <Link to={s.to} className="coach-step">
          <span className="coach-step-icon">{done[s.key] ? <Check /> : <GwIcon name={s.icon} size={20} />}</span>
          <span className="coach-step-text"><strong>{t(`coach.steps.${s.key}`)}</strong>{!done[s.key] && <small>{t(`coach.hints.${s.key}`)}</small>}</span>
          {!done[s.key] && <ChevronRight className="settings-chevron" />}
        </Link></li>)}</ol>
    </section>}
  </>;
}

/** Private lifetime earnings milestones in Host tools. */
export function EarningsMilestones() {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const { data: c } = useQuery(coachChecklistQuery);
  const done = Object.fromEntries(EARN.map(e => [e.key, (c?.earned_cents ?? 0) >= e.cents]));
  const { step, close } = useCelebrations(c, EARN.map(e => e.key), done);
  if (!c) return null;
  return <section className="panel earn-milestones" aria-labelledby="earn-ms-h">
    <Celebration step={step} onClose={close} />
    <h2 id="earn-ms-h" className="section-title">{t('coach.milestonesTitle')}</h2>
    <p className="gw-muted-line"><Lock className="inline-icon" />{t('coach.private')}</p>
    <ol className="earn-milestone-list">{EARN.map(e => <li key={e.key} className={done[e.key] ? 'is-done' : ''}>
      <span className="coach-step-icon">{done[e.key] ? <Check /> : <GwIcon name="Trophy" size={20} />}</span>
      <strong>{formatMoney(e.cents, lang)}</strong><small>{done[e.key] ? t('coach.reached') : t('coach.toGo', { amount: formatMoney(Math.max(0, e.cents - c.earned_cents), lang) })}</small>
    </li>)}</ol>
  </section>;
}

/** Neutral price guidance from anonymous platform data. */
export function PriceGuidance({ category }: { category: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en';
  const { data } = useQuery({ queryKey: ['price-guidance', category], queryFn: async () => {
    const { data, error } = await supabase.rpc('price_guidance', { _category: category === 'more' ? '' : category }); if (error) throw error;
    return data as unknown as { sample: boolean; low: number; high: number };
  } });
  if (!data) return null;
  const low = data.low ? formatMoney(data.low, lang) : t('offers.free');
  return <small className="field-hint price-guidance">{data.sample && <span className="chip sample-badge">{t('common.sample')}</span>}{t('coach.priceGuide', { low, high: formatMoney(data.high, lang) })}</small>;
}
