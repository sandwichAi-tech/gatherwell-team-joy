import { createFileRoute } from '@tanstack/react-router';
import { MePage } from '@/components/me-page';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/_authenticated/_app/me')({ head: () => gatherwellHead('me'), component: () => <MePage /> });
