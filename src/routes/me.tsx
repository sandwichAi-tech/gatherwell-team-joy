import { createFileRoute } from '@tanstack/react-router';
import { EmptyPage } from '@/components/gatherwell-pages';
import { gatherwellHead } from '@/lib/gatherwell-head';
export const Route = createFileRoute('/me')({ head: () => gatherwellHead('me'), component: () => <EmptyPage page="me" /> });
