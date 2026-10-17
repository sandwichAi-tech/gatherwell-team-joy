import { FeatureRoute } from '@/lib/feature-flags';
import { createFileRoute } from '@tanstack/react-router';
import { MapPage } from '@/components/map-page';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/team_/map')({ head: () => gatherwellHead('team'), component: () => <FeatureRoute flag="feature_team_map"><MapPage /></FeatureRoute> });
