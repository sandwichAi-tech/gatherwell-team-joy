import { describe, expect, it } from 'vitest';
import { CREATE_TYPES } from './create-resource';
import { placementsFor, resourceAccessPrice, resourcePriceCents, savedPlacement } from './resource-placement';

describe('resource placement and one-time pricing', () => {
  for (const type of CREATE_TYPES) it(`${type} supports team and coach placement`, () => {
    expect(placementsFor(type)).toContain('team'); expect(placementsFor(type)).toContain('coach');
    expect(placementsFor(type).includes('course')).toBe(type !== 'course');
  });
  it('legacy public and course links keep their placement', () => {
    expect(savedPlacement({ visibility: 'public' })).toBe('coach');
    expect(savedPlacement({ offer_id: 'course' })).toBe('course');
    expect(savedPlacement({})).toBe('team');
  });
  it('free never requires a price', () => expect(resourcePriceCents(true, '')).toBe(0));
  it('one-time USD price preserves cents', () => expect(resourcePriceCents(false, '12.34')).toBe(1234));
  it('rejects zero, negative, non-finite and overprecision prices', () => {
    for (const price of ['', '0', '-1', 'Infinity', '1.234', '1.2.3']) expect(resourcePriceCents(false, price)).toBeNull();
  });
  it('course-contained access never charges again', () => expect(resourceAccessPrice('course', false, '25')).toBe(0));
});
import { destinationIssues, destinationsPayload, destinationsPrice, fromSavedDestinations, hasDestination, listedInTeam, newDestinations, setCourseSection, toggleCourse, toggleDestination } from './resource-placement';

describe('multi-destination resources', () => {
  const base = { team: false, coach: false, courses: [], locked: false };
  it('any combination including all three is allowed', () => {
    let d = toggleDestination(toggleDestination(base, 'team'), 'coach');
    d = toggleCourse(toggleCourse(d, 'c1'), 'c2');
    expect(d.team && d.coach).toBe(true); expect(d.courses.map(c => c.course)).toEqual(['c1', 'c2']);
    expect(destinationIssues(d, ['c1', 'c2'])).toEqual([]);
  });
  it('publishing needs at least one destination', () => {
    expect(hasDestination(base)).toBe(false);
    expect(destinationIssues(base, [])).toEqual(['destination']);
  });
  it('another host\'s or lost course is flagged and never sent', () => {
    const d = toggleCourse(toggleDestination(base, 'team'), 'foreign');
    expect(destinationIssues(d, ['mine'])).toEqual(['courseUnavailable']);
    expect(destinationsPayload(d, ['mine'])).toEqual([]);
  });
  it('course section choice is kept per course', () => {
    const d = setCourseSection(toggleCourse(base, 'c1'), 'c1', 's2');
    expect(destinationsPayload(d, ['c1'])).toEqual([{ course: 'c1', section: 's2' }]);
  });
  it('course-only placement never charges; standalone keeps its price', () => {
    expect(destinationsPrice(toggleCourse(base, 'c1'), false, '25')).toBe(0);
    expect(destinationsPrice({ ...toggleCourse(base, 'c1'), team: true }, false, '25')).toBe(2500);
  });
  it('legacy single-destination rows load as one selection', () => {
    expect(fromSavedDestinations({ team: false, coach: true, locked: false, courses: [] })).toEqual({ team: false, coach: true, locked: false, courses: [] });
    const legacyCourse = fromSavedDestinations({ team: false, coach: false, locked: true, courses: [{ course_id: 'c1', section_id: null, locked: true, contained: true, available: true, title_en: 'A', title_es: 'A' }] });
    expect(legacyCourse?.courses).toHaveLength(1);
    expect(toggleCourse(legacyCourse!, 'c1').courses).toHaveLength(1);
    expect(toggleDestination(legacyCourse!, 'team').team).toBe(false);
  });
  it('new resources default to Team; course-created ones to that course', () => {
    expect(newDestinations()).toMatchObject({ team: true, courses: [] });
    expect(newDestinations('c1')).toMatchObject({ team: false, courses: [{ course: 'c1' }] });
  });
  it('duplicate course selections are sent once', () => {
    const d = { ...base, courses: [{ course: 'c1', section: null }, { course: 'c1', section: null }] };
    expect(destinationsPayload(d, ['c1'])).toHaveLength(1);
  });
  it('Team Resources hides only explicit opt-outs', () => {
    expect(listedInTeam({ on_team: null })).toBe(true);
    expect(listedInTeam({ on_team: false })).toBe(false);
  });
});
