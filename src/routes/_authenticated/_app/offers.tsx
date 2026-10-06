import { createFileRoute } from '@tanstack/react-router';
import { OffersManagePage } from '@/components/offers';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/offers')({ head: () => gatherwellHead('me'), component: OffersManagePage });
