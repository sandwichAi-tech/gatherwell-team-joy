import { describe, expect, it } from 'vitest';
import { bandFor, emptyOption, hasPlaceholder, mustAnswerAll, outcomeFor, pollPercents, pollVisible, questionProblems, quizBlockers, retakeState, typesForMode, unanswered, type StudioQuestion } from './quiz-studio';

const opt = (label: string, extra: Partial<ReturnType<typeof emptyOption>> = {}) => ({ ...emptyOption(), label_en: label, ...extra });
const q = (over: Partial<StudioQuestion> = {}): StudioQuestion => ({ type: 'single', prompt_en: 'Pick one', prompt_es: '', points: 1, image_path: null, image_alt: '', accepted: [], allow_manual: false, options: [opt('A', { is_correct: true }), opt('B')], ...over });
const quiz = { mode: 'scored' as const, title_en: 'Hydration basics', title_es: '', instructions_en: '', instructions_es: '' };

describe('quiz modes', () => {
  it('outcome quizzes and polls only allow choice questions', () => {
    expect(typesForMode('poll')).toEqual(['single', 'multi']);
    expect(typesForMode('outcome')).toEqual(['single', 'multi']);
    expect(typesForMode('scored')).toContain('short');
  });
});

describe('publish checks', () => {
  it('requires a title and at least one question', () => {
    expect(quizBlockers({ ...quiz, title_en: '' }, [], [], [])).toEqual(expect.arrayContaining(['missing_title', 'no_questions']));
  });
  it('requires at least two choices', () => {
    expect(questionProblems(q({ options: [opt('A', { is_correct: true })] }), 'scored')).toContain('missing_options');
  });
  it('single-answer scored questions need exactly one correct answer', () => {
    expect(questionProblems(q({ options: [opt('A'), opt('B')] }), 'scored')).toContain('missing_key');
    expect(questionProblems(q(), 'scored')).toEqual([]);
  });
  it('polls need no correct answer', () => {
    expect(questionProblems(q({ options: [opt('A'), opt('B')] }), 'poll')).toEqual([]);
  });
  it('outcome quizzes need two outcomes and every answer mapped', () => {
    expect(quizBlockers({ ...quiz, mode: 'outcome' }, [q({ options: [opt('A', { outcome_id: 'o1' }), opt('B')] })], [{ id: 'o1', title_en: 'Calm', title_es: '', body_en: '', body_es: '' }], []))
      .toEqual(expect.arrayContaining(['outcomes_needed', 'outcome_unmapped']));
  });
  it('images need alt text', () => {
    expect(questionProblems(q({ image_path: 'u/quiz-1.jpg', image_alt: ' ' }), 'scored')).toContain('missing_alt');
    expect(questionProblems(q({ options: [opt('', { is_correct: true, image_path: 'u/a.jpg', image_alt: 'Green tea' }), opt('B')] }), 'scored')).toEqual([]);
  });
  it('blocks leftover [placeholder] text', () => {
    expect(hasPlaceholder('Ask about [topic]')).toBe(true);
    expect(questionProblems(q({ prompt_en: 'What is [your question]?' }), 'scored')).toContain('placeholder');
  });
});

describe('results', () => {
  it('score band is the highest band reached', () => {
    const bands = [{ min_pct: 0, t: 'start' }, { min_pct: 50, t: 'mid' }, { min_pct: 80, t: 'top' }];
    expect(bandFor(bands, 79.5)?.t).toBe('mid');
    expect(bandFor(bands, 80)?.t).toBe('top');
    expect(bandFor(bands, null)).toBeNull();
  });
  it('outcome is the most-picked, ties go to the first listed', () => {
    expect(outcomeFor(['a', 'b'], ['b', 'b', 'a'])).toBe('b');
    expect(outcomeFor(['a', 'b'], ['b', 'a'])).toBe('a');
  });
  it('poll results stay hidden until 3 people answered (coach always sees)', () => {
    expect(pollVisible(2, false)).toBe(false);
    expect(pollVisible(3, false)).toBe(true);
    expect(pollVisible(1, true)).toBe(true);
    expect(pollPercents([2, 1], 3)).toEqual([67, 33]);
  });
  it('outcome quizzes and polls need every answer before submit', () => {
    expect(mustAnswerAll('poll')).toBe(true);
    expect(mustAnswerAll('scored')).toBe(false);
    expect(unanswered(['q1', 'q2'], { q1: { selected: ['x'], text_answer: null } })).toEqual(['q2']);
  });
  it('retake policy', () => {
    expect(retakeState(null, 4).key).toBe('unlimited');
    expect(retakeState(2, 1)).toEqual({ key: 'left', left: 1 });
    expect(retakeState(1, 1).key).toBe('none');
  });
});
