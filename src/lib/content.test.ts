import { describe, expect, it } from 'vitest';
import { bundleItemError, commerceMode, enrollmentState, isAllowedEmbed, isHttpsUrl, lessonFileError, paidSetupRequired, readinessBlockers } from '@/lib/content';

describe('readinessBlockers', () => {
  const base = { kind: 'course', sections: 1, lessons: 2, title_en: 'Course', summary_en: 'Short', description_en: 'Long' };
  it('passes a complete free course', () => {
    expect(readinessBlockers(base)).toEqual([]);
  });
  it('requires a title, summary and description in at least one language', () => {
    expect(readinessBlockers({ ...base, title_en: '', title_es: ' ' })).toContain('missing_title');
    expect(readinessBlockers({ ...base, summary_en: null, summary_es: null })).toContain('missing_summary');
    expect(readinessBlockers({ ...base, description_en: '', description_es: '' })).toContain('missing_description');
    expect(readinessBlockers({ ...base, title_en: '', title_es: 'Título' })).not.toContain('missing_title');
  });
  it('requires sections and lessons for courses and memberships', () => {
    expect(readinessBlockers({ ...base, sections: 0 })).toContain('no_sections');
    expect(readinessBlockers({ ...base, lessons: 0 })).toContain('no_lessons');
    expect(readinessBlockers({ ...base, kind: 'membership', sections: 0, lessons: 0 })).toEqual(expect.arrayContaining(['no_sections', 'no_lessons']));
  });
  it('requires a file for downloads but not sections', () => {
    expect(readinessBlockers({ kind: 'download', sections: 0, lessons: 0, title_en: 'R', summary_en: 'S', description_en: 'D', file_path: null })).toEqual(['missing_file']);
    expect(readinessBlockers({ kind: 'download', sections: 0, lessons: 0, title_en: 'R', summary_en: 'S', description_en: 'D', file_path: 'u/f.pdf' })).toEqual([]);
  });
  it('flags every paid offer as setup required until checkout is verified', () => {
    expect(readinessBlockers({ ...base, price_cents: 2500 })).toContain('paid_setup_required');
    expect(readinessBlockers({ ...base, price_cents: 0 })).not.toContain('paid_setup_required');
  });
});

describe('enrollmentState', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  it('is open with no window', () => {
    expect(enrollmentState({ enroll_opens_at: null, enroll_closes_at: null }, now)).toBe('open');
  });
  it('respects open and close dates', () => {
    expect(enrollmentState({ enroll_opens_at: '2026-10-25T00:00:00Z', enroll_closes_at: null }, now)).toBe('not_yet');
    expect(enrollmentState({ enroll_opens_at: null, enroll_closes_at: '2026-10-23T00:00:00Z' }, now)).toBe('closed');
    expect(enrollmentState({ enroll_opens_at: '2026-10-23T00:00:00Z', enroll_closes_at: '2026-10-25T00:00:00Z' }, now)).toBe('open');
  });
});

describe('link and embed validation', () => {
  it('accepts only https URLs', () => {
    expect(isHttpsUrl('https://example.com/x')).toBe(true);
    expect(isHttpsUrl('http://example.com')).toBe(false);
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpsUrl('')).toBe(true);
  });
  it('allows only approved embed hosts', () => {
    expect(isAllowedEmbed('https://www.youtube.com/watch?v=abc12345')).toBe(true);
    expect(isAllowedEmbed('https://vimeo.com/123456')).toBe(true);
    expect(isAllowedEmbed('https://evil.example.com/embed')).toBe(false);
  });
});

describe('lessonFileError', () => {
  it('enforces MIME and size per type', () => {
    expect(lessonFileError('video', { size: 10, type: 'video/mp4' })).toBeNull();
    expect(lessonFileError('video', { size: 10, type: 'application/pdf' })).toBe('bad_type');
    expect(lessonFileError('pdf', { size: 60 * 1024 * 1024, type: 'application/pdf' })).toBe('too_large');
    expect(lessonFileError('audio', { size: 10, type: 'audio/mpeg' })).toBeNull();
    expect(lessonFileError('file', { size: 10, type: 'application/pdf' })).toBeNull();
    expect(lessonFileError('text', { size: 10, type: 'anything' })).toBeNull();
  });
});

describe('commerce configuration', () => {
  it('maps price and interval to free, one-time or subscription', () => {
    expect(commerceMode({ price_cents: 0 })).toBe('free');
    expect(commerceMode({ price_cents: 2500 })).toBe('one_time');
    expect(commerceMode({ price_cents: 2500, billing_interval: 'month' })).toBe('subscription');
  });
  it('keeps every paid action setup-required', () => {
    expect(paidSetupRequired({ price_cents: 1 })).toBe(true);
    expect(paidSetupRequired({ price_cents: 0 })).toBe(false);
  });
});

describe('bundle items', () => {
  it('text items need body content', () => {
    expect(bundleItemError({ type: 'text', body: '' })).toBe('missing_content');
    expect(bundleItemError({ type: 'text', body: 'Hello' })).toBeNull();
  });
  it('file items need an uploaded file', () => {
    expect(bundleItemError({ type: 'file' })).toBe('missing_content');
    expect(bundleItemError({ type: 'file', storage_path: 'team/x.pdf' })).toBeNull();
  });
  it('link and embed items require https URLs', () => {
    expect(bundleItemError({ type: 'link' })).toBe('missing_content');
    expect(bundleItemError({ type: 'link', url: 'http://x.com' })).toBe('https');
    expect(bundleItemError({ type: 'embed', url: 'https://vimeo.com/123' })).toBeNull();
  });
});
