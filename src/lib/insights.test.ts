import { describe, expect, it } from 'vitest';
import { attendanceRate, eventsCsv, offersCsv, totals, type HostEventStat } from './insights';

const ev = (over: Partial<HostEventStat>): HostEventStat => ({
  id: 'e1', title: 'Morning Yoga', starts_at: '2026-11-01T15:00:00Z', status: 'published',
  going: 10, attended: 8, waitlist: 2, cancelled: 1, ...over,
});

describe('host analytics helpers', () => {
  it('computes attendance rate only when registrations exist', () => {
    expect(attendanceRate(ev({}))).toBe(80);
    expect(attendanceRate(ev({ going: 0, attended: 0 }))).toBeNull();
    expect(attendanceRate(ev({ going: 3, attended: 1 }))).toBe(33);
  });

  it('totals events across the dashboard', () => {
    const t = totals([ev({}), ev({ id: 'e2', going: 5, attended: 5, waitlist: 0, cancelled: 0 })]);
    expect(t).toEqual({ going: 15, attended: 13, waitlist: 2, cancelled: 1 });
    expect(totals([])).toEqual({ going: 0, attended: 0, waitlist: 0, cancelled: 0 });
  });

  it('exports aggregate event CSV with no guest-level data and injection-safe cells', () => {
    const csv = eventsCsv([ev({ title: '=HYPERLINK("x")' })]);
    const [header, row] = csv.split('\r\n');
    expect(header).toBe('"event","starts_at","status","registered","attended","waitlisted","cancelled"');
    expect(row).toContain('"\'=HYPERLINK(""x"")"');
    expect(row).toContain('"10","8","2","1"');
    expect(csv).not.toContain('guest');
  });

  it('exports offering CSV with aggregate learner counts only', () => {
    const csv = offersCsv([{ id: 'o1', title: 'Course "A"', kind: 'course', status: 'published', enrollments: 4, learners_started: 3, certificates: 2 }]);
    expect(csv.split('\r\n')[1]).toBe('"Course ""A""","course","published","4","3","2"');
  });
});
