import { createFileRoute } from '@tanstack/react-router';
import { EmptyPage } from '@/components/gatherwell-pages';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/team')({ head: () => gatherwellHead('team'), component: () => <EmptyPage page="team" /> });
