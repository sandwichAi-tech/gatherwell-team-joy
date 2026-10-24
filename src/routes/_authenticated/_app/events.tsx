import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { EventsPage } from '@/components/events-page';
import { gatherwellHead } from '@/lib/gatherwell-head';

const search = z.object({ tab: z.enum(['upcoming', 'hosting', 'past', 'tickets']).optional() });
export const Route = createFileRoute('/_authenticated/_app/events')({
  validateSearch: search,
  head: () => gatherwellHead('events'),
  component: Events,
});
function Events() { const { tab } = Route.useSearch(); return <EventsPage tab={tab ?? 'upcoming'} />; }
