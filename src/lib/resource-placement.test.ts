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