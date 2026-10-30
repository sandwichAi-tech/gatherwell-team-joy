/** Per-team metric sharing (server: set_team_metric_share / team_member_insights). */
export const TEAM_METRICS = ['upcoming_events', 'registrations', 'attendance'] as const;
export type TeamMetric = (typeof TEAM_METRICS)[number];

export type MemberInsights = {
  name: string | null; shared: TeamMetric[]; from: string; upcoming_count?: number | null;
  events: { id: string; title: string; starts_at: string; timezone: string | null; public: boolean; registered: number | null; checked_in: number | null }[];
};

export const normalizeMetrics = (v: unknown): TeamMetric[] =>
  Array.isArray(v) ? TEAM_METRICS.filter(m => v.includes(m)) : [];

/** Distinguish loading/error/not shared/no events so the leader never sees misleading zeros. */
export function insightsState(pending: boolean, error: boolean, d: MemberInsights | null | undefined): 'loading' | 'error' | 'not_shared' | 'no_events' | 'ready' {
  if (pending) return 'loading';
  if (error || !d) return 'error';
  if (!d.shared?.length) return 'not_shared';
  if (!(d.events ?? []).length) return 'no_events';
  return 'ready';
}
