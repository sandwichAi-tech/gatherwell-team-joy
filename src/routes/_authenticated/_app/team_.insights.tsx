import { createFileRoute } from '@tanstack/react-router';
import { InsightsPage } from '@/components/insights-page';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/team_/insights')({ head: () => gatherwellHead('team'), component: InsightsPage });
