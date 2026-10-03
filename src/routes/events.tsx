import { createFileRoute } from '@tanstack/react-router';
import { EmptyPage } from '@/components/gatherwell-pages';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/events')({ head: () => gatherwellHead('events'), component: () => <EmptyPage page="events" /> });
