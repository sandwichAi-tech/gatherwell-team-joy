import { describe, expect, it } from 'vitest';
import { draftDestination, filterResources, inProgress, lessonResourceType, lessonResources, parseResourceSearch, recipeCard, splitTemplates, templateParts, toResources, type ResourceTemplate } from './resources';
import { effectiveType } from './learn';
import type { LearnData, Lesson, Recipe, Track } from './learn';
import type { LearningEntry } from './content';

const track = (id: string, o: Partial<Track> = {}): Track => ({ id, team_id: 'T', title_en: id, title_es: id, description_en: null, description_es: null, cover_url: null, cover_style: 0, sort_order: 0, is_start_here: false, is_published: true, created_at: '', offer_id: null, subtitle_en: null, subtitle_es: null, cta_en: null, cta_es: null, card_layout: 'preview', accent: 'plum', promo_en: null, promo_es: null, ...o });
const lesson = (id: string, track_id: string, type: string, o: Partial<Lesson> = {}): Lesson => ({ id, track_id, type, title_en: id, title_es: id, url: null, storage_path: null, duration_minutes: 5, live_starts_at: null, replay_url: null, notes_en: null, notes_es: null, sort_order: 0, created_at: '', description_en: null, description_es: null, is_preview: false, is_published: true, prerequisite_lesson_id: null, attachments: [], event_id: null, ...o } as Lesson);
const recipe = (id: string, team_id: string | null): Recipe => ({ id, team_id, title_en: id, title_es: id, cover_url: null, cover_style: 0, prep_minutes: 10, tags: [], ingredients: {}, steps: {}, created_by: null, created_at: '', private_owner: null, sort_order: 0, is_published: true, subtitle_en: null, subtitle_es: null, cta_en: null, cta_es: null, card_layout: 'preview', accent: 'plum', promo_en: null, promo_es: null } as Recipe);
const entry = (id: string, kind: string): LearningEntry => ({ id, kind, title_en: id, title_es: id, summary_en: null, summary_es: null, cover_style: 0, cover_url: null, status: 'published', host_name: 'Ana', source: 'free', enrolled_at: '', lessons: 4, done: 1 });

const data: LearnData = { tracks: [], lessons: [lesson('v1', 'tv', 'video'), lesson('x1', 'tm', 'text'), lesson('a1', 'tm', 'audio'), lesson('c1', 'course-sec', 'video')], done: new Set(['x1']) };

describe('resource mapping', () => {
  const list = toResources({ data, tracks: [track('tv'), track('tm'), track('empty'), track('course-sec', { offer_id: 'C' })], learning: [entry('C', 'course'), entry('D', 'download'), entry('M', 'membership')], recipes: [recipe('starter', null), recipe('team', 'T')], quizOffers: new Set(['C']) });
  it('maps each source to one card, skipping empty tracks and course sections', () => {
    expect(list.map(r => r.key).sort()).toEqual(['offer:C', 'offer:D', 'recipe:starter', 'recipe:team', 'track:tm', 'track:tv']);
  });
  it('never treats memberships as resources', () => { expect(list.some(r => r.id === 'M')).toBe(false); });
  it('types single-format tracks by their lessons and mixed ones as learning tracks', () => {
    expect(list.find(r => r.id === 'tv')!.type).toBe('video');
    expect(list.find(r => r.id === 'tm')!.type).toBe('track');
  });
  it('marks starter recipes as ZoheeWell and team recipes as team', () => {
    expect(recipeCard(recipe('s', null)).source).toBe('zoheewell');
    expect(recipeCard(recipe('t', 'T')).source).toBe('team');
  });
  it('shows a quiz badge on courses with a published quiz', () => { expect(list.find(r => r.id === 'C')!.hasQuiz).toBe(true); expect(list.find(r => r.id === 'D')!.hasQuiz).toBe(false); });
  it('filters by type and source', () => {
    expect(filterResources(list, 'recipe', 'zoheewell').map(r => r.id)).toEqual(['starter']);
    expect(filterResources(list, 'course', 'all').map(r => r.id).sort()).toEqual(['C', 'tm']);
    expect(filterResources(list, 'file', 'all').map(r => r.id)).toEqual(['D']);
    expect(filterResources(list, 'all', 'zoheewell')).toHaveLength(1);
  });
  it('lists in-progress items for For you', () => { expect(inProgress(list).map(r => r.id).sort()).toEqual(['C', 'D', 'tm']); });
  it('surfaces single lessons only for media filters and only from published tracks', () => {
    expect(lessonResources(data, [track('tm'), track('tv', { is_published: false })], 'audio').map(r => r.id)).toEqual(['a1']);
    expect(lessonResources(data, [track('tv', { is_published: false })], 'video')).toHaveLength(0);
    expect(lessonResources(data, [track('tm')], 'all')).toHaveLength(0);
  });
});

describe('lesson types', () => {
  it('text lessons are valid guides with a known reader type', () => {
    expect(lessonResourceType(lesson('t', 'x', 'text'))).toBe('guide');
    expect(effectiveType(lesson('t', 'x', 'text'))).toBe('text');
  });
  it('unknown lesson types fall back to text instead of an undefined icon', () => { expect(effectiveType(lesson('t', 'x', 'weird'))).toBe('text'); });
  it('audio only when the lesson or its file says so', () => {
    expect(lessonResourceType(lesson('f', 'x', 'file', { storage_path: 'a/b.mp3' }))).toBe('audio');
    expect(lessonResourceType(lesson('f', 'x', 'file', { storage_path: 'a/b.pdf' }))).toBe('file');
  });
  it('live with replay is a video, without is live', () => {
    expect(lessonResourceType(lesson('l', 'x', 'live', { replay_url: 'https://x' }))).toBe('video');
    expect(lessonResourceType(lesson('l', 'x', 'live'))).toBe('live');
  });
});

describe('search params', () => {
  it('clamps unknown values to defaults', () => { expect(parseResourceSearch({ tab: 'hack', type: 'x', source: 1 }, true)).toEqual({ tab: 'foryou', type: 'all', source: 'all' }); });
  it('keeps valid shareable values', () => { expect(parseResourceSearch({ tab: 'library', type: 'pdf' === 'pdf' ? 'guide' : '', source: 'zoheewell' }, false)).toEqual({ tab: 'library', type: 'guide', source: 'zoheewell' }); });
  it('members cannot open Created by me', () => {
    expect(parseResourceSearch({ tab: 'mine' }, false).tab).toBe('foryou');
    expect(parseResourceSearch({ tab: 'mine' }, true).tab).toBe('mine');
  });
});

describe('resource templates', () => {
  const tpl = (id: string, team_id: string | null, sort = 0): ResourceTemplate => ({ id, team_id, kind: 'guide', target: 'download', title_en: id, title_es: id, description_en: null, description_es: null, structure: {}, sort_order: sort, created_at: '' });
  it('splits ZoheeWell starters from the active team only', () => {
    const s = splitTemplates([tpl('b', null, 2), tpl('a', null, 1), tpl('mine', 'T'), tpl('other', 'U')], 'T');
    expect(s.starters.map(x => x.id)).toEqual(['a', 'b']);
    expect(s.mine.map(x => x.id)).toEqual(['mine']);
  });
  it('counts parts and files that must be replaced', () => {
    expect(templateParts({ structure: { items: [{}, { needs_asset: true }], sections: [{ lessons: [{}, {}] }] } })).toEqual({ parts: 4, needsAssets: 1 });
  });
  it('opens each new draft in its existing editor', () => {
    expect(draftDestination('recipe', 'r')).toEqual({ to: '/learn/manage', search: { tab: 'recipes' } });
    expect(draftDestination('track', 't')).toEqual({ to: '/learn/manage', search: { tab: 'tracks' } });
    expect(draftDestination('course', 'c')).toEqual({ to: '/offer/$id', params: { id: 'c' } });
  });
});
