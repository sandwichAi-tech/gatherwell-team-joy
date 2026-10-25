import type { HostEventStat } from './insights';

/** Event-date cohorts, not registration-date or financial ledger periods. */
export function eventPeriod(events: HostEventStat[], from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`) + 86400000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return { current: [], previous: [] };
  const duration = end - start;
  return {
    current: events.filter(e => e.starts_at && Date.parse(e.starts_at) >= start && Date.parse(e.starts_at) < end),
    previous: events.filter(e => e.starts_at && Date.parse(e.starts_at) >= start - duration && Date.parse(e.starts_at) < start),
  };
}

export function monthBounds(month: string) {
  const [year, m] = month.split('-').map(Number);
  if (!year || !m || m < 1 || m > 12) throw new Error('invalid_month');
  return { start: new Date(Date.UTC(year, m - 1, 1)).toISOString(), end: new Date(Date.UTC(year, m, 1)).toISOString() };
}