import { describe, expect, it } from 'vitest';
import { boundText, publicCardModel } from './public-cards';

describe('publicCardModel', () => {
  const base = { kind: 'download', id: '1', title_en: 'Guide', title_es: 'Guía' };

  it('picks the active language with fallback to the other', () => {
    expect(publicCardModel(base, 'en', 'Untitled', 'Get it').title).toBe('Guide');
    expect(publicCardModel(base, 'es', 'Untitled', 'Get it').title).toBe('Guía');
    expect(publicCardModel({ ...base, title_es: null }, 'es', 'Untitled', 'Get it').title).toBe('Guide');
  });

  it('falls back to the default title and CTA when empty', () => {
    const m = publicCardModel({ kind: 'download', id: '1' }, 'en', 'Untitled', 'Get it free');
    expect(m.title).toBe('Untitled');
    expect(m.cta).toBe('Get it free');
    expect(m.subtitle).toBe('');
  });

  it('uses the custom CTA and subtitle when saved', () => {
    const m = publicCardModel({ ...base, cta_en: 'Open the guide', subtitle_en: 'Short line' }, 'en', 'U', 'D');
    expect(m.cta).toBe('Open the guide');
    expect(m.subtitle).toBe('Short line');
  });

  it('whitelists layout and accent, falling back to preview/plum', () => {
    expect(publicCardModel({ ...base, card_layout: 'callout', accent: 'terracotta' }, 'en', 'U', 'D').layout).toBe('callout');
    expect(publicCardModel({ ...base, card_layout: 'neon-grid', accent: 'hotpink' }, 'en', 'U', 'D').layout).toBe('preview');
    expect(publicCardModel({ ...base, accent: 'hotpink' }, 'en', 'U', 'D').colors).toEqual(publicCardModel(base, 'en', 'U', 'D').colors);
  });

  it('bounds long text with an ellipsis', () => {
    const long = 'x'.repeat(200);
    const m = publicCardModel({ ...base, title_en: long, subtitle_en: long }, 'en', 'U', 'D');
    expect(m.title.length).toBeLessThanOrEqual(90);
    expect(m.title.endsWith('…')).toBe(true);
    expect(m.subtitle.length).toBeLessThanOrEqual(140);
  });

  it('marks paid offerings and defaults missing covers to the gradient', () => {
    expect(publicCardModel({ ...base, price_cents: 2500 }, 'en', 'U', 'D').paid).toBe(true);
    expect(publicCardModel(base, 'en', 'U', 'D').paid).toBe(false);
    expect(publicCardModel(base, 'en', 'U', 'D').coverPath).toBeNull();
    expect(publicCardModel(base, 'en', 'U', 'D').coverStyle).toBe(0);
  });
});

describe('boundText', () => {
  it('leaves short text alone and cuts long text', () => {
    expect(boundText('hi', 10)).toBe('hi');
    expect(boundText('hello world!', 8)).toBe('hello w…');
    expect(boundText('hello world!', 8).length).toBeLessThanOrEqual(8);
  });
});

describe('visibleLessons (course outline draft filtering)', () => {
  it('hides draft lessons from participants and shows them to leaders', async () => {
    const { visibleLessons } = await import('./learn');
    const mk = (id: string, pub: boolean) => ({ id, track_id: 'T', is_published: pub }) as never;
    const data = { tracks: [], lessons: [mk('a', true), mk('b', false), mk('c', true)], done: new Set<string>(), locked: new Map<string, string>() };
    expect(visibleLessons(data, 'T', false).map(l => l.id)).toEqual(['a', 'c']);
    expect(visibleLessons(data, 'T', true).map(l => l.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('publicCardRoute / publicKindKey (cross-model cards)', () => {
  it('routes offers to the offer landing and tracks to the track access route', async () => {
    const { publicCardRoute } = await import('./public-cards');
    expect(publicCardRoute({ id: 'a', entity: 'offer' })).toEqual({ to: '/o/$id', id: 'a' });
    expect(publicCardRoute({ id: 'b', entity: 'track' })).toEqual({ to: '/resource/$kind/$id', id: 'b', kind: 'track' });
    expect(publicCardRoute({ id: 'c' })).toEqual({ to: '/o/$id', id: 'c' }); // legacy rows without entity stay offers
  });
  it('picks the type label namespace per model', async () => {
    const { publicKindKey } = await import('./public-cards');
    expect(publicKindKey({ kind: 'download', entity: 'offer' })).toBe('resources.create.types.file.name');
    expect(publicKindKey({ kind: 'video', entity: 'track' })).toBe('resources.create.types.video.name');
    expect(publicKindKey({ kind: 'link', entity: 'track' })).toBe('resources.create.types.link.name');
  });
  it('track cards render through the shared card model with fallbacks', async () => {
    const { publicCardModel } = await import('./public-cards');
    const m = publicCardModel({ id: 't', kind: 'video', entity: 'track', title_en: 'Morning video', card_layout: 'callout', accent: 'terracotta' }, 'es', 'Sin título', 'Ver');
    expect(m.title).toBe('Morning video'); // es missing falls back to en
    expect(m.layout).toBe('callout');
    expect(m.paid).toBe(false); // track resources are free after sign-in
  });
});
