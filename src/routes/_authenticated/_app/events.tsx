import { createFileRoute } from '@tanstack/react-router';
import { EmptyPage } from '@/components/gatherwell-pages';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/events')({ head: () => gatherwellHead('events'), component: () => <EmptyPage page="events" /> });
