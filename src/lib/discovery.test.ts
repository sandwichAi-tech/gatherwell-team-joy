import { describe, it, expect, beforeEach } from 'vitest';
import { hasActiveFilters, activeFilterCount, savePendingHostInvite, pendingHostInvite, clearPendingHostInvite } from './discovery';
import { searchToFilters } from '@/components/landing/discover-page';

describe('hasActiveFilters', () => {
  it('is false for a clean catalog view', () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ sort: 'soonest' })).toBe(false);
  });
  it('is true for any real filter', () => {
    expect(hasActiveFilters({ q: 'yoga' })).toBe(true);
    expect(hasActiveFilters({ kinds: ['event'] })).toBe(true);
    expect(hasActiveFilters({ free: false })).toBe(true); // paid-only is a filter too
    expect(hasActiveFilters({ accessible: true })).toBe(true);
    expect(hasActiveFilters({ minors: true })).toBe(true);
    expect(hasActiveFilters({ near: { lat: 1, lng: 2, radiusKm: 50, label: '' } })).toBe(true);
  });
});

describe('activeFilterCount', () => {
  it('counts removable filters, not sort', () => {
    expect(activeFilterCount({})).toBe(0);
    expect(activeFilterCount({ q: 'x', free: true, near: { lat: 1, lng: 1, radiusKm: 25, label: '' } })).toBe(3);
    expect(activeFilterCount({ from: '2026-10-01', to: '2026-10-31' })).toBe(1); // date window is one chip
  });
});

describe('searchToFilters (URL parity)', () => {
  it('parses kind lists and drops unknown kinds', () => {
    expect(searchToFilters({ kind: 'event,course' }, null).kinds).toEqual(['event', 'course']);
    expect(searchToFilters({ kind: 'event,bogus' }, null).kinds).toEqual(['event']);
    expect(searchToFilters({ kind: 'bogus' }, null).kinds).toBeUndefined();
  });
  it('maps free=0 to a paid-only filter and free=1 to free-only', () => {
    expect(searchToFilters({ free: 1 }, null).free).toBe(true);
    expect(searchToFilters({ free: 0 }, null).free).toBe(false);
    expect(searchToFilters({}, null).free).toBeUndefined();
  });
  it('builds a near filter only with both coordinates', () => {
    expect(searchToFilters({ lat: 40.7, lng: -74, r: 25 }, null).near).toEqual({ lat: 40.7, lng: -74, radiusKm: 25, label: '' });
    expect(searchToFilters({ lat: 40.7 }, null).near).toBeUndefined();
    expect(searchToFilters({}, { lat: 1, lng: 2 }).near).toEqual({ lat: 1, lng: 2, radiusKm: 50, label: '' });
  });
  it('round-trips flags', () => {
    const f = searchToFilters({ access: 1, minors: 1, sort: 'newest', lang: 'es' }, null);
    expect(f).toMatchObject({ accessible: true, minors: true, sort: 'newest', lang: 'es' });
  });
});

describe('pending host invite storage', () => {
  beforeEach(() => { localStorage.clear(); });
  it('round-trips a token and clears it', () => {
    savePendingHostInvite('ABC123XYZ9');
    expect(pendingHostInvite()).toBe('ABC123XYZ9');
    clearPendingHostInvite();
    expect(pendingHostInvite()).toBeNull();
  });
  it('expires after the TTL', () => {
    const now = Date.now();
    savePendingHostInvite('ABC123XYZ9', now);
    expect(pendingHostInvite(now + 8 * 24 * 60 * 60 * 1000)).toBeNull();
    expect(pendingHostInvite(now + 60_000)).toBe('ABC123XYZ9');
  });
});
