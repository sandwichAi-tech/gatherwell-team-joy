import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type Track = Database['public']['Tables']['tracks']['Row'];
export type Lesson = Database['public']['Tables']['lessons']['Row'];
export type Recipe = Database['public']['Tables']['recipes']['Row'];
export type LessonType = 'video' | 'pdf' | 'link' | 'live';
export const RECIPE_TAGS = ['breakfast', 'shake', 'snack', 'quick', 'family'] as const;

/** Pick the member's language, falling back to the other one. */
export const pick = (lang: string | undefined, en?: string | null, es?: string | null) => (lang === 'es' ? es || en : en || es) || '';
export const trackTitle = (t: Pick<Track, 'title_en' | 'title_es'>, lang?: string) => pick(lang, t.title_en, t.title_es);
export const lessonTitle = (l: Pick<Lesson, 'title_en' | 'title_es'>, lang?: string) => pick(lang, l.title_en, l.title_es);

/** A live lesson with a replay link behaves like a normal video lesson. */
export const effectiveType = (l: Pick<Lesson, 'type' | 'replay_url'>): LessonType => (l.type === 'live' && l.replay_url ? 'video' : l.type as LessonType);
export const isUpcomingLive = (l: Lesson) => l.type === 'live' && !l.replay_url && !!l.live_starts_at && new Date(l.live_starts_at).getTime() + 3 * 3600_000 > Date.now();

export type LearnData = { tracks: Track[]; lessons: Lesson[]; done: Set<string> };

/** Tracks the caller can read (own team + parent teams; leaders also see drafts), their lessons and the caller's progress. */
export const learnQuery = (userId: string) => queryOptions({
  queryKey: ['learn', userId],
  queryFn: async (): Promise<LearnData> => {
    const [{ data: tracks, error }, { data: lessons, error: e2 }, { data: progress, error: e3 }] = await Promise.all([
      supabase.from('tracks').select('*').order('sort_order').order('created_at'),
      supabase.from('lessons').select('*').order('sort_order').order('created_at'),
      supabase.from('lesson_progress').select('lesson_id').eq('user_id', userId),
    ]);
    if (error || e2 || e3) throw error ?? e2 ?? e3;
    return { tracks: tracks ?? [], lessons: lessons ?? [], done: new Set((progress ?? []).map(p => p.lesson_id)) };
  },
});

export const lessonsOf = (data: LearnData, trackId: string) => data.lessons.filter(l => l.track_id === trackId);
export function trackStats(data: LearnData, trackId: string) {
  const list = lessonsOf(data, trackId);
  const done = list.filter(l => data.done.has(l.id)).length;
  const minutes = list.reduce((n, l) => n + (l.duration_minutes ?? 0), 0);
  const next = list.find(l => !data.done.has(l.id)) ?? null;
  return { count: list.length, done, minutes, pct: list.length ? done / list.length : 0, next, complete: list.length > 0 && done === list.length };
}

/** Tracks relevant to the active team: its own and those of parent teams it can read. */
export const visibleTracks = (data: LearnData, teamIds: string[], leader: boolean, activeTeam: string) =>
  data.tracks.filter(t => (t.is_published || (leader && t.team_id === activeTeam)) && (teamIds.length === 0 || teamIds.includes(t.team_id) || t.team_id === activeTeam));

export const recipesQuery = (userId: string) => queryOptions({
  queryKey: ['recipes', userId],
  queryFn: async () => {
    const [{ data, error }, { data: saved }] = await Promise.all([
      supabase.from('recipes').select('*').order('created_at', { ascending: false }),
      supabase.from('saved_recipes').select('recipe_id').eq('user_id', userId),
    ]);
    if (error) throw error;
    const rows = (data ?? []).filter(r => r.team_id !== null || r.private_owner !== null || r.is_published);
    const recipes = [...rows.filter(r => r.team_id !== null || r.private_owner !== null), ...rows.filter(r => r.team_id === null && r.private_owner === null).sort((a, b) => a.sort_order - b.sort_order)];
    return { recipes, saved: new Set((saved ?? []).map(s => s.recipe_id)) };
  },
});

export const remindersQuery = (userId: string) => queryOptions({
  queryKey: ['lesson-reminders', userId],
  queryFn: async () => new Set(((await supabase.from('lesson_reminders').select('lesson_id').eq('user_id', userId)).data ?? []).map(r => r.lesson_id)),
});

export type Bilingual = { en: string[]; es: string[] };
export const listOf = (value: unknown, lang?: string): string[] => {
  const v = (value ?? {}) as Partial<Bilingual>;
  const a = (lang === 'es' ? v.es : v.en) ?? []; const b = (lang === 'es' ? v.en : v.es) ?? [];
  return (a.length ? a : b).filter((x): x is string => typeof x === 'string');
};

/** Team ancestors chain (self first) so sub-team members also see parent-team tracks. */
export const ancestorsQuery = (teamId: string) => queryOptions({
  queryKey: ['team-ancestors', teamId],
  queryFn: async () => {
    const ids: string[] = []; let cur: string | null = teamId;
    for (let i = 0; cur && i < 10; i++) {
      ids.push(cur);
      const res: { data: { parent_team_id: string | null } | null } = await supabase.from('teams').select('parent_team_id').eq('id', cur).maybeSingle();
      cur = res.data?.parent_team_id ?? null;
    }
    return ids;
  },
});

export async function learnFileUrl(path?: string | null) {
  if (!path) return null;
  const { data } = await supabase.storage.from('learn-media').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** Upload with a progress callback (the storage client has no progress events). */
export async function uploadLearnFile(teamId: string, file: File, onProgress: (pct: number) => void): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('not_signed_in');
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${teamId}/${crypto.randomUUID()}.${ext}`;
  const url = `${import.meta.env['VITE_SUPABASE_URL']}/storage/v1/object/learn-media/${path}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
    xhr.setRequestHeader('apikey', import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(xhr.status === 413 ? 'too_large' : 'upload_failed')));
    xhr.onerror = () => reject(new Error('upload_failed'));
    xhr.send(file);
  });
  return path;
}

/** Shrink images before upload; other files pass through unchanged. */
export async function compressImage(file: File, max = 1600): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.85));
  return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file;
}

/** YouTube / Vimeo embed URL, or null for other links. */
export function embedUrl(url?: string | null) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

export function icsFor(l: Lesson, title: string, description: string) {
  const start = new Date(l.live_starts_at!); const end = new Date(start.getTime() + (l.duration_minutes || 60) * 60_000);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/[\\,;]/g, m => `\\${m}`).replace(/\n/g, '\\n');
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gatherwell//Learn//EN', 'BEGIN:VEVENT', `UID:${l.id}@gatherwell`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`, `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(description)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar' })); a.download = 'gatherwell-live.ics'; a.click();
}
