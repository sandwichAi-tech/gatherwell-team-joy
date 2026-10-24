import { describe, expect, it } from 'vitest';
import { COVER_STYLES, COVER_FOCALS, COVER_OVERLAYS, coverStyleAt, isValidOverlay, isValidFocal, isValidAlt, clampOverlay, clampFocal, DEFAULT_FOCAL } from './cover';

describe('COVER_STYLES', () => {
  it('offers six curated brand gradients', () => {
    expect(COVER_STYLES.length).toBe(6);
    for (const g of COVER_STYLES) expect(g).toMatch(/gradient\(/);
  });
  it('uses the Blueprint v4 palette', () => {
    const all = COVER_STYLES.join(' ');
    expect(all).toContain('#302338'); // Midnight Plum
    expect(all).toContain('#C78E76'); // Adobe Terracotta
  });
});

describe('coverStyleAt', () => {
  it('returns a valid gradient for any input', () => {
    expect(coverStyleAt(0)).toBe(COVER_STYLES[0]);
    expect(coverStyleAt(5)).toBe(COVER_STYLES[5]);
    expect(coverStyleAt(6)).toBe(COVER_STYLES[0]);
    expect(coverStyleAt(null)).toBe(COVER_STYLES[0]);
    expect(coverStyleAt(undefined)).toBe(COVER_STYLES[0]);
    expect(coverStyleAt(99)).toBe(COVER_STYLES[3]);
    expect(coverStyleAt(-1)).toBe(COVER_STYLES[1]);
  });
});

describe('overlay validation', () => {
  it('accepts 0–60 and rejects the rest', () => {
    expect(isValidOverlay(0)).toBe(true);
    expect(isValidOverlay(60)).toBe(true);
    expect(isValidOverlay(61)).toBe(false);
    expect(isValidOverlay(-1)).toBe(false);
    expect(isValidOverlay(2.5)).toBe(false);
    expect(isValidOverlay('25')).toBe(false);
    expect(clampOverlay('bad')).toBe(0);
    expect(COVER_OVERLAYS.every(isValidOverlay)).toBe(true);
  });
});

describe('focal validation', () => {
  it('accepts percent pairs and rejects malformed values', () => {
    expect(isValidFocal('50% 50%')).toBe(true);
    expect(isValidFocal('0% 100%')).toBe(true);
    expect(isValidFocal('50%50%')).toBe(false);
    expect(isValidFocal('101% 50%')).toBe(false);
    expect(isValidFocal('50px 50px')).toBe(false);
    expect(isValidFocal('')).toBe(false);
    expect(clampFocal('junk')).toBe(DEFAULT_FOCAL);
    expect(COVER_FOCALS.every(isValidFocal)).toBe(true);
    expect(COVER_FOCALS.length).toBe(9);
  });
});

describe('alt text validation', () => {
  it('allows empty and bounded text', () => {
    expect(isValidAlt(null)).toBe(true);
    expect(isValidAlt('A sunrise yoga class')).toBe(true);
    expect(isValidAlt('x'.repeat(200))).toBe(true);
    expect(isValidAlt('x'.repeat(201))).toBe(false);
  });
});
