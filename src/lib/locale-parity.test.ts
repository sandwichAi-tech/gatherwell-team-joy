import { describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import es from '@/locales/es.json';

const flat = (o: unknown, p = ''): Record<string, string> => Object.entries(o as Record<string, unknown>).reduce((acc, [k, v]) => (typeof v === 'object' && v !== null ? { ...acc, ...flat(v, `${p}${k}.`) } : { ...acc, [`${p}${k}`]: String(v) }), {} as Record<string, string>);

describe('English and Spanish keys', () => {
  const E = flat(en), S = flat(es);
  it('have identical key sets', () => {
    expect(Object.keys(E).filter(k => !(k in S))).toEqual([]);
    expect(Object.keys(S).filter(k => !(k in E))).toEqual([]);
  });
  it('identity, onboarding and auth strings are translated and non-empty', () => {
    const keys = Object.keys(E).filter(k => /^(identity|onboarding|auth|join)\./.test(k));
    for (const k of keys) expect(S[k]?.trim().length, k).toBeGreaterThan(0);
    for (const k of Object.keys(E).filter(k => k.startsWith('identity.'))) expect(S[k], k).not.toBe(E[k]);
  });
  it('keep the same interpolation variables', () => {
    const vars = (s: string) => (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map(v => v.replace(/\s/g, '')).sort();
    const mismatched = Object.keys(E).filter(k => k in S && vars(E[k]!).join() !== vars(S[k]!).join());
    expect(mismatched).toEqual([]);
  });
});
