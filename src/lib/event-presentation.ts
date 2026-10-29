/** Presentation only: never use this value to update a profile or location. */
export function displayTitleCase(value: string | null | undefined): string {
  return (value ?? '').toLocaleLowerCase().replace(/(^|[\s\-’'])\p{L}/gu, part => part.toLocaleUpperCase());
}

export const BRAND_EVENT_SLOT = 'hero_card_1';
const photoCategories = ['fitcamp', 'run', 'yoga', 'walk', 'hike', 'pickleball', 'soundbath', 'pilates'];
export function eventPhotoSlot(category?: string | null): string {
  return category && photoCategories.includes(category) ? `feed_default_${category}` : BRAND_EVENT_SLOT;
}
export function showAgePolicy(event: { min_age?: number | null; allows_minors?: boolean }): boolean {
  return event.min_age != null || event.allows_minors === true;
}
export function attendancePresentation(going: number, capacity: number | null) {
  const left = capacity == null ? null : Math.max(0, capacity - going);
  return { first: going < 3, left: left != null && left < 10 ? left : null };
}