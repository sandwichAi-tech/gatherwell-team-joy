import { describe, expect, it } from 'vitest';
import {
  ACCENT_KEYS, accentPair, cardLayoutsFor, defaultCtaKey, emptyItemState, itemIssues,
  itemSnapshot, richTextHasContent, sanitizeRichText, sectionsFor,
} from './resource-item';

describe('sectionsFor', () => {
  it('gives offers the full section set', () => {
    expect(sectionsFor('course')).toEqual(['presentation', 'content', 'access', 'preview']);
    expect(sectionsFor('file')).toContain('options');
  });
  it('shows placement and access for every standalone type', () => {
    expect(sectionsFor('quiz')).toEqual(['presentation', 'content', 'access', 'preview']);
    expect(sectionsFor('recipe')).toContain('access');
    expect(sectionsFor('link')).toContain('access');
    expect(sectionsFor('link')).not.toContain('options');
  });
});

describe('cardLayoutsFor', () => {
  it('keeps all layouts for media/link types', () => {
    expect(cardLayoutsFor('video')).toEqual(['button', 'callout', 'preview']);
  });
  it('drops the bare button for file-heavy types', () => {
    expect(cardLayoutsFor('course')).toEqual(['callout', 'preview']);
    expect(cardLayoutsFor('bundle')).not.toContain('button');
  });
});

describe('accents', () => {
  it('every accent has a dark-on-light or light-on-dark pair', () => {
    for (const k of ACCENT_KEYS) {
      const p = accentPair(k);
      expect(p.bg).toMatch(/^#/); expect(p.fg).toMatch(/^#/); expect(p.bg).not.toBe(p.fg);
    }
  });
  it('unknown accents fall back to plum', () => {
    expect(accentPair('neon')).toEqual(accentPair('plum'));
  });
});

describe('sanitizeRichText', () => {
  it('keeps headings, lists, emphasis and safe links', () => {
    const out = sanitizeRichText('<h3>Hi</h3><p>Some <strong>bold</strong> and <em>em</em></p><ul><li>one</li></ul><a href="https://x.com/y">go</a>');
    expect(out).toContain('<h3>Hi</h3>');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<li>one</li>');
    expect(out).toContain('href="https://x.com/y"');
    expect(out).toContain('rel="noopener noreferrer"');
  });
  it('strips scripts, handlers, styles and unsafe tags/attributes', () => {
    const out = sanitizeRichText('<p onclick="x()">a</p><script>alert(1)</script><img src=x onerror=y><a href="javascript:bad()">j</a><div>d</div>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('img');
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('<div>');
    expect(out).toContain('<p>a</p>');
    expect(out).toContain('d'); // unwrapped, not dropped
  });
  it('handles empty input', () => {
    expect(sanitizeRichText('')).toBe('');
    expect(richTextHasContent('<p> </p>')).toBe(false);
    expect(richTextHasContent('<p>Hello</p>')).toBe(true);
  });
});

describe('itemIssues', () => {
  const base = { ...emptyItemState(), titleEn: 'Hi' };
  it('requires a title in at least one language', () => {
    expect(itemIssues('video', emptyItemState(), {})).toContain('title');
    expect(itemIssues('video', { ...emptyItemState(), titleEs: 'Hola' }, {})).toEqual([]);
  });
  it('validates only fields relevant to the type', () => {
    expect(itemIssues('link', base, { lessonUrl: 'ftp://x' })).toContain('url');
    expect(itemIssues('link', base, { lessonUrl: 'https://x.com' })).toEqual([]);
    expect(itemIssues('video', base, {})).toEqual([]); // video url optional
    expect(itemIssues('live', base, {})).toContain('live_time');
    expect(itemIssues('live', base, { live: '2026-11-01T10:00' })).toEqual([]);
    expect(itemIssues('quiz', base, {})).toContain('course');
    expect(itemIssues('quiz', base, { courseId: 'c1' })).toEqual([]);
  });
  it('validates price only for paid access', () => {
    expect(itemIssues('course', base, {})).toEqual([]);
    expect(itemIssues('course', { ...base, access: { free: false, price: '' } }, {})).toContain('price');
    expect(itemIssues('course', { ...base, access: { free: false, price: '0.10' } }, {})).toContain('price');
    expect(itemIssues('course', { ...base, access: { free: false, price: '25' } }, {})).toEqual([]);
  });
  it('requires a file before publishing a download', () => {
    expect(itemIssues('file', base, { publish: true })).toContain('file');
    expect(itemIssues('file', base, { publish: false })).toEqual([]);
    expect(itemIssues('file', base, { publish: true, filePath: 'u/f.pdf' })).toEqual([]);
  });
});

describe('defaults and dirty tracking', () => {
  it('cta default differs for free vs paid', () => {
    expect(defaultCtaKey(false)).not.toBe(defaultCtaKey(true));
  });
  it('snapshot detects changes', () => {
    const a = emptyItemState();
    const b = { ...a, subtitleEn: 'x' };
    expect(itemSnapshot(a)).toBe(itemSnapshot(emptyItemState()));
    expect(itemSnapshot(a)).not.toBe(itemSnapshot(b));
  });
});
