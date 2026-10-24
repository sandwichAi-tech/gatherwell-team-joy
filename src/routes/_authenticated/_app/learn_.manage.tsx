import { FeatureRoute } from '@/lib/feature-flags';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { LearnManage } from '@/components/learn-manage';
import { gatherwellHead } from '@/lib/gatherwell-head';
const search = z.object({ tab: z.enum(['tracks', 'recipes', 'progress']).optional().catch(undefined), new: z.string().optional().catch(undefined) });
export const Route = createFileRoute('/_authenticated/_app/learn_/manage')({
  validateSearch: search,
  head: () => gatherwellHead('learn', 'learnHub.manage'),
  component: function Page() { const s = Route.useSearch(); return <FeatureRoute flag="feature_learn"><LearnManage tab={s.tab ?? 'tracks'} newType={s.new} /></FeatureRoute>; },
});
