import { createFileRoute } from '@tanstack/react-router';
import { PlanPage } from '@/components/plan-page';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/plan')({ head: () => gatherwellHead('me'), component: PlanPage });
