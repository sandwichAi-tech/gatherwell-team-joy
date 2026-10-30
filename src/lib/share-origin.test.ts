import { describe, expect, it } from 'vitest';
import { shareOrigin } from '@/lib/seo';

describe('share links for invitations', () => {
  it('preview hosts hand recipients the production domain', () => expect(shareOrigin('https://id-preview--d56c15d9-a849-4fc3-a192-501da269084f.lovable.app')).toBe('https://zoheewell.com'));
  it('the secondary published host also uses the production domain', () => expect(shareOrigin('https://gatherwell-team-joy.lovable.app')).toBe('https://zoheewell.com'));
  it('www and production stay on zoheewell.com', () => expect(shareOrigin('https://www.zoheewell.com')).toBe('https://zoheewell.com'));
  it('local development keeps its own origin', () => expect(shareOrigin('http://localhost:8080')).toBe('http://localhost:8080'));
});
