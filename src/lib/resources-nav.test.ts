import { describe, expect, it } from 'vitest';
import { resourcesOwnsPath } from './insights-navigation';

describe('course page breadcrumb', () => {
  it('places course pages under Resources, not Home', () => {
    expect(resourcesOwnsPath('/offer/4ba6ac9f-c01f-4795-88e4-69b537f40f7f')).toBe(true);
    expect(resourcesOwnsPath('/home')).toBe(false);
    expect(resourcesOwnsPath('/offers')).toBe(false);
  });
});
