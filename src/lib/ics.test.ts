import { describe, expect, it } from 'vitest';
import { buildIcs, buildVEvent, googleCalendarUrl, icsEscape, icsFold, icsStamp, outlookCalendarUrl } from './ics';

const base = { id: 'evt-123', title: 'Sunrise Yoga', startsAt: '2026-11-01T14:00:00.000Z', endsAt: '2026-11-01T15:30:00.000Z' };

describe('icsStamp', () => {
  it('formats UTC basic timestamps', () => {
    expect(icsStamp(base.startsAt)).toBe('20261101T140000Z');
  });
});

describe('icsEscape / icsFold', () => {
  it('escapes commas, semicolons, backslashes and newlines', () => {
    expect(icsEscape('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });
  it('folds lines longer than 74 chars with a leading space', () => {
    const folded = icsFold('X'.repeat(80));
    const parts = folded.split('\r\n');
    expect(parts[0]).toHaveLength(74);
    expect(parts[1]).toBe(' ' + 'X'.repeat(6));
  });
});

describe('buildIcs', () => {
  it('builds a valid single-event calendar with stable UID', () => {
    const ics = buildIcs({ ...base, location: 'Park', url: 'https://zoheewell.com/e/evt-123' }, new Date('2026-10-24T00:00:00Z'));
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('UID:evt-123@zoheewell');
    expect(ics).toContain('DTSTART:20261101T140000Z');
    expect(ics).toContain('DTEND:20261101T153000Z');
    expect(ics).toContain('STATUS:CONFIRMED');
    expect(ics).toContain('LOCATION:Park');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('defaults to a one-hour duration when no end is given', () => {
    const ics = buildIcs({ id: 'x', title: 'T', startsAt: base.startsAt });
    expect(ics).toContain('DTEND:20261101T150000Z');
  });

  it('adds an RRULE for weekly recurrence', () => {
    expect(buildIcs({ ...base, recurrence: 'weekly' })).toContain('RRULE:FREQ=WEEKLY');
    expect(buildIcs(base)).not.toContain('RRULE');
  });

  it('marks cancellations with STATUS:CANCELLED and a sequence bump', () => {
    const ics = buildIcs({ ...base, status: 'cancelled', sequence: 2 });
    expect(ics).toContain('STATUS:CANCELLED');
    expect(ics).toContain('SEQUENCE:2');
  });

  it('includes multi-day itinerary entries in the description', () => {
    const ics = buildIcs({
      ...base,
      endsAt: '2026-11-03T18:00:00.000Z',
      itinerary: [{ label: 'Arrival & dinner', time: 'Fri 5pm' }, { label: 'Morning hike' }],
    });
    expect(ics).toContain('Fri 5pm — Arrival & dinner');
    expect(ics).toContain('Morning hike');
  });

  it('keeps the same UID for an updated event so calendar apps replace it', () => {
    const a = buildIcs(base);
    const b = buildIcs({ ...base, title: 'Sunrise Yoga (moved)', sequence: 1 });
    expect(a.match(/UID:.*/)?.[0]).toBe(b.match(/UID:.*/)?.[0]);
  });
});

describe('buildVEvent line lengths', () => {
  it('folds long summaries', () => {
    const lines = buildVEvent({ ...base, title: 'Y'.repeat(200) }, '20261024T000000Z');
    for (const line of lines.join('\r\n').split('\r\n')) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });
});

describe('calendar template links', () => {
  it('builds a Google Calendar template URL with dates and recurrence', () => {
    const url = googleCalendarUrl({ ...base, location: 'Park', recurrence: 'weekly' });
    expect(url).toContain('calendar.google.com/calendar/render');
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('dates=20261101T140000Z%2F20261101T153000Z');
    expect(url).toContain('recur=RRULE%3AFREQ%3DWEEKLY');
  });
  it('builds an Outlook deeplink with ISO dates', () => {
    const url = outlookCalendarUrl({ ...base, location: 'Park' });
    expect(url).toContain('outlook.live.com/calendar/0/deeplink/compose');
    expect(url).toContain('rru=addevent');
    expect(url).toContain('startdt=2026-11-01T14%3A00%3A00.000Z');
  });
});
