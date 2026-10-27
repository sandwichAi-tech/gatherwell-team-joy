import { describe, it, expect } from 'vitest';
import { ADDON_IMAGE_BYTES, ADDON_IMAGE_RATIO, ownAddonImagePath, validAddonImagePath, publicAddon } from './addon-images';
import { cleanAddons } from './event-builder';
import { supportedCropType } from '@/components/image-crop';
import { detailsFromEvent, detailsPayload } from '@/components/event-details-form';

const owner = '11111111-1111-4111-8111-111111111111';
const outsider = '22222222-2222-4222-8222-222222222222';
const path = `${owner}/addon-33333333-3333-4333-8333-333333333333.webp`;
describe('optional add-on images', () => {
  it('preserves old image-free records unchanged', () => {
    expect(cleanAddons([{ id: 'mat', name: 'Mat', price_cents: 500 }])).toEqual([{ id: 'mat', name: 'Mat', price_cents: 500 }]);
  });
  it('preserves the image through canonical save/reopen normalization', () => {
    const d = detailsFromEvent({ addons: [{ id: 'mat', name: 'Mat', price_cents: 500, image_path: path }] });
    expect(detailsPayload(d)?.['addons']).toEqual([{ id: 'mat', name: 'Mat', price_cents: 500, image_path: path }]);
  });
  it('preserves image removal as an explicit null', () => {
    expect(cleanAddons([{ id: 'mat', name: 'Mat', price_cents: 500, image_path: null }])?.[0]?.image_path).toBeNull();
  });
  it('preserves selected image in a partial draft without requiring a name', () => {
    const snapshot = { details: { addons: [{ id: 'mat', name: '', price_cents: 0, image_path: path }] } };
    expect(JSON.parse(JSON.stringify(snapshot)).details.addons[0].image_path).toBe(path);
    expect(cleanAddons(snapshot.details.addons)).toBeNull();
  });
  it('uses the existing 15MB limit and 4:3 product ratio', () => {
    expect(ADDON_IMAGE_BYTES).toBe(15 * 1024 * 1024);
    expect(ADDON_IMAGE_RATIO).toBe(4 / 3);
  });
  it('uses the existing accepted types, not SVG/GIF/HEIC', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) expect(supportedCropType(type)).toBe(true);
    for (const type of ['image/svg+xml', 'image/gif', 'image/heic']) expect(supportedCropType(type)).toBe(false);
  });
  it('does not permit deleting another uploader’s image', () => {
    expect(ownAddonImagePath(path, owner)).toBe(true);
    expect(ownAddonImagePath(path, outsider)).toBe(false);
  });
  it('rejects external URLs, traversal and unrelated private media', () => {
    for (const p of ['https://example.com/photo.webp', `${owner}/../addon-a.webp`, `${owner}/cover-123.webp`, '/addon-a.webp']) expect(validAddonImagePath(p)).toBe(false);
  });
  it('projects only signed image URLs, never uploader paths', () => {
    expect(publicAddon({ id: 'mat', name: 'Mat', price_cents: 500, image_path: path }, 'https://example.com/signed')).toEqual({ id: 'mat', name: 'Mat', price_cents: 500, image: 'https://example.com/signed', description_en: null, description_es: null });
  });
  it('keeps prices unchanged when images are absent/unavailable', () => {
    expect(publicAddon({ id: 'mat', name: 'Mat', price_cents: 500, image_path: path }, null)).toEqual({ id: 'mat', name: 'Mat', price_cents: 500, image: null, description_en: null, description_es: null });
  });
});