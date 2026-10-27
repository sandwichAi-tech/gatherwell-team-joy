import type { CreateType } from './create-resource';

export const RESOURCE_PLACEMENTS = ['team', 'course', 'coach'] as const;
export type ResourcePlacement = (typeof RESOURCE_PLACEMENTS)[number];
export const placementsFor = (type: CreateType): readonly ResourcePlacement[] => type === 'course' ? ['team', 'coach'] : RESOURCE_PLACEMENTS;
export function resourcePriceCents(free: boolean, price: string): number | null {
  if (free) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(price.trim())) return null;
  const cents = Math.round(Number(price) * 100);
  return Number.isSafeInteger(cents) && cents >= 50 && cents <= 100000 ? cents : null;
}
export const savedPlacement = (row: { placement?: string | null; visibility?: string | null; offer_id?: string | null }): ResourcePlacement =>
  row.placement === 'coach' || row.placement === 'course' ? row.placement : row.placement === 'team' ? 'team' : row.offer_id ? 'course' : row.visibility === 'public' ? 'coach' : 'team';
export const resourceAccessPrice = (placement: ResourcePlacement, free: boolean, price: string) => placement === 'course' ? 0 : resourcePriceCents(free, price);