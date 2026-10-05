import { createFileRoute } from '@tanstack/react-router';
import { processOutbox } from '@/lib/notify/process.server';

// Called every 5 minutes by the database scheduler with a private token stored in the database.
export const Route = createFileRoute('/api/public/outbox/process')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get('x-cron-token') ?? '';
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { data } = await supabaseAdmin.from('app_config').select('value').eq('key', 'cron_token').maybeSingle();
        if (!data?.value || token.length !== data.value.length || token !== data.value) return new Response('Unauthorized', { status: 401 });
        try {
          const result = await processOutbox(150);
          return Response.json(result);
        } catch (e) {
          console.error('[outbox] process error', e);
          return new Response('Processing failed', { status: 500 });
        }
      },
    },
  },
});
