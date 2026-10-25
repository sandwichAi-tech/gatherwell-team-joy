import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ChallengesSection } from '@/components/challenges';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/challenges')({
  validateSearch: z.object({ create: z.boolean().optional() }),
  head: () => gatherwellHead('events'),
  component: Challenges,
});
function Challenges() { const { create } = Route.useSearch(); return <ChallengesSection startCreate={create} />; }