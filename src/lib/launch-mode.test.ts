import { describe, expect, it } from 'vitest';
import { FEATURE_KEYS, featureOn } from '@/lib/feature-flags';
import { createTypeAllowed, launchCreateGroups } from '@/lib/create-resource';
import { buildToolSections } from '@/lib/tools-inventory';
import { launchSteps } from '@/components/coach-launch';
import { showComingSoon } from '@/components/coming-soon-card';

const ids = (s: ReturnType<typeof buildToolSections>) => s.flatMap(x => x.tools.map(t => t.id));
const leader = { isLeader: true, workspaceRole: 'owner' as const, isAdmin: false, learnOn: true, teamMapOn: false, canSellPaid: false };

describe('launch mode gate', () => {
  it('lists every launch switch', () => {
    for (const k of ['feature_selling', 'feature_referrals', 'feature_automations', 'feature_courses', 'feature_assessment', 'feature_alerts', 'feature_locations', 'feature_marketing_extra'])
      expect(FEATURE_KEYS).toContain(k);
  });
  it('missing or off switch is hidden for regular users', () => {
    expect(featureOn(undefined, 'feature_selling', false)).toBe(false);
    expect(featureOn({ feature_selling: { enabled: false } }, 'feature_selling', false)).toBe(false);
    expect(featureOn({ feature_selling: { enabled: true } }, 'feature_selling', false)).toBe(true);
  });
  it('admins see switched-off features unless viewing as a regular user', () => {
    expect(featureOn({}, 'feature_courses', true)).toBe(true);
    expect(featureOn({}, 'feature_courses', true, true)).toBe(false);
    expect(featureOn({ feature_courses: { enabled: true } }, 'feature_courses', true, true)).toBe(true);
  });
  it('Tools hides offers, promos, earnings, seats, referrals and locations while off', () => {
    const off = ids(buildToolSections(leader));
    for (const id of ['offers', 'promos', 'earnings', 'planSeats', 'referrals', 'locations']) expect(off).not.toContain(id);
    expect(off).toContain('communications'); expect(off).toContain('followups'); expect(off).toContain('waivers');
    const on = ids(buildToolSections({ ...leader, sellingOn: true, referralsOn: true, locationsOn: true }));
    for (const id of ['offers', 'promos', 'earnings', 'planSeats', 'referrals', 'locations']) expect(on).toContain(id);
  });
  it('resource picker hides course, bundle, live and assessment while off', () => {
    const off = launchCreateGroups({ courses: false, assessment: false }).flatMap(g => g.types);
    expect(off).toEqual(expect.arrayContaining(['video', 'audio', 'guide', 'file', 'link', 'recipe']));
    for (const t of ['course', 'bundle', 'live', 'assessment'] as const) { expect(off).not.toContain(t); expect(createTypeAllowed(t, { courses: false, assessment: false })).toBe(false); }
    expect(createTypeAllowed('assessment', { courses: false, assessment: true })).toBe(true);
    expect(createTypeAllowed('live', { courses: true, assessment: false })).toBe(true);
  });
  it('money steps stay hidden while selling is off, even with payments connected', () => {
    const steps = ['profile', 'offer', 'shared', 'first_rsvp', 'first_paid', 'first_100'].map(key => ({ key }));
    expect(launchSteps(steps, true, false).map(s => s.key)).toEqual(['profile', 'shared', 'first_rsvp']);
    expect(launchSteps(steps, true, true)).toHaveLength(6);
    expect(launchSteps(steps, false, true).map(s => s.key)).not.toContain('first_paid');
  });
  it('Coming soon card hides only when selling and courses are both on', () => {
    expect(showComingSoon(false, false)).toBe(true);
    expect(showComingSoon(true, false)).toBe(true);
    expect(showComingSoon(false, true)).toBe(true);
    expect(showComingSoon(true, true)).toBe(false);
  });
});
