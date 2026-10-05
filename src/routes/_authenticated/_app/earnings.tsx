import { createFileRoute } from '@tanstack/react-router';
import { EarningsPage } from '@/components/plan-page';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/earnings')({ head: () => gatherwellHead('me'), component: EarningsPage });
