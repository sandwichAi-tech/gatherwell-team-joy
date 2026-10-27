import { AddonDescriptionText } from '@/components/addon-description-field';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { GuestShell } from '@/components/guest-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListSkeleton, RetryState } from '@/components/launch-states';
import { beginChallengeOrder, getPublicChallenge } from '@/lib/challenge-orders.functions';
import { supabase } from '@/integrations/supabase/client';
import { pick } from '@/lib/learn';
export const publicChallengeQuery = (id: string) => ({ queryKey: ['public-challenge', id], queryFn: () => getPublicChallenge({ data: { id } }) });
export function PublicChallengePage({ id }: { id: string }) {
  const { t, i18n } = useTranslation(); const lang = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const q = useQuery(publicChallengeQuery(id)); const start = useServerFn(beginChallengeOrder);
  const [chosen, setChosen] = useState<Record<string, number>>({}); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [request] = useState(() => crypto.randomUUID());
  const session = useQuery({ queryKey: ['challenge-public-session'], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null });
  if (q.isPending) return <GuestShell><ListSkeleton /></GuestShell>;
  if (q.isError) return <GuestShell><RetryState retry={() => void q.refetch()} /></GuestShell>;
  const c = q.data; if (!c) return <GuestShell><h1>{t('learnHub.notFound')}</h1></GuestShell>;
  const money = (cents: number) => new Intl.NumberFormat(lang, { style: 'currency', currency: c.currency }).format(cents / 100);
  const base = c.is_paid ? c.price_cents : 0; const extras = c.addons.reduce((n, a) => n + (chosen[a.id] ?? 0) * a.price_cents, 0);
  const enroll = async () => {
    if (busy) return; setBusy(true); setMessage('');
    try { const r = await start({ data: { id, request, extras: Object.entries(chosen).filter(([, n]) => n > 0).map(([id, quantity]) => ({ id, quantity })), environment: 'live', origin: window.location.origin, lang } });
      if (r.url) window.location.assign(r.url); else setMessage(r.enrolled ? t('challenges.enrollmentSaved') : t(`challenges.err.${r.error}`, { defaultValue: t('profile.saveError') }));
    } catch { setMessage(t('profile.saveError')); } finally { setBusy(false); }
  };
  return <GuestShell><h1>{pick(lang, c.title_en, c.title_es)}</h1><p>{pick(lang, c.description_en, c.description_es)}</p><p>{c.starts_on} — {c.ends_on}</p><strong>{base ? money(base) : t('lifecycle.free')}</strong><section className="edit-form"><h2>{t('lifecycle.extras')}</h2>{c.addons.map(a => <div key={a.id} className="form-field"><label htmlFor={`extra-${a.id}`}>{a.name} · {money(a.price_cents)}</label><AddonDescriptionText addon={a} lang={lang} /><Input id={`extra-${a.id}`} type="number" min={0} max={Math.min(a.max_quantity, a.inventory ?? a.max_quantity)} disabled={busy || !a.available || a.inventory === 0} value={chosen[a.id] ?? 0} onChange={e => setChosen(x => ({ ...x, [a.id]: Math.max(0, Math.min(a.max_quantity, a.inventory ?? a.max_quantity, Number(e.target.value) || 0)) }))} /></div>)}<dl><dt>{t('lifecycle.base')}</dt><dd>{money(base)}</dd><dt>{t('lifecycle.extras')}</dt><dd>{money(extras)}</dd><dt>{t('lifecycle.total')}</dt><dd>{money(base + extras)}</dd></dl>{message && <p role="status">{message}</p>}{session.data ? <Button disabled={busy} aria-busy={busy} onClick={() => void enroll()}>{t(base + extras ? 'lifecycle.continuePayment' : 'challenges.join')}</Button> : <Button asChild><Link to="/login">{t('lifecycle.signIn')}</Link></Button>}</section></GuestShell>;
}