import { describe, expect, it } from 'vitest';
import { attendancePresentation, displayTitleCase, eventPhotoSlot, showAgePolicy } from './event-presentation';
describe('event presentation rules', () => {
  it('matches all category slots and never maps Pilates to yoga', () => {
    for (const c of ['fitcamp','run','yoga','walk','hike','pickleball','soundbath','pilates']) expect(eventPhotoSlot(c)).toBe(`feed_default_${c}`);
    expect(eventPhotoSlot('other')).toBe('hero_card_1');
  });
  it('hides default age policy but shows explicit minimum or minors rule', () => {
    expect(showAgePolicy({ allows_minors: false, min_age: null })).toBe(false);
    expect(showAgePolicy({ min_age: 18 })).toBe(true);
    expect(showAgePolicy({ allows_minors: true })).toBe(true);
  });
  it('uses first RSVP message only below three going', () => {
    expect(attendancePresentation(2, null).first).toBe(true);
    expect(attendancePresentation(3, null).first).toBe(false);
  });
  it('shows remaining capacity only below ten', () => {
    expect(attendancePresentation(1,11).left).toBe(null);
    expect(attendancePresentation(1,10).left).toBe(9);
    expect(attendancePresentation(10,10).left).toBe(0);
  });
  it('formats names and cities without mutating the source', () => {
    const person = { name: 'michael marchione', city: 'san diego' };
    expect(displayTitleCase(person.name)).toBe('Michael Marchione');
    expect(displayTitleCase(person.city)).toBe('San Diego');
    expect(person.name).toBe('michael marchione');
    expect(displayTitleCase('MARÍA JOSÉ')).toBe('María José');
  });
});