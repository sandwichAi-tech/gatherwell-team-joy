import { FeatureRoute } from '@/lib/feature-flags';
import { createFileRoute } from '@tanstack/react-router';
import { EarningsPage } from '@/components/plan-page';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/earnings')({ head: () => gatherwellHead('me'), component: () => <FeatureRoute flag="feature_selling"><EarningsPage /></FeatureRoute> });
