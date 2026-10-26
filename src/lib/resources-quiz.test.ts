import { describe, expect, it } from 'vitest';
import { quizCard, RESOURCE_TYPES, filterResources } from './resources';

const base = { id: 'q1', title_en: 'Hydration', title_es: '', mode: 'scored' as const, is_published: true, mine: false, questions: 2, done: false, cover_path: null };

describe('team quizzes in Resources', () => {
  it('adds a Quizzes filter', () => { expect(RESOURCE_TYPES).toContain('quiz'); });
  it('links a quiz card to its quiz page', () => {
    expect(quizCard(base, 'Team').href).toEqual({ to: '/learn/quiz/$id', params: { id: 'q1' } });
  });
  it('marks unpublished quizzes as drafts', () => { expect(quizCard({ ...base, is_published: false }, null).status).toBe('draft'); });
  it('counts a finished quiz as done', () => { expect(quizCard({ ...base, done: true }, null).progress).toEqual({ done: 1, total: 1 }); });
  it('quiz filter keeps only quizzes', () => {
    const list = filterResources([quizCard(base, null), { ...quizCard(base, null), key: 'x', type: 'video' }], 'quiz', 'all');
    expect(list.map(r => r.type)).toEqual(['quiz']);
  });
});
