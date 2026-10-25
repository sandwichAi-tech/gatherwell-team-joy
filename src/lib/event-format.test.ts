import { describe, expect, it } from 'vitest';
import { eventFormats, formatOf } from './event-format';

describe('event format cards', () => {
  it('offers standard and multi-event by default', () => {
    expect(eventFormats({ retreatsEnabled: false, retreatActive: false, isSeries: false })).toEqual(['standard', 'multi']);
  });
  it('adds retreat when the feature is on', () => {
    expect(eventFormats({ retreatsEnabled: true, retreatActive: false, isSeries: false })).toEqual(['standard', 'retreat', 'multi']);
  });
  it('keeps retreat available for legacy retreat events even with the feature off', () => {
    expect(eventFormats({ retreatsEnabled: false, retreatActive: true, isSeries: false })).toContain('retreat');
  });
  it('hides multi-event for events in a recurring series', () => {
    expect(eventFormats({ retreatsEnabled: true, retreatActive: false, isSeries: true })).toEqual(['standard', 'retreat']);
  });
  it('never includes a challenge format', () => {
    const all = eventFormats({ retreatsEnabled: true, retreatActive: true, isSeries: false });
    expect(all).not.toContain('challenge');
    expect(all).toHaveLength(3);
  });
});

describe('current format detection', () => {
  it('maps form state to a format', () => {
    expect(formatOf(false, false)).toBe('standard');
    expect(formatOf(false, true)).toBe('retreat');
    expect(formatOf(true, false)).toBe('multi');
  });
});
