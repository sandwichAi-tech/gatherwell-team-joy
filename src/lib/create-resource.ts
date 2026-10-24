import type { LessonType } from '@/lib/learn';

/** Type-first resource authoring: what the creator picks on /learn/create and where each choice goes. */

export const CREATE_TYPES = ['video', 'quiz', 'guide', 'audio', 'file', 'link', 'live', 'recipe', 'course', 'bundle'] as const;
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
