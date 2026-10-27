import { AddonDescriptionText } from '@/components/addon-description-field';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { RetryState } from '@/components/launch-states';
import { Button } from '@/components/ui/button';
import { useServerFn } from '@tanstack/react-start';
import { cancelChallengeOrder } from '@/lib/challenge-orders.functions';
import { useState } from 'react';
type Receipt = { id: string; status: string; currency: string; total: number; lines: { id: string; name: string; description_en?: string | null; description_es?: string | null; quantity: number; unit_cents: number; refunded_cents: number }[] };
export function ChallengeOrderReceipts({ id, userId }: { id: string; userId: string }) {
  const { t, i18n } = useTranslation();
  const cancel = useServerFn(cancelChallengeOrder); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const cancelOrder = async (order: string) => { if (busy) return; setBusy(true); setError(''); try { const r = await cancel({ data: { order } }); if (!r.cancelled) setError(t('lifecycle.cancelPending')); else await q.refetch(); } catch { setError(t('lifecycle.cancelPending')); } finally { setBusy(false); } };
  const q = useQuery({ queryKey: ['challenge-orders', id, userId], refetchInterval: 15000, queryFn: async () => { const r = await supabase.rpc('challenge_order_receipts', { _c: id }); if (r.error) throw r.error; return r.data as unknown as Receipt[]; } });
  if (q.isError) return <RetryState retry={() => void q.refetch()} />;
  if (!q.data?.length) return null;
  return <section><h2>{t('lifecycle.receipts')}</h2>{error && <p role="alert">{error}</p>}{q.data.map(r => <article key={r.id} className="edit-form"><strong>{t(`lifecycle.status.${r.status}`)}</strong><span>{new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'currency', currency: r.currency }).format(r.total / 100)}</span><ul>{(r.lines ?? []).map(l => <li key={l.id}>{l.name} × {l.quantity}{l.refunded_cents > 0 && ` · ${t('lifecycle.refundedAmount', { amount: l.refunded_cents / 100 })}`}<AddonDescriptionText addon={l} lang={i18n.resolvedLanguage} /></li>)}</ul>{r.status === 'pending' && <Button variant="secondary" disabled={busy} onClick={() => void cancelOrder(r.id)}>{t('lifecycle.cancelCheckout')}</Button>}</article>)}</section>;
}