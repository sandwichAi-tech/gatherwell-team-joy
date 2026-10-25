import { describe, expect, it } from 'vitest';
import { coachRequestSchema, coachUpdatesOrigin } from './coach-updates';

describe('coach-specific update consent', () => {
 const request = { slug: 'coach-one', email: 'person@example.invalid', language: 'en', adult: true, origin: 'https://zoheewell.com', announcements: false, events: true, resources: false };
 it('requires explicit preference consent', () => {
  expect(coachRequestSchema.safeParse({ ...request, events: false }).success).toBe(false);
  expect(coachRequestSchema.safeParse(request).success).toBe(true);
 });
 it('requires adult attestation', () => expect(coachRequestSchema.safeParse({ ...request, adult: false }).success).toBe(false));
 it('retains separate coach preference choices', () => expect(coachRequestSchema.parse(request)).toEqual(request));
 it.each(['https://zoheewell.com', 'http://localhost:8080', 'https://id-preview--d56c15d9-a849-4fc3-a192-501da269084f.lovable.app'])('accepts the app origin %s', origin => expect(coachUpdatesOrigin(origin)).toBe(origin));
 it.each(['https://evil.example', 'https://zoheewell.com.evil.example', 'https://person@zoheewell.com', 'https://zoheewell.com/path', 'https://zoheewell.com?next=evil', 'http://zoheewell.com'])('rejects unsafe origins %s', origin => expect(() => coachUpdatesOrigin(origin)).toThrow('invalid_origin'));
});