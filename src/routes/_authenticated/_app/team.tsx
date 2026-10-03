import { createFileRoute } from '@tanstack/react-router';
import { EmptyPage } from '@/components/gatherwell-pages';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/team')({ head: () => gatherwellHead('team'), component: () => <EmptyPage page="team" /> });
