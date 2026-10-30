import { FeatureRoute } from '@/lib/feature-flags';
import { createFileRoute } from '@tanstack/react-router';
import { PromoCodesPage } from '@/components/promo-codes';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/promos')({ head: () => gatherwellHead('me'), component: () => <FeatureRoute flag="feature_selling"><PromoCodesPage /></FeatureRoute> });
