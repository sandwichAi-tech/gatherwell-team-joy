import { FeatureRoute } from '@/lib/feature-flags';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ResourceTemplatesPage } from '@/components/resources';
import { gatherwellHead } from '@/lib/gatherwell-head';

const search = z.object({ tab: z.string().optional().catch(undefined) });
export const Route = createFileRoute('/_authenticated/_app/learn_/templates')({ validateSearch: search, head: () => gatherwellHead('learn', 'templatesR.title'), component: Page });
function Page() { const { tab } = Route.useSearch(); return <FeatureRoute flag="feature_learn"><ResourceTemplatesPage tab={tab === 'mine' ? 'mine' : 'starters'} /></FeatureRoute>; }
