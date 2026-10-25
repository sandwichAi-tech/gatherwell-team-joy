import { describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import { activationIso, hasPlaceholder, isLive, oneShot, publishedDestination, stepNav, trackState } from '@/lib/resource-flow';
import { sectionsFor } from '@/lib/resource-item';

describe('builder step navigation', () => {
  const s = sectionsFor('file');
  it('intermediate steps have Back/Next and no publish', () => {
    const n = stepNav(s, 'content');
    expect(n.prev).toBe('presentation'); expect(n.next).toBe('access'); expect(n.isFinal).toBe(false);
  });
  it('first step has no Back', () => expect(stepNav(s, 'presentation').prev).toBeNull());
  it('publish only on final review step', () => {
    expect(stepNav(s, 'preview').isFinal).toBe(true);
    expect(stepNav(s, 'preview').next).toBeNull();
  });
  it('recipe skips access/options but still ends on preview', () => {
    expect(stepNav(sectionsFor('recipe'), 'content').next).toBe('preview');
  });
});

describe('activation boundary', () => {
  const at = '2026-11-01T10:00:00.000Z'; const t = new Date(at).getTime();
  it('no date means live', () => expect(isLive(null, t)).toBe(true));
  it('one ms before is not live', () => expect(isLive(at, t - 1)).toBe(false));
  it('exactly at the instant is live', () => expect(isLive(at, t)).toBe(true));
  it('empty or invalid input clears the date', () => { expect(activationIso('')).toBeNull(); expect(activationIso('nope')).toBeNull(); });
});

describe('one-shot publish', () => {
  it('ignores a second click while the first is saving', async () => {
    let calls = 0; let release!: () => void;
    const run = oneShot(() => { calls++; return new Promise<void>(r => { release = r; }); });
    const a = run(); const b = run();
    release(); await a; await b;
    expect(calls).toBe(1);
    const c = run(); release(); await c; expect(calls).toBe(2);
  });
});

describe('blueprint placeholders', () => {
  it('detects bracketed example text', () => expect(hasPlaceholder('[Your lesson title]')).toBe(true));
  it('allows normal text and short brackets', () => expect(hasPlaceholder('Morning flow', 'Step [1]', null)).toBe(false));
});

describe('destinations and track state', () => {
  it('routes to canonical detail pages', () => {
    expect(publishedDestination('track', 'x').to).toBe('/learn/track/$id');
    expect(publishedDestination('offer', 'x').to).toBe('/offer/$id');
    expect(publishedDestination('recipe', 'x').to).toBe('/learn/recipe/$id');
  });
  it('flags a published track whose lessons are all drafts', () => {
    expect(trackState(true, [{ is_published: false }, { is_published: false }]).key).toBe('publishedEmpty');
    expect(trackState(true, [{ is_published: true }, { is_published: false }]).key).toBe('publishedPartial');
    expect(trackState(false, []).key).toBe('draft');
  });
});

describe('resource blueprint copy', () => {
  it('English says blueprint, not template', () => {
    expect(en.templatesR.title).toBe('Resource blueprints');
    expect(en.resources.templatesButton).toBe('Resource blueprints');
    expect(JSON.stringify(en.templatesR)).not.toMatch(/template/i);
  });
  it('Spanish matches Event blueprint wording (Modelos)', () => {
    expect(es.templatesR.title).toBe('Modelos de recursos');
    expect(JSON.stringify(es.templatesR)).not.toMatch(/plantilla/i);
  });
});
