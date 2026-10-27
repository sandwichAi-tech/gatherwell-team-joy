import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { rpcErrorKey } from '@/lib/challenges';
import { ChallengeOrderReceipts } from '@/components/challenge-order-receipts';

type Enrollment = { user_id: string; name: string | null; status: string; extras: { id: string; name: string; quantity: number }[] };
type Candidate = { id: string; name: string; invited: boolean };
export function ChallengeHostPanel({ id, inviteOnly, userId }: { id: string; inviteOnly: boolean; userId: string }) {
  const { t } = useTranslation(); const qc = useQueryClient(); const [busy, setBusy] = useState(false);
  const orders = useQuery({ queryKey: ['challenge-enrollments', id, userId], queryFn: async () => { const r = await supabase.rpc('challenge_host_enrollments', { _c: id }); if (r.error) throw r.error; return r.data as Enrollment[]; } });
  const candidates = useQuery({ queryKey: ['challenge-invite-candidates', id, userId], enabled: inviteOnly, queryFn: async () => { const r = await supabase.rpc('challenge_invite_candidates', { _c: id }); if (r.error) throw r.error; return r.data as Candidate[]; } });
  const invite = async (candidate: Candidate, on: boolean) => {
    if (busy) return; setBusy(true);
    try { const r = await supabase.rpc('set_challenge_invite', { _c: id, _user: candidate.id, _on: on }); if (r.error) throw r.error; await qc.invalidateQueries({ queryKey: ['challenge-invite-candidates', id] }); }
    catch (e) { toast.error(t(rpcErrorKey(e))); } finally { setBusy(false); }
  };
  return <section className="challenge-host-panel">
    <ChallengeOrderReceipts id={id} userId={userId} />
    {inviteOnly && <><h2>{t('challenges.invitedParticipants')}</h2><p className="field-hint">{t('challenges.inviteNoMessages')}</p>{candidates.isPending ? <p role="status">{t('publicEvent.loading')}</p> : candidates.isError ? <Button variant="secondary" onClick={() => void candidates.refetch()}>{t('common.retry')}</Button> : candidates.data?.map(c => <label key={c.id} className="switch-row"><Switch disabled={busy} checked={c.invited} onCheckedChange={on => void invite(c, on)} /><span>{c.name}</span></label>)}</>}
    <h2>{t('challenges.enrollmentDetails')}</h2>
    {orders.isPending ? <p role="status">{t('publicEvent.loading')}</p> : orders.isError ? <Button variant="secondary" onClick={() => void orders.refetch()}>{t('common.retry')}</Button> : orders.data?.length ? <ul className="team-membership-list">{orders.data.map((o, index) => <li key={o.user_id}><strong>{o.name || t('challenges.participantNumber', { number: index + 1 })}</strong><span>{o.status === 'active' ? t('challenges.joined') : t('challenges.inactiveEnrollment')}</span>{o.extras.map(e => <p key={e.id}>{e.name} × {e.quantity}</p>)}</li>)}</ul> : <p>{t('challenges.boardEmpty')}</p>}
  </section>;
}