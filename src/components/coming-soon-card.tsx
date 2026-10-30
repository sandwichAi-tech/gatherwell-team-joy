import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { GwFeatureTile } from '@/components/gw-icon';
import { supabase } from '@/integrations/supabase/client';

/** Launch mode: hidden once both paid selling and courses are switched on. */
export function showComingSoon(sellingOn: boolean, coursesOn: boolean) {
  return !(sellingOn && coursesOn);
}

const interestQuery = (userId: string) => ({
  queryKey: ['host-feature-interest', userId],
  enabled: !!userId,
  queryFn: async () => {
    const { data, error } = await supabase.from('host_feature_interest').select('user_id').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return !!data;
  },
});

/** Tools "Coming soon" card: one interest row per host (primary key = user), duplicates are ignored. */
export function ComingSoonCard({ userId }: { userId: string }) {
  const { t } = useTranslation(); const qc = useQueryClient();
  const { data: saved } = useQuery(interestQuery(userId));
  const [busy, setBusy] = useState(false);
  const notify = async () => {
    setBusy(true);
    const { error } = await supabase.from('host_feature_interest').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
    setBusy(false);
    if (error) { toast.error(t('comingSoon.error')); return; }
    qc.setQueryData(['host-feature-interest', userId], true);
  };
  return <section className="panel tools-section coming-soon-card" aria-labelledby="tools-coming-soon">
    <div className="coming-soon-row">
      <GwFeatureTile name="Sparkles" size={24} className="settings-tile" />
      <div className="coming-soon-body">
        <h2 id="tools-coming-soon">{t('comingSoon.title')}</h2>
        <p className="muted-copy">{t('comingSoon.text')}</p>
      </div>
    </div>
    {saved
      ? <p className="coming-soon-done" role="status">{t('comingSoon.saved')}</p>
      : <Button type="button" variant="secondary" disabled={busy || saved === undefined} onClick={() => void notify()}>{t('comingSoon.notify')}</Button>}
  </section>;
}
