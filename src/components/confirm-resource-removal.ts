import i18next, { type TFunction } from 'i18next';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { confirmAction } from '@/components/confirm-dialog';
import { fromSavedDestinations } from '@/lib/resource-placement';
import { livePlacementNames } from '@/lib/placement-warning';
import { removalCopyKeys, type RemovalAction } from '@/lib/resource-removal';

type Kind = 'track' | 'recipe' | 'quiz' | 'offer';

/** Places a resource currently appears, in the reader's language. */
async function placeNames(t: TFunction, kind: Kind, id: string): Promise<string[]> {
  try {
    const r = await (supabase as any).rpc('resource_destinations', { _kind: kind, _id: id });
    return livePlacementNames(fromSavedDestinations(r.data), i18next.language?.startsWith('es') ? 'es' : 'en', { team: t('resources.removal.team'), coach: t('resources.removal.coach') });
  } catch { return []; }
}

/** Confirm-only archive warning (used when unpublishing a live offer). */
export async function confirmResourceRemoval(t: TFunction, kind: Kind, id: string, title: string): Promise<boolean> {
  const names = await placeNames(t, kind, id);
  const body = [names.length ? t('resources.removal.places', { places: names.join(', ') }) : null, t('resources.removal.archiveHistory')].filter(Boolean).join(' ');
  return confirmAction({ title, body, confirmLabel: t('resources.removal.archive'), destructive: true });
}

/**
 * The only host-facing removal path. The server decides: untouched drafts are deleted,
 * anything with placements, access, purchases or learner history is archived instead.
 */
export async function removeResource(t: TFunction, kind: Kind, id: string): Promise<RemovalAction | null> {
  const plan = await (supabase as any).rpc('resource_removal_plan', { _kind: kind, _id: id });
  if (plan.error || !plan.data) { toast.error(t('profile.saveError')); return null; }
  const action: RemovalAction = plan.data.action === 'delete' ? 'delete' : 'archive';
  // An untouched draft has no real placements (legacy defaults only), so list places only when archiving.
  const names = action === 'delete' ? [] : livePlacementNames(fromSavedDestinations(plan.data.destinations), i18next.language?.startsWith('es') ? 'es' : 'en', { team: t('resources.removal.team'), coach: t('resources.removal.coach') });
  const k = removalCopyKeys(action);
  const body = [names.length ? t('resources.removal.places', { places: names.join(', ') }) : null, t(k.body)].filter(Boolean).join(' ');
  if (!(await confirmAction({ title: t(k.title), body, confirmLabel: t(k.confirm), destructive: action === 'delete' }))) return null;
  const res = await (supabase as any).rpc('remove_resource', { _kind: kind, _id: id });
  if (res.error) { toast.error(t('profile.saveError')); return null; }
  const done: RemovalAction = res.data === 'deleted' ? 'delete' : 'archive';
  toast.success(t(done === 'delete' ? 'resources.removal.deleted' : 'resources.removal.archived'));
  return done;
}

export async function restoreResource(t: TFunction, kind: Kind, id: string): Promise<boolean> {
  const res = await (supabase as any).rpc('restore_resource', { _kind: kind, _id: id });
  if (res.error) { toast.error(t('profile.saveError')); return false; }
  toast.success(t('resources.removal.restored'));
  return true;
}
