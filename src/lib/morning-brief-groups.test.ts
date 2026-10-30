import { describe, expect, it } from 'vitest';
import { groupBrief, type BriefLine } from '@/lib/morning-brief';

const line = (key: string, label: string): BriefLine => ({ key, label, values: {}, target: 'event', id: key });

describe('morning brief grouping', () => {
  it('puts an event with no sign-ups under Needs your attention as a required action', () => {
    const g = groupBrief([line('share-1', 'share')]);
    expect(g.attention).toHaveLength(1);
    expect(g.attention[0]).toMatchObject({ action: 'share', required: true });
  });
  it('keeps hosting and attending under Upcoming without requiring action', () => {
    const g = groupBrief([line('hosting', 'hosting'), line('attending', 'attendingCode')]);
    expect(g.upcoming.map(i => i.required)).toEqual([false, false]);
    expect(g.attention).toHaveLength(0);
  });
  it('treats new sign-ups, team activity and resources as optional updates', () => {
    const g = groupBrief([line('signups', 'signups'), line('team-events', 'teamEvents'), line('r1', 'resource')]);
    expect(g.updates.map(i => i.action)).toEqual(['reviewRegistrations', 'viewTeam', 'open']);
    expect(g.updates.every(i => !i.required)).toBe(true);
  });
  it('drops duplicate keys and unknown labels', () => {
    const g = groupBrief([line('share-1', 'share'), line('share-1', 'share'), line('x', 'mystery')]);
    expect(g.attention).toHaveLength(1);
    expect(g.upcoming.length + g.updates.length).toBe(0);
  });
});
