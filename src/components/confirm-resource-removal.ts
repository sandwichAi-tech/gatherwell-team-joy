import i18next, { type TFunction } from 'i18next';
import { supabase } from '@/integrations/supabase/client';
import { confirmAction } from '@/components/confirm-dialog';
import { fromSavedDestinations } from '@/lib/resource-placement';
import { livePlacementNames } from '@/lib/placement-warning';

/** Confirms deleting/archiving a resource, naming every place it currently appears. History rules are unchanged. */
export async function confirmResourceRemoval(t: TFunction, kind: 'track' | 'recipe' | 'quiz' | 'offer', id: string, title: string, mode: 'delete' | 'archive' = 'delete'): Promise<boolean> {
  let names: string[] = [];
  try {
    const r = await (supabase as any).rpc('resource_destinations', { _kind: kind, _id: id });
    names = livePlacementNames(fromSavedDestinations(r.data), i18next.language?.startsWith('es') ? 'es' : 'en', { team: t('resources.removal.team'), coach: t('resources.removal.coach') });
  } catch { /* fall back to the generic warning */ }
  const body = [names.length ? t('resources.removal.places', { places: names.join(', ') }) : null, t(`resources.removal.${mode}History`)].filter(Boolean).join(' ');
  return confirmAction({ title, body, confirmLabel: t(`resources.removal.${mode}`), destructive: true });
}
