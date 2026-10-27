import { describe, it, expect } from 'vitest';
import { hostWaiverStatus, initialHostPick, pickOne, platformStatus, publishBlocked } from './builder-agreements';

const own = [
  { id: 'a', version: 2, archived: false, is_default: true },
  { id: 'b', version: 1, archived: false, is_default: false },
  { id: 'old', version: 3, archived: true, is_default: false },
];
const ready = { ready: true, en_id: 'e', es_id: 's', en_url: 'https://x', es_url: 'https://y', en_version: 1, es_version: 1 };

describe('event builder agreements', () => {
  it('platform agreement needs both approved English and Spanish documents', () => {
    expect(platformStatus(ready, false, false)).toBe('ready');
    expect(platformStatus({ ...ready, ready: false, es_id: null }, false, false)).toBe('missing');
    expect(platformStatus(null, false, false)).toBe('missing');
    expect(platformStatus(null, true, false)).toBe('loading');
    expect(platformStatus(null, false, true)).toBe('error');
  });
  it('publishing stays blocked without the platform agreement even with no host waiver', () => {
    expect(publishBlocked('missing', 'none')).toBe(true);
    expect(publishBlocked('error', 'ready')).toBe(true);
    expect(publishBlocked('ready', 'none')).toBe(false);
  });
  it('no host waiver is valid', () => expect(hostWaiverStatus([], own, false)).toBe('none'));
  it('a waiver not in the host’s own library cannot be published', () => {
    expect(hostWaiverStatus([{ id: 'other-host', version: 1 }], own, false)).toBe('unavailable');
    expect(hostWaiverStatus([{ id: 'old', version: 3 }], own, false)).toBe('unavailable');
    expect(publishBlocked('ready', 'unavailable')).toBe(true);
  });
  it('flags an older pinned version without changing it', () => expect(hostWaiverStatus([{ id: 'a', version: 1 }], own, false)).toBe('stale'));
  it('published events keep their pinned waiver', () => expect(hostWaiverStatus([{ id: 'gone', version: 1 }], undefined, true)).toBe('ready'));
  it('new events start with the default waiver; edits and duplicates do not', () => {
    expect(initialHostPick(own, true)).toEqual([{ id: 'a', version: 2 }]);
    expect(initialHostPick(own, false)).toEqual([]);
    expect(initialHostPick(own.map(w => ({ ...w, is_default: false })), true)).toEqual([]);
  });
  it('selecting one waiver replaces others and never picks archived ones', () => {
    expect(pickOne(own, 'b')).toEqual([{ id: 'b', version: 1 }]);
    expect(pickOne(own, 'old')).toEqual([]);
    expect(pickOne(own, null)).toEqual([]);
  });
});
