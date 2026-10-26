import { describe, expect, it } from 'vitest';
import { isMultiLessonTrack, lessonsToPublishWithTrack, placeholderLessons } from '@/lib/resource-flow';
import { draftDestination } from '@/lib/resources';
import en from '@/locales/en.json';
import es from '@/locales/es.json';

const L = (id: string, title: string, published = false, notes: string | null = null) => ({ id, title_en: title, title_es: title, is_published: published, notes_en: notes, notes_es: notes });

describe('row 61: blueprint track review and publish', () => {
  it('a copied track opens in the item builder, not a list', () => expect(draftDestination('track', 'abc')).toEqual({ to: '/learn/create', search: { type: 'video', id: 'abc' } }));
  it('blueprint copies and multi-lesson tracks use lesson-by-lesson editing', () => {
    expect(isMultiLessonTrack([L('a', 'One'), L('b', 'Two')])).toBe(true);
    expect(isMultiLessonTrack([L('a', '[Your lesson title]')])).toBe(true);
    expect(isMultiLessonTrack([L('a', 'Real title')])).toBe(false);
  });
  it('finds lessons whose title or notes still hold placeholders', () => {
    const ls = [L('a', '[Your lesson title]'), L('b', 'Try this next', false, '[One small action]'), L('c', 'Done', false, 'Real notes')];
    expect(placeholderLessons(ls).map(l => l.id)).toEqual(['a', 'b']);
  });
  it('first publish makes only reviewed draft lessons visible', () => {
    const ls = [L('a', 'Reviewed'), L('b', '[Example]'), L('c', 'Already live', true)];
    expect(lessonsToPublishWithTrack(ls, false)).toEqual(['a']);
  });
  it('an Update never changes lesson visibility', () => expect(lessonsToPublishWithTrack([L('a', 'Hidden on purpose')], true)).toEqual([]));
  it('status copy exists in EN and ES', () => {
    for (const k of ['multiLessonHint', 'lessonStatusTitle', 'lessonNeedsReview', 'lessonVisible', 'lessonHidden', 'publishesLessons_other', 'placeholderLessons', 'placeholderBlock'] as const) {
      expect((en.resources.item as Record<string, string>)[k]).toBeTruthy();
      expect((es.resources.item as Record<string, string>)[k]).toBeTruthy();
    }
  });
});
