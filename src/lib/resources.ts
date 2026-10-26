import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LearnData, Lesson, Recipe, Track } from '@/lib/learn';
import type { LearningEntry } from '@/lib/content';

/** Resources page model: one card shape mapped from tracks/lessons, course and download offers, and recipes. Memberships are never resources. */

export const RESOURCE_TABS = ['foryou', 'library', 'live', 'saved', 'mine'] as const;
export const RESOURCE_TYPES = ['all', 'course', 'video', 'audio', 'guide', 'file', 'link', 'recipe'] as const;
export const RESOURCE_SOURCES = ['all', 'team', 'zoheewell'] as const;
export type ResourceTab = (typeof RESOURCE_TABS)[number];
export type ResourceTypeFilter = (typeof RESOURCE_TYPES)[number];
export type ResourceSourceFilter = (typeof RESOURCE_SOURCES)[number];
export type ResourceType = Exclude<ResourceTypeFilter, 'all'> | 'track' | 'live';
export type ResourceSource = 'team' | 'zoheewell';

export type ResourceCardData = {
  key: string; id: string;
  entity: 'track' | 'course' | 'download' | 'recipe' | 'lesson';
  type: ResourceType; source: ResourceSource;
  title_en: string; title_es: string;
  cover_url: string | null; cover_style: number; cover: 'learn' | 'offer';
  status: 'draft' | 'published' | 'archived';
  creator: string | null;
  progress: { done: number; total: number } | null;
  minutes: number | null;
  hasQuiz: boolean;
  href: { to: string; params?: Record<string, string> };
};

/** Clamp untrusted URL values to the known tab/filter lists. */
export function parseResourceSearch(s: { tab?: unknown; type?: unknown; source?: unknown }, canCreate: boolean) {
  const tab = (RESOURCE_TABS as readonly unknown[]).includes(s.tab) ? (s.tab as ResourceTab) : 'foryou';
  return {
    tab: tab === 'mine' && !canCreate ? 'foryou' as ResourceTab : tab,
    type: (RESOURCE_TYPES as readonly unknown[]).includes(s.type) ? (s.type as ResourceTypeFilter) : 'all' as ResourceTypeFilter,
    source: (RESOURCE_SOURCES as readonly unknown[]).includes(s.source) ? (s.source as ResourceSourceFilter) : 'all' as ResourceSourceFilter,
  };
}

/** Lesson type to resource type. Text and PDF lessons read as guides; live lessons with a replay are videos. Audio only when the lesson says so or its file is audio. */
export function lessonResourceType(l: Pick<Lesson, 'type' | 'replay_url' | 'storage_path'>): ResourceType {
  if (l.type === 'live') return l.replay_url ? 'video' : 'live';
  if (l.type === 'audio') return 'audio';
  if (l.type === 'file') return isAudioPath(l.storage_path) ? 'audio' : 'file';
  if (l.type === 'pdf' || l.type === 'text') return 'guide';
  if (l.type === 'video' || l.type === 'link') return l.type;
  return 'guide';
}
export const isAudioPath = (p?: string | null) => !!p && /\.(mp3|m4a|aac|wav|ogg|oga|opus)$/i.test(p);

/** A team track's type: its lessons' shared type, otherwise a multi-format track. */
function trackType(lessons: Lesson[]): ResourceType {
  const types = new Set(lessons.map(lessonResourceType));
  if (types.size === 1) { const [only] = [...types]; return only === 'live' ? 'track' : only!; }
  return 'track';
}

export type ResourceInputs = {
  data: LearnData;
  tracks: Track[];            // already filtered to what the caller may read
  learning: LearningEntry[];  // caller's entitlements (my_learning)
  recipes: Recipe[];
  quizOffers?: Set<string> | undefined; quizLessons?: Set<string> | undefined;
  teamName?: string | null;
};

/** Library: tracks (not course sections), entitled courses/downloads and readable recipes. */
export function toResources({ data, tracks, learning, recipes, quizOffers = new Set(), quizLessons = new Set(), teamName = null }: ResourceInputs): ResourceCardData[] {
  const out: ResourceCardData[] = [];
  for (const tr of tracks) {
    if (tr.offer_id) continue;
    const lessons = data.lessons.filter(l => l.track_id === tr.id);
    if (!lessons.length) continue;
    out.push({ key: `track:${tr.id}`, id: tr.id, entity: 'track', type: trackType(lessons), source: 'team', title_en: tr.title_en, title_es: tr.title_es,
      cover_url: tr.cover_url, cover_style: tr.cover_style, cover: 'learn', status: tr.is_published ? 'published' : 'draft', creator: teamName,
      progress: { done: lessons.filter(l => data.done.has(l.id)).length, total: lessons.length },
      minutes: lessons.reduce((n, l) => n + (l.duration_minutes ?? 0), 0) || null,
      hasQuiz: lessons.some(l => quizLessons.has(l.id)), href: { to: '/learn/track/$id', params: { id: tr.id } } });
  }
  for (const e of learning) {
    if (e.kind !== 'course' && e.kind !== 'download') continue;
    out.push({ key: `offer:${e.id}`, id: e.id, entity: e.kind, type: e.kind === 'course' ? 'course' : 'file', source: 'team', title_en: e.title_en, title_es: e.title_es,
      cover_url: e.cover_url, cover_style: e.cover_style, cover: 'offer', status: e.status === 'archived' ? 'archived' : 'published', creator: e.host_name,
      progress: e.lessons > 0 ? { done: e.done, total: e.lessons } : null, minutes: null, hasQuiz: quizOffers.has(e.id), href: { to: '/offer/$id', params: { id: e.id } } });
  }
  for (const r of recipes) out.push(recipeCard(r, teamName));
  return out;
}

export const recipeCard = (r: Recipe, teamName: string | null = null): ResourceCardData => ({
  key: `recipe:${r.id}`, id: r.id, entity: 'recipe', type: 'recipe', source: r.team_id === null && r.private_owner === null ? 'zoheewell' : 'team',
  title_en: r.title_en, title_es: r.title_es, cover_url: r.cover_url, cover_style: r.cover_style, cover: 'learn',
  status: r.is_published ? 'published' : 'draft', creator: r.team_id === null ? null : teamName, progress: null, minutes: r.prep_minutes, hasQuiz: false,
  href: { to: '/learn/recipe/$id', params: { id: r.id } },
});

/** Single-format lessons surfaced when someone filters by a media type. */
export function lessonResources(data: LearnData, tracks: Track[], type: ResourceTypeFilter): ResourceCardData[] {
  if (type === 'all' || type === 'course' || type === 'recipe') return [];
  const readable = new Map(tracks.filter(t => t.is_published).map(t => [t.id, t]));
  return data.lessons.filter(l => readable.has(l.track_id) && lessonResourceType(l) === type).map(l => ({
    key: `lesson:${l.id}`, id: l.id, entity: 'lesson' as const, type: lessonResourceType(l), source: 'team' as const, title_en: l.title_en, title_es: l.title_es,
    cover_url: readable.get(l.track_id)!.cover_url, cover_style: readable.get(l.track_id)!.cover_style, cover: 'learn' as const, status: 'published' as const,
    creator: null, progress: { done: data.done.has(l.id) ? 1 : 0, total: 1 }, minutes: l.duration_minutes, hasQuiz: false, href: { to: '/learn/lesson/$id', params: { id: l.id } },
  }));
}

/** Type filter: Courses include multi-format tracks; a single-format track matches its media type. */
export function matchesType(r: ResourceCardData, type: ResourceTypeFilter) {
  if (type === 'all') return true;
  if (type === 'course') return r.type === 'course' || r.type === 'track';
  return r.type === type;
}
export const filterResources = (list: ResourceCardData[], type: ResourceTypeFilter, source: ResourceSourceFilter) =>
  list.filter(r => matchesType(r, type) && (source === 'all' || r.source === source));

export const inProgress = (list: ResourceCardData[]) => list.filter(r => r.progress && r.progress.done > 0 && r.progress.done < r.progress.total);

/* ---------- Resource templates (distinct from Event Blueprints) ---------- */

export type ResourceTemplateKind = 'video_lesson' | 'guide' | 'mini_course' | 'bundle' | 'recipe' | 'live_workshop' | 'track';
export type ResourceTemplate = {
  id: string; team_id: string | null; kind: ResourceTemplateKind; target: 'track' | 'course' | 'download' | 'recipe';
  title_en: string; title_es: string; description_en: string | null; description_es: string | null;
  structure: Record<string, unknown>; sort_order: number; created_at: string;
};

const db = supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>; from: (t: string) => any };

export const resourceTemplatesQuery = () => queryOptions({
  queryKey: ['resource-templates'],
  queryFn: async (): Promise<ResourceTemplate[]> => {
    const { data, error } = await db.from('resource_templates').select('*').order('sort_order').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ResourceTemplate[];
  },
});

export const splitTemplates = (list: ResourceTemplate[], teamId: string) => ({
  starters: list.filter(t => t.team_id === null).sort((a, b) => a.sort_order - b.sort_order),
  mine: list.filter(t => t.team_id === teamId),
});

/** Count of parts in a template, and how many uploaded files must be replaced after copying. */
export function templateParts(t: Pick<ResourceTemplate, 'structure'>) {
  const s = t.structure as { lessons?: { needs_asset?: boolean }[]; items?: { needs_asset?: boolean }[]; sections?: { lessons?: { needs_asset?: boolean }[] }[]; steps?: { en?: unknown[] } };
  const parts = [...(s.lessons ?? []), ...(s.items ?? []), ...(s.sections ?? []).flatMap(x => x.lessons ?? [])];
  return { parts: parts.length || (s.steps?.en?.length ?? 0), needsAssets: parts.filter(p => p.needs_asset).length };
}

/** Where the new draft is edited. */
export function draftDestination(target: ResourceTemplate['target'], id: string): { to: string; params?: Record<string, string>; search?: Record<string, string> } {
  if (target === 'recipe') return { to: '/learn/manage', search: { tab: 'recipes' } };
  // A copied track opens straight in the item builder for review → preview → publish.
  if (target === 'track') return { to: '/learn/create', search: { type: 'video', id } };
  return { to: '/offer/$id', params: { id } };
}

export async function applyResourceTemplate(templateId: string, teamId: string) {
  const { data, error } = await db.rpc('use_resource_template', { _template: templateId, _team: teamId });
  if (error) throw error;
  return data as { target: ResourceTemplate['target']; id: string };
}
export async function saveResourceTemplate(sourceKind: 'track' | 'offer' | 'recipe', sourceId: string, titleEn: string, titleEs: string) {
  const { data, error } = await db.rpc('save_resource_template', { _source_kind: sourceKind, _source: sourceId, _title_en: titleEn, _title_es: titleEs });
  if (error) throw error;
  return data as string;
}
export async function deleteResourceTemplate(id: string) {
  const { error } = await db.from('resource_templates').delete().eq('id', id);
  if (error) throw error;
}

/** Published quizzes the caller can read, for the quiz badge. */
export const quizMarkersQuery = (userId: string) => queryOptions({
  queryKey: ['quiz-markers', userId],
  queryFn: async () => {
    const { data } = await db.from('quizzes').select('offer_id, lesson_id').eq('is_published', true);
    const rows = (data ?? []) as { offer_id: string; lesson_id: string | null }[];
    return { offers: new Set(rows.map(r => r.offer_id)), lessons: new Set(rows.flatMap(r => (r.lesson_id ? [r.lesson_id] : []))) };
  },
});

/** Saved course/download offerings (memberships and events stay on /saved). */
export const savedOfferResourcesQuery = (userId: string) => queryOptions({
  queryKey: ['saved-offer-resources', userId],
  queryFn: async (): Promise<ResourceCardData[]> => {
    const { data: saved } = await db.from('saved_offerings').select('kind, target_id').eq('user_id', userId).in('kind', ['course', 'download']);
    const ids = ((saved ?? []) as { target_id: string }[]).map(s => s.target_id);
    if (!ids.length) return [];
    const { data } = await db.from('offers').select('id, kind, title_en, title_es, cover_url, cover_style, status').in('id', ids).in('kind', ['course', 'download']);
    return ((data ?? []) as { id: string; kind: 'course' | 'download'; title_en: string; title_es: string; cover_url: string | null; cover_style: number; status: string }[])
      .filter(o => o.status !== 'draft')
      .map(o => ({ key: `offer:${o.id}`, id: o.id, entity: o.kind, type: o.kind === 'course' ? 'course' : 'file', source: 'team', title_en: o.title_en, title_es: o.title_es,
        cover_url: o.cover_url, cover_style: o.cover_style, cover: 'offer', status: o.status === 'archived' ? 'archived' : 'published', creator: null, progress: null, minutes: null, hasQuiz: false,
        href: { to: '/offer/$id', params: { id: o.id } } }));
  },
});
