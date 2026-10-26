import { createFileRoute } from '@tanstack/react-router';
import { TeamPage } from '@/components/team-page';
import { gatherwellHead } from '@/lib/gatherwell-head';
import { z } from 'zod';
export const Route = createFileRoute('/_authenticated/_app/team')({ validateSearch: z.object({ panel: z.enum(['members', 'invite', 'edit']).optional() }), head: () => gatherwellHead('team'), component: () => <TeamPage /> });
