import { z } from 'zod';

export const coachPreferenceSchema = z.object({ announcements: z.boolean(), events: z.boolean(), resources: z.boolean() });
export const coachRequestSchema = coachPreferenceSchema.extend({
  slug: z.string().min(3).max(80), email: z.string().trim().email().max(254),
  language: z.enum(['en', 'es']), adult: z.literal(true), origin: z.string().url(),
}).refine(v => v.announcements || v.events || v.resources, 'consent_required');

export function coachUpdatesOrigin(input: string) {
  const url = new URL(input);
  const allowed = ['https://zoheewell.com', 'https://www.zoheewell.com', 'https://gatherwell-team-joy.lovable.app', 'https://id-preview--d56c15d9-a849-4fc3-a192-501da269084f.lovable.app', 'http://localhost:8080'];
  if (!allowed.includes(url.origin) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('invalid_origin');
  return url.origin;
}

export type CoachPreferences = z.infer<typeof coachPreferenceSchema>;
export type CoachPreferenceRecord = { coach: string; confirmed: boolean; announcements: boolean; new_events: boolean; new_resources: boolean };