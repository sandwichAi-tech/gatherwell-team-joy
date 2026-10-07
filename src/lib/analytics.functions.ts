import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const EVENTS = ['signup', 'onboarding_complete', 'team_joined', 'gathering_created', 'gathering_published', 'rsvp', 'checkin', 'template_launched', 'challenge_checkin', 'badge_earned', 'assistant_used', 'followup_sent', 'upgrade_clicked', 'hero_find_click', 'hero_host_click', 'category_click', 'feed_rsvp_click', 'sticky_cta_click', 'sticky_cta_view', 'location_prompt_accept', 'location_prompt_decline'] as const;

/** Single analytics sink. Reads POSTHOG_KEY; quietly does nothing when it is missing. Never forwards personal data. */
export const sendAnalytics = createServerFn({ method: 'POST' })
  .inputValidator((d) => z.object({ event: z.enum(EVENTS), distinctId: z.string().max(64), props: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean(), z.null()])).optional() }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env['POSTHOG_KEY'];
    if (!key) return { sent: false };
    const host = process.env['POSTHOG_REGION'] === 'us' ? 'https://us.i.posthog.com' : 'https://eu.i.posthog.com';
    try {
      await fetch(`${host}/i/v0/e/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: key, event: data.event, distinct_id: data.distinctId, properties: data.props ?? {} }) });
      return { sent: true };
    } catch { return { sent: false }; }
  });

export type TrackedEvent = (typeof EVENTS)[number];
