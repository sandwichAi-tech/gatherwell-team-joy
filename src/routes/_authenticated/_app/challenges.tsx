import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ChallengesSection } from '@/components/challenges';
import { gatherwellHead } from '@/lib/gatherwell-head';
import { useTranslation } from 'react-i18next';
export const Route = createFileRoute('/_authenticated/_app/challenges')({
  validateSearch: z.object({ create: z.boolean().optional() }),
  head: () => gatherwellHead('events', 'challenges.title'),
  component: Challenges,
});
function Challenges() { const { create } = Route.useSearch(); const { t } = useTranslation(); return <div className="page-stack"><h1>{t('challenges.title')}</h1><ChallengesSection startCreate={create ?? false} /></div>; }