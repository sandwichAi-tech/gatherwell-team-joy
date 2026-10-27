import type { LessonType } from '@/lib/learn';

/** Type-first resource authoring: what the creator picks on /learn/create and where each choice goes. */

export const CREATE_TYPES = ['course', 'assessment', 'video', 'audio', 'guide', 'file', 'bundle', 'link', 'quiz', 'recipe', 'live'] as const;
export const CREATE_GROUPS = [
  { key: 'programs', types: ['course', 'assessment'] },
  { key: 'media', types: ['video', 'audio', 'guide', 'file', 'bundle'] },
  { key: 'interactive', types: ['link', 'quiz', 'recipe', 'live'] },
] as const;
export type CreateType = (typeof CREATE_TYPES)[number];

export const parseCreateType = (v: unknown): CreateType | null =>
  (CREATE_TYPES as readonly unknown[]).includes(v) ? (v as CreateType) : null;

export type CreateDestination = { to: string; params?: Record<string, string>; search?: Record<string, string> };

/** Single resources that are a team track with one preset lesson. */
export const TRACK_FLOW_TYPES = ['video', 'guide', 'audio', 'link', 'live'] as const;
export type TrackFlowType = (typeof TRACK_FLOW_TYPES)[number];
export const isTrackFlow = (t: CreateType): t is TrackFlowType => (TRACK_FLOW_TYPES as readonly string[]).includes(t);

/** Lesson type preset for each track flow: a guide is a PDF lesson, everything else maps 1:1. */
export const lessonPresetFor = (t: TrackFlowType): LessonType =>
  t === 'guide' ? 'pdf' : t === 'video' ? 'video' : t === 'audio' ? 'audio' : t === 'link' ? 'link' : 'live';

/** Where each type sends the creator. Quiz returns null: it needs a parent course picked first. */
export function createDestination(t: CreateType): CreateDestination | null {
  if (t === 'quiz') return null;
  if (isTrackFlow(t)) return { to: '/learn/manage', search: { tab: 'tracks', new: t } };
  if (t === 'recipe') return { to: '/learn/manage', search: { tab: 'recipes', new: 'recipe' } };
  if (t === 'course') return { to: '/offers', search: { new: 'course' } };
  if (t === 'file') return { to: '/offers', search: { new: 'download' } };
  return { to: '/offers', search: { new: 'download', mode: 'bundle' } };
}

/** Quizzes live inside a course: after picking the parent course, land on its quiz section. */
export const quizParentDestination = (offerId: string): CreateDestination => ({ to: '/offer/$id', params: { id: offerId }, search: { panel: 'quiz' } });

/** Which controls a focused lesson editor shows for a preset type. Upload only where the model stores a file. */
export function lessonEditorConfig(type: LessonType) {
  return {
    uploadAccept: type === 'video' ? 'video/*' : type === 'audio' ? 'audio/*' : type === 'pdf' ? 'application/pdf' : null,
    keepsFile: type === 'video' || type === 'pdf' || type === 'audio',
    showsUrl: type !== 'live',
    showsLiveFields: type === 'live',
  };
}

/** An uploaded file must match the lesson type, so a PDF can never be saved as a video (or vice versa). */
export function fileMatchesLessonType(type: LessonType, file: { type: string; name: string }): boolean {
  const mime = (file.type || '').toLowerCase(); const name = file.name.toLowerCase();
  if (type === 'pdf') return mime === 'application/pdf' || name.endsWith('.pdf');
  if (type === 'video') return mime.startsWith('video/');
  if (type === 'audio') return mime.startsWith('audio/');
  return false;
}

/* ---------- Single dynamic resource builder (/learn/create?type=…) ---------- */

/** Offer-backed types create a course or a download offer; everything else uses tracks/recipes/quizzes. */
export const offerKindFor = (t: CreateType): 'course' | 'download' | null =>
  t === 'course' ? 'course' : t === 'file' || t === 'bundle' ? 'download' : null;
export const isOfferFlow = (t: CreateType): boolean => offerKindFor(t) !== null;

/** Type-specific draft content held by the builder while the creator works. */
export type BuilderDraft = {
  lesson: { url: string; storagePath: string | null; live: string; meeting: string; replay: string };
  recipe: { prep: string; ingEn: string; ingEs: string; stepsEn: string; stepsEs: string; tags: string[] };
  offer: { price: string; filePath: string | null };
};

export const emptyBuilderDraft = (): BuilderDraft => ({
  lesson: { url: '', storagePath: null, live: '', meeting: '', replay: '' },
  recipe: { prep: '', ingEn: '', ingEs: '', stepsEn: '', stepsEs: '', tags: [] },
  offer: { price: '', filePath: null },
});

const lessonHasContent = (d: BuilderDraft) => !!(d.lesson.url.trim() || d.lesson.storagePath || d.lesson.live || d.lesson.meeting.trim() || d.lesson.replay.trim());
const recipeHasContent = (d: BuilderDraft) => !!(d.recipe.prep.trim() || d.recipe.ingEn.trim() || d.recipe.ingEs.trim() || d.recipe.stepsEn.trim() || d.recipe.stepsEs.trim() || d.recipe.tags.length);
const offerHasContent = (d: BuilderDraft) => !!(d.offer.price.trim() || d.offer.filePath);

/**
 * True when switching from `from` to `to` would discard type-specific content the creator entered.
 * Shared fields (title, description, cover) always carry over and never trigger the warning.
 */
export function typeContentAtRisk(d: BuilderDraft, from: CreateType, to: CreateType): boolean {
  if (from === to) return false;
  if (isTrackFlow(from) && !isTrackFlow(to) && lessonHasContent(d)) return true;
  if (from === 'recipe' && to !== 'recipe' && recipeHasContent(d)) return true;
  if (isOfferFlow(from) && !isOfferFlow(to) && offerHasContent(d)) return true;
  // A paid offer price cannot move onto a file/bundle file upload and vice versa is fine; price carries between offer kinds.
  if (from === 'quiz' && to !== 'quiz') return false; // quiz holds no extra builder content beyond the shared title
  return false;
}
