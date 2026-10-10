import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GwFeatureTile, GwIcon } from '@/components/gw-icon';
import { formatMoney } from '@/lib/billing';
import { initialsOf } from '@/lib/account';

type Kind = 'offer' | 'event';
type Info = { available: boolean; mine: { status: 'pending' | 'approved' | 'declined'; pay_cents: number } | null; is_host: boolean } | null;
type Req = { id: string; name: string | null; note: string | null; pay_cents: number; status: 'pending' | 'approved' | 'declined'; created_at: string };

const errKey = (e: { message?: string } | null) => `community.errors.${['no_seats', 'not_signed_in', 'own_offer', 'too_long', 'invalid_amount', 'already_decided'].find(k => e?.message?.includes(k)) ?? 'failed'}`;
const infoQuery = (kind: Kind, target: string) => ({ queryKey: ['community-seat', kind, target], queryFn: async () => { const { data } = await supabase.rpc('community_seat_info', { _kind: kind, _target: target }); return (data as unknown as Info) ?? null; } });

/** Private request card for members. Never shows who else used a seat. */
export function CommunitySeatCard({ kind, target, signedIn }: { kind: Kind; target: string; signedIn: boolean }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en'; const qc = useQueryClient();
  const { data } = useQuery(infoQuery(kind, target));
  const [open, setOpen] = useState(false); const [note, setNote] = useState(''); const [mode, setMode] = useState<'free' | 'pwyc'>('free'); const [amount, setAmount] = useState(''); const [busy, setBusy] = useState(false);
  if (!data || data.is_host) return null;
  const mine = data.mine;
  const send = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('request_community_seat', { _kind: kind, _target: target, _note: note, _pay_cents: mode === 'pwyc' ? Math.round(Number(amount || 0) * 100) : 0 });
    setBusy(false);
    if (error) return void toast.error(t(errKey(error)));
    toast.success(t('community.sent')); setOpen(false); await qc.invalidateQueries({ queryKey: ['community-seat', kind, target] });
  };
  const withdraw = async () => { await supabase.rpc('withdraw_community_request', { _kind: kind, _target: target }); await qc.invalidateQueries({ queryKey: ['community-seat', kind, target] }); };
  if (!mine && !data.available) return null;
  return <section className="community-card">
    <GwFeatureTile name="HandHeart" size={22} />
    <div className="community-body">
      <strong>{t('community.title')}</strong>
      {!mine && <p>{t('community.body')}</p>}
      {mine?.status === 'pending' && <><p>{t('community.pending')}</p><Button variant="ghost" size="sm" onClick={withdraw}>{t('community.withdraw')}</Button></>}
      {mine?.status === 'approved' && <p>{mine.pay_cents ? t('community.approvedPay', { amount: formatMoney(mine.pay_cents, lang) }) : t('community.approvedFree')}</p>}
      {mine?.status === 'declined' && <p>{t('community.declined')}</p>}
      {!mine && !open && (signedIn ? <Button variant="secondary" onClick={() => setOpen(true)}>{t('community.request')}</Button> : <Button asChild variant="secondary"><Link to="/login">{t('community.signIn')}</Link></Button>)}
      {open && <div className="community-form">
        <div className="segmented full" role="group" aria-label={t('community.howLabel')}>{(['free', 'pwyc'] as const).map(m => <Button key={m} variant="ghost" className={mode === m ? 'selected' : ''} aria-pressed={mode === m} onClick={() => setMode(m)}>{t(`community.mode.${m}`)}</Button>)}</div>
        {mode === 'pwyc' && <><label className="field-label" htmlFor={`cs-amt-${target}`}>{t('community.amount')}</label><Input id={`cs-amt-${target}`} inputMode="decimal" className="field-input" value={amount} placeholder="$0" onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, '').slice(0, 7))} /></>}
        <label className="field-label" htmlFor={`cs-note-${target}`}>{t('community.note')}</label>
        <Textarea id={`cs-note-${target}`} rows={3} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder={t('community.notePh')} />
        <p className="muted-small">{t('community.private')}</p>
        <div className="form-actions"><Button disabled={busy || (mode === 'pwyc' && !(Number(amount) >= 1))} onClick={send}>{t('community.send')}</Button><Button variant="ghost" onClick={() => setOpen(false)}>{t('community.cancel')}</Button></div>
      </div>}
    </div>
  </section>;
}

/** Host-only list of private requests. */
export function CommunityRequestsPanel({ kind, target, seats }: { kind: Kind; target: string; seats: number | null | undefined }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage ?? 'en'; const qc = useQueryClient();
  const key = ['community-requests', kind, target];
  const { data = [] } = useQuery({ queryKey: key, enabled: !!seats, queryFn: async () => { const { data, error } = await supabase.rpc('community_requests', { _kind: kind, _target: target }); if (error) throw error; return (data as unknown as Req[]) ?? []; } });
  const [busy, setBusy] = useState<string | null>(null);
  if (!seats) return null;
  const used = data.filter(r => r.status === 'approved').length;
  const decide = async (id: string, approve: boolean) => {
    setBusy(id); const { error } = await supabase.rpc('decide_community_seat', { _id: id, _approve: approve }); setBusy(null);
    if (error) return void toast.error(t(errKey(error)));
    toast.success(t(approve ? 'community.approvedToast' : 'community.declinedToast')); await qc.invalidateQueries({ queryKey: key });
  };
  return <section className="panel community-panel">
    <div className="section-heading"><h2>{t('community.hostTitle')}</h2><span className="chip tabular-nums">{t('community.used', { used, seats })}</span></div>
    <p className="muted-small">{t('community.hostNote')}</p>
    {data.length ? <ul className="community-list">{data.map(r => <li key={r.id}>
      <span className="initial-avatar" aria-hidden="true">{initialsOf(r.name)}</span>
      <div className="community-req-main"><strong>{r.name ?? t('teamSpace.someone')}</strong><small>{r.pay_cents ? t('community.offersPay', { amount: formatMoney(r.pay_cents, lang) }) : t('community.asksFree')}</small>{r.note && <p>{r.note}</p>}</div>
      {r.status === 'pending' ? <div className="community-actions"><Button size="sm" disabled={busy === r.id || used >= seats} onClick={() => decide(r.id, true)}><GwIcon name="Check" />{t('community.approve')}</Button><Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => decide(r.id, false)}>{t('community.decline')}</Button></div>
        : <span className="chip">{t(`community.status.${r.status}`)}</span>}
    </li>)}</ul> : <p className="muted-copy">{t('community.none')}</p>}
  </section>;
}
