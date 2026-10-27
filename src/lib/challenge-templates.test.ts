import { describe, expect, it } from 'vitest';
import { challengeTemplate, challengeStepIssues, resizeChallengeSchedule, challengePrice, challengeScore, challengePeriods, checkedInPeriod, challengeExtrasTotal } from './challenge-templates';
import { STARTERS } from './challenges';

const create = (key: typeof STARTERS[number] | 'scratch') => challengeTemplate(key, '2026-11-01', 'en', k => k, 'America/New_York');
describe('complete challenge templates', () => {
  for (const key of STARTERS) {
    it(`${key} is complete, editable and send-safe across all five steps`, () => {
      const d = create(key);
      expect(d.activities).toHaveLength(2);
      expect(d.activities[0]?.day_offset).toBeNull();
      expect(d.activities[1]?.day_offset).toBe((Date.parse(d.f.ends_on) - Date.parse(d.f.starts_on)) / 864e5 + 1);
      expect(d.activities.every(a => a.resource_id === null && a.link_url === null && a.file_path === null)).toBe(true);
      expect(d.messages.every(m => !m.enabled && !m.paused)).toBe(true);
      for (const step of ['basics', 'model', 'activities', 'messages', 'review'] as const) expect(challengeStepIssues(step, d.f, d.activities, d.messages, false, '', [])).toEqual([]);
    });
  }
  it('scratch removes all prior configuration', () => {
    const d = create('scratch');
    expect(d.activities).toEqual([]); expect(d.addons).toEqual([]); expect(d.f.title_en).toBe(''); expect(d.f.goal_target).toBe(''); expect(d.f.model).toBe('streak'); expect(d.messages.every(m => !m.body_en && !m.enabled)).toBe(true);
  });
  it('loads only the active authoring language', () => {
    const d = challengeTemplate('walk', '2026-11-01', 'es', k => k, 'UTC');
    expect(d.f.title_en).toBe(''); expect(d.f.title_es.length).toBeGreaterThan(0); expect(d.activities.every(a => !a.title_en)).toBe(true);
  });
  it('uses the requested template durations and models', () => {
    expect(create('consistency').f.ends_on).toBe('2026-11-21'); expect(create('walk').f.goal_target).toBe('14'); expect(create('hydration').f.ends_on).toBe('2026-11-07'); expect(create('morning').f.model).toBe('streak');
  });
  it('moves end reflection but rejects stale custom activity dates', () => {
    const d = create('walk'); const next = resizeChallengeSchedule(d.activities, 14, 7);
    expect(next[1]?.day_offset).toBe(7);
    expect(challengeStepIssues('activities', { ...d.f, ends_on: '2026-11-07' }, [...next, { ...d.activities[0], title_en: 'Custom', title_es: '', day_offset: 10 } as typeof next[number]], [], false, '', [])).toEqual(['activities']);
  });
  it('validates only the current step, all fields at review', () => {
    const d = create('walk'); const f = { ...d.f, goal_target: '' };
    expect(challengeStepIssues('basics', f, [], [], false, '', [])).toEqual([]); expect(challengeStepIssues('model', f, [], [], false, '', [])).toEqual(['goal']); expect(challengeStepIssues('review', f, [], [], false, '', [])).toEqual(['goal']);
  });
  it('rejects unsafe links and enabled unconnected schedules', () => {
    const d = create('walk'); expect(challengeStepIssues('activities', d.f, [{ ...d.activities[0], link_url: 'http://example.org' } as typeof d.activities[number]], [], false, '', [])).toEqual(['activities']);
    expect(challengeStepIssues('messages', d.f, [], [{ ...d.messages[1], enabled: true } as typeof d.messages[number]], false, '', [])).toEqual(['messages']);
  });
  it('rejects unattainable goals when duration or weekly rhythm changes', () => {
    const d = create('walk');
    expect(challengeStepIssues('model', { ...d.f, frequency: 'weekly' }, [], [], false, '', [])).toEqual(['goal']);
    expect(challengeStepIssues('review', { ...d.f, ends_on: '2026-11-07' }, [], [], false, '', [])).toEqual(['goal']);
  });
  it('welcome displays on joining only, never pretends a delayed schedule fired', () => {
    const d = create('walk'); const welcome = d.messages[0]; if (!welcome) throw new Error('missing welcome');
    expect(challengeStepIssues('messages', d.f, [], [{ ...welcome, enabled: true, send_offset_days: 1 }], false, '', [])).toEqual(['messages']);
  });
});
describe('challenge scoring and extras', () => {
  it('one point per valid check-in, capped goal, streak scoring', () => { expect(challengeScore('points', 3, 2)).toBe(3); expect(challengeScore('goal', 20, 2, 14)).toBe(14); expect(challengeScore('streak', 20, 2)).toBe(2); });
  it('weekly periods start at challenge start and deduplicate', () => { expect(challengePeriods(21, 'weekly')).toBe(3); expect(checkedInPeriod(['2026-11-01'], '2026-11-07', '2026-11-01', 'weekly')).toBe(true); expect(checkedInPeriod(['2026-11-01'], '2026-11-08', '2026-11-01', 'weekly')).toBe(false); });
  it('paid prices are finite, bounded and precise', () => { expect(challengePrice('12.34')).toBe(1234); for (const x of ['0', 'NaN', '1.234', '1..2', '1001', '-5']) expect(challengePrice(x)).toBeNull(); });
  it('extras are never chosen by default and unavailable extras do not affect total', () => { const a = { id: 'mat', name: 'Mat', description: '', price_cents: 500, max_quantity: 2, inventory: 3, available: true }; expect(challengeExtrasTotal([a], {})).toBe(0); expect(challengeExtrasTotal([a], { mat: 2 })).toBe(1000); expect(challengeExtrasTotal([{ ...a, available: false }], { mat: 2 })).toBe(0); });
});