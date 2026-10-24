import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { savedQuery, toggleSaved } from '@/lib/discovery';
import { GwIcon } from '@/components/gw-icon';

/** Save/unsave an event or offering. Signed-out visitors get a sign-in link, never a silent failure. */
export function SaveButton({ kind, targetId }: { kind: 'event' | 'offer'; targetId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  if (userId === undefined) {
    // one-time session read; safe in an event-less effect-free render because supabase caches it
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }
  const saved = useQuery(savedQuery(userId ?? undefined));
  const isSaved = saved.data?.has(`${kind}:${targetId}`) ?? false;
  if (userId === null) return <Link to="/login" className="chip save-chip" aria-label={t('saved.save')}><GwIcon name="BookmarkSimple" size={16} /></Link>;
  if (userId === undefined) return null;
  const toggle = async () => {
    setBusy(true);
    try {
      await toggleSaved(userId, kind, targetId, isSaved);
      await qc.invalidateQueries({ queryKey: ['saved-offerings', userId] });
      toast.success(t(isSaved ? 'saved.removed' : 'saved.added'));
    } catch { toast.error(t('error.message')); }
    setBusy(false);
  };
  return <button type="button" className={`chip save-chip${isSaved ? ' selected' : ''}`} aria-pressed={isSaved} aria-label={t(isSaved ? 'saved.unsave' : 'saved.save')} disabled={busy} onClick={() => void toggle()}>
    <GwIcon name={isSaved ? 'BookmarkSimple' : 'BookmarkSimple'} size={16} weight={isSaved ? 'fill' : 'regular'} />
  </button>;
}
