import { createFileRoute } from '@tanstack/react-router';
import { SeatsPage } from '@/components/plan-page';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/plan_/seats')({ head: () => gatherwellHead('me'), component: SeatsPage });
