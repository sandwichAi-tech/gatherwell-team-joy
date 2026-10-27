import { createFileRoute } from '@tanstack/react-router';
import { TeamPage } from '@/components/team-page';
import { gatherwellHead } from '@/lib/gatherwell-head';
import { validTopicId } from '@/lib/app-link';
import { z } from 'zod';
export const Route = createFileRoute('/_authenticated/_app/team')({
  validateSearch: z.object({ team: z.string().optional().transform(validTopicId).catch(undefined), surface: z.enum(['announcements','chat']).optional().catch(undefined), announcement: z.string().optional().transform(validTopicId).catch(undefined), message: z.string().optional().transform(validTopicId).catch(undefined), panel: z.enum(['members', 'invite', 'edit']).optional().catch(undefined), topic: z.string().optional().transform(validTopicId).catch(undefined) }),
  head: () => gatherwellHead('team'),
  component: () => <TeamPage />,
});
