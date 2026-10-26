import { describe, expect, it, vi } from 'vitest';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import {
  CARD_RENDITION_WIDTHS, RENDITION_WIDTHS, buildSrcSet, croppedOutputWidth, isLowResolution,
  mediaHref, pickRenditionWidth, signRendition, toRendition, type SigningBucket,
} from '@/lib/media-renditions';

const fakeBucket = (fail: (w?: number) => boolean = () => false) => {
  const calls: { path: string; expires: number; transform?: unknown }[] = [];
  const bucket: SigningBucket = {
    createSignedUrl: vi.fn(async (path: string, expires: number, opts?: { transform?: { width?: number } }) => {
      calls.push({ path, expires, transform: opts?.transform });
      const w = opts?.transform?.width;
      if (fail(w)) return { data: null, error: new Error('no transform') };
      return { data: { signedUrl: `https://cdn.test/${w ? 'render' : 'object'}/sign/media/x?token=t${w ?? 0}` }, error: null };
    }),
  };
  return { bucket, calls };
};

describe('rendition selection', () => {
  it('picks the smallest width covering CSS width × DPR', () => {
    expect(pickRenditionWidth(360, 1)).toBe(480);
    expect(pickRenditionWidth(360, 2)).toBe(960);
    expect(pickRenditionWidth(390, 3)).toBe(1600);
    expect(pickRenditionWidth(1280, 2)).toBe(2400);
  });
  it('caps at the largest rendition instead of asking for more pixels', () => {
    expect(pickRenditionWidth(1920, 3)).toBe(2400);
    expect(pickRenditionWidth(400, 3, CARD_RENDITION_WIDTHS)).toBe(1600);
  });
  it('builds an ascending srcset and skips failed widths', () => {
    expect(buildSrcSet([{ width: 960, url: 'b' }, { width: 480, url: 'a' }, { width: 1600, url: null }])).toBe('a 480w, b 960w');
    expect(buildSrcSet([{ width: 480, url: null }])).toBeUndefined();
  });
});

describe('signed private renditions', () => {
  it('signs the original plus every width with contain resize (keeps crop, never stretches)', async () => {
    const { bucket, calls } = fakeBucket();
    const r = await signRendition(bucket, 'user/cover-1.webp', 3600);
    expect(calls).toHaveLength(1 + RENDITION_WIDTHS.length);
    expect(calls.every(c => c.path === 'user/cover-1.webp' && c.expires === 3600)).toBe(true);
    for (const c of calls.slice(1)) expect(c.transform).toMatchObject({ resize: 'contain', quality: 80 });
    expect(r?.src).toContain('/object/sign/');
    expect(r?.srcSet?.split(', ')).toHaveLength(RENDITION_WIDTHS.length);
    expect(r?.srcSet).toContain('2400w');
  });
  it('never puts the raw storage path in the output', async () => {
    const { bucket } = fakeBucket();
    const r = await signRendition(bucket, 'secret-user/cover-1.webp');
    expect(JSON.stringify(r)).not.toContain('secret-user/cover-1.webp');
  });
  it('falls back to the original alone when the transformer fails', async () => {
    const { bucket } = fakeBucket(w => w !== undefined);
    expect(await signRendition(bucket, 'u/c.webp')).toEqual({ src: 'https://cdn.test/object/sign/media/x?token=t0' });
  });
  it('returns null when the original cannot be signed (no access)', async () => {
    const { bucket } = fakeBucket(() => true);
    expect(await signRendition(bucket, 'u/c.webp')).toBeNull();
  });
  it('passes external https URLs through without signing', async () => {
    const { bucket, calls } = fakeBucket();
    expect(await signRendition(bucket, 'https://images.example/x.jpg')).toEqual({ src: 'https://images.example/x.jpg' });
    expect(calls).toHaveLength(0);
  });
  it('card signing uses only card widths', async () => {
    const { bucket, calls } = fakeBucket();
    await signRendition(bucket, 'u/c.webp', 3600, CARD_RENDITION_WIDTHS);
    expect(calls).toHaveLength(1 + CARD_RENDITION_WIDTHS.length);
  });
  it('normalizes plain URLs and renditions', () => {
    expect(toRendition('https://a')).toEqual({ src: 'https://a' });
    expect(toRendition(null)).toBeNull();
    expect(mediaHref({ src: 'https://a', srcSet: 'x 480w' })).toBe('https://a');
  });
});

describe('low-resolution honesty and crop size', () => {
  it('flags covers under 1200px wide and accepts larger ones', () => {
    expect(isLowResolution(1080)).toBe(true);
    expect(isLowResolution(1200)).toBe(false);
    expect(isLowResolution(2400)).toBe(false);
    expect(isLowResolution(0)).toBe(false);
  });
  it('crop output keeps real pixels, caps the long edge at 2400 and never enlarges', () => {
    expect(croppedOutputWidth(800, 450)).toBe(800);
    expect(croppedOutputWidth(4000, 2250)).toBe(2400);
    expect(croppedOutputWidth(1350, 2400)).toBe(1350);
    expect(croppedOutputWidth(2000, 4000)).toBe(1200);
  });
  it('has matched EN/ES warning copy with the width placeholder', () => {
    for (const s of [en.crop.lowRes, es.crop.lowRes, en.gathering.coverLowRes, es.gathering.coverLowRes]) expect(s).toContain('{{width}}');
  });
});
