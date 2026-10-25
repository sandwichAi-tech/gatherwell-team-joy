/**
 * Mobile bottom bar stays fixed at five slots: four primary destinations plus a More menu.
 * The desktop sidebar still lists every destination. Communication and Insights live directly
 * inside More when they do not fit the primary four.
 */
export function splitMobileNav<T>(tabs: T[]): { primary: T[]; more: T[] } {
  return { primary: tabs.slice(0, 4), more: tabs.slice(4) };
}
