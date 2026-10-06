import { EmptyState } from '@/components/launch-states';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { UsersRound } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ResponsiveSheet } from '@/components/responsive-sheet';
import { supabase } from '@/integrations/supabase/client';
import { initialsOf } from '@/lib/account';
import { rosterQuery } from '@/lib/team';

const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
export const MAX_COHOSTS = 3;

export const cohostsQuery = (eventId: string) => ({
  queryKey: ['event', eventId, 'cohosts'],
  queryFn: async () => ((await db.from('event_cohosts').select('user_id').eq('event_id', eventId)).data ?? []).map((r: { user_id: string }) => r.user_id) as string[],
});

/** Event ids where the signed-in person is a co-host (for follow-up inbox scope). */
export async function myCohostedEventIds(userId: string): Promise<string[]> {
  const { data } = await db.from('event_cohosts').select('event_id').eq('user_id', userId);
  return ((data ?? []) as { event_id: string }[]).map(r => r.event_id);
}

export function CohostsPanel({ eventId, teamId, hostId, canEdit }: { eventId: string; teamId: string; hostId: string; canEdit: boolean }) {
  const { t } = useTranslation(); const qc = useQueryClient();
  const { data: ids = [] } = useQuery(cohostsQuery(eventId));
  const { data: roster = [] } = useQuery(rosterQuery(teamId));
  const [open, setOpen] = useState(false); const [pick, setPick] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setPick(ids); }, [open, ids]);
  const names = ids.map(id => roster.find(m => m.userId === id)).filter(Boolean);
  if (!canEdit && !ids.length) return null;
  const save = async () => {
    setBusy(true); const { error } = await db.rpc('set_event_cohosts', { _event: eventId, _users: pick }); setBusy(false);
    if (error) { toast.error(t(error.message.includes('too_many') ? 'cohosts.tooMany' : 'profile.saveError')); return; }
    toast.success(t('cohosts.saved')); setOpen(false);
    void qc.invalidateQueries({ queryKey: ['event', eventId, 'cohosts'] });
  };
  const candidates = roster.filter(m => m.userId !== hostId);
  return <section className="panel cohosts-panel">
    <div className="section-heading"><div><h2>{t('cohosts.title')}</h2><p>{t('cohosts.help')}</p></div>
      {canEdit && <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><UsersRound />{ids.length ? t('cohosts.change') : t('cohosts.add')}</Button>}</div>
    {names.length ? <ul className="cohost-list">{names.map(m => <li key={m!.userId}><span className="initial-avatar">{initialsOf(m!.name)}</span><span>{m!.name ?? t('teamSpace.someone')}</span></li>)}</ul>
      : <EmptyState compact icon="UsersRound" text={t('cohosts.none')} />}
    <ResponsiveSheet open={open} onOpenChange={setOpen} title={t('cohosts.pickTitle')} description={t('cohosts.pickHelp', { max: MAX_COHOSTS })}>
      <div className="edit-form">
        {candidates.length ? <ul className="cohost-pick">{candidates.map(m => { const on = pick.includes(m.userId); const disabled = !on && pick.length >= MAX_COHOSTS;
          return <li key={m.userId}><label className={`guest-consent${disabled ? ' is-disabled' : ''}`}><Checkbox checked={on} disabled={disabled} onCheckedChange={v => setPick(p => v ? [...p, m.userId] : p.filter(x => x !== m.userId))} />
            <span className="initial-avatar">{initialsOf(m.name)}</span><span>{m.name ?? t('teamSpace.someone')}</span></label></li>; })}</ul>
          : <EmptyState compact icon="UsersRound" text={t('cohosts.noCandidates')} />}
        <p className="auth-subtitle" aria-live="polite">{t('cohosts.count', { n: pick.length, max: MAX_COHOSTS })}</p>
        <Button className="onboarding-continue" disabled={busy} onClick={save}>{t('cohosts.save')}</Button>
      </div>
    </ResponsiveSheet>
  </section>;
}
