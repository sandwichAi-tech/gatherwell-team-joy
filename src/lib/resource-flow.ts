import type { ItemSection } from '@/lib/resource-item';

/**
 * Resource builder flow rules: step navigation, one-shot publish, activation
 * (“available from”) boundaries and blueprint placeholder detection.
 * Pure so the same rules are unit-tested and mirrored by the database guards.
 */

export function stepNav(sections: readonly ItemSection[], current: ItemSection) {
  const i = Math.max(0, sections.indexOf(current));
  return {
    index: i,
    total: sections.length,
    prev: i > 0 ? sections[i - 1]! : null,
    next: i < sections.length - 1 ? sections[i + 1]! : null,
    /** Publish/Update is offered only on the final review step. */
    isFinal: i === sections.length - 1,
  };
}

/** Blueprint copies use bracketed example text, e.g. “[Your lesson title]”. Mirrors has_blueprint_placeholder(). */
export const PLACEHOLDER_RE = /\[[^\]]{3,}\]/;
export const hasPlaceholder = (...texts: (string | null | undefined)[]) => texts.some(x => !!x && PLACEHOLDER_RE.test(x));

/** Same definition as resource_is_live(): no date = available on publish; otherwise available at/after the instant. */
export const isLive = (availableFrom: string | null | undefined, now: number = Date.now()) =>
  !availableFrom || new Date(availableFrom).getTime() <= now;

/** datetime-local value (interpreted in the browser’s zone) → ISO instant, or null when empty/invalid. */
export const activationIso = (local: string) => {
  if (!local.trim()) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/**
 * Guards a submit so a double click cannot create two records: returns a runner
 * that ignores calls while one is in flight.
 */
export function oneShot<A extends unknown[], R>(fn: (...a: A) => Promise<R>) {
  let inFlight = false;
  return async (...a: A): Promise<R | undefined> => {
    if (inFlight) return undefined;
    inFlight = true;
    try { return await fn(...a); } finally { inFlight = false; }
  };
}

/** Where a successful publish/update lands: the canonical detail page for the saved item. */
export function publishedDestination(entity: 'track' | 'recipe' | 'offer', id: string) {
  if (entity === 'track') return { to: '/learn/track/$id' as const, params: { id } };
  if (entity === 'recipe') return { to: '/learn/recipe/$id' as const, params: { id } };
  return { to: '/offer/$id' as const, params: { id } };
}

/** Human-meaningful track state for management lists: track status plus lesson publication. */
export function trackState(trackPublished: boolean, lessons: { is_published: boolean }[]) {
  const live = lessons.filter(l => l.is_published).length;
  if (!trackPublished) return { key: 'draft' as const, live, total: lessons.length };
  if (lessons.length > 0 && live === 0) return { key: 'publishedEmpty' as const, live, total: lessons.length };
  if (live < lessons.length) return { key: 'publishedPartial' as const, live, total: lessons.length };
  return { key: 'published' as const, live, total: lessons.length };
}

type LessonLike = { id: string; is_published: boolean; title_en: string | null; title_es: string | null; notes_en?: string | null; notes_es?: string | null; description_en?: string | null; description_es?: string | null };
const lessonHasPlaceholder = (l: LessonLike) => hasPlaceholder(l.title_en, l.title_es, l.notes_en, l.notes_es, l.description_en, l.description_es);

/** Tracks with several lessons, or a blueprint copy still holding example text, are edited lesson by lesson. */
export const isMultiLessonTrack = (lessons: LessonLike[]) => lessons.length > 1 || lessons.some(lessonHasPlaceholder);

/** Lessons whose example text must be replaced before the track can be published. */
export const placeholderLessons = <L extends LessonLike>(lessons: L[]) => lessons.filter(lessonHasPlaceholder);

/**
 * First publish makes every reviewed draft lesson visible with the track; an Update never
 * changes lesson visibility the coach set afterwards. Lessons still holding placeholders never auto-publish.
 */
export const lessonsToPublishWithTrack = (lessons: LessonLike[], trackWasPublished: boolean) =>
  trackWasPublished ? [] : lessons.filter(l => !l.is_published && !lessonHasPlaceholder(l)).map(l => l.id);
