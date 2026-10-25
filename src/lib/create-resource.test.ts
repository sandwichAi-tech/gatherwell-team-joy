import { describe, expect, it } from 'vitest';
import { CREATE_TYPES, createDestination, emptyBuilderDraft, isOfferFlow, isTrackFlow, lessonEditorConfig, lessonPresetFor, offerKindFor, parseCreateType, quizParentDestination, typeContentAtRisk } from './create-resource';

describe('create resource type parsing', () => {
  it('accepts every supported type and rejects unknown values', () => {
    for (const t of CREATE_TYPES) expect(parseCreateType(t)).toBe(t);
    expect(parseCreateType('hack')).toBeNull();
    expect(parseCreateType('')).toBeNull();
    expect(parseCreateType(undefined)).toBeNull();
    expect(parseCreateType(42)).toBeNull();
  });
});

describe('type-to-destination mapping', () => {
  it('routes single media resources to the track editor with a preset', () => {
    expect(createDestination('video')).toEqual({ to: '/learn/manage', search: { tab: 'tracks', new: 'video' } });
    expect(createDestination('guide')).toEqual({ to: '/learn/manage', search: { tab: 'tracks', new: 'guide' } });
    expect(createDestination('audio')).toEqual({ to: '/learn/manage', search: { tab: 'tracks', new: 'audio' } });
    expect(createDestination('link')).toEqual({ to: '/learn/manage', search: { tab: 'tracks', new: 'link' } });
    expect(createDestination('live')).toEqual({ to: '/learn/manage', search: { tab: 'tracks', new: 'live' } });
  });
  it('routes recipes to the recipe editor and courses/files/bundles to offer editors', () => {
    expect(createDestination('recipe')).toEqual({ to: '/learn/manage', search: { tab: 'recipes', new: 'recipe' } });
    expect(createDestination('course')).toEqual({ to: '/offers', search: { new: 'course' } });
    expect(createDestination('file')).toEqual({ to: '/offers', search: { new: 'download' } });
    expect(createDestination('bundle')).toEqual({ to: '/offers', search: { new: 'download', mode: 'bundle' } });
  });
  it('never routes a quiz without a parent course', () => {
    expect(createDestination('quiz')).toBeNull();
    expect(quizParentDestination('C1')).toEqual({ to: '/offer/$id', params: { id: 'C1' }, search: { panel: 'quiz' } });
  });
});

describe('lesson presets', () => {
  it('maps each track flow to its lesson type', () => {
    expect(lessonPresetFor('video')).toBe('video');
    expect(lessonPresetFor('guide')).toBe('pdf');
    expect(lessonPresetFor('audio')).toBe('audio');
    expect(lessonPresetFor('link')).toBe('link');
    expect(lessonPresetFor('live')).toBe('live');
  });
  it('only track-flow types use the track editor', () => {
    expect(isTrackFlow('video')).toBe(true);
    expect(isTrackFlow('quiz')).toBe(false);
    expect(isTrackFlow('recipe')).toBe(false);
    expect(isTrackFlow('bundle')).toBe(false);
  });
});

describe('focused lesson editor controls', () => {
  it('video uploads video files and keeps them, with no quiz or live fields', () => {
    const c = lessonEditorConfig('video');
    expect(c.uploadAccept).toBe('video/*');
    expect(c.keepsFile).toBe(true);
    expect(c.showsLiveFields).toBe(false);
  });
  it('audio uploads audio files and keeps them', () => {
    const c = lessonEditorConfig('audio');
    expect(c.uploadAccept).toBe('audio/*');
    expect(c.keepsFile).toBe(true);
  });
  it('guide uploads PDFs only', () => {
    expect(lessonEditorConfig('pdf').uploadAccept).toBe('application/pdf');
  });
  it('link never shows an upload control', () => {
    const c = lessonEditorConfig('link');
    expect(c.uploadAccept).toBeNull();
    expect(c.keepsFile).toBe(false);
    expect(c.showsUrl).toBe(true);
  });
  it('live shows scheduling fields instead of a URL', () => {
    const c = lessonEditorConfig('live');
    expect(c.showsLiveFields).toBe(true);
    expect(c.showsUrl).toBe(false);
    expect(c.uploadAccept).toBeNull();
  });
});

describe('single dynamic builder', () => {
  it('maps offer-backed types to their offer kind', () => {
    expect(offerKindFor('course')).toBe('course');
    expect(offerKindFor('file')).toBe('download');
    expect(offerKindFor('bundle')).toBe('download');
    expect(offerKindFor('video')).toBeNull();
    expect(offerKindFor('recipe')).toBeNull();
    expect(isOfferFlow('course')).toBe(true);
    expect(isOfferFlow('quiz')).toBe(false);
  });
  it('warns only when type-specific content would be lost', () => {
    const d = emptyBuilderDraft();
    expect(typeContentAtRisk(d, 'video', 'recipe')).toBe(false); // nothing entered yet
    d.lesson.url = 'https://example.com/v';
    expect(typeContentAtRisk(d, 'video', 'recipe')).toBe(true); // media link cannot become a recipe
    expect(typeContentAtRisk(d, 'video', 'audio')).toBe(false); // stays inside the track flow
    expect(typeContentAtRisk(d, 'video', 'video')).toBe(false);
    const r = emptyBuilderDraft();
    r.recipe.ingEn = 'rice';
    expect(typeContentAtRisk(r, 'recipe', 'video')).toBe(true);
    const o = emptyBuilderDraft();
    o.offer.price = '10';
    expect(typeContentAtRisk(o, 'course', 'video')).toBe(true);
    expect(typeContentAtRisk(o, 'course', 'bundle')).toBe(false); // price carries between offer kinds
    expect(typeContentAtRisk(emptyBuilderDraft(), 'quiz', 'video')).toBe(false);
  });
});
