import { describe, expect, it } from 'vitest';
import { eventPeriod, monthBounds } from './analytics-period';
import type { HostEventStat } from './insights';
const row = (id: string, starts_at: string): HostEventStat => ({ id, starts_at, title: id, status: 'published', going: 4, attended: 2, cancelled: 0, waitlist: 0 });
describe('real date cohorts', () => {
  it('compares equal inclusive UTC day ranges without counting the next day', () => {
    const events = [row('previous', '2026-10-09T23:59:00Z'), row('current', '2026-10-10T00:00:00Z'), row('end', '2026-10-12T23:59:00Z'), row('outside', '2026-10-13T00:00:00Z')];
    const result = eventPeriod(events, '2026-10-10', '2026-10-12');
    expect(result.current.map(e => e.id)).toEqual(['current', 'end']);
    expect(result.previous.map(e => e.id)).toEqual(['previous']);
  });
  it('rejects inverted date ranges with no invented metrics', () => expect(eventPeriod([], '2026-10-12', '2026-10-10')).toEqual({ current: [], previous: [] }));
  it('bounds current-month attendance at the next month', () => expect(monthBounds('2026-10')).toEqual({ start: '2026-10-01T00:00:00.000Z', end: '2026-11-01T00:00:00.000Z' }));
});