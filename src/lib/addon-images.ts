import type { Addon } from '@/lib/event-builder';

export const ADDON_IMAGE_BYTES = 15 * 1024 * 1024;
export const ADDON_IMAGE_RATIO = 4 / 3;
export function validAddonImagePath(path: string): boolean {
  return /^[a-f0-9-]{36}\/addon-[a-f0-9-]+\.webp$/.test(path);
}
export function ownAddonImagePath(path: string, userId: string): boolean {
  return validAddonImagePath(path) && path.startsWith(`${userId}/`);
}
export function publicAddon(a: Addon, image: string | null) {
  return { id: a.id, name: a.name, price_cents: a.price_cents, image };
}