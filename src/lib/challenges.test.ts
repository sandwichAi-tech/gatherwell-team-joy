import { describe, expect, it } from 'vitest';
import {
  activitiesForDay, challengeIssues, goalProgress, lifecycleOf, messageHasContent, messageSendDate, modelOf,
  type ChallengeActivity,
} from './challenges';

describe('challenge models', () => {
  it('maps legacy rows without a model to streak', () => {
    expect(modelOf({})).toBe('streak');
    expect(modelOf({ model: null })).toBe('streak');
    expect(modelOf({ model: 'goal' })).toBe('goal');
    expect(modelOf({ model: 'nonsense' })).toBe('streak');
  });
  it('computes goal progress with completion', () => {
    expect(goalProgress(10, 4)).toEqual({ target: 10, done: 4, pct: 0.4, complete: false });
    expect(goalProgress(10, 12).complete).toBe(true);
    expect(goalProgress(null, 3).target).toBe(0);
  });
  it('draft status overrides the date phase', () => {
    expect(lifecycleOf({ status: 'draft' }, 'active')).toBe('draft');
    expect(lifecycleOf({ status: 'published' }, 'active')).toBe('active');
    expect(lifecycleOf({}, 'upcoming')).toBe('upcoming');
  });
});

describe('activities for a day', () => {
  const acts: ChallengeActivity[] = [
    { title_en: 'All days', title_es: '', day_offset: null, sort_order: 2, requires_checkin: false, requires_note: false, due_hour: null, link_url: null, resource_kind: null, resource_id: null, file_path: null },
    { title_en: 'Day 1', title_es: '', day_offset: 1, sort_order: 1, requires_checkin: true, requires_note: false, due_hour: null, link_url: null, resource_kind: null, resource_id: null, file_path: null },
    { title_en: 'Day 2', title_es: '', day_offset: 2, sort_order: 1, requires_checkin: false, requires_note: false, due_hour: null, link_url: null, resource_kind: null, resource_id: null, file_path: null },
  ];
  it('shows day-specific plus throughout items, day-specific first', () => {
    expect(activitiesForDay(acts, 1).map(a => a.title_en)).toEqual(['Day 1', 'All days']);
    expect(activitiesForDay(acts, 2).map(a => a.title_en)).toEqual(['Day 2', 'All days']);
    expect(activitiesForDay(acts, 5).map(a => a.title_en)).toEqual(['All days']);
  });
});

describe('message scheduling', () => {
  it('anchors welcome to the join date and completion to the end date', () => {
    expect(messageSendDate('welcome', 0, '2026-11-01', '2026-11-21', '2026-11-03')).toBe('2026-11-03');
    expect(messageSendDate('completion', 0, '2026-11-01', '2026-11-21')).toBe('2026-11-21');
    expect(messageSendDate('start_reminder', -1, '2026-11-01', '2026-11-21')).toBe('2026-10-31');
    expect(messageSendDate('daily_prompt', 4, '2026-11-01', '2026-11-21')).toBe('2026-11-05');
  });
  it('treats empty messages as not sendable', () => {
    expect(messageHasContent({ title_en: '', title_es: '', body_en: '', body_es: '' })).toBe(false);
    expect(messageHasContent({ title_en: 'Hi', title_es: '', body_en: '', body_es: '' })).toBe(true);
  });
});

describe('builder validation', () => {
  const base = { title_en: 'Test', title_es: '', starts_on: '2026-11-01', ends_on: '2026-11-21', model: 'streak' as const, goal_target: '', capacity: '' };
  it('accepts a minimal streak challenge', () => {
    expect(challengeIssues(base, '2026-10-25')).toEqual([]);
  });
  it('requires a goal target only for the goal model', () => {
    expect(challengeIssues({ ...base, model: 'goal' }, '2026-10-25')).toEqual(['goal']);
    expect(challengeIssues({ ...base, model: 'goal', goal_target: '12' }, '2026-10-25')).toEqual([]);
  });
  it('flags missing title and inverted dates', () => {
    expect(challengeIssues({ ...base, title_en: '', ends_on: '2026-10-01' }, '2026-10-25')).toEqual(['title', 'end']);
  });
  it('rejects a capacity below 1', () => {
    expect(challengeIssues({ ...base, capacity: '0' }, '2026-10-25')).toEqual(['capacity']);
  });
});
