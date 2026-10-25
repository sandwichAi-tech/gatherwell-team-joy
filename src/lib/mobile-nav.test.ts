import { describe, expect, it } from 'vitest';
import { splitMobileNav } from './mobile-nav';

describe('Mobile bottom navigation split', () => {
  it('keeps four primary destinations and moves the rest into More', () => {
    const coach = ['home', 'events', 'team', 'learn', 'communications', 'insights', 'me'];
    const { primary, more } = splitMobileNav(coach);
    expect(primary).toEqual(['home', 'events', 'team', 'learn']);
    expect(more).toEqual(['communications', 'insights', 'me']);
  });

  it('keeps Communication and Insights immediately inside More for coaches', () => {
    const { more } = splitMobileNav(['home', 'events', 'team', 'learn', 'communications', 'insights', 'me']);
    expect(more.slice(0, 2)).toEqual(['communications', 'insights']);
  });

  it('gives guests four primary tabs with progress and profile in More', () => {
    const { primary, more } = splitMobileNav(['home', 'discover', 'circles', 'learn', 'progress', 'me']);
    expect(primary).toEqual(['home', 'discover', 'circles', 'learn']);
    expect(more).toEqual(['progress', 'me']);
  });

  it('adds no More menu when four or fewer destinations exist', () => {
    const { primary, more } = splitMobileNav(['home', 'events', 'team', 'learn']);
    expect(primary).toHaveLength(4);
    expect(more).toHaveLength(0);
  });
});
