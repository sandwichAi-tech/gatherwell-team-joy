import { createFileRoute } from '@tanstack/react-router';
import { TeamPage } from '@/components/team-page';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/team')({ head: () => gatherwellHead('team'), component: () => <TeamPage /> });
