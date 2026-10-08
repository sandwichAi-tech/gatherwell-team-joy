import { tgShare } from '@/lib/chat-links';
import { CopyButton } from '@/components/copy-button';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Copy, MessageCircle, MessageSquareText, Share2, Gift, Check, Trash2, Send } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useGatherwell } from '@/components/gatherwell-shell';
import { ListSkeleton, RetryState } from '@/components/launch-states';
import {
  addReward, guestWelcomeQuery, honorCode, hostRewardsQuery, myWelcomeQuery, redeemGuest, redeemMine, removeReward, rewardTitle, toggleReward, welcomeLink, type WelcomeSummary,
} from '@/lib/welcome';

const dateFmt = (iso: string, lang: string) => new Date(iso).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric' });

function WelcomeBody({ data, onRedeem }: { data: WelcomeSummary; onRedeem: (reward: string) => Promise<{ data: unknown; error: unknown }> }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const link = welcomeLink(data.code);
  const msg = t('welcome.shareMessage', { link });
  const came = data.friends.filter(f => f.status === 'earned').length;
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ text: msg }); } catch { /* dismissed */ } }
    else { await navigator.clipboard.writeText(link); toast.success(t('onboarding.copied')); }
  };
  const redeem = async (id: string) => {
    setBusy(id);
    const { data: code, error } = await onRedeem(id);
    setBusy(null);
    if (error) { toast.error(t(String((error as { message?: string }).message ?? '').includes('not_enough') ? 'welcome.notEnough' : 'welcome.error')); return; }
    toast.success(t('welcome.redeemed', { code: String(code) }));
    await qc.invalidateQueries({ queryKey: ['welcome'] });
  };
  return <div className="welcome">
    <p className="auth-subtitle">{t('welcome.intro')}</p>
    <div className="welcome-link"><Input readOnly value={link} aria-label={t('welcome.yourLink')} className="field-input" onFocus={e => e.currentTarget.select()} /></div>
    <div className="share-grid">
      <CopyButton text={link} />
      <Button asChild variant="secondary"><a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer"><MessageCircle />{t('teamSpace.whatsapp')}</a></Button><Button asChild variant="secondary"><a href={tgShare(msg)} target="_blank" rel="noopener noreferrer"><Send />{t('teamSpace.telegram')}</a></Button>
      <Button asChild variant="secondary"><a href={`sms:?&body=${encodeURIComponent(msg)}`}><MessageSquareText />{t('gathering.text')}</a></Button>
      <Button variant="secondary" onClick={share}><Share2 />{t('welcome.share')}</Button>
    </div>
    <div className="stat-pair"><div><strong>{came}</strong><small>{t('welcome.friendsCame')}</small></div><div><strong>{data.hosts.reduce((s, h) => s + h.points, 0)}</strong><small>{t('welcome.points')}</small></div></div>
    <p className="muted-small">{t('welcome.howItWorks')}</p>

    {data.hosts.length > 0 && <><h3 className="field-label">{t('welcome.rewards')}</h3>
      {data.hosts.map(h => <div key={h.host_id} className="welcome-host">
        <div className="welcome-host-head"><strong>{h.host_name || t('welcome.aHost')}</strong><span className="chip">{t('welcome.pointsCount', { count: h.points })}</span></div>
        {h.rewards.length ? <ul className="welcome-rewards">{h.rewards.map(r => <li key={r.id}><Gift className="inline-icon" /><span>{rewardTitle(r, lang)}<small>{t('welcome.pointsCount', { count: r.cost })}</small></span>
          <Button size="sm" variant="secondary" disabled={h.points < r.cost || busy === r.id} onClick={() => redeem(r.id)}>{t('welcome.redeem')}</Button></li>)}</ul>
          : <p className="muted-small">{t('welcome.noRewardsYet')}</p>}
      </div>)}</>}

    {data.redemptions.length > 0 && <><h3 className="field-label">{t('welcome.myCodes')}</h3>
      <ul className="welcome-codes">{data.redemptions.map(d => <li key={d.code}><code>{d.code}</code><span>{d.title}<small>{d.host_name} · {t(d.status === 'honored' ? 'welcome.used' : 'welcome.showHost')}</small></span></li>)}</ul></>}

    <h3 className="field-label">{t('welcome.friends')}</h3>
    {data.friends.length ? <ul className="welcome-friends">{data.friends.map((f, i) => <li key={i}><span>{f.name || t('welcome.aFriend')}<small>{f.title} · {dateFmt(f.at, lang)}</small></span><span className={`chip ${f.status === 'earned' ? '' : 'sample-badge'}`}>{t(f.status === 'earned' ? 'welcome.came' : 'welcome.rsvped')}</span></li>)}</ul>
      : <p className="muted-small">{t('welcome.noFriends')}</p>}
    <p className="muted-small">{t('welcome.rules')}</p>
  </div>;
}

/** Me → Invite friends */
export function InviteFriendsPanel() {
  const { userId } = useGatherwell();
  const q = useQuery(myWelcomeQuery(userId));
  if (q.isPending) return <ListSkeleton />;
  if (q.isError) return <RetryState retry={() => void q.refetch()} />;
  return <WelcomeBody data={q.data} onRedeem={redeemMine} />;
}

/** Guest RSVP page: personal link and points, no account needed. */
export function GuestWelcomeCard({ checkin }: { checkin: string }) {
  const { t } = useTranslation();
  const q = useQuery(guestWelcomeQuery(checkin));
  if (!q.data) return null;
  return <section className="guest-card"><h2 className="guest-subhead">{t('welcome.title')}</h2><WelcomeBody data={q.data} onRedeem={id => redeemGuest(checkin, id)} /></section>;
}

/** Host: Welcome rewards (in Earnings) */
export function WelcomeRewardsCard() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const { userId } = useGatherwell();
  const qc = useQueryClient();
  const q = useQuery(hostRewardsQuery(userId));
  const [f, setF] = useState({ en: '', es: '', cost: '50' });
  const [code, setCode] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['welcome', 'host', userId] });
  const add = async () => {
    const cost = Math.round(Number(f.cost));
    if (!(f.en.trim() || f.es.trim()) || !(cost >= 10 && cost <= 1000)) { toast.error(t('welcome.rewardInvalid')); return; }
    const { error } = await addReward({ title_en: f.en.trim(), title_es: f.es.trim(), points_cost: cost });
    if (error) { toast.error(t('welcome.error')); return; }
    setF({ en: '', es: '', cost: '50' }); await refresh();
  };
  const honor = async () => {
    const { data, error } = await honorCode(code);
    if (error) { toast.error(t('welcome.codeNotFound')); return; }
    toast.success(t('welcome.honored', { title: (data as { title: string }).title })); setCode(''); await refresh();
  };
  return <section className="panel welcome-host-card">
    <div className="section-heading"><h2>{t('welcome.hostTitle')}</h2></div>
    <p className="auth-subtitle">{t('welcome.hostIntro')}</p>
    {q.isPending ? <ListSkeleton /> : q.isError ? <RetryState retry={() => void q.refetch()} /> : <>
      {q.data.rewards.length > 0 && <ul className="welcome-rewards">{q.data.rewards.map(r => <li key={r.id}><Gift className="inline-icon" /><span>{rewardTitle(r, lang)}<small>{t('welcome.pointsCount', { count: r.points_cost })}</small></span>
        <Switch checked={r.active} aria-label={t('welcome.active')} onCheckedChange={async v => { await toggleReward(r.id, v); await refresh(); }} />
        <Button size="icon" variant="ghost" aria-label={t('welcome.removeReward')} onClick={async () => { await removeReward(r.id); await refresh(); }}><Trash2 /></Button></li>)}</ul>}
      <div className="bilingual">
        <div className="form-field"><label className="field-label" htmlFor="wr-en">{t('welcome.rewardName')} · EN</label><Input id="wr-en" className="field-input" maxLength={80} placeholder={t('welcome.rewardPlaceholder')} value={f.en} onChange={e => setF({ ...f, en: e.target.value })} /></div>
        <div className="form-field"><label className="field-label" htmlFor="wr-es">{t('welcome.rewardName')} · ES</label><Input id="wr-es" className="field-input" maxLength={80} value={f.es} onChange={e => setF({ ...f, es: e.target.value })} /></div>
      </div>
      <div className="form-field"><label className="field-label" htmlFor="wr-cost">{t('welcome.pointsNeeded')}</label><Input id="wr-cost" className="field-input" inputMode="numeric" value={f.cost} onChange={e => setF({ ...f, cost: e.target.value.replace(/\D/g, '') })} /></div>
      <Button variant="secondary" onClick={add}>{t('welcome.addReward')}</Button>
      <p className="muted-small">{t('welcome.hostRules')}</p>
      <div className="form-field"><label className="field-label" htmlFor="wr-code">{t('welcome.honorLabel')}</label>
        <div className="welcome-link"><Input id="wr-code" className="field-input" placeholder="GW-XXXXXXXX" value={code} onChange={e => setCode(e.target.value.toUpperCase())} /><Button disabled={!code.trim()} onClick={honor}><Check />{t('welcome.honor')}</Button></div></div>
      {q.data.redemptions.length > 0 && <ul className="welcome-codes">{q.data.redemptions.map(d => <li key={d.id}><code>{d.code}</code><span>{d.title}<small>{dateFmt(d.created_at, lang)} · {t(d.status === 'honored' ? 'welcome.used' : 'welcome.waiting')}</small></span></li>)}</ul>}
    </>}
  </section>;
}
