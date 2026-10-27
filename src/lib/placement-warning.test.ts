import { describe, expect, it } from 'vitest';
import { livePlacementNames } from '@/lib/placement-warning';
const L = { team: 'Team Resources', coach: 'Coach page' };
describe('remove/archive placement warning', () => {
  it('lists every live destination including each course', () => {
    const d = { team: true, coach: true, locked: false, courses: [{ course: 'a', section: null, title_en: 'Course A', title_es: 'Curso A' }, { course: 'b', section: null, title_en: 'Course B', title_es: '' }] };
    expect(livePlacementNames(d as never, 'en', L)).toEqual(['Team Resources', 'Coach page', 'Course A', 'Course B']);
    expect(livePlacementNames(d as never, 'es', L)).toEqual(['Team Resources', 'Coach page', 'Curso A', 'Course B']);
  });
  it('is empty when nothing is placed or unknown', () => {
    expect(livePlacementNames(null, 'en', L)).toEqual([]);
    expect(livePlacementNames({ team: false, coach: false, locked: false, courses: [] }, 'en', L)).toEqual([]);
  });
});
