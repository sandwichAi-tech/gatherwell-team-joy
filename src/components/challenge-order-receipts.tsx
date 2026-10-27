import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { RetryState } from '@/components/launch-states';
type Receipt = { id: string; status: string; currency: string; total: number; lines: { id: string; name: string; quantity: number; unit_cents: number; refunded_cents: number }[] };
export function ChallengeOrderReceipts({ id, userId }: { id: string; userId: string }) {
  const { t, i18n } = useTranslation();
  const q = useQuery({ queryKey: ['challenge-orders', id, userId], refetchInterval: 15000, queryFn: async () => { const r = await supabase.rpc('challenge_order_receipts', { _c: id }); if (r.error) throw r.error; return r.data as unknown as Receipt[]; } });
  if (q.isError) return <RetryState retry={() => void q.refetch()} />;
  if (!q.data?.length) return null;
  return <section><h2>{t('lifecycle.receipts')}</h2>{q.data.map(r => <article key={r.id} className="edit-form"><strong>{t(`lifecycle.status.${r.status}`)}</strong><span>{new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'currency', currency: r.currency }).format(r.total / 100)}</span><ul>{(r.lines ?? []).map(l => <li key={l.id}>{l.name} × {l.quantity}{l.refunded_cents > 0 && ` · ${t('lifecycle.refundedAmount', { amount: l.refunded_cents / 100 })}`}</li>)}</ul></article>)}</section>;
}