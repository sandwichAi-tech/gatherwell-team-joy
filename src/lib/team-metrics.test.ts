import { describe, expect, it } from 'vitest';
import { insightsState, normalizeMetrics, type MemberInsights } from '@/lib/team-metrics';

const base: MemberInsights = { name: 'A', shared: [], from: '2026-08-01', events: [] };

describe('row 95: per-team metric sharing', () => {
  it('membership alone shares nothing', () => {
    expect(insightsState(false, false, base)).toBe('not_shared');
  });
  it('shared but no events is not shown as zeros', () => {
    expect(insightsState(false, false, { ...base, shared: ['registrations'] })).toBe('no_events');
  });
  it('loading and errors are distinct from not shared', () => {
    expect(insightsState(true, false, undefined)).toBe('loading');
    expect(insightsState(false, true, undefined)).toBe('error');
  });
  it('only approved metric keys survive', () => {
    expect(normalizeMetrics(['attendance', 'revenue', 'contacts'])).toEqual(['attendance']);
    expect(normalizeMetrics(null)).toEqual([]);
  });
});
