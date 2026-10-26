import { describe, expect, it } from 'vitest';
import { eventLocalInput, nextDaySchedule } from './attendance-schedule';
describe('event time zone follow-up scheduling', () => {
  it('uses the event zone rather than the browser zone', () => expect(eventLocalInput('2026-10-27T02:00:00Z', 'America/Los_Angeles')).toBe('2026-10-26T19:00'));
  it('defaults to next day at 09:00 in the event zone', () => expect(nextDaySchedule('2026-10-27T02:00:00Z', 'America/Los_Angeles')).toBe('2026-10-27T09:00'));
  it('keeps the next calendar day across a daylight saving change', () => expect(nextDaySchedule('2026-11-01T01:00:00Z', 'America/New_York')).toBe('2026-11-01T09:00'));
});