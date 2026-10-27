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
/** Legacy single-destination value (rows saved before multi-destination). */
export const savedPlacement = (row: { placement?: string | null; visibility?: string | null; offer_id?: string | null }): ResourcePlacement =>
  row.placement === 'coach' || row.placement === 'course' ? row.placement : row.placement === 'team' ? 'team' : row.offer_id ? 'course' : row.visibility === 'public' ? 'coach' : 'team';
export const resourceAccessPrice = (placement: ResourcePlacement, free: boolean, price: string) => placement === 'course' ? 0 : resourcePriceCents(free, price);

/* ---------- Multi-destination model ---------- */
/** One course placement. `contained` = legacy item built inside that course; `locked` = it cannot move out. */
export type CoursePick = { course: string; section: string | null; locked?: boolean; contained?: boolean; available?: boolean; title_en?: string; title_es?: string };
export type Destinations = { team: boolean; coach: boolean; courses: CoursePick[]; locked: boolean };

export const newDestinations = (course?: string | null): Destinations =>
  course ? { team: false, coach: false, courses: [{ course, section: null }], locked: false } : { team: true, coach: false, courses: [], locked: false };

/** Reads the server's resource_destinations() payload (legacy rows arrive as a single destination). */
export function fromSavedDestinations(raw: unknown): Destinations | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { team?: unknown; coach?: unknown; locked?: unknown; courses?: unknown };
  const courses = Array.isArray(r.courses) ? r.courses.flatMap((c): CoursePick[] => {
    const x = c as Record<string, unknown>;
    return typeof x.course_id === 'string' ? [{ course: x.course_id, section: typeof x.section_id === 'string' ? x.section_id : null, locked: x.locked === true, contained: x.contained === true, available: x.available !== false, title_en: String(x.title_en ?? ''), title_es: String(x.title_es ?? '') }] : [];
  }) : [];
  return { team: r.team === true, coach: r.coach === true, locked: r.locked === true, courses };
}

export const coursesAllowed = (type: CreateType) => type !== 'course';
export const isStandalone = (d: Destinations) => d.team || d.coach;
export const hasDestination = (d: Destinations) => d.team || d.coach || d.courses.length > 0;
/** Standalone price applies to Team/Coach access; course placements inherit the course gate and never charge again. */
export const destinationsPrice = (d: Destinations, free: boolean, price: string) => isStandalone(d) ? resourcePriceCents(free, price) : 0;

export function toggleDestination(d: Destinations, key: 'team' | 'coach'): Destinations {
  return d.locked ? d : { ...d, [key]: !d[key] };
}
export function toggleCourse(d: Destinations, course: string): Destinations {
  const found = d.courses.find(c => c.course === course);
  if (found?.locked) return d;
  return { ...d, courses: found ? d.courses.filter(c => c.course !== course) : [...d.courses, { course, section: null }] };
}
export const setCourseSection = (d: Destinations, course: string, section: string | null): Destinations =>
  ({ ...d, courses: d.courses.map(c => c.course === course && !c.locked ? { ...c, section } : c) });

/** Courses selected but no longer owned/available to this host. */
export const unavailableCourses = (d: Destinations, authorized: string[]) =>
  d.courses.filter(c => c.available === false || (!c.locked && !authorized.includes(c.course)));

export type DestinationIssue = 'destination' | 'courseUnavailable';
export function destinationIssues(d: Destinations, authorized: string[]): DestinationIssue[] {
  const out: DestinationIssue[] = [];
  if (!hasDestination(d)) out.push('destination');
  if (unavailableCourses(d, authorized).length) out.push('courseUnavailable');
  return out;
}

/** RPC payload; drops duplicates and unavailable courses (the server re-checks ownership). */
export const destinationsPayload = (d: Destinations, authorized: string[]) => {
  const seen = new Set<string>();
  return d.courses.filter(c => (c.locked || authorized.includes(c.course)) && c.available !== false && !seen.has(c.course) && !!seen.add(c.course)).map(c => ({ course: c.course, section: c.section }));
};

/** Server entity name for set_resource_destinations / resource_destinations. */
export type DestinationEntity = 'track' | 'recipe' | 'quiz' | 'offer';
export async function saveDestinations(
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>,
  entity: DestinationEntity, id: string, d: Destinations, authorized: string[], priceCents: number,
) {
  const r = await rpc('set_resource_destinations', { _kind: entity, _id: id, _team: d.team, _coach: d.coach, _courses: destinationsPayload(d, authorized), _price: isStandalone(d) ? priceCents : 0 });
  if (r.error) throw new Error(r.error.message);
}
