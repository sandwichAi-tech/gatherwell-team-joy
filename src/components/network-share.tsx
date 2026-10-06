import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useGatherwell } from '@/components/gatherwell-shell';
import { netRpc, referralQuery, sharedQuery } from '@/lib/network';

export function NetworkShareToggle({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: on = false } = useQuery(sharedQuery(eventId));
  const [busy, setBusy] = useState(false);
  return <label className="switch-row network-share">
    <Switch checked={on} disabled={busy} aria-label={t('network.shareToNetwork')} onCheckedChange={async v => {
      setBusy(true);
      try { await netRpc('network_share', { _event: eventId, _on: v }); toast.success(t(v ? 'network.shared' : 'network.unshared')); await qc.invalidateQueries({ queryKey: ['network-shared', eventId] }); }
      catch { toast.error(t('network.error')); }
      setBusy(false);
    }} />
    <span><strong>{t('network.shareToNetwork')}</strong><small>{t('network.shareHelp')}</small></span>
  </label>;
}

/** Referral thank-yous between partner hosts, shown in Earnings. Guests only, never team recruiting. */
export function ReferralCard({ format }: { format: (cents: number) => string }) {
  const { t } = useTranslation();
  const { userId } = useGatherwell();
  const qc = useQueryClient();
  const { data } = useQuery(referralQuery(userId));
  const [kind, setKind] = useState<'none' | 'percent' | 'flat' | null>(null);
  const [amount, setAmount] = useState('');
  const current = kind ?? data?.thanks?.kind ?? 'none';
  const value = amount || (data?.thanks ? String(data.thanks.kind === 'flat' ? data.thanks.amount / 100 : data.thanks.amount) : '');
  const save = async () => {
    const n = Number(value || 0);
    const amt = current === 'flat' ? Math.round(n * 100) : Math.round(n);
    if (!Number.isFinite(n) || n < 0 || (current === 'percent' && amt > 50)) { toast.error(t('network.thanksInvalid')); return; }
    try { await netRpc('set_referral_thanks', { _kind: current, _amount: current === 'none' ? 0 : amt }); toast.success(t('profile.saved')); await qc.invalidateQueries({ queryKey: ['referrals'] }); }
    catch { toast.error(t('network.error')); }
  };
  return <section className="panel">
    <div className="section-heading"><h2>{t('network.referralsTitle')}</h2></div>
    <p className="auth-subtitle">{t('network.referralsText')}</p>
    <div className="stats-grid">
      <div className="stat-card"><div className="stat-heading"><span>{t('network.guestsSent')}</span></div><strong className="stat-value">{data?.sent ?? 0}</strong></div>
      <div className="stat-card"><div className="stat-heading"><span>{t('network.guestsReceived')}</span></div><strong className="stat-value">{data?.received ?? 0}</strong></div>
      <div className="stat-card"><div className="stat-heading"><span>{t('network.thanksEarned')}</span></div><strong className="stat-value">{format(data?.thanks_earned_cents ?? 0)}</strong></div>
      <div className="stat-card"><div className="stat-heading"><span>{t('network.thanksOwed')}</span></div><strong className="stat-value">{format(data?.thanks_owed_cents ?? 0)}</strong></div>
    </div>
    <div className="form-field"><span className="field-label">{t('network.thanksLabel')}</span>
      <div className="segmented" role="group" aria-label={t('network.thanksLabel')}>{(['none', 'percent', 'flat'] as const).map(k => <Button key={k} variant="ghost" aria-pressed={current === k} className={current === k ? 'selected' : ''} onClick={() => setKind(k)}>{t(`network.thanks_${k}`)}</Button>)}</div>
    </div>
    {current !== 'none' && <div className="form-field"><label className="field-label" htmlFor="thanks-amount">{t(current === 'percent' ? 'network.thanksPercent' : 'network.thanksFlat')}</label>
      <Input id="thanks-amount" className="field-input" inputMode="decimal" value={value} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} /></div>}
    <Button variant="secondary" onClick={save}>{t('profile.save')}</Button>
    <p className="muted-small">{t('network.payoutNote')}</p>
  </section>;
}
