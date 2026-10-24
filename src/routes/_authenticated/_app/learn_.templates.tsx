import { FeatureRoute } from '@/lib/feature-flags';
import { createFileRoute } from '@tanstack/react-router';
import { fallback, zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { ResourceTemplatesPage } from '@/components/resources';
import { gatherwellHead } from '@/lib/gatherwell-head';

const search = z.object({ tab: fallback(z.string(), 'starters').optional() });
export const Route = createFileRoute('/_authenticated/_app/learn_/templates')({ validateSearch: zodValidator(search), head: () => gatherwellHead('learn', 'templatesR.title'), component: Page });
function Page() { const { tab } = Route.useSearch(); return <FeatureRoute flag="feature_learn"><ResourceTemplatesPage tab={tab === 'mine' ? 'mine' : 'starters'} /></FeatureRoute>; }
