import { describe, expect, it } from 'vitest';
import { classifyPhotoFile } from '@/components/image-crop';
const MB = 1024 * 1024;
describe('photo upload validation', () => {
  it('detects HEIC/HEIF by type or by name when the phone sends no type', () => {
    expect(classifyPhotoFile({ type: 'image/heic', name: 'a.jpg', size: 1 }, 5 * MB)).toBe('heic');
    expect(classifyPhotoFile({ type: 'image/heif', name: 'a', size: 1 }, 5 * MB)).toBe('heic');
    expect(classifyPhotoFile({ type: '', name: 'IMG_0001.HEIC', size: 1 }, 5 * MB)).toBe('heic');
  });
  it('accepts JPG/PNG/WebP within the limit and rejects other types or oversize', () => {
    expect(classifyPhotoFile({ type: 'image/jpeg', name: 'a.jpg', size: 5 * MB }, 5 * MB)).toBeNull();
    expect(classifyPhotoFile({ type: 'image/jpeg', name: 'a.jpg', size: 5 * MB + 1 }, 5 * MB)).toBe('size');
    expect(classifyPhotoFile({ type: 'image/gif', name: 'a.gif', size: 1 }, 5 * MB)).toBe('type');
  });
});
