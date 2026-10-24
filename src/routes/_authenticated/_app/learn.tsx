import { FeatureRoute } from '@/lib/feature-flags';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ResourcesPage, useCanCreate } from '@/components/resources';
import { parseResourceSearch } from '@/lib/resources';
import { gatherwellHead } from '@/lib/gatherwell-head';

const search = z.object({ tab: z.string().optional().catch(undefined), type: z.string().optional().catch(undefined), source: z.string().optional().catch(undefined) });
export const Route = createFileRoute('/_authenticated/_app/learn')({ validateSearch: search, head: () => gatherwellHead('learn'), component: Page });
function Page() { return <FeatureRoute flag="feature_learn"><Resources /></FeatureRoute>; }
function Resources() { const canCreate = useCanCreate(); const s = parseResourceSearch(Route.useSearch(), canCreate); return <ResourcesPage tab={s.tab} type={s.type} source={s.source} />; }
