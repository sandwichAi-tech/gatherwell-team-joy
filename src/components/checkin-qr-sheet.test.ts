import { describe, it, expect } from 'vitest';
import { groupedCheckinCode } from './checkin-qr-sheet';
describe('Manual check-in code', () => {
  it('groups the code in fours for reading aloud', () => expect(groupedCheckinCode('ab12cd34ef')).toBe('AB12-CD34-EF'));
});
