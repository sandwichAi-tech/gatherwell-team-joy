import { FeatureRoute } from '@/lib/feature-flags';
import { createFileRoute } from '@tanstack/react-router';
import { fallback, zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { ResourcesPage, useCanCreate } from '@/components/resources';
import { parseResourceSearch } from '@/lib/resources';
import { gatherwellHead } from '@/lib/gatherwell-head';

const search = z.object({ tab: fallback(z.string(), 'foryou').optional(), type: fallback(z.string(), 'all').optional(), source: fallback(z.string(), 'all').optional() });
export const Route = createFileRoute('/_authenticated/_app/learn')({ validateSearch: zodValidator(search), head: () => gatherwellHead('learn'), component: Page });
function Page() { return <FeatureRoute flag="feature_learn"><Resources /></FeatureRoute>; }
function Resources() { const canCreate = useCanCreate(); const s = parseResourceSearch(Route.useSearch(), canCreate); return <ResourcesPage tab={s.tab} type={s.type} source={s.source} />; }
