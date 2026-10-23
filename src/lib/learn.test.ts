import { describe, expect, it } from 'vitest';
import { populatedTracks, type Track } from './learn';

describe('Resources content', () => {
  it('hides tracks with zero lessons and keeps tracks with a lesson', () => {
    const tracks = [{ id: 'empty' }, { id: 'ready' }] as Track[];
    expect(populatedTracks(tracks, [{ track_id: 'ready' }]).map(track => track.id)).toEqual(['ready']);
  });
});