import { FeatureRoute } from '@/lib/feature-flags';
import { createFileRoute } from '@tanstack/react-router';
import { NetworkPage } from '@/components/network-page';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/network')({ head: () => gatherwellHead('team'), component: () => <FeatureRoute flag="feature_network"><NetworkPage /></FeatureRoute> });
