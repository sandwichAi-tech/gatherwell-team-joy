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
import { ListSkeleton, RetryState } from '@/components/launch-states';
import { useGatherwell } from '@/lib/gatherwell-context';
import { initialsOf, mediaUrl, uploadMedia } from '@/lib/account';

type Credential = { kind: 'certification' | 'license'; title: string; issuer: string | null };
type Review = { id: string; rating: number; body: string | null; created_at: string; name: string; avatar_url: string | null };
export type CoachTrust = {
  verified: boolean; verified_at: string | null; years_experience: number | null; credentials: Credential[];
  hosting_since: string | null; hosted: number; regulars: number; rating: number | null; reviews_count: number; reviews: Review[];
  can_review: boolean; my_review: { rating: number; body: string | null } | null;
};

const lang = (l?: string) => (l === 'es' ? 'es-MX' : 'en-US');
const errKey = (e: unknown) => { const m = String((e as { message?: string })?.message ?? ''); const k = ['blocked_claim', 'not_eligible', 'already_pending', 'identity_required', 'invalid_credentials', 'storage_limit'].find(x => m.includes(x)); return `coachTrust.errors.${k ?? 'failed'}`; };

/** Small seal shown next to a verified coach's name anywhere in the app. */
export function VerifiedMark({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  return <span className={`verified-mark ${compact ? 'is-compact' : ''}`} title={t('coachTrust.verified')}><GwIcon name="BadgeCheck" size={compact ? 16 : 18} /><span className={compact ? 'sr-only' : ''}>{t('coachTrust.verified')}</span></span>;
}

export const verifiedHostsQuery = (ids: string[]) => ({
  queryKey: ['verified-hosts', [...ids].sort().join(',')],
  queryFn: async () => { if (!ids.length) return [] as string[]; const { data } = await supabase.rpc('verified_hosts', { _ids: ids }); return (data ?? []) as string[]; },
  staleTime: 5 * 60 * 1000,
});
export function useIsVerified(id: string | null | undefined) {
  const { data = [] } = useQuery({ ...verifiedHostsQuery(id ? [id] : []), enabled: !!id });
  return !!id && data.includes(id);
}

const trustQuery = (hostId: string) => ({
  queryKey: ['coach-trust', hostId],
  queryFn: async () => { const { data, error } = await supabase.rpc('coach_trust', { _host: hostId }); if (error) throw error; return data as unknown as CoachTrust; },
});

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return <span className="review-stars" aria-hidden="true">{[1, 2, 3, 4, 5].map(n => <GwIcon key={n} name="Star" size={size} className={n <= Math.round(value) ? 'is-on' : ''} />)}</span>;
}

/** Public trust strip, credentials and reviews for a host. */
export function CoachTrustSection({ hostId }: { hostId: string }) {
  const { t, i18n } = useTranslation();
  const q = useQuery(trustQuery(hostId));
  if (q.isLoading) return <ListSkeleton />;
  if (q.isError || !q.data) return <RetryState retry={() => void q.refetch()} />;
  const d = q.data; const loc = lang(i18n.resolvedLanguage);
  const since = d.hosting_since ? new Intl.DateTimeFormat(loc, { month: 'short', year: 'numeric' }).format(new Date(d.hosting_since)) : null;
  const items = [
    d.verified ? { icon: 'BadgeCheck' as const, value: t('coachTrust.verified'), label: t('coachTrust.identity') } : null,
    since ? { icon: 'CalendarDays' as const, value: since, label: t('coachTrust.since') } : null,
    { icon: 'CalendarCheck' as const, value: new Intl.NumberFormat(loc).format(d.hosted), label: t('coachTrust.hosted', { count: d.hosted }) },
    { icon: 'HandHeart' as const, value: new Intl.NumberFormat(loc).format(d.regulars), label: t('coachTrust.regulars', { count: d.regulars }) },
    d.rating != null ? { icon: 'Star' as const, value: new Intl.NumberFormat(loc, { minimumFractionDigits: 1 }).format(d.rating), label: t('coachTrust.reviewsCount', { count: d.reviews_count }) } : null,
  ].filter(Boolean) as { icon: 'Star'; value: string; label: string }[];
  return <>
    <section className="trust-strip" aria-label={t('coachTrust.title')}>{items.map(i => <div key={i.label} className="trust-item"><GwFeatureTile name={i.icon} size={20} /><strong>{i.value}</strong><small>{i.label}</small></div>)}</section>
    {d.verified && (d.credentials.length > 0 || d.years_experience != null) && <section className="panel credentials-panel">
      <div className="section-heading"><h2>{t('coachTrust.credentials')}</h2><VerifiedMark compact /></div>
      <ul className="credential-list">
        {d.years_experience != null && <li><GwFeatureTile name="Clock" size={20} /><span><strong>{t('coachTrust.yearsValue', { count: d.years_experience })}</strong><small>{t('coachTrust.yearsLabel')}</small></span></li>}
        {d.credentials.map((c, i) => <li key={i}><GwFeatureTile name={c.kind === 'license' ? 'ShieldCheck' : 'Award'} size={20} /><span><strong>{c.title}</strong><small>{[t(`coachTrust.kind.${c.kind}`), c.issuer].filter(Boolean).join(' · ')}</small></span></li>)}
      </ul>
      <p className="muted-small">{t('coachTrust.checkedNote')}</p>
    </section>}
    <ReviewsPanel hostId={hostId} d={d} />
  </>;
}

function ReviewsPanel({ hostId, d }: { hostId: string; d: CoachTrust }) {
  const { t, i18n } = useTranslation(); const qc = useQueryClient();
  const [open, setOpen] = useState(false); const [rating, setRating] = useState(d.my_review?.rating ?? 0); const [body, setBody] = useState(d.my_review?.body ?? ''); const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('save_coach_review', { _host: hostId, _rating: rating, _body: body });
    setBusy(false);
    if (error) return void toast.error(t(errKey(error)));
    toast.success(t('coachTrust.reviewSaved')); setOpen(false); await qc.invalidateQueries({ queryKey: ['coach-trust', hostId] });
  };
  const remove = async () => { await supabase.rpc('delete_my_coach_review', { _host: hostId }); setRating(0); setBody(''); setOpen(false); await qc.invalidateQueries({ queryKey: ['coach-trust', hostId] }); };
  return <section className="panel reviews-panel">
    <div className="section-heading"><h2>{t('coachTrust.reviews')}</h2>{d.rating != null && <span className="review-avg"><Stars value={d.rating} /><span>{t('coachTrust.reviewsCount', { count: d.reviews_count })}</span></span>}</div>
    {d.can_review && !open && <Button variant="secondary" onClick={() => setOpen(true)}><GwIcon name="Star" />{d.my_review ? t('coachTrust.editReview') : t('coachTrust.writeReview')}</Button>}
    {open && <div className="review-form">
      <div className="review-rate" role="radiogroup" aria-label={t('coachTrust.ratingLabel')}>{[1, 2, 3, 4, 5].map(n => <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={t('coachTrust.stars', { count: n })} className={n <= rating ? 'is-on' : ''} onClick={() => setRating(n)}><GwIcon name="Star" size={28} /></button>)}</div>
      <label className="field-label" htmlFor="review-body">{t('coachTrust.reviewBody')}</label>
      <Textarea id="review-body" rows={3} maxLength={500} value={body} onChange={e => setBody(e.target.value)} placeholder={t('coachTrust.reviewPlaceholder')} />
      <p className="muted-small">{t('coachTrust.reviewHint')}</p>
      <div className="form-actions"><Button disabled={busy || !rating} onClick={save}>{t('coachTrust.postReview')}</Button><Button variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>{d.my_review && <Button variant="ghost" onClick={remove}>{t('coachTrust.deleteReview')}</Button>}</div>
    </div>}
    {!d.can_review && <p className="muted-small">{t('coachTrust.whoCanReview')}</p>}
    {d.reviews.length ? <ul className="review-list">{d.reviews.map(r => <li key={r.id} className="review-item">
      <ReviewAvatar path={r.avatar_url} name={r.name} />
      <div><div className="review-head"><strong>{r.name || t('teamSpace.someone')}</strong><Stars value={r.rating} size={14} /><small>{new Intl.DateTimeFormat(lang(i18n.resolvedLanguage), { month: 'short', year: 'numeric' }).format(new Date(r.created_at))}</small></div>{r.body && <p>{r.body}</p>}</div>
    </li>)}</ul> : <p className="muted-copy">{t('coachTrust.noReviews')}</p>}
  </section>;
}

function ReviewAvatar({ path, name }: { path: string | null; name: string }) {
  const { data: url } = useQuery({ queryKey: ['media-url', path], queryFn: () => mediaUrl(path), enabled: !!path, staleTime: 50 * 60 * 1000 });
  return url ? <img src={url} alt="" className="review-avatar" width={40} height={40} loading="lazy" /> : <span className="review-avatar is-initials" aria-hidden="true">{initialsOf(name)}</span>;
}

type MyRequest = { id: string; status: 'pending' | 'approved' | 'rejected'; review_note: string | null; created_at: string };
type Draft = { kind: 'certification' | 'license'; title: string; issuer: string; file: File | null };

/** Host tools → Get verified. */
export function VerifyPage() {
  const { t } = useTranslation(); const { userId } = useGatherwell(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ['my-verification', userId], queryFn: async () => { const { data, error } = await supabase.from('coach_verifications').select('id,status,review_note,created_at').order('created_at', { ascending: false }).limit(1); if (error) throw error; return (data?.[0] ?? null) as MyRequest | null; } });
  const [idFile, setIdFile] = useState<File | null>(null); const [years, setYears] = useState(''); const [creds, setCreds] = useState<Draft[]>([]); const [busy, setBusy] = useState(false);
  if (q.isLoading) return <ListSkeleton />;
  if (q.isError) return <RetryState retry={() => void q.refetch()} />;
  const last = q.data;
  const submit = async () => {
    if (!idFile || !userId) return;
    setBusy(true);
    try {
      const stamp = Date.now(); const ext = (f: File) => (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const identity = await uploadMedia(userId, idFile, 'cover', `${userId}/verify-${stamp}-id.${ext(idFile)}`);
      const list = [];
      for (const [i, c] of creds.entries()) {
        if (!c.title.trim()) continue;
        const doc = c.file ? await uploadMedia(userId, c.file, 'cover', `${userId}/verify-${stamp}-${i}.${ext(c.file)}`) : null;
        list.push({ kind: c.kind, title: c.title.trim(), issuer: c.issuer.trim() || null, doc_path: doc });
      }
      const { error } = await supabase.rpc('submit_verification', { _identity: identity, _years: years === '' ? null as unknown as number : Number(years), _credentials: list });
      if (error) throw error;
      toast.success(t('coachTrust.submitted')); await qc.invalidateQueries({ queryKey: ['my-verification'] });
    } catch (e) { toast.error(t(errKey(e))); }
    setBusy(false);
  };
  const set = (i: number, p: Partial<Draft>) => setCreds(cs => cs.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const tooBig = (f: File | null) => !!f && f.size > 5 * 1024 * 1024;
  return <div className="verify-page">
    <header className="page-heading"><div><p className="eyebrow">{t('profile.groupHost')}</p><h1>{t('coachTrust.getVerified')}</h1><p>{t('coachTrust.verifyIntro')}</p></div></header>
    {last?.status === 'approved' && <section className="panel verify-status is-approved"><GwFeatureTile name="BadgeCheck" /><div><h2>{t('coachTrust.statusApproved')}</h2><p className="muted-copy">{t('coachTrust.statusApprovedBody')}</p></div></section>}
    {last?.status === 'pending' && <section className="panel verify-status"><GwFeatureTile name="Clock" /><div><h2>{t('coachTrust.statusPending')}</h2><p className="muted-copy">{t('coachTrust.statusPendingBody')}</p></div></section>}
    {last?.status === 'rejected' && <section className="panel verify-status is-rejected"><GwFeatureTile name="AlertCircle" /><div><h2>{t('coachTrust.statusRejected')}</h2>{last.review_note && <p className="muted-copy">{last.review_note}</p>}<p className="muted-copy">{t('coachTrust.tryAgain')}</p></div></section>}
    {last?.status !== 'pending' && <section className="panel verify-form">
      <h2 className="section-title">{last?.status === 'approved' ? t('coachTrust.updateCredentials') : t('coachTrust.step1')}</h2>
      <label className="field-label" htmlFor="verify-id">{t('coachTrust.idLabel')}</label>
      <Input id="verify-id" type="file" accept="image/*,application/pdf" onChange={e => setIdFile(e.target.files?.[0] ?? null)} />
      <p className="muted-small">{tooBig(idFile) ? t('coachTrust.errors.tooBig') : t('coachTrust.idHint')}</p>
      <label className="field-label" htmlFor="verify-years">{t('coachTrust.yearsLabel')}</label>
      <Input id="verify-years" type="number" inputMode="numeric" min={0} max={70} value={years} onChange={e => setYears(e.target.value)} />
      <h3 className="field-label">{t('coachTrust.credentialsOptional')}</h3>
      {creds.map((c, i) => <div key={i} className="credential-draft">
        <div className="segmented" role="group" aria-label={t('coachTrust.kindLabel')}>{(['certification', 'license'] as const).map(k => <Button key={k} type="button" variant="ghost" aria-pressed={c.kind === k} className={c.kind === k ? 'selected' : ''} onClick={() => set(i, { kind: k })}>{t(`coachTrust.kind.${k}`)}</Button>)}</div>
        <label className="field-label" htmlFor={`cred-title-${i}`}>{t('coachTrust.credTitle')}</label><Input id={`cred-title-${i}`} maxLength={100} value={c.title} onChange={e => set(i, { title: e.target.value })} />
        <label className="field-label" htmlFor={`cred-issuer-${i}`}>{t('coachTrust.credIssuer')}</label><Input id={`cred-issuer-${i}`} maxLength={100} value={c.issuer} onChange={e => set(i, { issuer: e.target.value })} />
        <label className="field-label" htmlFor={`cred-file-${i}`}>{t('coachTrust.credFile')}</label><Input id={`cred-file-${i}`} type="file" accept="image/*,application/pdf" onChange={e => set(i, { file: e.target.files?.[0] ?? null })} />
        <Button variant="ghost" onClick={() => setCreds(cs => cs.filter((_, j) => j !== i))}><GwIcon name="Trash2" />{t('coachTrust.removeCred')}</Button>
      </div>)}
      {creds.length < 8 && <Button variant="secondary" onClick={() => setCreds(cs => [...cs, { kind: 'certification', title: '', issuer: '', file: null }])}><GwIcon name="Plus" />{t('coachTrust.addCred')}</Button>}
      <p className="muted-small">{t('coachTrust.privacy')}</p>
      <Button className="verify-submit" disabled={busy || !idFile || tooBig(idFile) || creds.some(c => tooBig(c.file))} onClick={submit}><GwIcon name="ShieldCheck" />{t('coachTrust.submit')}</Button>
    </section>}
    {userId && <p className="muted-small"><Link to="/me">{t('coachTrust.backToMe')}</Link></p>}
  </div>;
}
