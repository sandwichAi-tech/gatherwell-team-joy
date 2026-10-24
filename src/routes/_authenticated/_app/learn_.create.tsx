import { FeatureRoute } from '@/lib/feature-flags';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { CreateResourcePage } from '@/components/create-resource';
import { gatherwellHead } from '@/lib/gatherwell-head';

const search = z.object({ type: z.string().optional().catch(undefined) });
export const Route = createFileRoute('/_authenticated/_app/learn_/create')({
  validateSearch: search,
  head: () => gatherwellHead('learn', 'resources.create.title'),
  component: function Page() { return <FeatureRoute flag="feature_learn"><CreateResourcePage type={Route.useSearch().type} /></FeatureRoute>; },
});
