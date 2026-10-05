import { createFileRoute } from '@tanstack/react-router';

// Called hourly by the database scheduler (private token). Drafts follow-ups at 8:00 the morning after each gathering.
export const Route = createFileRoute('/api/public/ai/followups')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get('x-cron-token') ?? '';
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { data } = await supabaseAdmin.from('app_config').select('value').eq('key', 'cron_token').maybeSingle();
        if (!data?.value || token.length !== data.value.length || token !== data.value) return new Response('Unauthorized', { status: 401 });
        const { draftFollowupsForEvent } = await import('@/lib/ai/followups.server');
        const { data: due, error } = await supabaseAdmin.rpc('due_followup_events');
        if (error) return new Response('Lookup failed', { status: 500 });
        let created = 0;
        for (const id of (due ?? []) as unknown as string[]) {
          try { created += (await draftFollowupsForEvent(supabaseAdmin, id)).created; } catch (e) { console.error('[followups] event failed', id, e); }
        }
        return Response.json({ events: (due ?? []).length, created });
      },
    },
  },
});
