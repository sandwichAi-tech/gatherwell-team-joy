import { useQuery } from '@tanstack/react-query';
import { notFound } from '@tanstack/react-router';
import { useSyncExternalStore, type ReactNode } from 'react';
import { featureFlagsQuery } from '@/lib/landing';
import { isAdminQuery } from '@/lib/site-media';
import { useGatherwell } from '@/components/gatherwell-shell';

/** Launch-mode switches managed in /admin?tab=flags. Missing or off = hidden for everyone but admins (see SOURCE_OF_TRUTH.md, Launch mode decision 2026-10-29). */
export const FEATURE_KEYS = [
  'feature_learn', 'feature_network', 'feature_retreats', 'feature_badges_limited', 'feature_playbook', 'feature_team_map',
  'feature_selling', 'feature_referrals', 'feature_automations', 'feature_courses', 'feature_assessment',
  'feature_alerts', 'feature_locations', 'feature_marketing_extra',
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type FlagMap = Record<string, { enabled: boolean } | undefined> | undefined;

/** Admins see parked features unless they are viewing as a regular user. */
export function featureOn(flags: FlagMap, key: FeatureKey, isAdmin: boolean, viewAsUser = false) {
  return (isAdmin && !viewAsUser) || flags?.[key]?.enabled === true;
}

/* "View as a regular user": in-memory only (localStorage is reserved for language/theme/invite), resets on reload. */
let viewAsUser = false;
const listeners = new Set<() => void>();
export function setViewAsUser(on: boolean) { viewAsUser = on; listeners.forEach(l => l()); }
export function getViewAsUser() { return viewAsUser; }
export function useViewAsUser(): boolean {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => viewAsUser, () => false);
}

/** Returns [on, ready]. */
export function useFeature(key: FeatureKey): [boolean, boolean] {
  const { userId } = useGatherwell();
  const flags = useQuery(featureFlagsQuery());
  const admin = useQuery(isAdminQuery(userId || undefined));
  const asUser = useViewAsUser();
  const ready = flags.isFetched && (!userId || admin.isFetched);
  return [featureOn(flags.data, key, !!admin.data, asUser), ready];
}

/** Renders children only when the feature is on; otherwise nothing. */
export function Feature({ flag, children }: { flag: FeatureKey; children: ReactNode }) {
  const [on] = useFeature(flag);
  return on ? <>{children}</> : null;
}

/** Route guard: parked features show the 404 page to non-admins. */
export function FeatureRoute({ flag, children }: { flag: FeatureKey | FeatureKey[]; children: ReactNode }) {
  const keys = Array.isArray(flag) ? flag : [flag];
  const results = keys.map(k => useFeature(k)); // fixed-length per call site
  if (!results.every(r => r[1])) return null;
  if (!results.some(r => r[0])) throw notFound();
  return <>{children}</>;
}
