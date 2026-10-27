import { describe, expect, it } from 'vitest';
import { eventLocalDay, homeNextAction } from './event-day-home';
import type { PersonalHome } from './personal-home';
const base: PersonalHome = { mode: 'hosting', events: [], resources: [], coaches: [], drafts: 0, event_progress: { exists: false, draft: null } };
describe('saved, mode-aware Home recommendations', () => {
  it('never interprets loading or failed data as zero events', () => { expect(homeNextAction(undefined)).toBeNull(); expect(homeNextAction({ ...base, event_progress: undefined })).toBeNull(); });
  it('new host with no event or draft gets first event', () => expect(homeNextAction(base)).toEqual({ kind: 'first' }));
  it('draft-only host opens the authoritative recent draft', () => expect(homeNextAction({ ...base, event_progress: { exists: true, draft: { id: 'recent', title: 'Draft' } } })).toEqual({ kind: 'draft', id: 'recent', title: 'Draft' }));
  it('published or completed work never recommends first event or invented sharing', () => expect(homeNextAction({ ...base, event_progress: { exists: true, draft: null } })).toBeNull());
  it('attending mode never recommends host work', () => expect(homeNextAction({ ...base, mode: 'attending' })).toBeNull());
});
describe('event-local calendar dates', () => {
  it('uses event date rather than viewer UTC day at midnight', () => expect(eventLocalDay('2026-10-28T00:30:00Z', 'America/New_York')).toBe('2026-10-27'));
  it('handles DST fall-back without a rolling 24-hour assumption', () => { expect(eventLocalDay('2026-11-01T05:30:00Z', 'America/New_York')).toBe('2026-11-01'); expect(eventLocalDay('2026-11-01T06:30:00Z', 'America/New_York')).toBe('2026-11-01'); });
  it('keeps yesterday, today and tomorrow distinct in the event zone', () => { expect(eventLocalDay('2026-10-27T03:59:00Z', 'America/New_York')).toBe('2026-10-26'); expect(eventLocalDay('2026-10-27T04:00:00Z', 'America/New_York')).toBe('2026-10-27'); expect(eventLocalDay('2026-10-28T04:00:00Z', 'America/New_York')).toBe('2026-10-28'); });
});