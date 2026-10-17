import { useQuery } from '@tanstack/react-query';
import { notFound } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { featureFlagsQuery } from '@/lib/landing';
import { isAdminQuery } from '@/lib/site-media';
import { useGatherwell } from '@/components/gatherwell-shell';

/** Launch-mode switches managed in /admin?tab=flags. Missing or off = hidden for everyone but admins. */
export type FeatureKey = 'feature_learn' | 'feature_network' | 'feature_retreats' | 'feature_badges_limited' | 'feature_playbook' | 'feature_team_map';

export function featureOn(flags: Record<string, { enabled: boolean } | undefined> | undefined, key: FeatureKey, isAdmin: boolean) {
  return isAdmin || flags?.[key]?.enabled === true;
}

/** Returns [on, ready]. Admins always see parked features. */
export function useFeature(key: FeatureKey): [boolean, boolean] {
  const { userId } = useGatherwell();
  const flags = useQuery(featureFlagsQuery());
  const admin = useQuery(isAdminQuery(userId || undefined));
  const ready = flags.isFetched && (!userId || admin.isFetched);
  return [featureOn(flags.data, key, !!admin.data), ready];
}

/** Renders children only when the feature is on; otherwise nothing. */
export function Feature({ flag, children }: { flag: FeatureKey; children: ReactNode }) {
  const [on] = useFeature(flag);
  return on ? <>{children}</> : null;
}

/** Route guard: parked features show the 404 page to non-admins. */
export function FeatureRoute({ flag, children }: { flag: FeatureKey; children: ReactNode }) {
  const [on, ready] = useFeature(flag);
  if (!ready) return null;
  if (!on) throw notFound();
  return <>{children}</>;
}
