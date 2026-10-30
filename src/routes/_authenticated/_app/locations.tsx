import { FeatureRoute } from '@/lib/feature-flags';
import { createFileRoute } from '@tanstack/react-router';
import { LocationsPage } from '@/components/locations';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/locations')({ head: () => gatherwellHead('me'), component: () => <FeatureRoute flag="feature_locations"><LocationsPage /></FeatureRoute> });
