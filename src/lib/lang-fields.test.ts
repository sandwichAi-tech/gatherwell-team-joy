import { describe, expect, it } from 'vitest';
import { activeLang, hasAnyTitle, otherLang, showBothLanguages } from './lang-fields';

describe('active content language', () => {
  it('follows the UI language with English fallback', () => {
    expect(activeLang('es')).toBe('es');
    expect(activeLang('es-MX')).toBe('en'); // only exact es switches; resolvedLanguage is already normalized
    expect(activeLang('en')).toBe('en');
    expect(activeLang(undefined)).toBe('en');
  });
  it('knows the other language', () => {
    expect(otherLang('en')).toBe('es');
    expect(otherLang('es')).toBe('en');
  });
});

describe('when both language fields show', () => {
  it('shows only the active language by default', () => {
    expect(showBothLanguages('', false)).toBe(false);
  });
  it('shows both when the creator expanded the translation', () => {
    expect(showBothLanguages('', true)).toBe(true);
  });
  it('always shows both when the hidden language already has content', () => {
    expect(showBothLanguages('Hola', false)).toBe(true);
    expect(showBothLanguages('  ', false)).toBe(false);
  });
});

describe('title validation', () => {
  it('accepts a title in either language and never requires the hidden one', () => {
    expect(hasAnyTitle('Title', '')).toBe(true);
    expect(hasAnyTitle('', 'Título')).toBe(true);
    expect(hasAnyTitle('', '')).toBe(false);
    expect(hasAnyTitle('  ', ' ')).toBe(false);
  });
});
