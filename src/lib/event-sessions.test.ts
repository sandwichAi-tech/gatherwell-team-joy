import { expect, it } from 'vitest';
import { validSessions } from './event-sessions';
const rows = [{ title: 'One', starts_at: '2026-11-01T10:00:00Z', ends_at: '2026-11-01T11:00:00Z', place: '' }, { title: 'Two', starts_at: '2026-11-02T10:00:00Z', ends_at: '2026-11-02T11:00:00Z', place: '' }];
it('requires multiple ordered non-overlapping sessions within 31 days', () => {
 expect(validSessions(rows, rows[0]?.starts_at ?? '')).toBe(true);
 expect(validSessions(rows.slice(0,1), rows[0]?.starts_at ?? '')).toBe(false);
 expect(validSessions([...rows].reverse(), rows[0]?.starts_at ?? '')).toBe(false);
 expect(validSessions([...rows,{...rows[1],title:'Late',starts_at:'2027-01-01T10:00:00Z',ends_at:'2027-01-01T11:00:00Z',place:''}],rows[0]?.starts_at ?? '')).toBe(false);
});