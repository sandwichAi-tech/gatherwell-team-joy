import { describe, expect, it } from 'vitest';
import { safeFormFileName, formLanguages } from './host-forms';
import { addPick, movePick, removePick } from './builder-agreements';

const own = [{ id: 'a', version: 2, archived: false, is_default: false }, { id: 'b', version: 1, archived: false, is_default: true }, { id: 'x', version: 3, archived: true, is_default: false }];
describe('host forms', () => {
  it('sanitizes uploaded file names and never keeps folders', () => {
    expect(safeFormFileName('../../etc/Release <final>.PDF')).toBe('Release -final.pdf');
    expect(safeFormFileName('C:\\docs\\waiver.pdf')).toBe('waiver.pdf');
    expect(safeFormFileName('###.pdf')).toBe('document.pdf');
  });
  it('reports text languages; PDF-only forms have none', () => {
    expect(formLanguages({ body_en: 'x', body_es: ' ' })).toEqual(['en']);
    expect(formLanguages({ body_en: '', body_es: '' })).toEqual([]);
  });
  it('adds forms once at their current version and refuses archived/unknown forms', () => {
    const v = addPick([], own, 'a'); expect(v).toEqual([{ id: 'a', version: 2 }]);
    expect(addPick(v, own, 'a')).toBe(v); expect(addPick(v, own, 'x')).toBe(v); expect(addPick(v, own, 'zz')).toBe(v);
  });
  it('reorders and removes selections', () => {
    const v = [{ id: 'a', version: 2 }, { id: 'b', version: 1 }];
    expect(movePick(v, 'b', -1).map(x => x.id)).toEqual(['b', 'a']);
    expect(movePick(v, 'a', -1)).toBe(v);
    expect(removePick(v, 'a')).toEqual([{ id: 'b', version: 1 }]);
  });
});
