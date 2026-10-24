import { describe, it, expect } from 'vitest';
import { normalizeAnswer, scorePct, passedQuiz, timeLeftMs, cooldownActive, attemptsExhausted, CERT_NUMBER_PATTERN, courseComplete, coursePercent } from './quizzes';

describe('normalizeAnswer', () => {
  it('trims, lowercases, collapses whitespace', () => {
    expect(normalizeAnswer('  Hello   World ')).toBe('hello world');
    expect(normalizeAnswer('Água  Fría')).toBe('água fría');
  });
});

describe('scorePct', () => {
  it('rounds to 2 decimals like the SQL', () => {
    expect(scorePct(1, 3)).toBe(33.33);
    expect(scorePct(2, 3)).toBe(66.67);
    expect(scorePct(3, 3)).toBe(100);
    expect(scorePct(0, 3)).toBe(0);
  });
  it('returns null when no points exist', () => {
    expect(scorePct(0, 0)).toBeNull();
  });
});

describe('passedQuiz', () => {
  it('passes at or above the threshold', () => {
    expect(passedQuiz(80, 80)).toBe(true);
    expect(passedQuiz(79.99, 80)).toBe(false);
    expect(passedQuiz(null, 80)).toBeNull();
  });
});

describe('time limits and cooldowns', () => {
  const now = Date.parse('2026-10-24T12:00:00Z');
  it('computes remaining time and clamps at zero', () => {
    expect(timeLeftMs('2026-10-24T12:05:00Z', now)).toBe(300_000);
    expect(timeLeftMs('2026-10-24T11:59:00Z', now)).toBe(0);
    expect(timeLeftMs(null, now)).toBeNull();
  });
  it('cooldown blocks only while in the future', () => {
    expect(cooldownActive('2026-10-24T12:10:00Z', now)).toBe(true);
    expect(cooldownActive('2026-10-24T11:50:00Z', now)).toBe(false);
    expect(cooldownActive(null, now)).toBe(false);
  });
  it('attempt limits: null means unlimited', () => {
    expect(attemptsExhausted(null, 99)).toBe(false);
    expect(attemptsExhausted(2, 2)).toBe(true);
    expect(attemptsExhausted(2, 1)).toBe(false);
  });
});

describe('certificate numbers', () => {
  it('matches the ZW- + 12 hex format', () => {
    expect(CERT_NUMBER_PATTERN.test('ZW-FE66520E2E8A')).toBe(true);
    expect(CERT_NUMBER_PATTERN.test('ZW-123')).toBe(false);
    expect(CERT_NUMBER_PATTERN.test('ZW-FE66520E2E8G')).toBe(false);
  });
});

describe('course completion rules', () => {
  const base = { requireLessons: true, lessons: 4, lessonsDone: 4, requireQuizzes: true, quizzesRequired: 1, quizzesPassed: 1 };
  it('complete only when every required part is done', () => {
    expect(courseComplete(base)).toBe(true);
    expect(courseComplete({ ...base, lessonsDone: 3 })).toBe(false);
    expect(courseComplete({ ...base, quizzesPassed: 0 })).toBe(false);
  });
  it('respects host toggles', () => {
    expect(courseComplete({ ...base, requireQuizzes: false, quizzesPassed: 0 })).toBe(true);
    expect(courseComplete({ ...base, requireLessons: false, lessonsDone: 0 })).toBe(true);
  });
  it('empty course is never complete', () => {
    expect(courseComplete({ requireLessons: true, lessons: 0, lessonsDone: 0, requireQuizzes: true, quizzesRequired: 0, quizzesPassed: 0 })).toBe(false);
  });
  it('percent counts only required parts', () => {
    expect(coursePercent(base)).toBe(100);
    expect(coursePercent({ ...base, lessonsDone: 2, quizzesPassed: 0 })).toBe(40);
    expect(coursePercent({ ...base, lessons: 0, lessonsDone: 0 })).toBe(100);
  });
});
